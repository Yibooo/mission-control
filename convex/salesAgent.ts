"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ─────────────────────────────────────────────────────────────────
// 外部API呼び出しヘルパー
// ─────────────────────────────────────────────────────────────────

async function searchWithTavily(
  apiKey: string,
  query: string,
  maxResults = 5
): Promise<{ title: string; url: string; content: string }[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: maxResults,
      include_answer: false,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tavily API エラー: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.results ?? [];
}

async function generateWithGemini(
  apiKey: string,
  prompt: string,
  maxTokens = 1500
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: maxTokens,
        },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API エラー: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─────────────────────────────────────────────────────────────────
// STEP 1: 企業リストアップ (Tavily × 複数クエリ)
// 戦略: AI系クエリは外し、企業の「会社概要/お問い合わせ」ページを直撃
// ─────────────────────────────────────────────────────────────────

const SEARCH_QUERIES = [
  // 業種×地域で会社概要ページを狙う
  "東京都 渋谷区 株式会社 会社概要 お問い合わせ 小売業",
  "東京都 新宿区 有限会社 会社概要 連絡先 サービス業",
  "東京都 中小企業 株式会社 会社概要 代表取締役 お問い合わせ",
  "神奈川県 横浜市 中小企業 株式会社 会社概要 採用",
  "埼玉県 さいたま市 中小企業 株式会社 事業内容 お問い合わせ",
];

// ─────────────────────────────────────────────────────────────────
// STEP 2: Gemini で企業情報を構造化抽出
// ─────────────────────────────────────────────────────────────────

interface CompanyInfo {
  companyName: string;
  industry: string;
  location: string;
  estimatedSize: string;
  websiteUrl: string;
  contactEmail: string;
  contactName: string;
  researchSummary: string;
}

async function extractCompanyInfo(
  geminiKey: string,
  searchResult: { title: string; url: string; content: string }
): Promise<CompanyInfo | null> {
  // URLからドメインを取得してフォールバック用メアドを作成
  let domain = "";
  try {
    domain = new URL(searchResult.url).hostname.replace("www.", "");
  } catch { /* ignore */ }

  // ニュースサイト・官公庁・個人ブログはスキップ
  const skipDomains = ["pref.", "city.", "news", "nikkei", "yahoo", "google",
    "wikipedia", "ameblo", "livedoor", "hatena", "note.com", "twitter",
    "facebook", "instagram", "linkedin", "github", "youtube", "gov."];
  if (skipDomains.some((s) => searchResult.url.includes(s))) return null;

  const prompt = `
以下の検索結果は日本の企業のWebページです。企業情報をJSONで抽出してください。

検索結果:
タイトル: ${searchResult.title}
URL: ${searchResult.url}
内容: ${searchResult.content.substring(0, 1000)}

抽出ルール:
- companyName: 会社名（「株式会社」「有限会社」等を含む正式名称。見つからなければタイトルから推測）
- industry: 業種（小売業/飲食業/IT・Web/士業/製造業/建設業/医療・介護/教育/サービス業 のいずれか）
- location: 所在地（都道府県+市区町村。見つからなければURLのドメインから推測してよい）
- estimatedSize: 従業員規模（〜10名/10〜50名/50〜100名/不明）
- websiteUrl: "${searchResult.url}"をそのまま使用
- contactEmail: ページ内のメールアドレス。なければ "info@${domain || "company.co.jp"}"
- contactName: 担当者・代表者名（あれば）
- researchSummary: この企業がAIを使うとどんな業務を効率化できるか（具体的に50字以内）
- isCompanyPage: この結果が実際の企業ページかどうか（true/false）

JSON形式のみで回答（コードブロック不要）:
{
  "companyName": "...",
  "industry": "...",
  "location": "...",
  "estimatedSize": "...",
  "websiteUrl": "...",
  "contactEmail": "...",
  "contactName": "",
  "researchSummary": "...",
  "isCompanyPage": true
}
`;

  try {
    const raw = await generateWithGemini(geminiKey, prompt, 700);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as CompanyInfo & { isCompanyPage?: boolean };

    // 企業ページでない / 会社名が空 はスキップ
    if (!parsed.isCompanyPage) return null;
    if (!parsed.companyName || parsed.companyName.length < 2) return null;
    // ニュースや行政のページをフィルタ
    if (parsed.companyName.includes("ニュース") || parsed.companyName.includes("行政")) return null;

    return parsed;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// STEP 3: Gemini でパーソナライズ営業メール生成
// ─────────────────────────────────────────────────────────────────

interface EmailDraft {
  subject: string;
  body: string;
}

async function generateSalesEmail(
  geminiKey: string,
  company: CompanyInfo
): Promise<EmailDraft> {
  const prompt = `
あなたはAI導入支援サービス「AI駆け込み寺」の営業担当です。
以下の企業情報をもとに、自然で押しつけがましくない営業メールを日本語で作成してください。

【企業情報】
会社名: ${company.companyName}
業種: ${company.industry}
所在地: ${company.location}
AI活用の余地: ${company.researchSummary}

【AI駆け込み寺のサービス】
- 無料相談（30分、オンライン）
- AIスターターパック（¥5,000）: ChatGPT/Claude等の初期設定、環境構築、プロンプト設計
- 本格導入・顧問（¥50,000〜/月）
- URL: https://ai-kakekomi-dera.vercel.app

【作成ルール】
1. 件名: 企業固有の課題に言及した30字以内のキャッチーな件名
2. 本文: 200〜280字。書き出しで企業への具体的な言及、課題提示、サービス提案、CTAを含める
3. トーン: 丁寧・親しみやすい・押しつけがましくない
4. 締めは「AI駆け込み寺 / https://ai-kakekomi-dera.vercel.app」

以下のJSON形式のみで回答してください（他のテキスト不要）:
{
  "subject": "件名",
  "body": "本文（\\nで改行）"
}
`;

  try {
    const raw = await generateWithGemini(geminiKey, prompt, 1000);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON解析失敗");
    return JSON.parse(jsonMatch[0]) as EmailDraft;
  } catch {
    // フォールバック: 業種別テンプレート
    return generateFallbackEmail(company);
  }
}

// ─────────────────────────────────────────────────────────────────
// テンプレートフォールバック（Gemini失敗時）
// ─────────────────────────────────────────────────────────────────

function generateFallbackEmail(company: CompanyInfo): EmailDraft {
  const industryTemplates: Record<string, { subject: string; painPoint: string }> = {
    "小売": { subject: `【在庫管理の自動化】${company.companyName}様の業務効率化について`, painPoint: "在庫管理・発注業務の自動化" },
    "飲食": { subject: `【予約・注文管理をAIで効率化】${company.companyName}様へ`, painPoint: "予約管理・メニュー提案の自動化" },
    "IT": { subject: `【社内業務の30%削減】AI活用のご提案 — ${company.companyName}様`, painPoint: "見積・議事録・コード作成の効率化" },
    "士業": { subject: `【書類作成をAIで半分の時間に】${company.companyName}様へのご提案`, painPoint: "契約書・申請書類作成の効率化" },
    "製造": { subject: `【報告書・見積作成をAIで自動化】${company.companyName}様へ`, painPoint: "見積・報告書作成の効率化" },
  };

  const key = Object.keys(industryTemplates).find((k) => company.industry.includes(k)) ?? "IT";
  const template = industryTemplates[key];

  return {
    subject: template.subject,
    body: `ご担当者様

突然のご連絡失礼いたします。中小企業向けAI導入支援「AI駆け込み寺」と申します。

${company.industry}の企業様では、${template.painPoint}にAIを活用して大幅な業務削減を実現する事例が増えています。

まずは30分の無料相談で、${company.companyName}様に合ったAI活用方法をご提案できればと思います。

ご興味があればお気軽にご連絡ください。

━━━━━━━━━━━━
AI駆け込み寺
https://ai-kakekomi-dera.vercel.app
━━━━━━━━━━━━`,
  };
}

// ─────────────────────────────────────────────────────────────────
// メインアクション: 実AI営業エージェント実行
// ─────────────────────────────────────────────────────────────────

export const runSalesAgent = action({
  args: {
    targetArea: v.optional(v.string()),
    maxLeads: v.optional(v.number()),
  },
  handler: async (ctx, { targetArea = "東京都・首都圏", maxLeads = 5 }) => {
    const tavilyKey = process.env.TAVILY_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!tavilyKey) throw new Error("TAVILY_API_KEY が設定されていません");
    if (!geminiKey) throw new Error("GEMINI_API_KEY が設定されていません");

    const results = {
      leadsCreated: 0,
      draftsCreated: 0,
      errors: [] as string[],
    };

    // Prospectorエージェントのステータス更新
    const agents = await ctx.runQuery(api.agents.list);
    const prospector = agents.find((a) => a.name === "Prospector");
    const researcher = agents.find((a) => a.name === "Researcher");
    const copywriter = agents.find((a) => a.name === "Copywriter");

    if (prospector) {
      await ctx.runMutation(api.agents.updateStatus, {
        id: prospector._id,
        status: "working",
        currentTask: `${targetArea}の企業をリサーチ中...`,
      });
      await ctx.runMutation(api.agents.updateActivity, {
        id: prospector._id,
        currentAction: `Tavilyで${targetArea}の企業を検索中...`,
      });
    }

    // ── STEP 1: Tavily で企業を検索 ──
    const allSearchResults: { title: string; url: string; content: string }[] = [];

    for (const query of SEARCH_QUERIES.slice(0, 3)) {
      try {
        const searchResults = await searchWithTavily(tavilyKey, query, 3);
        allSearchResults.push(...searchResults);
        if (allSearchResults.length >= maxLeads * 2) break;
      } catch (e) {
        results.errors.push(`検索エラー: ${String(e)}`);
      }
    }

    if (prospector) {
      await ctx.runMutation(api.agents.updateActivity, {
        id: prospector._id,
        currentAction: `${allSearchResults.length}件の検索結果を取得完了`,
      });
    }

    // 既存リードのURLリストを取得（重複防止）
    const existingLeads = await ctx.runQuery(api.sales.listLeads, {});
    const existingUrls = new Set(existingLeads.map((l) => l.websiteUrl ?? "").filter(Boolean));

    // ── STEP 2 & 3: 企業情報抽出 + メール生成 ──
    let processedCount = 0;

    for (const result of allSearchResults) {
      if (processedCount >= maxLeads) break;

      // 重複チェック
      if (result.url && existingUrls.has(result.url)) continue;

      try {
        // Researcherステータス更新
        if (researcher) {
          await ctx.runMutation(api.agents.updateStatus, {
            id: researcher._id,
            status: "working",
            currentTask: `「${result.title.substring(0, 30)}」を調査中`,
          });
          await ctx.runMutation(api.agents.updateActivity, {
            id: researcher._id,
            currentAction: `${result.url} の企業情報を抽出中...`,
          });
        }

        // Gemini で企業情報を構造化
        const companyInfo = await extractCompanyInfo(geminiKey, result);
        if (!companyInfo) continue;

        // 東京・首都圏フィルター（緩めにチェック）
        const isTargetArea =
          companyInfo.location.includes("東京") ||
          companyInfo.location.includes("神奈川") ||
          companyInfo.location.includes("埼玉") ||
          companyInfo.location.includes("千葉") ||
          companyInfo.location === "";

        if (!isTargetArea) continue;

        // Lead 作成
        const leadId = await ctx.runMutation(api.sales.createLead, {
          companyName: companyInfo.companyName,
          industry: companyInfo.industry,
          location: companyInfo.location || targetArea,
          estimatedSize: companyInfo.estimatedSize || "不明",
          websiteUrl: companyInfo.websiteUrl || result.url,
          contactEmail: companyInfo.contactEmail,
          contactName: companyInfo.contactName || undefined,
          researchSummary: companyInfo.researchSummary,
          source: "tavily_search",
        });

        results.leadsCreated++;
        existingUrls.add(companyInfo.websiteUrl || result.url);

        // Copywriterステータス更新
        if (copywriter) {
          await ctx.runMutation(api.agents.updateStatus, {
            id: copywriter._id,
            status: "working",
            currentTask: `${companyInfo.companyName} 向けメールを生成中`,
          });
          await ctx.runMutation(api.agents.updateActivity, {
            id: copywriter._id,
            currentAction: `${companyInfo.companyName} へのパーソナライズメールを生成中...`,
          });
        }

        // Gemini でメール生成
        const emailDraft = await generateSalesEmail(geminiKey, companyInfo);

        // EmailDraft 作成
        await ctx.runMutation(api.sales.createEmailDraft, {
          leadId,
          subject: emailDraft.subject,
          body: emailDraft.body,
          generatedBy: "agent:Copywriter(Gemini)",
        });

        results.draftsCreated++;
        processedCount++;

        // 過負荷防止: 少し待機
        await new Promise((r) => setTimeout(r, 500));

      } catch (e) {
        results.errors.push(`処理エラー [${result.url}]: ${String(e)}`);
      }
    }

    // ── 完了: エージェントをidle に戻す ──
    for (const agent of [prospector, researcher, copywriter]) {
      if (agent) {
        await ctx.runMutation(api.agents.updateStatus, {
          id: agent._id,
          status: "idle",
          currentTask: undefined,
        });
        await ctx.runMutation(api.agents.updateActivity, {
          id: agent._id,
          currentAction: undefined,
        });
      }
    }

    return results;
  },
});
