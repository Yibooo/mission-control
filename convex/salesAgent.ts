"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ─────────────────────────────────────────────────────────────────
// 旅館業界特化 — 関東圏の老舗旅館・温泉旅館
// 旅行OTA・まとめサイトは除外して公式サイトのみ狙う
// ─────────────────────────────────────────────────────────────────

const EXCLUDE_DOMAINS = [
  // 大手旅行OTA（公式サイトではないのでスキップ）
  "jalan.net", "ikyu.com", "rurubu.com", "relux.jp", "jtb.co.jp",
  "booking.com", "expedia.co.jp", "hotels.com", "agoda.com", "airbnb.jp",
  "tripadvisor.jp", "4travel.jp", "travel.rakuten.co.jp", "travel.yahoo.co.jp",
  "dtrip.jp", "kkday.com", "veltra.com",
  // 旅行まとめ・比較
  "allabout.co.jp", "jorudan.co.jp", "navitime.co.jp",
  "mapion.co.jp", "walkerplus.com", "timeout.jp",
  // ニュース・ブログ・SNS
  "nikkei.com", "asahi.com", "yomiuri.co.jp", "nhk.or.jp", "mainichi.jp",
  "hatena.ne.jp", "ameblo.jp", "note.com", "livedoor.com",
  "twitter.com", "x.com", "facebook.com", "instagram.com", "youtube.com",
  "wikipedia.org", "yahoo.co.jp", "google.com", "bing.com",
];

// ─────────────────────────────────────────────────────────────────
// 検索クエリ: 「公式サイト」+ 「お問い合わせ」で直接ヒットさせる
// 温泉地名を具体的に指定し、OTAではなく旅館公式を狙う
// ─────────────────────────────────────────────────────────────────

const SEARCH_QUERIES = [
  "箱根温泉 旅館 公式サイト お問い合わせ",
  "草津温泉 旅館 公式サイト お問い合わせ 宿泊",
  "伊香保温泉 旅館 公式サイト お問い合わせ",
  "那須温泉 旅館 公式サイト お問い合わせ",
  "鬼怒川温泉 旅館 公式サイト お問い合わせ",
  "熱海温泉 旅館 公式サイト お問い合わせ",
  "湯河原温泉 旅館 公式サイト お問い合わせ",
  "修善寺温泉 旅館 公式サイト お問い合わせ",
  "四万温泉 旅館 公式サイト お問い合わせ",
  "日光温泉 旅館 公式サイト お問い合わせ",
];

// ─────────────────────────────────────────────────────────────────
// API ヘルパー
// ─────────────────────────────────────────────────────────────────

async function searchWithTavily(
  apiKey: string, query: string, maxResults = 5
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
  if (!res.ok) throw new Error(`Tavily: ${res.status} ${await res.text()}`);
  return (await res.json()).results ?? [];
}

async function generateWithGemini(
  apiKey: string, prompt: string, maxTokens = 1500
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function firecrawlScrape(
  apiKey: string,
  url: string,
  formats: string[],
  actions?: object[]
): Promise<{ markdown?: string; html?: string; links?: string[] }> {
  const body: Record<string, unknown> = { url, formats, timeout: 25000 };
  if (actions?.length) body.actions = actions;

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return {};
  const data = await res.json();
  return data.data ?? {};
}

// ─────────────────────────────────────────────────────────────────
// STEP 1: 旅館情報を Gemini で抽出
// ─────────────────────────────────────────────────────────────────

interface RyokanInfo {
  companyName: string;
  location: string;
  websiteUrl: string;
  contactEmail: string;
  researchSummary: string;
  isRyokan: boolean;  // 旅館・温泉旅館かどうか
}

async function extractRyokanInfo(
  geminiKey: string,
  searchResult: { title: string; url: string; content: string }
): Promise<RyokanInfo | null> {
  let domain = "";
  try { domain = new URL(searchResult.url).hostname.replace("www.", ""); } catch { /* skip */ }

  // 大手OTAのURLはスキップ（EXCLUDE_DOMAINSで弾けなかった分）
  const otaKeywords = ["jalan", "ikyu", "booking", "tripadvisor", "rakuten", "expedia", "relux"];
  if (otaKeywords.some(k => searchResult.url.includes(k))) return null;

  // タイトルがランキング・まとめ系ならスキップ
  const skipTitle = ["ランキング", "おすすめ", "厳選", "まとめ", "一覧", "比較", "口コミ", "人気旅館"];
  if (skipTitle.some(w => searchResult.title.includes(w))) return null;

  const prompt = `以下のWebページは日本の旅館・温泉旅館の公式サイトです。情報をJSONで抽出してください。

タイトル: ${searchResult.title}
URL: ${searchResult.url}
内容: ${searchResult.content.substring(0, 1200)}

抽出ルール:
- companyName: 旅館名（「旅館」「温泉旅館」「○○の宿」等を含む正式名称）
- location: 都道府県+温泉地名（例: 神奈川県箱根温泉、群馬県草津温泉）
- websiteUrl: "${searchResult.url}"をそのまま使用
- contactEmail: ページ内のメアド。なければ "info@${domain}"
- researchSummary: この旅館がAIを活用できる業務（50字以内。例:「予約管理・口コミ返信・多言語対応をAIで効率化できる」）
- isRyokan: 旅館・ホテル・宿の公式サイトかつ個人経営〜中小規模ならtrue。OTAや比較サイト・ニュースはfalse

旅館の公式サイトのドメインは .co.jp/.jp/.com 等様々なので、内容で判断してください。

JSONのみで回答:
{
  "companyName": "○○温泉旅館",
  "location": "神奈川県箱根温泉",
  "websiteUrl": "https://...",
  "contactEmail": "info@...",
  "researchSummary": "...",
  "isRyokan": true
}`;

  try {
    const raw = await generateWithGemini(geminiKey, prompt, 600);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as RyokanInfo;
    if (!parsed.isRyokan) return null;
    if (!parsed.companyName || parsed.companyName.length < 2) return null;
    return parsed;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────
// STEP 2: Firecrawl でお問い合わせフォーム構造を発見・解析
// Phase 2-D の核心部分
// ─────────────────────────────────────────────────────────────────

interface FieldMapping {
  selector: string;      // CSS selector (例: "[name='your-name']", "#contact-name")
  label: string;         // 日本語ラベル
  role: "name" | "email" | "company" | "phone" | "subject" | "message" | "other";
  inputType: string;     // text / email / tel / textarea
}

interface ContactFormStructure {
  contactFormUrl: string;
  formActionUrl: string;   // <form action="..."> の値
  submitSelector: string;  // 送信ボタンのCSSセレクタ
  fields: FieldMapping[];
  hasCaptcha: boolean;
  hasNonce: boolean;       // WordPress nonce等、動的トークンがあるか
}

async function discoverContactForm(
  firecrawlKey: string,
  websiteUrl: string,
  geminiKey: string
): Promise<ContactFormStructure | null> {

  // ── Phase A: トップページからお問い合わせリンクを探す ──
  const mainPage = await firecrawlScrape(firecrawlKey, websiteUrl, ["links"]);
  const links: string[] = mainPage.links ?? [];

  const contactKeywords = [
    "contact", "inquiry", "お問い合わせ", "問合せ", "toiawase",
    "otoiawase", "contact-us", "inquiry-form", "form",
  ];

  // ドメインのoriginを取得
  let origin = websiteUrl;
  try { origin = new URL(websiteUrl).origin; } catch { /* skip */ }

  // リンクからお問い合わせページを探す
  let contactUrl: string | null = links.find(l =>
    contactKeywords.some(k => l.toLowerCase().includes(k))
  ) ?? null;

  // 見つからない場合はよくあるパスを試す
  if (!contactUrl) {
    const guessPaths = ["/contact", "/inquiry", "/contact/", "/inquiry/",
      "/form", "/otoiawase", "/contactus"];
    contactUrl = `${origin}${guessPaths[0]}`; // 最初の候補を使用
  }

  // ── Phase B: お問い合わせページのHTMLを取得 ──
  const contactPage = await firecrawlScrape(firecrawlKey, contactUrl, ["html", "markdown"]);
  const html = contactPage.html ?? "";
  const markdown = contactPage.markdown ?? "";

  if (!html && !markdown) return null;

  // ── Phase C: CAPTCHA / nonce を検出（旅館サイトはほぼ100%CAPTCHA有り）──
  const htmlLower = html.toLowerCase();
  // reCAPTCHA v3（不可視）もv2（チェックボックス）も検出
  const hasCaptcha = [
    "captcha", "recaptcha", "hcaptcha", "g-recaptcha",
    "grecaptcha", "recaptcha-v3", "capcha",   // typoも含む
    "認証コード", "画像認証",
  ].some(k => htmlLower.includes(k));
  // Snow Monkey Forms / CF7 / nonce 等の動的トークン検出
  const hasNonce = [
    "_wpnonce", "wpcf7_sec_id", "nonce", "snow-monkey",
    "smf-", "mw-wp-form",
  ].some(k => htmlLower.includes(k));

  // ── Phase D: Gemini でフォームのCSSセレクタを抽出 ──
  const selectorPrompt = `以下はお問い合わせフォームページのHTMLです。
フォームの詳細をJSONで返してください。

HTML（先頭3000文字）:
${html.substring(0, 3000)}

抽出ルール:
- formActionUrl: <form>タグのaction属性のURL。相対パスなら "${origin}" を補完して絶対URLにする。なければ "${contactUrl}"
- submitSelector: 送信ボタンのCSSセレクタ（例: "[type='submit']", ".submit-btn", "#submit"）
- fields: 各入力フィールドの情報
  - selector: その要素を特定できるCSSセレクタ（name属性があれば [name='xxx'] を優先）
  - label: そのフィールドの日本語ラベル
  - role: フィールドの役割 ("name"=名前/"email"=メアド/"company"=会社名/"phone"=電話/"subject"=件名/"message"=問い合わせ内容/"other")
  - inputType: "text" / "email" / "tel" / "textarea" のいずれか

JSONのみで回答（コードブロック不要）:
{
  "formActionUrl": "https://...",
  "submitSelector": "[type='submit']",
  "fields": [
    {"selector": "[name='your-name']", "label": "お名前", "role": "name", "inputType": "text"},
    {"selector": "[name='your-email']", "label": "メールアドレス", "role": "email", "inputType": "email"},
    {"selector": "[name='your-subject']", "label": "件名", "role": "subject", "inputType": "text"},
    {"selector": "[name='your-message']", "label": "お問い合わせ内容", "role": "message", "inputType": "textarea"}
  ]
}`;

  try {
    const raw = await generateWithGemini(geminiKey, selectorPrompt, 800);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { formActionUrl: string; submitSelector: string; fields: FieldMapping[] };

    // messageフィールドが存在するか確認（最低限必要）
    const hasMessageField = parsed.fields?.some(f => f.role === "message");
    if (!hasMessageField || !parsed.fields?.length) return null;

    return {
      contactFormUrl: contactUrl,
      formActionUrl: parsed.formActionUrl || contactUrl,
      submitSelector: parsed.submitSelector || "[type='submit']",
      fields: parsed.fields,
      hasCaptcha,
      hasNonce,
    };
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────
// STEP 3: Gemini で旅館向けパーソナライズ営業メッセージを生成
// ─────────────────────────────────────────────────────────────────

interface MessageDraft {
  subject: string;
  body: string;
}

async function generateRyokanSalesMessage(
  geminiKey: string,
  ryokan: RyokanInfo
): Promise<MessageDraft> {
  const prompt = `あなたはAI導入支援サービス「AI駆け込み寺」の営業担当です。
以下の旅館情報をもとに、お問い合わせフォームに入力する営業文章を作成してください。

【旅館情報】
旅館名: ${ryokan.companyName}
所在地: ${ryokan.location}
AI活用の余地: ${ryokan.researchSummary}

【AI駆け込み寺のサービス】
- 無料相談（30分、オンライン）
- AIスターターパック（¥5,000）: ChatGPT/Claude等の初期設定・プロンプト設計
- 本格導入・顧問（¥50,000〜/月）
- URL: https://ai-kakekomi-dera.vercel.app

【旅館業界でAIが役立つシーン（本文で必ず1〜2つ言及すること）】
- 予約・問い合わせへの自動返信（メール・電話対応の負担軽減）
- 口コミ・レビューへの返信文の自動生成（Google・じゃらん・楽天）
- 多言語対応（外国人観光客向けの案内・FAQの自動翻訳）
- 季節限定プランや客室案内のコンテンツ自動生成
- スタッフの引き継ぎ・マニュアル文書の整備

【作成ルール】
1. subject: 旅館固有の課題に言及した30字以内の件名
2. body: 200〜280字。旅館名への具体的な言及→課題提示→AI活用提案→CTA
3. トーン: 丁寧・親しみやすい・押しつけがましくない
4. 「旅館様」と呼びかける（メール・メールアドレス等の表現は使わない）
5. 締めは「AI駆け込み寺 / https://ai-kakekomi-dera.vercel.app」

JSONのみで回答:
{"subject":"件名","body":"本文（\\nで改行）"}`;

  try {
    const raw = await generateWithGemini(geminiKey, prompt, 1000);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON解析失敗");
    return JSON.parse(match[0]) as MessageDraft;
  } catch {
    return {
      subject: `【予約管理・口コミ返信の自動化】${ryokan.companyName}様へのご提案`,
      body: `ご担当者様\n\n突然のご連絡失礼いたします。中小企業向けAI導入支援「AI駆け込み寺」と申します。\n\n旅館様では、予約・問い合わせへの返信や口コミへの対応に多くの時間を費やされているケースが多くあります。AIを活用することで、これらの業務を大幅に効率化し、接客サービスに集中できる体制を作ることが可能です。\n\nまずは30分の無料相談で、${ryokan.companyName}様に合ったAI活用方法をご提案できればと思います。\n\n━━━━━━━━━━━━\nAI駆け込み寺\nhttps://ai-kakekomi-dera.vercel.app\n━━━━━━━━━━━━`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// メインアクション: 旅館リード発掘 + フォーム構造解析 + 文章生成
// ─────────────────────────────────────────────────────────────────

export const runSalesAgent = action({
  args: {
    targetArea: v.optional(v.string()),
    maxLeads: v.optional(v.number()),
  },
  handler: async (ctx, { targetArea = "関東圏温泉旅館", maxLeads = 5 }) => {
    const tavilyKey = process.env.TAVILY_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;

    if (!tavilyKey) throw new Error("TAVILY_API_KEY が設定されていません");
    if (!geminiKey) throw new Error("GEMINI_API_KEY が設定されていません");

    const results = {
      leadsCreated: 0,
      draftsCreated: 0,
      formUrlsFound: 0,
      captchaDetected: 0,
      errors: [] as string[],
      debug: {
        searchResultsTotal: 0,
        skippedOTA: 0,
        skippedNotRyokan: 0,
        skippedDuplicate: 0,
        processedUrls: [] as string[],
      },
    };

    const agents = await ctx.runQuery(api.agents.list);
    const prospector = agents.find(a => a.name === "Prospector");
    const researcher = agents.find(a => a.name === "Researcher");
    const copywriter = agents.find(a => a.name === "Copywriter");

    if (prospector) {
      await ctx.runMutation(api.agents.updateStatus, {
        id: prospector._id, status: "working",
        currentTask: `${targetArea}の旅館を検索中...`,
      });
      await ctx.runMutation(api.agents.updateActivity, {
        id: prospector._id,
        currentAction: "Tavilyで関東圏の温泉旅館を検索中...",
      });
    }

    // ── STEP 1: Tavily 検索 ──
    const allResults: { title: string; url: string; content: string }[] = [];
    for (const query of SEARCH_QUERIES.slice(0, 4)) {
      try {
        const res = await searchWithTavily(tavilyKey, query, 5);
        allResults.push(...res);
        results.debug.searchResultsTotal += res.length;
        if (allResults.length >= maxLeads * 4) break;
      } catch (e) {
        results.errors.push(`検索エラー: ${String(e)}`);
      }
    }

    if (prospector) {
      await ctx.runMutation(api.agents.updateActivity, {
        id: prospector._id,
        currentAction: `${allResults.length}件の候補を取得完了`,
      });
    }

    const existingLeads = await ctx.runQuery(api.sales.listLeads, {});
    const existingUrls = new Set(existingLeads.map(l => l.websiteUrl ?? "").filter(Boolean));

    // ── STEP 2〜4: 旅館情報抽出 → フォーム発見 → 文章生成 ──
    let processedCount = 0;

    for (const result of allResults) {
      if (processedCount >= maxLeads) break;
      if (result.url && existingUrls.has(result.url)) {
        results.debug.skippedDuplicate++;
        continue;
      }

      results.debug.processedUrls.push(result.url);

      try {
        // ── STEP 2: 旅館情報を抽出（Gemini） ──
        if (researcher) {
          await ctx.runMutation(api.agents.updateActivity, {
            id: researcher._id,
            currentAction: `「${result.title.substring(0, 25)}」を旅館公式か確認中...`,
          });
        }

        const ryokanInfo = await extractRyokanInfo(geminiKey, result);
        if (!ryokanInfo) {
          results.debug.skippedNotRyokan++;
          continue;
        }

        // ── STEP 3: Firecrawl でフォーム構造を発見 ──
        let formStructure: ContactFormStructure | null = null;
        let contactFormUrl: string | undefined;
        let formFields: string | undefined;

        if (firecrawlKey) {
          if (researcher) {
            await ctx.runMutation(api.agents.updateActivity, {
              id: researcher._id,
              currentAction: `${ryokanInfo.companyName} のお問い合わせフォームを解析中...`,
            });
          }
          try {
            formStructure = await discoverContactForm(
              firecrawlKey, ryokanInfo.websiteUrl, geminiKey
            );
            if (formStructure) {
              contactFormUrl = formStructure.contactFormUrl;
              formFields = JSON.stringify(formStructure);  // 全構造を保存
              results.formUrlsFound++;
              if (formStructure.hasCaptcha) results.captchaDetected++;
            }
          } catch (e) {
            results.errors.push(`フォーム発見エラー [${ryokanInfo.companyName}]: ${String(e)}`);
          }
        }

        // ── Lead 作成 ──
        const leadId = await ctx.runMutation(api.sales.createLead, {
          companyName: ryokanInfo.companyName,
          industry: "宿泊業・旅館",
          location: ryokanInfo.location || targetArea,
          estimatedSize: "〜50名",
          websiteUrl: ryokanInfo.websiteUrl,
          contactFormUrl,
          formFields,
          contactEmail: ryokanInfo.contactEmail,
          researchSummary: ryokanInfo.researchSummary,
          source: "tavily_search",
        });

        results.leadsCreated++;
        existingUrls.add(ryokanInfo.websiteUrl);

        // CAPTCHA検出時はステータス変更
        if (formStructure?.hasCaptcha) {
          await ctx.runMutation(api.sales.updateLeadStatus, {
            id: leadId, status: "captcha_required",
            notes: "CAPTCHAを検出。手動でフォームから送信してください。",
          });
        }

        // ── STEP 4: 旅館向け営業文章を生成（Gemini） ──
        if (copywriter) {
          await ctx.runMutation(api.agents.updateStatus, {
            id: copywriter._id, status: "working",
            currentTask: `${ryokanInfo.companyName} 向けメッセージを生成中`,
          });
        }

        const draft = await generateRyokanSalesMessage(geminiKey, ryokanInfo);
        await ctx.runMutation(api.sales.createEmailDraft, {
          leadId,
          subject: draft.subject,
          body: draft.body,
          generatedBy: "agent:Copywriter(Gemini)",
        });

        results.draftsCreated++;
        processedCount++;

        await new Promise(r => setTimeout(r, 400));

      } catch (e) {
        results.errors.push(`処理エラー [${result.url}]: ${String(e)}`);
      }
    }

    // 完了 → エージェントを idle に戻す
    for (const agent of [prospector, researcher, copywriter]) {
      if (agent) {
        await ctx.runMutation(api.agents.updateStatus, { id: agent._id, status: "idle", currentTask: undefined });
        await ctx.runMutation(api.agents.updateActivity, { id: agent._id, currentAction: undefined });
      }
    }

    return results;
  },
});

// ─────────────────────────────────────────────────────────────────
// フォーム送信アクション: 人間の承認後に呼び出す
// Firecrawl actions で CSS セレクタを使って自動入力・送信
// ─────────────────────────────────────────────────────────────────

export const submitApprovedDraft = action({
  args: { draftId: v.id("emailDrafts") },
  handler: async (ctx, { draftId }) => {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY が設定されていません");

    // draft と lead を取得
    const draft = await ctx.runQuery(api.sales.getDraftById, { draftId });
    if (!draft) throw new Error("草稿が見つかりません");

    const lead = await ctx.runQuery(api.sales.getLead, { id: draft.leadId });
    if (!lead) throw new Error("リードが見つかりません");

    if (!lead.formFields) {
      throw new Error("フォーム構造が未発見です。先にエージェントを再実行してフォームを解析してください。");
    }

    // フォーム構造を復元
    let formStructure: ContactFormStructure;
    try {
      formStructure = JSON.parse(lead.formFields) as ContactFormStructure;
    } catch {
      throw new Error("フォーム構造のパースに失敗しました");
    }

    if (formStructure.hasCaptcha) {
      throw new Error("CAPTCHAが検出されています。手動でフォームから送信してください。");
    }

    // 送信者情報
    const SENDER_NAME = "AI駆け込み寺 代表";
    const SENDER_EMAIL = "info@ai-kakekomi-dera.vercel.app";
    const SENDER_COMPANY = "AI駆け込み寺";
    const subject = draft.editedBody ? `（編集済み）${draft.subject}` : draft.subject;
    const body = draft.editedBody ?? draft.body;

    // フォームフィールドにマッピングして Firecrawl actions を生成
    const actions: object[] = [
      { type: "wait", milliseconds: 2000 },  // ページ描画待ち
    ];

    for (const field of formStructure.fields) {
      let value = "";
      switch (field.role) {
        case "name":    value = SENDER_NAME; break;
        case "email":   value = SENDER_EMAIL; break;
        case "company": value = SENDER_COMPANY; break;
        case "phone":   value = "";  // 電話は入力しない
          continue;
        case "subject": value = subject; break;
        case "message": value = body; break;
        default: continue;  // "other" フィールドはスキップ
      }
      if (!value) continue;

      actions.push({ type: "click",  selector: field.selector });
      actions.push({ type: "write",  text: value });
    }

    // 送信ボタンをクリック
    actions.push({ type: "wait", milliseconds: 500 });
    actions.push({ type: "click", selector: formStructure.submitSelector });
    actions.push({ type: "wait", milliseconds: 3000 });   // 送信処理待ち
    actions.push({ type: "screenshot" });                  // 結果確認用

    // Firecrawl で実行
    const submitResult = await firecrawlScrape(
      firecrawlKey,
      formStructure.contactFormUrl,
      ["markdown"],
      actions
    );

    // 送信成功の確認（「送信完了」「ありがとうございます」等のキーワード）
    const resultMarkdown = submitResult.markdown ?? "";
    const successKeywords = [
      "送信完了", "ありがとうございます", "受け付けました",
      "送信しました", "thank you", "successfully", "sent",
    ];
    const isSuccess = successKeywords.some(k => resultMarkdown.toLowerCase().includes(k.toLowerCase()));

    if (isSuccess) {
      // DB更新: submitted
      await ctx.runMutation(api.sales.markDraftSubmitted, { draftId });
      return { success: true, message: "フォーム送信が完了しました" };
    } else {
      // 失敗として記録（手動確認を促す）
      await ctx.runMutation(api.sales.markDraftFailed, {
        draftId,
        reason: "送信完了の確認テキストが検出されませんでした。フォーム構造が変更された可能性があります。",
      });
      return {
        success: false,
        message: "送信の確認ができませんでした。フォームURLを直接確認してください。",
        formUrl: formStructure.contactFormUrl,
      };
    }
  },
});
