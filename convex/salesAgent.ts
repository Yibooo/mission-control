"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ─────────────────────────────────────────────────────────────────
// Tavily側でフィルタするドメイン（ニュース・SNS・求人サイト等）
// ─────────────────────────────────────────────────────────────────
const EXCLUDE_DOMAINS = [
  "nikkei.com", "asahi.com", "yomiuri.co.jp", "mainichi.jp", "nhk.or.jp",
  "sankei.com", "jiji.com", "kyodo.co.jp",
  "yahoo.co.jp", "google.com", "bing.com",
  "hatena.ne.jp", "ameblo.jp", "livedoor.com", "note.com", "blogger.com",
  "twitter.com", "x.com", "facebook.com", "instagram.com", "linkedin.com",
  "youtube.com", "github.com", "wikipedia.org",
  "indeed.com", "glassdoor.com", "recruit.co.jp", "rikunabi.com",
  "mynavi.jp", "doda.jp", "hellowork.mhlw.go.jp",
  "itmedia.co.jp", "techcrunch.com", "cnet.com", "wired.jp",
  "pref.tokyo.lg.jp", "metro.tokyo.lg.jp", "city.shibuya.tokyo.jp",
  "bengo4.com", "keyman.or.jp", "aismiley.jp",
];

// ─────────────────────────────────────────────────────────────────
// 検索クエリ: 「資本金」「設立」は企業ページ固有のキーワード
// ─────────────────────────────────────────────────────────────────
const SEARCH_QUERIES = [
  "東京都 渋谷区 株式会社 代表取締役 資本金 設立",
  "東京都 新宿区 有限会社 代表者 資本金 設立年月",
  "東京都 港区 株式会社 代表取締役社長 資本金 従業員",
  "神奈川県 横浜市 株式会社 代表取締役 資本金 設立",
  "東京都 世田谷区 株式会社 代表取締役 事業内容 資本金",
  "東京都 品川区 有限会社 代表者 設立 事業内容",
  "東京都 墨田区 江東区 株式会社 代表取締役 資本金",
];

// ─────────────────────────────────────────────────────────────────
// API ヘルパー: Tavily / Gemini / Firecrawl
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
      search_depth: "advanced",
      max_results: maxResults,
      include_answer: false,
      exclude_domains: EXCLUDE_DOMAINS,
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
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
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
// Phase 2-D: Firecrawl でお問い合わせフォームURLを特定
// ─────────────────────────────────────────────────────────────────

interface ContactFormResult {
  contactFormUrl: string | null;
  formFields: string | null;   // JSON文字列: { name, email, subject, body ... }
  hasCaptcha: boolean;
}

async function findContactFormWithFirecrawl(
  firecrawlKey: string,
  websiteUrl: string,
  geminiKey: string
): Promise<ContactFormResult> {
  const empty: ContactFormResult = { contactFormUrl: null, formFields: null, hasCaptcha: false };

  try {
    // STEP 1: トップページをスクレイプしてリンク一覧を取得
    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify({
        url: websiteUrl,
        formats: ["links"],
        timeout: 20000,
      }),
    });

    if (!scrapeRes.ok) return empty;
    const scrapeData = await scrapeRes.json();
    const links: string[] = scrapeData.data?.links ?? [];

    // STEP 2: お問い合わせ系リンクを探す
    const contactKeywords = [
      "contact", "お問い合わせ", "inquiry", "inquire",
      "問合せ", "問い合わせ", "toiawase", "otoiawase", "contact-us",
    ];
    const contactUrl = links.find((link) =>
      contactKeywords.some((kw) => link.toLowerCase().includes(kw))
    );

    if (!contactUrl) {
      // リンクにない場合: よくあるパスを直接試す
      const origin = new URL(websiteUrl).origin;
      const guessUrls = [
        `${origin}/contact`,
        `${origin}/contact/`,
        `${origin}/inquiry`,
        `${origin}/お問い合わせ`,
      ];
      // 最初のguessを使用（実際の検証は省略）
      return { contactFormUrl: guessUrls[0], formFields: null, hasCaptcha: false };
    }

    // STEP 3: お問い合わせページをスクレイプしてフォーム構造を解析
    const formRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify({
        url: contactUrl,
        formats: ["markdown"],
        timeout: 20000,
      }),
    });

    if (!formRes.ok) return { contactFormUrl: contactUrl, formFields: null, hasCaptcha: false };
    const formData = await formRes.json();
    const markdown = formData.data?.markdown ?? "";

    // STEP 4: CAPTCHAの検出
    const captchaKeywords = ["captcha", "recaptcha", "hcaptcha", "robot", "ロボット", "認証"];
    const hasCaptcha = captchaKeywords.some((kw) => markdown.toLowerCase().includes(kw));
    if (hasCaptcha) {
      return { contactFormUrl: contactUrl, formFields: null, hasCaptcha: true };
    }

    // STEP 5: Gemini でフォームフィールド構造を抽出
    const fieldPrompt = `以下はお問い合わせフォームページのMarkdownです。
フォームに含まれる入力フィールドを特定して、JSON形式で返してください。

Markdownの内容:
${markdown.substring(0, 2000)}

よくあるフィールド例: お名前、会社名、メールアドレス、電話番号、件名、お問い合わせ内容

JSONのみで回答（コードブロック不要）:
{
  "fields": [
    {"label": "お名前", "type": "text", "required": true},
    {"label": "メールアドレス", "type": "email", "required": true},
    {"label": "件名", "type": "text", "required": false},
    {"label": "お問い合わせ内容", "type": "textarea", "required": true}
  ],
  "hasPrivacyCheckbox": false
}`;

    try {
      const raw = await generateWithGemini(geminiKey, fieldPrompt, 600);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { contactFormUrl: contactUrl, formFields: jsonMatch[0], hasCaptcha: false };
      }
    } catch { /* フォームフィールド解析失敗は無視 */ }

    return { contactFormUrl: contactUrl, formFields: null, hasCaptcha: false };

  } catch {
    return empty;
  }
}

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
  let domain = "";
  try {
    domain = new URL(searchResult.url).hostname.replace("www.", "");
  } catch { /* ignore */ }

  // .co.jp / .jp ドメインは企業ページとして優先信頼
  const isCojpDomain = domain.endsWith(".co.jp") || domain.endsWith(".jp");

  // タイトルに含まれるニュース・まとめ系キーワードでスキップ
  const skipTitleWords = ["ニュース", "速報", "まとめ", "ランキング", "一覧", "比較",
    "おすすめ", "プレスリリース", "転職", "求人", "掲示板"];
  if (skipTitleWords.some((w) => searchResult.title.includes(w))) return null;

  const prompt = `以下のWebページから日本の企業情報をJSONで抽出してください。

ページ情報:
タイトル: ${searchResult.title}
URL: ${searchResult.url}
内容: ${searchResult.content.substring(0, 1200)}

抽出ルール:
- companyName: 会社名（「株式会社」「有限会社」等含む正式名称。不明ならタイトルから推測）
- industry: 業種（小売業/飲食業/IT・Web/士業/製造業/建設業/医療・介護/教育/サービス業のいずれか）
- location: 都道府県+市区町村（不明な場合は "東京都"）
- estimatedSize: 従業員規模（〜10名/10〜50名/50〜100名/不明）
- websiteUrl: "${searchResult.url}"をそのまま使用
- contactEmail: ページ内のメアド。なければ "info@${domain || "example.co.jp"}"
- contactName: 代表者・担当者名（あれば）、なければ空文字
- researchSummary: AIで効率化できる業務（50字以内）
- isCompanyPage: 企業・店舗・個人事業・NPOのページならtrue。ニュース・求人・比較サイト・官公庁・個人ブログならfalse

重要: .co.jp や .jp ドメインは基本的に企業サイトなのでisCompanyPage=trueにしてください。

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
}`;

  try {
    const raw = await generateWithGemini(geminiKey, prompt, 700);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as CompanyInfo & { isCompanyPage?: boolean };

    // .co.jp ドメインはGeminiがfalseと言っても信頼
    if (parsed.isCompanyPage === false && !isCojpDomain) return null;
    if (!parsed.companyName || parsed.companyName.length < 2) return null;
    const skipNames = ["ニュース", "行政", "一覧", "まとめ", "比較"];
    if (skipNames.some((w) => parsed.companyName.includes(w))) return null;

    return parsed;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// STEP 3: Gemini でパーソナライズ問い合わせ文章生成
// ─────────────────────────────────────────────────────────────────

interface MessageDraft {
  subject: string;
  body: string;
}

async function generateSalesMessage(
  geminiKey: string,
  company: CompanyInfo
): Promise<MessageDraft> {
  const prompt = `あなたはAI導入支援サービス「AI駆け込み寺」の営業担当です。
以下の企業情報をもとに、企業のお問い合わせフォームに入力する営業メッセージを作成してください。

【企業情報】
会社名: ${company.companyName}
業種: ${company.industry}
所在地: ${company.location}
AI活用の余地: ${company.researchSummary}

【AI駆け込み寺のサービス】
- 無料相談（30分、オンライン）
- AIスターターパック（¥5,000）: ChatGPT/Claude等の初期設定・プロンプト設計
- 本格導入・顧問（¥50,000〜/月）
- URL: https://ai-kakekomi-dera.vercel.app

【作成ルール】
1. 件名（subject）: 企業固有の課題に言及した30字以内の件名
2. 本文（body）: 200〜280字。書き出しで企業への具体的な言及、課題提示、サービス提案、CTAを含める
3. トーン: 丁寧・親しみやすい・押しつけがましくない
4. 締めは「AI駆け込み寺 / https://ai-kakekomi-dera.vercel.app」
5. フォーム送信を想定（「メール」という表現を避け、「ご連絡」「お問い合わせ」を使う）

JSON形式のみで回答（他のテキスト不要）:
{"subject":"件名","body":"本文（\\nで改行）"}`;

  try {
    const raw = await generateWithGemini(geminiKey, prompt, 1000);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON解析失敗");
    return JSON.parse(jsonMatch[0]) as MessageDraft;
  } catch {
    return generateFallbackMessage(company);
  }
}

function generateFallbackMessage(company: CompanyInfo): MessageDraft {
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
    body: `ご担当者様\n\n突然のご連絡失礼いたします。中小企業向けAI導入支援「AI駆け込み寺」と申します。\n\n${company.industry}の企業様では、${template.painPoint}にAIを活用して大幅な業務削減を実現する事例が増えています。\n\nまずは30分の無料相談で、${company.companyName}様に合ったAI活用方法をご提案できればと思います。\n\nご興味があればお気軽にお問い合わせください。\n\n━━━━━━━━━━━━\nAI駆け込み寺\nhttps://ai-kakekomi-dera.vercel.app\n━━━━━━━━━━━━`,
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
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;

    if (!tavilyKey) throw new Error("TAVILY_API_KEY が設定されていません");
    if (!geminiKey) throw new Error("GEMINI_API_KEY が設定されていません");
    // firecrawlKey はオプション（なければフォーム発見はスキップ）

    const results = {
      leadsCreated: 0,
      draftsCreated: 0,
      formUrlsFound: 0,     // フォームURL発見数
      captchaDetected: 0,   // CAPTCHA検出数
      errors: [] as string[],
      debug: {
        searchResultsTotal: 0,
        skippedByTitle: 0,
        skippedNotCompany: 0,
        skippedDuplicate: 0,
        processedUrls: [] as string[],
      },
    };

    // エージェントのステータス更新
    const agents = await ctx.runQuery(api.agents.list);
    const prospector = agents.find((a) => a.name === "Prospector");
    const researcher = agents.find((a) => a.name === "Researcher");
    const copywriter = agents.find((a) => a.name === "Copywriter");

    if (prospector) {
      await ctx.runMutation(api.agents.updateStatus, {
        id: prospector._id, status: "working",
        currentTask: `${targetArea}の企業をリサーチ中...`,
      });
      await ctx.runMutation(api.agents.updateActivity, {
        id: prospector._id,
        currentAction: `Tavilyで${targetArea}の企業を検索中...`,
      });
    }

    // ── STEP 1: Tavily で企業を検索 ──
    const allSearchResults: { title: string; url: string; content: string }[] = [];

    for (const query of SEARCH_QUERIES.slice(0, 4)) {
      try {
        const searchResults = await searchWithTavily(tavilyKey, query, 5);
        allSearchResults.push(...searchResults);
        results.debug.searchResultsTotal += searchResults.length;
        if (allSearchResults.length >= maxLeads * 4) break;
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

    // ── STEP 2〜4: 企業情報抽出 + フォーム発見 + 文章生成 ──
    let processedCount = 0;

    for (const result of allSearchResults) {
      if (processedCount >= maxLeads) break;

      if (result.url && existingUrls.has(result.url)) {
        results.debug.skippedDuplicate++;
        continue;
      }

      const skipTitleWords = ["ニュース", "速報", "まとめ", "ランキング", "一覧", "比較", "おすすめ", "転職", "求人"];
      if (skipTitleWords.some((w) => result.title.includes(w))) {
        results.debug.skippedByTitle++;
        continue;
      }

      results.debug.processedUrls.push(result.url);

      try {
        // STEP 2: Gemini で企業情報を構造化抽出
        if (researcher) {
          await ctx.runMutation(api.agents.updateStatus, {
            id: researcher._id, status: "working",
            currentTask: `「${result.title.substring(0, 30)}」を調査中`,
          });
          await ctx.runMutation(api.agents.updateActivity, {
            id: researcher._id,
            currentAction: `${result.url} の企業情報を抽出中...`,
          });
        }

        const companyInfo = await extractCompanyInfo(geminiKey, result);
        if (!companyInfo) {
          results.debug.skippedNotCompany++;
          continue;
        }

        // STEP 3: Firecrawl でお問い合わせフォームURLを特定
        let contactFormUrl: string | undefined;
        let formFields: string | undefined;
        let hasCaptcha = false;

        if (firecrawlKey && companyInfo.websiteUrl) {
          if (researcher) {
            await ctx.runMutation(api.agents.updateActivity, {
              id: researcher._id,
              currentAction: `${companyInfo.companyName} のお問い合わせフォームを検索中...`,
            });
          }
          const formResult = await findContactFormWithFirecrawl(
            firecrawlKey,
            companyInfo.websiteUrl,
            geminiKey
          );
          contactFormUrl = formResult.contactFormUrl ?? undefined;
          formFields = formResult.formFields ?? undefined;
          hasCaptcha = formResult.hasCaptcha;

          if (contactFormUrl) results.formUrlsFound++;
          if (hasCaptcha) results.captchaDetected++;
        }

        // Lead 作成
        const leadId = await ctx.runMutation(api.sales.createLead, {
          companyName: companyInfo.companyName,
          industry: companyInfo.industry,
          location: companyInfo.location || targetArea,
          estimatedSize: companyInfo.estimatedSize || "不明",
          websiteUrl: companyInfo.websiteUrl || result.url,
          contactFormUrl,
          formFields,
          contactEmail: companyInfo.contactEmail,
          contactName: companyInfo.contactName || undefined,
          researchSummary: companyInfo.researchSummary,
          source: "tavily_search",
        });

        results.leadsCreated++;
        existingUrls.add(companyInfo.websiteUrl || result.url);

        // CAPTCHA検出の場合はステータスを captcha_required に更新
        if (hasCaptcha) {
          await ctx.runMutation(api.sales.updateLeadStatus, {
            id: leadId,
            status: "captcha_required",
            notes: "CAPTCHAが検出されました。手動でフォームを送信してください。",
          });
        }

        // STEP 4: Gemini で問い合わせ文章を生成
        if (copywriter) {
          await ctx.runMutation(api.agents.updateStatus, {
            id: copywriter._id, status: "working",
            currentTask: `${companyInfo.companyName} 向けメッセージを生成中`,
          });
          await ctx.runMutation(api.agents.updateActivity, {
            id: copywriter._id,
            currentAction: `${companyInfo.companyName} へのパーソナライズ文章を生成中...`,
          });
        }

        const messageDraft = await generateSalesMessage(geminiKey, companyInfo);

        await ctx.runMutation(api.sales.createEmailDraft, {
          leadId,
          subject: messageDraft.subject,
          body: messageDraft.body,
          generatedBy: "agent:Copywriter(Gemini)",
        });

        results.draftsCreated++;
        processedCount++;

        await new Promise((r) => setTimeout(r, 300));

      } catch (e) {
        results.errors.push(`処理エラー [${result.url}]: ${String(e)}`);
      }
    }

    // ── 完了: エージェントをidle に戻す ──
    for (const agent of [prospector, researcher, copywriter]) {
      if (agent) {
        await ctx.runMutation(api.agents.updateStatus, {
          id: agent._id, status: "idle", currentTask: undefined,
        });
        await ctx.runMutation(api.agents.updateActivity, {
          id: agent._id, currentAction: undefined,
        });
      }
    }

    return results;
  },
});
