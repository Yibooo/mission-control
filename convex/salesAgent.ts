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
// URL/title に旅館キーワードがあれば Gemini 失敗時もフォールバックで通す
// ─────────────────────────────────────────────────────────────────

// URL や タイトルに含まれる旅館判定キーワード
const RYOKAN_URL_KEYWORDS = [
  "ryokan", "旅館", "onsen", "温泉", "yado", "宿", "kanko", "kankou",
  "inn", "spa", "hotel", "ホテル", "resort", "リゾート",
  "hakone", "箱根", "kusatsu", "草津", "ikaho", "伊香保",
  "nasu", "那須", "kinugawa", "鬼怒川", "atami", "熱海",
  "yugawara", "湯河原", "shuzenji", "修善寺", "shima", "四万",
  "nikko", "日光",
];

interface RyokanInfo {
  companyName: string;
  location: string;
  websiteUrl: string;
  contactEmail: string;
  researchSummary: string;
  isRyokan: boolean;  // 旅館・温泉旅館かどうか
}

// URL / title から旅館っぽいかを判定
function looksLikeRyokanSite(url: string, title: string): boolean {
  const text = (url + " " + title).toLowerCase();
  return RYOKAN_URL_KEYWORDS.some(k => text.includes(k.toLowerCase()));
}

// Gemini 失敗時の最小限フォールバックデータ
function buildFallbackRyokanInfo(
  searchResult: { title: string; url: string },
  domain: string
): RyokanInfo {
  // タイトルから旅館名を抽出（【】や | 以降を除去）
  const cleanTitle = searchResult.title
    .replace(/【.*?】/g, "")
    .replace(/\|.*$/, "")
    .replace(/｜.*$/, "")
    .trim()
    .substring(0, 40) || domain;

  // URL から温泉地名を推測
  let location = "関東圏";
  const url = searchResult.url.toLowerCase();
  if (url.includes("hakone") || searchResult.title.includes("箱根")) location = "神奈川県箱根温泉";
  else if (url.includes("kusatsu") || searchResult.title.includes("草津")) location = "群馬県草津温泉";
  else if (url.includes("ikaho") || searchResult.title.includes("伊香保")) location = "群馬県伊香保温泉";
  else if (url.includes("nasu") || searchResult.title.includes("那須")) location = "栃木県那須温泉";
  else if (url.includes("kinugawa") || searchResult.title.includes("鬼怒川")) location = "栃木県鬼怒川温泉";
  else if (url.includes("atami") || searchResult.title.includes("熱海")) location = "静岡県熱海温泉";
  else if (url.includes("yugawara") || searchResult.title.includes("湯河原")) location = "神奈川県湯河原温泉";
  else if (url.includes("shuzenji") || searchResult.title.includes("修善寺")) location = "静岡県修善寺温泉";
  else if (url.includes("nikko") || searchResult.title.includes("日光")) location = "栃木県日光温泉";

  return {
    companyName: cleanTitle,
    location,
    websiteUrl: searchResult.url,
    contactEmail: `info@${domain}`,
    researchSummary: "予約・問い合わせへの自動返信や口コミ返信をAIで効率化できる",
    isRyokan: true,
  };
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

  // URL/title ベースで旅館かどうかを事前判定
  const isRyokanByUrl = looksLikeRyokanSite(searchResult.url, searchResult.title);

  const prompt = `以下のWebページ情報をJSONで抽出してください。

タイトル: ${searchResult.title}
URL: ${searchResult.url}
内容: ${searchResult.content.substring(0, 1200)}

抽出ルール:
- companyName: 旅館・ホテル・宿の名称。正式名称を優先。
- location: 都道府県+温泉地名（例: 神奈川県箱根温泉、群馬県草津温泉）
- websiteUrl: "${searchResult.url}"をそのまま使用
- contactEmail: ページ内のメアド。なければ "info@${domain}"
- researchSummary: AIを活用できる業務（50字以内。例:「予約管理・口コミ返信・多言語対応をAIで効率化できる」）
- isRyokan: 旅館・ホテル・宿の公式サイトならtrue。OTAや比較サイト・ニュースはfalse

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

    if (!match) {
      // Gemini が JSON を返さなかった → URLが旅館系なら最小限データで通す
      if (isRyokanByUrl) return buildFallbackRyokanInfo(searchResult, domain);
      return null;
    }

    const parsed = JSON.parse(match[0]) as RyokanInfo;

    // URLが旅館系なら Gemini が isRyokan=false と言っても通す
    if (!parsed.isRyokan && !isRyokanByUrl) return null;
    if (!parsed.companyName || parsed.companyName.length < 2) {
      if (isRyokanByUrl) return buildFallbackRyokanInfo(searchResult, domain);
      return null;
    }

    return { ...parsed, isRyokan: true };

  } catch {
    // Gemini エラー → URLが旅館系なら最小限データで通す
    if (isRyokanByUrl) return buildFallbackRyokanInfo(searchResult, domain);
    return null;
  }
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

  // ─────────────────────────────────────────────────────────────────
  // AI駆け込み寺 LP の6課題に紐づく「痛み」候補
  // （口コミ返信など、サービスと無関係の課題は含めない）
  // ─────────────────────────────────────────────────────────────────
  // 解決策は以下3つの切り口に固定:
  //   ① カスタマーサービスの一次対応自動化
  //   ② データ入力・転記作業の自動化
  //   ③ データ集計・分析の効率化

  const prompt = `あなたはAI導入支援サービス「AI駆け込み寺」の営業担当です。
以下の旅館情報をもとに、お問い合わせフォームに送る営業文章を作成してください。

【旅館情報】
旅館名: ${ryokan.companyName}
所在地: ${ryokan.location}

【AI駆け込み寺のサービス（LP掲載内容）】
- 無料相談（30分、オンライン）
- AIスターターパック（¥5,000）: ChatGPT/Claude等の初期設定・プロンプト設計・現場で使えるまで伴走
- 本格導入・顧問（¥50,000〜/月）
- URL: https://ai-kakekomi-dera.vercel.app

【LPに掲載している6つの顧客の悩み（この中からのみ3つ選ぶこと）】
A. 「AIツールが多すぎて何を選べばいいかわからない」
B. 「設定や連携が難しくて挫折してしまった（アカウント作成・API連携・プロンプト設定で詰まった）」
C. 「SNS投稿のネタ出しと文章作成に追われている（毎日投稿しなきゃとわかっていても時間が取れない）」
D. 「Excelへの転記・入力作業が毎日発生している（紙やPDFを手で打ち込む、ミスが怖くて確認が二重三重）」
E. 「問い合わせ対応に時間が取られている（同じ質問が何度も来る、返信が遅れてクレームになることも）」
F. 「高いコンサル費を払って成果が出るか不安（お金をかけたのに使いこなせなかった経験がある、または怖い）」

【解決策は必ず以下3つの切り口に固定すること（順番もこの通り）】
1. カスタマーサービスの一次対応自動化
   → 問い合わせ・予約確認メールへの自動返信下書き生成。対応時間を大幅に削減。
2. データ入力・転記作業の自動化
   → 紙・PDFの予約情報・伝票をAIが読み取り、Excelや台帳への入力を自動化。ミスゼロへ。
3. データ入力・集計・分析の自動化＆効率化
   → 稼働率・売上・予約データを自動集計しレポート化。月次分析が数分で完了。

【作成ルール】
1. subject（件名）:
   - 形式: 【${ryokan.companyName}様】〇〇と〇〇の負担を、AIで半分にしませんか？
   - 〇〇には上記A〜Fの課題から旅館に最も刺さるものを2つ選ぶ（例: 問い合わせ対応、データ入力）
   - 全角35字以内

2. body（本文）: 以下の構造を必ず守ること
   ---
   ${ryokan.companyName} ご担当者様

   突然のご連絡失礼いたします。
   中小企業向けAI導入支援「AI駆け込み寺」と申します。

   ${ryokan.location}でお客様をお迎えされている${ryokan.companyName}様において、このような課題にお悩みではないでしょうか。

   ・[A〜Fから選んだ痛み1を旅館文脈に合わせて「」でくくって記述]
   ・[A〜Fから選んだ痛み2を旅館文脈に合わせて「」でくくって記述]
   ・[A〜Fから選んだ痛み3を旅館文脈に合わせて「」でくくって記述]

   弊社の「AIスターターパック（¥5,000〜）」では、これらを以下の3つの切り口で解決できます。

   1. カスタマーサービスの一次対応自動化：[旅館向けに具体的な効果を1〜2行で]
   2. データ入力・転記作業の自動化：[旅館向けに具体的な効果を1〜2行で]
   3. データ集計・分析の自動化＆効率化：[旅館向けに具体的な効果を1〜2行で]

   高いコンサル費を払って終わりではなく、「現場で本当に使えるAI」を一緒に構築させてください。

   まずは30分の無料相談で、${ryokan.companyName}様の業務の中から「どこをAIに任せられるか」を診断させていただきます。

   ━━━━━━━━━━━━━━━━━━━━
   AI駆け込み寺
   https://ai-kakekomi-dera.vercel.app
   ━━━━━━━━━━━━━━━━━━━━
   ---

3. トーン: 共感ベース。押しつけがましくない。「貴館」「ご担当者様」等の敬語を使う
4. 痛みの箇条書きは「・」で始め、「〜してしまう」「〜が足りない」等のネガティブ感情を含む
5. 解決策の3つの切り口の見出し（カスタマーサービスの〜 / データ入力・転記〜 / データ集計〜）は必ずそのまま使うこと

JSONのみで回答（コードブロック不要）:
{"subject":"件名","body":"本文（改行は\\nで表現）"}`;

  try {
    const raw = await generateWithGemini(geminiKey, prompt, 1500);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON解析失敗");
    const parsed = JSON.parse(match[0]) as MessageDraft;
    if (!parsed.subject || !parsed.body) throw new Error("フィールド不足");
    return parsed;
  } catch {
    // Gemini 失敗時のフォールバック（3つの固定切り口で構成）
    return {
      subject: `【${ryokan.companyName}様】問い合わせ対応とデータ入力の負担を、AIで半分にしませんか？`,
      body: [
        `${ryokan.companyName} ご担当者様`,
        ``,
        `突然のご連絡失礼いたします。`,
        `中小企業向けAI導入支援「AI駆け込み寺」と申します。`,
        ``,
        `${ryokan.location}でお客様をお迎えされている${ryokan.companyName}様において、このような課題にお悩みではないでしょうか。`,
        ``,
        `・「同じ問い合わせが何度も来る。返信が遅れてクレームになることもある」`,
        `・「予約情報をExcelや台帳に手入力する作業が毎日発生している」`,
        `・「高いコンサル費を払っても使いこなせるか不安で、AI導入に踏み切れない」`,
        ``,
        `弊社の「AIスターターパック（¥5,000〜）」では、これらを以下の3つの切り口で解決できます。`,
        ``,
        `1. カスタマーサービスの一次対応自動化：問い合わせ・予約確認メールへの返信下書きをAIが即座に生成。対応時間を大幅に削減します。`,
        `2. データ入力・転記作業の自動化：紙・PDFの予約情報をAIが読み取り、Excelや台帳への入力を自動化。ミスゼロの体制を構築します。`,
        `3. データ集計・分析の自動化＆効率化：稼働率・売上・予約データを自動集計しレポート化。月次分析が数分で完了します。`,
        ``,
        `高いコンサル費を払って終わりではなく、「現場で本当に使えるAI」を一緒に構築させてください。`,
        `まずは30分の無料相談で、${ryokan.companyName}様の業務の中から「どこをAIに任せられるか」を診断させていただきます。`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        `AI駆け込み寺`,
        `https://ai-kakekomi-dera.vercel.app`,
        `━━━━━━━━━━━━━━━━━━━━`,
      ].join("\n"),
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
