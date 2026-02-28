# Phase 2 要件定義書 — AI駆け込み寺 営業AIエージェント

> **ステータス**: Phase 2-B 実装中 / Phase 2-D（フォーム送信PIVOT）設計中
> **最終更新**: 2026-02-28
> **リポジトリ**: https://github.com/Yibooo/mission-control

---

## 目次

1. [背景・目的](#1-背景目的)
2. [戦略PIVOT: メール送信 → フォーム送信](#2-戦略pivot-メール送信--フォーム送信)
3. [システム全体アーキテクチャ](#3-システム全体アーキテクチャ)
4. [営業AIエージェント仕様](#4-営業aiエージェント仕様)
5. [ワークフロー詳細（フォーム送信版）](#5-ワークフロー詳細フォーム送信版)
6. [データモデル（DB設計）](#6-データモデルdb設計)
7. [UI/UX仕様](#7-uiux仕様)
8. [Phase 3 エージェント可視化UI要件](#8-phase-3-エージェント可視化ui要件)
9. [API・外部サービス一覧](#9-api外部サービス一覧)
10. [実装フェーズ（全体ステップ）](#10-実装フェーズ全体ステップ)
11. [必要なAPIキー一覧](#11-必要なapiキー一覧)

---

## 1. 背景・目的

**AI駆け込み寺**（https://ai-kakekomi-dera.vercel.app）は中小企業向けAI導入支援の個人事業サービス。

**課題**: 個人事業のため、営業活動（見込み企業の発掘・接触・フォローアップ）に割ける時間が限られる。

**目的**: 営業プロセスを自動化するAIエージェントを構築し、1日あたりの営業接触件数を増やしながら、人間は「最終承認」にのみ集中できる体制を作る。

**ターゲット**: 東京・首都圏の中小企業（業種不問、従業員5〜100名程度）

---

## 2. 戦略PIVOT: メール送信 → フォーム送信

### 2.1 なぜPIVOTするのか

| 比較軸 | ❌ メール送信（旧） | ✅ フォーム送信（新） |
|---|---|---|
| **メアド取得率** | 公開メアドを持つ企業は少ない（~30%） | 問い合わせフォームはほぼ全企業が持つ（~90%） |
| **到達率** | スパムフィルタに弾かれやすい | フォーム経由は正規の問い合わせとして処理される |
| **信頼性** | 不審なメールとして無視されやすい | 自社フォームへの入力=企業が用意した窓口 |
| **技術的難易度** | Gmail API認証が複雑 | Playwright等で自動化可能 |
| **スケーラビリティ** | メアドが見つからない企業はスキップ | ほぼ全企業にアプローチ可能 |

### 2.2 フォーム送信の仕組み

```
従来: 企業サイト → メアド抽出 → Gmail API で送信
新方式: 企業サイト → お問い合わせフォームURL発見 → フォームフィールドを解析
                    → 名前・メアド・問い合わせ内容を入力 → 送信ボタンをクリック
```

### 2.3 入力するフォームフィールドの設計

| フィールド | 入力内容 | 備考 |
|---|---|---|
| `お名前` | `AI駆け込み寺 代表` | 固定値 |
| `メールアドレス` | `info@ai-kakekomi-dera.vercel.app` | 送信者アドレス（返信受付用） |
| `会社名` | `AI駆け込み寺` | 固定値 |
| `お問い合わせ件名` | AIが生成した件名 | 企業ごとにパーソナライズ |
| `お問い合わせ内容` | AIが生成した営業文章 | 企業ごとにパーソナライズ（200〜280字） |
| `電話番号` | 省略 or `未記入` | 任意フィールドなら空欄のまま |

### 2.4 CAPTCHA・ボット対策への対応方針

```
⚠️ 重要: CAPTCHAが検出された場合は即座にスキップ（バイパスは行わない）
- hCaptcha / reCAPTCHA / 画像認証 が表示された場合 → skip
- 代わりにその企業を「CAPTCHA_REQUIRED」ステータスで保存
- 将来的に人間が手動で送信できるよう情報を保持
```

---

## 3. システム全体アーキテクチャ

```
┌──────────────────────────────────────────────────────────────┐
│                  フロントエンド (mission-control)              │
│  Next.js 16 + Convex + TypeScript + Tailwind                  │
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
│  │ (企業発見)  │  │ (フォームURL │  │  (問い合わせ文   │   │
│  │             │  │  調査)       │  │   生成)          │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                │                    │              │
│  ┌──────▼──────┐  ┌──────▼───────┐  ┌────────▼─────────┐   │
│  │ Tavily API  │  │  Firecrawl   │  │   Gemini API     │   │
│  │ (Web検索)   │  │(フォーム抽出)│  │  (文章生成)      │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  FormSubmitter Agent（承認後のみ実行）                │   │
│  │  Playwright / Steel.dev でフォーム自動入力・送信      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Tracker Agent                                        │   │
│  │  返信メールの監視（info@宛の受信箱をポーリング）        │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│               Convex DB (リアルタイムDB)                       │
│  agents / leads / contactDrafts / salesLogs                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. 営業AIエージェント仕様

### 4.1 エージェント構成（PIVOT後）

| エージェント名 | 役割 | 使用API | Phase |
|---|---|---|---|
| **Prospector** | ターゲット企業のリストアップ | Tavily Search API | 2-B ✅ |
| **Researcher** | お問い合わせフォームURLの特定・フォーム構造解析 | Firecrawl | 2-D |
| **Copywriter** | パーソナライズされた問い合わせ文章生成 | Gemini API ✅ | 2-B ✅ |
| **FormSubmitter** | フォームへの自動入力・送信（承認後のみ） | Playwright / Steel.dev | 2-D |
| **Tracker** | 返信メール監視・フォローアップ管理 | Gmail API（受信監視のみ） | 2-E |

### 4.2 ターゲット条件

```
エリア  : 東京都・首都圏（東京・神奈川・埼玉・千葉）
業種    : 不問（製造・小売・サービス・飲食・医療・士業 等）
規模    : 従業員5〜100名程度の中小企業
優先度  : お問い合わせフォームを持つ企業（≒ほぼ全企業）
スキップ: CAPTCHA必須のフォーム（人間承認キューへ回す）
```

### 4.3 生成する問い合わせ文章の設計方針

- **件名**: 企業固有の課題に言及（例: 「在庫管理の自動化で月10時間削減できます」）
- **本文**:
  - 書き出し: 企業への具体的な言及（サービス名・業種・強みに触れる）
  - 課題提示: 同業他社がAIで解決している事例
  - 提案: AI駆け込み寺のサービス（無料相談 or スターターパック）
  - CTA: URLとともに「まずは30分無料でご相談ください」
- **文字数**: 200〜300字（問い合わせフォームに収まる長さ）
- **トーン**: 丁寧だが押しつけがましくない

---

## 5. ワークフロー詳細（フォーム送信版）

```
[STEP 1] エージェント起動（管理画面）
  ↓ 対象条件（エリア・業種・件数）を入力

[STEP 2] Prospector Agent — 企業リストアップ
  ↓ Tavily API で「株式会社 代表取締役 資本金 設立 東京都」等を検索
  ↓ ニュース・求人サイト・SNSを自動除外（exclude_domains）
  ↓ 20〜50社の候補を leads テーブルに保存
  ↓ 重複チェック・既接触済みチェック

[STEP 3] Researcher Agent — フォームURL特定
  ↓ Firecrawl で各企業サイトをクロール
  ↓ 「お問い合わせ」「contact」「inquiry」等のリンクを発見
  ↓ フォームのフィールド構造を解析（name/email/tel/subject/body の対応確認）
  ↓ CAPTCHA検出 → status: "captcha_required" でスキップ（手動送信キューへ）
  ↓ leads.contactFormUrl, leads.formFields に保存

[STEP 4] Copywriter Agent — 問い合わせ文章生成
  ↓ Gemini で企業固有のパーソナライズ文章を生成
  ↓ contactDrafts テーブルに保存（approvalStatus: "pending"）

[STEP 5] ⚠️ HUMAN-IN-THE-LOOP — 事前チェック（必須・送信前に人間が確認）
  ↓ /sales ページに承認待ちカードとして表示
  ↓ 人間が確認: 会社名・フォームURL・件名・本文プレビュー
  ↓ [承認して送信] / [編集して承認] / [却下] の3択
  ↓ 承認しない限り FormSubmitter は実行されない

[STEP 6] FormSubmitter Agent — フォーム自動入力・送信（承認後のみ）
  ↓ Playwright で企業のお問い合わせフォームを開く
  ↓ 名前・メアド・件名・本文を入力
  ↓ 送信ボタンをクリック
  ↓ 送信完了の確認メッセージを検出 → salesLogs に記録
  ↓ leads.status を "contacted" に更新

[STEP 7] Tracker Agent — 返信監視（受信箱ポーリング）
  ↓ info@ai-kakekomi-dera.vercel.app 宛の受信箱を監視
  ↓ 返信検知 → Dashboard通知 → leads.status を "replied" に更新
  ↓ 7日間返信なし → フォローアップ問い合わせ文章を自動生成
```

---

## 6. データモデル（DB設計）

### 6.1 `leads` テーブル（PIVOT対応の拡張）

```typescript
{
  companyName: string,
  industry: string,
  location: string,
  estimatedSize: string,
  websiteUrl: string,

  // ── PIVOT追加フィールド ──────────────────────
  contactFormUrl: optional string,    // お問い合わせフォームのURL
  formFields: optional string,        // フォームフィールド構造（JSON文字列）
                                      // 例: {"name":"お名前","email":"メール","body":"お問い合わせ内容"}
  // ────────────────────────────────────────────

  contactEmail: optional string,      // メアドがあれば保持（将来のフォールバック用）
  contactName: optional string,
  researchSummary: string,

  status: "researching"
       | "draft_ready"          // 文章生成済み（承認待ち）
       | "captcha_required"     // CAPTCHAで自動送信不可（手動送信待ち）
       | "contacted"            // 送信済み
       | "replied"              // 返信あり
       | "negotiating"          // 商談中
       | "closed_won"           // 成約
       | "closed_lost"          // NG
       | "rejected",            // 人間が却下

  source: string,
  notes: optional string,
  createdAt: number,
  updatedAt: number,
}
```

### 6.2 `contactDrafts` テーブル（旧 emailDrafts をリネーム・拡張）

```typescript
{
  leadId: Id<"leads">,

  // 送信内容
  subject: string,                    // 件名
  body: string,                       // 問い合わせ本文
  senderName: string,                 // 送信者名（"AI駆け込み寺 代表"）
  senderEmail: string,                // 返信受付メアド

  approvalStatus: "pending"           // 承認待ち（人間レビュー必要）
                | "approved"          // 承認済み
                | "rejected"          // 却下
                | "submitted"         // フォーム送信済み
                | "failed",           // 送信失敗（エラー保存）

  editedBody: optional string,        // 人間が編集した場合
  approvedAt: optional number,
  submittedAt: optional number,
  failureReason: optional string,     // 送信失敗時のエラー内容

  generatedBy: string,                // "agent:Copywriter(Gemini)"
  createdAt: number,
}
```

### 6.3 `salesLogs` テーブル（イベント追加）

```typescript
{
  leadId: Id<"leads">,
  draftId: optional Id<"contactDrafts">,
  event: "lead_created"
       | "form_url_found"             // フォームURL発見
       | "captcha_detected"           // CAPTCHA検出 → スキップ
       | "draft_generated"
       | "approved"
       | "rejected"
       | "form_submitted"             // フォーム送信成功
       | "submission_failed"          // フォーム送信失敗
       | "replied"
       | "follow_up_scheduled"
       | "meeting_scheduled",
  detail: optional string,
  performedBy: string,
  createdAt: number,
}
```

---

## 7. UI/UX仕様

### 7.1 `/sales` ページ構成（PIVOT後）

```
┌──────────────────────────────────────────────────────────┐
│  📊 統計サマリー                                           │
│  [総リード数] [承認待ち] [CAPTCHA待ち] [送信済み] [返信あり] │
├──────────────────────────────────────────────────────────┤
│  ⚠️ 承認キュー（メインセクション）                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🏢 ○○食品株式会社     業種: 食品小売    東京都渋谷区 │  │
│  │ 🔗 フォームURL: https://xxfood.co.jp/contact/      │  │
│  │ ─────────────────────────────────────────────────  │  │
│  │ 📋 リサーチサマリー                                 │  │
│  │ 「在庫管理をExcelで運用中。AI自動化の余地が大きい」  │  │
│  │ ─────────────────────────────────────────────────  │  │
│  │ ✉️ 件名: 在庫管理の自動化で月10時間削減できます     │  │
│  │ [本文プレビュー ▼]                                 │  │
│  │                                                    │  │
│  │ [✅ 承認して送信] [✏️ 編集] [❌ 却下]              │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  🔐 CAPTCHA要手動送信（フォームURLのみ表示・手動誘導）      │
├──────────────────────────────────────────────────────────┤
│  📋 リードパイプライン                                     │
│  [全て] [草稿完了] [送信済み] [返信あり] [成約]            │
└──────────────────────────────────────────────────────────┘
```

### 7.2 CAPTCHA企業の扱い

- **自動送信はしない**
- `/sales` ページに「手動送信が必要な企業」セクションを別枠で表示
- フォームURLと生成済み文章をコピーボタン付きで表示
- ユーザーが手動でフォームを開いて貼り付け送信できるようにする

---

## 8. Phase 3 エージェント可視化UI要件

> 参考: Claw-Empire のオフィス画面のような、各エージェントが今何をしているか一目でわかるUI

### 8.1 目指すUX

- 各エージェントが「部屋（Department）」に所属
- 各エージェントの上に**リアルタイムで今やっていること**が吹き出しで表示
- ステータスに応じてアニメーション（待機中/稼働中/エラー）

### 8.2 必要なUIコンポーネント

| コンポーネント | 説明 |
|---|---|
| `DepartmentRoom` | 部署ごとの区画コンテナ |
| `AgentCharacter` | エージェントカード（アバター + 名前 + ステータス + 吹き出し） |
| `ActivityBubble` | `currentAction` をアニメ付きで表示 |
| `StatusPulse` | 稼働中エージェントのパルスアニメーション |
| `GlobalActivityFeed` | 全エージェントのタイムライン |

### 8.3 部署構成

```
Sales Department     → Prospector / Copywriter / FormSubmitter / Tracker
Research Department  → Researcher
Operations           → Commander（司令塔）
```

---

## 9. API・外部サービス一覧

| サービス | 用途 | 費用 | 公式URL |
|---|---|---|---|
| **Tavily API** | Web検索（企業リストアップ） | 月1,000回無料 | app.tavily.com |
| **Gemini API** | 問い合わせ文章生成 ✅ 導入済み | 1M tokens/日 無料 | ai.google.dev |
| **Firecrawl API** | Webクロール（フォームURL特定） | 月500クレジット無料 | firecrawl.dev |
| **Playwright** | ブラウザ自動操作（フォーム入力・送信） | OSS・無料 | playwright.dev |
| **Steel.dev** | クラウドブラウザ実行環境（Convexで実行不可の場合の代替） | 無料枠あり | steel.dev |
| **Gmail API** | 返信メール受信監視のみ（送信は不要になった） | 無料 | console.cloud.google.com |
| **Convex** | DB + リアルタイム同期 ✅ 導入済み | 無料枠あり | convex.dev |

---

## 10. 実装フェーズ（全体ステップ）

### ✅ Phase 2-A: 基盤構築（完了）

- [x] Convex スキーマ（leads / emailDrafts / salesLogs）
- [x] agents テーブル拡張（currentAction / department / activityLog）
- [x] /sales 承認キューUI
- [x] Sidebar への営業エージェントリンク追加
- [x] agents seed に Sales エージェント追加

### ✅ Phase 2-B: AI連携（完了）

- [x] Tavily API による企業リサーチ（salesAgent.ts）
- [x] Gemini による企業情報抽出・問い合わせ文章生成
- [x] TAVILY_API_KEY / GEMINI_API_KEY を Convex 本番環境に設定
- [x] モック実行モード（APIキー不要のテスト用）
- [x] デバッグログ表示（スキップ理由の可視化）

### 🔄 Phase 2-C: リード取得精度向上（改善継続中）

- [x] exclude_domains で検索段階でニュースサイトを除外
- [x] search_depth: advanced に変更
- [x] 検索クエリを「資本金/設立」等の企業固有キーワードに変更
- [ ] isCompanyPage 判定の精度をさらに改善（現状19/20が除外される）
- [ ] Firecrawl によるサイト内容の深掘り抽出（オプション）

### 🔲 Phase 2-D: フォーム送信PIVOT（次のメインタスク）

- [ ] **Firecrawl でお問い合わせフォームURLを自動特定**
  - 各企業サイトをクロールして「お問い合わせ」ページURLを抽出
  - フォームフィールドのラベルと input name を取得
- [ ] **DB拡張**: leads に `contactFormUrl`, `formFields` を追加
- [ ] **DB拡張**: `emailDrafts` → `contactDrafts` にリネーム＋フィールド追加
- [ ] **FormSubmitter Agent の実装**
  - Playwright を Convex Action（"use node"）で実行
  - 企業フォームを開く → フィールドを検出 → 入力 → 送信
  - CAPTCHA検出時は `captcha_required` ステータスで即停止
  - 送信完了の確認テキスト検出 → ログ記録
- [ ] **CAPTCHA企業の手動送信UI**
  - /sales ページに別セクションとして表示
  - フォームURL + 生成文章のコピーボタン

### 🔲 Phase 2-E: 返信トラッキング

- [ ] Gmail API（受信専用）のセットアップ
- [ ] Convex scheduled function で24時間ごとに受信箱をポーリング
- [ ] 返信検知 → `leads.status` を `replied` に自動更新
- [ ] 7日無返信 → フォローアップ文章を自動生成・承認キューへ

### 🔲 Phase 3: エージェント可視化UI

- [ ] DepartmentRoom / AgentCharacter / ActivityBubble コンポーネント
- [ ] GlobalActivityFeed（全エージェントの活動タイムライン）
- [ ] /team ページの全面リニューアル

---

## 11. 必要なAPIキー一覧

```bash
# ✅ 設定済み（Convex dev & prod 両方）
TAVILY_API_KEY=tvly-dev-...
GEMINI_API_KEY=AIzaSy...

# 🔲 Phase 2-D で必要
FIRECRAWL_API_KEY=fc-...       # firecrawl.dev で取得（月500クレジット無料）

# 🔲 Phase 2-E で必要（受信監視のみ）
GMAIL_CLIENT_ID=...            # Google Cloud Console
GMAIL_CLIENT_SECRET=...        # Google Cloud Console
GMAIL_REFRESH_TOKEN=...        # OAuth2 フロー完了後
GMAIL_RECEIVER_ADDRESS=info@ai-kakekomi-dera.vercel.app  # 返信受付アドレス
```

### 取得手順

| キー | 取得手順 |
|---|---|
| FIRECRAWL_API_KEY | https://firecrawl.dev → Sign up → API Keys |
| Gmail OAuth（受信） | Google Cloud Console → Gmail API有効化 → OAuth2 Client ID（スコープ: gmail.readonly のみ） |

---

*このドキュメントは mission-control リポジトリの Phase 2 要件定義書です。*
*Claude Code と協力して設計・実装しています。*
