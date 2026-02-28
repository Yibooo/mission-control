# Phase 2 要件定義書 — AI駆け込み寺 営業AIエージェント

> **ステータス**: Phase 2-D 実装完了 / Phase 2-E（返信トラッキング）準備中
> **最終更新**: 2026-02-28
> **リポジトリ**: https://github.com/Yibooo/mission-control
> **本番URL**: https://mission-control-xi-sepia.vercel.app/sales

---

## 目次

1. [背景・目的](#1-背景目的)
2. [業界PIVOT: 首都圏中小企業 → 関東圏老舗旅館](#2-業界pivot)
3. [戦略PIVOT: メール送信 → フォーム送信](#3-戦略pivot)
4. [システム全体アーキテクチャ](#4-システム全体アーキテクチャ)
5. [営業AIエージェント仕様](#5-営業aiエージェント仕様)
6. [ワークフロー詳細（フォーム送信版）](#6-ワークフロー詳細)
7. [データモデル（DB設計）](#7-データモデルdb設計)
8. [UI/UX仕様](#8-uiux仕様)
9. [Phase 3 エージェント可視化UI要件](#9-phase-3-エージェント可視化ui要件)
10. [API・外部サービス一覧](#10-api外部サービス一覧)
11. [実装フェーズ（全体ステップ）](#11-実装フェーズ全体ステップ)
12. [必要なAPIキー一覧](#12-必要なapiキー一覧)

---

## 1. 背景・目的

**AI駆け込み寺**（https://ai-kakekomi-dera.vercel.app）は中小企業向けAI導入支援の個人事業サービス。

**課題**: 個人事業のため、営業活動（見込み企業の発掘・接触・フォローアップ）に割ける時間が限られる。

**目的**: 営業プロセスを自動化するAIエージェントを構築し、1日あたりの営業接触件数を増やしながら、人間は「最終承認」にのみ集中できる体制を作る。

---

## 2. 業界PIVOT

### Before → After

| 軸 | ❌ 旧ターゲット | ✅ 新ターゲット |
|---|---|---|
| **業界** | 首都圏中小企業（業種不問） | **関東圏の老舗旅館・温泉旅館** |
| **エリア** | 東京都・首都圏 | 箱根・草津・伊香保・那須・鬼怒川・熱海・湯河原・修善寺・四万・日光 |
| **規模** | 従業員5〜100名 | 家族経営〜50名程度の中小旅館 |
| **AI活用余地** | 幅広いが刺さりにくい | 予約返信・口コミ返信・多言語対応・マニュアル整備など明確 |

### 2.1 旅館業界を選んだ理由

1. **痛みが明確**: 予約・問い合わせへの返信、OTA口コミへの返信文作成、外国人対応（多言語）など、AIで効率化できる定型業務が豊富
2. **DX遅れ**: 伝統的業界のためAI活用率が低く、競合が少ない初期ユーザーを取りやすい
3. **公式サイト存在率が高い**: OTAに依存しつつも独自ドメインサイトを持つ旅館が多く、フォーム経由でのアプローチが可能
4. **検索で特定しやすい**: 温泉地名 + 旅館 + 公式サイトで直接ヒットさせられる

### 2.2 ターゲット旅館プロファイル

```
エリア    : 関東圏主要温泉地（箱根・草津・那須・鬼怒川・熱海 等）
規模      : 従業員5〜50名、客室10〜50室程度
課題      : 予約・問い合わせ対応の工数削減、多言語対応、口コミ返信の自動化
除外      : じゃらん・一休・楽天トラベル等のOTA（公式サイトではないため）
除外      : ランキング・まとめ・比較サイト（旅行メディア）
```

### 2.3 旅館向けAI活用提案の4本柱

| 活用シーン | 効果 |
|---|---|
| 予約・問い合わせへの自動返信 | メール・電話対応の負担を最大70%削減 |
| 口コミ返信文の自動生成 | Google・じゃらん・楽天の返信を1分で作成 |
| 多言語対応（外国人ゲスト） | 英語・中国語・韓国語のFAQ・案内を即時翻訳 |
| プラン・客室案内コンテンツ生成 | 季節限定プランの説明文・SNS投稿を自動作成 |

---

## 3. 戦略PIVOT: メール送信 → フォーム送信

### 3.1 なぜPIVOTするのか

| 比較軸 | ❌ メール送信（旧） | ✅ フォーム送信（新） |
|---|---|---|
| **メアド取得率** | 公開メアドを持つ企業は少ない（~30%） | 問い合わせフォームはほぼ全企業が持つ（~90%） |
| **到達率** | スパムフィルタに弾かれやすい | フォーム経由は正規の問い合わせとして処理される |
| **信頼性** | 不審なメールとして無視されやすい | 自社フォームへの入力=企業が用意した窓口 |
| **技術的難易度** | Gmail API認証が複雑 | Firecrawl actions で自動化可能 |

### 3.2 CAPTCHA・ボット対策への対応方針

```
⚠️ 重要: CAPTCHAが検出された場合は即座にスキップ（バイパスは行わない）

検出対象:
- reCAPTCHA v2 / v3（Google）
- hCaptcha
- Snow Monkey Forms の nonce
- WordPress CF7 の wpcf7_sec_id
- mw-wp-form
- 画像認証

対応:
→ status: "captcha_required" で保存
→ /sales ページで「手動送信ヘルパー」として表示
→ ユーザーが「📋 文章をコピー」→「🔗 フォームを開く」で手動送信
```

### 3.3 現実的な見立て

> 調査した限り、関東圏の旅館サイトの約80〜90%はCAPTCHA付き（WordPress + CF7 / Snow Monkey Forms が主流）。
> 完全自動化は難しいが、「フォームURL特定 + 文章コピー + 手動貼り付け」のハイブリッドフローで十分に価値がある。

---

## 4. システム全体アーキテクチャ

```
┌──────────────────────────────────────────────────────────────┐
│                  フロントエンド (mission-control)              │
│  Next.js 16 + Convex + TypeScript + Tailwind CSS v4           │
│                                                              │
│  /sales          承認キュー・リード管理・送信ログ              │
│  /team           エージェント状態モニタリング（Phase 3）       │
└─────────────────────┬────────────────────────────────────────┘
                      │ Convex WebSocket (リアルタイム同期)
┌─────────────────────▼────────────────────────────────────────┐
│               バックエンド (Convex Actions "use node")         │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Prospector  │  │  Researcher  │  │   Copywriter     │   │
│  │ (旅館発見)  │  │ (フォームURL │  │  (問い合わせ文   │   │
│  │ Tavily検索  │  │  Firecrawl)  │  │   Gemini生成)    │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  FormSubmitter Agent（承認後・CAPTCHA無し旅館のみ）   │   │
│  │  Firecrawl actions でフォーム自動入力・送信           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tracker Agent（Phase 2-E）                           │   │
│  │  返信メールの監視（info@宛の受信箱をポーリング）        │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│               Convex DB (リアルタイムDB)                       │
│  agents / leads / emailDrafts / salesLogs                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. 営業AIエージェント仕様

### 5.1 エージェント構成

| エージェント名 | 役割 | 使用API | ステータス |
|---|---|---|---|
| **Prospector** | 関東圏の旅館サイトをリストアップ | Tavily Search API | ✅ 完了 |
| **Researcher** | お問い合わせフォームURLの特定・フォーム構造解析 | Firecrawl | ✅ 完了（実用精度改善中） |
| **Copywriter** | パーソナライズされた問い合わせ文章生成 | Gemini API | ✅ 完了 |
| **FormSubmitter** | フォームへの自動入力・送信（CAPTCHA無しのみ） | Firecrawl actions | ✅ 完了（実運用: 手動補助） |
| **Tracker** | 返信メール監視・フォローアップ管理 | Gmail API（受信監視のみ） | 🔲 Phase 2-E |

### 5.2 検索クエリ設計（旅館特化）

```typescript
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

// 除外ドメイン（OTA・まとめ・SNS等 26ドメイン）
const EXCLUDE_DOMAINS = [
  "jalan.net", "ikyu.com", "relux.jp", "booking.com",
  "tripadvisor.jp", "travel.rakuten.co.jp", ...
];
```

### 5.3 旅館判定ロジック

```
優先順位:
1. URL/title に旅館キーワードが含まれる → 旅館と判定（高精度）
   Keywords: ryokan/旅館/onsen/温泉/yado/宿/hakone/箱根/kusatsu/草津 等
2. Gemini による isRyokan 判定（補助）
3. Gemini 失敗時 → URL旅館判定を優先してフォールバック

→ この3層構造により "0リード問題" を解消
```

---

## 6. ワークフロー詳細

```
[STEP 1] エージェント起動（管理画面）
  ↓ 「🚀 エージェント起動（AI実行モード）」をクリック

[STEP 2] Prospector Agent — 旅館リストアップ
  ↓ Tavily API で「箱根温泉 旅館 公式サイト お問い合わせ」等を検索
  ↓ OTA・まとめサイトを自動除外（26ドメイン）
  ↓ 20件の候補を取得（1クエリ5件 × 4クエリ）
  ↓ 重複チェック・既接触済みチェック

[STEP 3] Researcher Agent — フォームURL特定
  ↓ Phase A: Firecrawl でトップページのリンク一覧を取得
  ↓ "contact" / "お問い合わせ" 等のキーワードでフォームページを特定
  ↓ Phase B: Firecrawl でフォームページのHTMLを取得
  ↓ Phase C: CAPTCHA / WordPress nonce を検出
  ↓ Phase D: Gemini でフォームのCSSセレクタを抽出
  ↓ leads.contactFormUrl, leads.formFields に保存
  ↓ CAPTCHA検出 → status: "captcha_required"（手動送信キューへ）

[STEP 4] Copywriter Agent — 旅館向け営業文章生成
  ↓ Gemini で旅館固有のパーソナライズ文章を生成
  ↓ 旅館業界特有の課題（予約返信・口コミ・多言語）に言及
  ↓ emailDrafts テーブルに保存（approvalStatus: "pending"）

[STEP 5] ⚠️ HUMAN-IN-THE-LOOP — 人間による最終確認
  ↓ /sales ページに承認待ちカードとして表示
  ↓ 旅館名・フォームURL・件名・本文プレビューを確認

  ─ CAPTCHA有り（大多数）─────────────────────────────────────
  ↓ 「📋 文章をコピー」→「🔗 フォームを開く」→ 手動貼り付け送信
  ↓ 「✅ 手動送信完了としてマーク」でステータス更新
  ──────────────────────────────────────────────────────────────

  ─ CAPTCHA無し（少数）────────────────────────────────────────
  ↓ 「🤖 自動送信」ボタンで Firecrawl actions による自動送信
  ↓ 送信完了確認テキストを検出 → ログ記録 → status: "contacted"
  ──────────────────────────────────────────────────────────────

[STEP 6] Tracker Agent（Phase 2-E）— 返信監視
  ↓ info@ai-kakekomi-dera.vercel.app 宛の受信箱を監視
  ↓ 返信検知 → leads.status を "replied" に更新
  ↓ 7日間返信なし → フォローアップ文章を自動生成・承認キューへ
```

---

## 7. データモデル（DB設計）

### 7.1 `leads` テーブル

```typescript
{
  companyName: string,        // 旅館名
  industry: string,           // "宿泊業・旅館"
  location: string,           // "神奈川県箱根温泉" 等
  estimatedSize: string,      // "〜50名"
  websiteUrl: string,

  // Phase 2-D 追加フィールド
  contactFormUrl?: string,    // お問い合わせフォームURL（Firecrawl で発見）
  formFields?: string,        // フォームフィールド構造（JSON文字列）
                              // ContactFormStructure の全体を保存

  contactEmail: string,       // メアド（info@domain の推測値 or 実際のアドレス）
  researchSummary?: string,

  status: "researching"
       | "draft_ready"         // 文章生成済み（承認待ち）
       | "captcha_required"    // CAPTCHA検出 → 手動送信待ち ← Phase 2-D 追加
       | "contacted"
       | "replied"
       | "negotiating"
       | "closed_won"
       | "closed_lost"
       | "rejected",

  source: string,              // "tavily_search"
  createdAt: number,
  updatedAt: number,
}
```

### 7.2 `emailDrafts` テーブル（フォーム送信対応に拡張）

```typescript
{
  leadId: Id<"leads">,
  subject: string,
  body: string,
  editedBody?: string,         // 人間が編集した場合

  approvalStatus: "pending"
                | "approved"
                | "rejected"
                | "sent"
                | "submitted"  // フォーム経由で送信済み ← Phase 2-D 追加
                | "failed",    // 送信失敗 ← Phase 2-D 追加

  approvedAt?: number,
  sentAt?: number,
  submittedAt?: number,        // フォーム送信日時 ← Phase 2-D 追加
  failureReason?: string,      // 失敗理由 ← Phase 2-D 追加

  generatedBy?: string,        // "agent:Copywriter(Gemini)"
  createdAt: number,
}
```

### 7.3 `salesLogs` イベント一覧

```typescript
event: "lead_created"
     | "research_done"
     | "form_url_found"         // フォームURL発見 ← Phase 2-D 追加
     | "captcha_detected"       // CAPTCHA検出 ← Phase 2-D 追加
     | "draft_generated"
     | "approved" | "rejected"
     | "sent"
     | "form_submitted"         // フォーム経由で送信成功 ← Phase 2-D 追加
     | "submission_failed"      // フォーム送信失敗 ← Phase 2-D 追加
     | "opened" | "replied"
     | "follow_up_scheduled"
     | "meeting_scheduled"
```

### 7.4 `ContactFormStructure`（JSON として formFields に保存）

```typescript
interface ContactFormStructure {
  contactFormUrl: string;      // お問い合わせページURL
  formActionUrl: string;       // <form action="...">
  submitSelector: string;      // 送信ボタンのCSSセレクタ
  fields: Array<{
    selector: string;          // [name='your-name'] 等
    label: string;             // "お名前"
    role: "name" | "email" | "company" | "phone" | "subject" | "message" | "other";
    inputType: "text" | "email" | "tel" | "textarea";
  }>;
  hasCaptcha: boolean;
  hasNonce: boolean;           // WordPress nonce等の動的トークン
}
```

---

## 8. UI/UX仕様

### 8.1 `/sales` ページ構成

```
┌──────────────────────────────────────────────────────────┐
│  🎯 営業エージェント           [🤖 AI実行] [🎭 モック]    │
│  AI駆け込み寺 — Gemini + Tavily 自動営業ワークフロー       │
│                           [🚀 エージェント起動]            │
├──────────────────────────────────────────────────────────┤
│  🤖 エージェントログ                                       │
│  ● Tavilyで関東圏の温泉旅館を検索中...                     │
│  ✅ 完了: 5社のリードを追加                                │
│  🚫 OTA・まとめサイト除外: 0件                             │
│  🏢 旅館以外として除外: 0件                                │
│  🌐 処理したURL: [url一覧]                                 │
├──────────────────────────────────────────────────────────┤
│  📊 [総リード数] [承認待ち] [送信済み] [返信あり] [成約]    │
├──────────────────────────────────────────────────────────┤
│  ⚠️ 承認キュー（5件）                                      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🏢 天成園  宿泊業・旅館  📍神奈川県箱根温泉  👥〜50名 │  │
│  │ ✉️ info@tenseien.co.jp                              │  │
│  │ 🔗 フォームURL: https://...  [🔐 CAPTCHA有り]      │  │
│  │ 📋 リサーチサマリー: 予約返信・口コミ返信をAIで効率化 │  │
│  │ 件名: 【予約管理・口コミ返信の自動化】天成園様へのご提案│  │
│  │                                                    │  │
│  │ CAPTCHA有り:                                       │  │
│  │ [📋 文章をコピー] [🔗 フォームを開く]               │  │
│  │ [✅ 手動送信完了としてマーク] [❌ 却下]              │  │
│  │                                                    │  │
│  │ CAPTCHA無し:                                       │  │
│  │ [🤖 自動送信] [📋 文章をコピー] [🔗 フォームを開く] │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  📋 リードパイプライン                                     │
│  [全て] [草稿完了] [🔐 手動送信待ち] [送信済み] [返信あり] │
└──────────────────────────────────────────────────────────┘
```

---

## 9. Phase 3 エージェント可視化UI要件

> 参考: Claw-Empire のオフィス画面のような、各エージェントが今何をしているか一目でわかるUI

### 9.1 必要なUIコンポーネント

| コンポーネント | 説明 |
|---|---|
| `DepartmentRoom` | 部署ごとの区画コンテナ（Sales / Research / Ops） |
| `AgentCharacter` | エージェントカード（アバター + 名前 + ステータス + 吹き出し） |
| `ActivityBubble` | `currentAction` をアニメ付きでリアルタイム表示 |
| `StatusPulse` | 稼働中エージェントのパルスアニメーション |
| `GlobalActivityFeed` | 全エージェントのタイムライン |

### 9.2 部署構成

```
Sales Department     → Prospector / Copywriter / FormSubmitter / Tracker
Research Department  → Researcher
Operations           → Commander（司令塔）
```

---

## 10. API・外部サービス一覧

| サービス | 用途 | 費用 | ステータス |
|---|---|---|---|
| **Tavily API** | Web検索（旅館リストアップ） | 月1,000回無料 | ✅ 設定済み |
| **Gemini 1.5 Flash** | 旅館情報抽出・文章生成 | 1M tokens/日 無料 | ✅ 設定済み |
| **Firecrawl API** | Webクロール（フォームURL特定・自動送信） | 月500クレジット無料 | ✅ 設定済み |
| **Convex** | DB + リアルタイム同期 + Actions実行環境 | 無料枠あり | ✅ 設定済み |
| **Vercel** | Next.js ホスティング | 無料枠あり | ✅ 設定済み |
| **Gmail API** | 返信メール受信監視のみ | 無料 | 🔲 Phase 2-E |

---

## 11. 実装フェーズ（全体ステップ）

### ✅ Phase 2-A: 基盤構築（完了）

- [x] Convex スキーマ（leads / emailDrafts / salesLogs / agents）
- [x] /sales 承認キューUI
- [x] Sidebar への営業エージェントリンク追加
- [x] agents seed に Sales エージェント追加（Prospector / Researcher / Copywriter）

### ✅ Phase 2-B: AI連携（完了）

- [x] Tavily API による企業リサーチ（salesAgent.ts）
- [x] Gemini による情報抽出・問い合わせ文章生成
- [x] TAVILY_API_KEY / GEMINI_API_KEY を Convex dev & prod に設定
- [x] モック実行モード（APIキー不要のテスト用）
- [x] デバッグログ表示（スキップ理由の可視化）

### ✅ Phase 2-C: ターゲット精度向上（完了）

- [x] **業界PIVOT**: 首都圏中小企業 → **関東圏老舗旅館・温泉旅館**
- [x] SEARCH_QUERIES を温泉地名指定（箱根・草津・伊香保・那須・鬼怒川・熱海 等）
- [x] EXCLUDE_DOMAINS を26ドメインに拡充（全大手OTA除外）
- [x] **URL/title ベース旅館判定**（RYOKAN_URL_KEYWORDS 26語）
  - Gemini の isRyokan 失敗時もフォールバックでリード作成
  - Gemini が false と判定してもURLが旅館系なら通過
- [x] `buildFallbackRyokanInfo()` — Gemini失敗時の最小限データ生成
- [x] 旅館向けパーソナライズ営業文章テンプレート（`generateRyokanSalesMessage`）
- [x] **検証結果**: 5社/回のリード作成を確認（hakone-kamon.jp, tenseien.co.jp, suimeisou.com 等）

### ✅ Phase 2-D: フォーム送信PIVOT（完了）

- [x] FIRECRAWL_API_KEY を Convex dev & prod に設定
- [x] **DB拡張**: leads に `contactFormUrl`, `formFields`, `captcha_required` ステータス追加
- [x] **DB拡張**: emailDrafts に `submitted`, `failed`, `submittedAt`, `failureReason` 追加
- [x] **DB拡張**: salesLogs に `form_url_found`, `captcha_detected`, `form_submitted`, `submission_failed` 追加
- [x] `discoverContactForm()` — 2フェーズフォーム発見（リンク探索 → HTML解析 → CAPTCHA検出）
- [x] CAPTCHA検出ロジック（reCAPTCHA / hCaptcha / Snow Monkey Forms / CF7 nonce 等）
- [x] `submitApprovedDraft` action — Firecrawl actions による自動フォーム送信
- [x] **手動送信ヘルパーUI**: 「📋 文章をコピー」「🔗 フォームを開く」「✅ 手動送信完了としてマーク」
- [x] CAPTCHA有り/無しで自動的にUIを切り替え
- [x] `markDraftSubmitted` / `markDraftFailed` / `getDraftById` mutation 追加

### 🔲 Phase 2-E: 返信トラッキング（次のステップ）

- [ ] Gmail API（受信専用 `gmail.readonly` スコープ）のセットアップ
- [ ] Google Cloud Console で OAuth2 Client ID 取得
- [ ] Convex scheduled function で24時間ごとに受信箱をポーリング
- [ ] 返信検知 → `leads.status` を `replied` に自動更新 + Dashboard通知
- [ ] 7日間返信なし → フォローアップ文章を自動生成・承認キューへ

### 🔲 Phase 3: エージェント可視化UI

- [ ] DepartmentRoom / AgentCharacter / ActivityBubble コンポーネント実装
- [ ] GlobalActivityFeed（全エージェントの活動タイムライン）
- [ ] /team ページの全面リニューアル
- [ ] Convex WebSocket を使ったリアルタイム状態同期

---

## 12. 必要なAPIキー一覧

```bash
# ✅ 設定済み（Convex dev & prod 両方）
TAVILY_API_KEY=tvly-dev-...
GEMINI_API_KEY=AIzaSy...
FIRECRAWL_API_KEY=fc-1eba8bdb...

# 🔲 Phase 2-E で必要（受信監視のみ）
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...        # OAuth2 フロー完了後
GMAIL_RECEIVER_ADDRESS=info@ai-kakekomi-dera.vercel.app
```

| キー | 取得方法 |
|---|---|
| TAVILY_API_KEY | https://app.tavily.com → API Keys |
| GEMINI_API_KEY | https://ai.google.dev → Get API Key |
| FIRECRAWL_API_KEY | https://firecrawl.dev → Sign up → API Keys |
| Gmail OAuth | Google Cloud Console → Gmail API有効化 → OAuth2 Client ID（スコープ: `gmail.readonly`） |

---

*このドキュメントは mission-control リポジトリの Phase 2 要件定義書です。*
*Claude Code と協力して設計・実装しています。*
*最終更新: 2026-02-28*
