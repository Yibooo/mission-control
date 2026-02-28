# Phase 2 要件定義書 — AI駆け込み寺 営業AIエージェント

> **ステータス**: 設計完了 / 実装中
> **最終更新**: 2026-02-28
> **リポジトリ**: https://github.com/Yibooo/mission-control

---

## 目次

1. [背景・目的](#1-背景目的)
2. [システム全体アーキテクチャ](#2-システム全体アーキテクチャ)
3. [営業AIエージェント仕様](#3-営業aiエージェント仕様)
4. [ワークフロー詳細](#4-ワークフロー詳細)
5. [データモデル（DB設計）](#5-データモデルdb設計)
6. [UI/UX仕様](#6-uiux仕様)
7. [Phase 3 エージェント可視化UI要件](#7-phase-3-エージェント可視化ui要件)
8. [API・外部サービス一覧](#8-api外部サービス一覧)
9. [実装フェーズ](#9-実装フェーズ)
10. [必要なAPIキー一覧](#10-必要なapiキー一覧)

---

## 1. 背景・目的

**AI駆け込み寺**（https://ai-kakekomi-dera.vercel.app）は中小企業向けAI導入支援の個人事業サービス。

**課題**: 個人事業のため、営業活動（見込み企業の発掘・メール送信・フォローアップ）に割ける時間が限られる。

**目的**: 営業プロセスを自動化するAIエージェントを構築し、1日あたりの営業接触件数を増やしながら、人間は「最終承認」にのみ集中できる体制を作る。

**ターゲット**: 東京・首都圏の中小企業（業種不問）

---

## 2. システム全体アーキテクチャ

```
┌──────────────────────────────────────────────────────────────┐
│                  フロントエンド (mission-control)              │
│  Next.js 16 + Convex + TypeScript + Tailwind                  │
│                                                              │
│  /sales          承認キュー・リード管理・送信ログ              │
│  /team           エージェント状態モニタリング                  │
│  /workspaces     CRMワークスペース（リードパイプライン）        │
└─────────────────────┬────────────────────────────────────────┘
                      │ Convex WebSocket (リアルタイム同期)
┌─────────────────────▼────────────────────────────────────────┐
│               バックエンド (Convex Actions)                    │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Prospector  │  │  Researcher  │  │   Copywriter     │   │
│  │ (企業発見)  │  │ (企業調査)   │  │  (メール生成)    │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                │                    │              │
│  ┌──────▼──────┐  ┌──────▼───────┐  ┌────────▼─────────┐   │
│  │ Tavily API  │  │  Firecrawl   │  │   Claude API     │   │
│  │ (Web検索)   │  │ (サイト抽出)  │  │  (文章生成)      │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Sender Agent (承認後のみ実行)  ← Gmail API          │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│               Convex DB (リアルタイムDB)                       │
│  agents / leads / emailDrafts / salesLogs                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 営業AIエージェント仕様

### 3.1 エージェント構成

| エージェント名 | 役割 | 使用API |
|---|---|---|
| **Prospector** | ターゲット企業のリストアップ | Tavily Search API |
| **Researcher** | 個別企業の詳細調査 | Firecrawl + Claude |
| **Copywriter** | パーソナライズ営業メール生成 | Claude API |
| **Sender** | 承認済みメールの送信 | Gmail API |
| **Tracker** | 返信監視・フォローアップ管理 | Gmail API |

### 3.2 ターゲット条件

```
エリア  : 東京都・首都圏（東京・神奈川・埼玉・千葉）
業種    : 不問（製造・小売・サービス・飲食・医療・士業 等）
規模    : 従業員5〜100名程度の中小企業
優先度  : Webサイトを持ち連絡先が記載されている企業
```

### 3.3 生成メールの設計方針

- **件名**: 企業固有の課題に言及（例: 「在庫管理の自動化で月10時間削減できます」）
- **本文**:
  - 書き出し: 企業への具体的な言及（サービス名・強みに触れる）
  - 課題提示: 同業他社がAIで解決している事例
  - 提案: AI駆け込み寺のサービス（無料相談 or スターターパック）
  - CTA: URLとともに「まずは30分無料でご相談ください」
- **文字数**: 200〜300字（読まれる長さ）
- **トーン**: 丁寧だが押しつけがましくない

---

## 4. ワークフロー詳細

```
[STEP 1] ターゲット条件の入力
  ↓ 管理画面から業種・地域・規模を指定

[STEP 2] Prospector Agent — 企業リストアップ
  ↓ Tavily API で検索 → 20〜50社の候補をleadsテーブルに保存
  ↓ 重複チェック・既連絡済みチェック

[STEP 3] Researcher Agent — 個別企業調査（並列実行）
  ↓ Firecrawl でWebサイト内容を抽出
  ↓ Claude で「AI導入で解決できる課題」を分析
  ↓ researchSummary を leads に保存

[STEP 4] Copywriter Agent — メール文章生成
  ↓ Claude で企業固有のパーソナライズメールを生成
  ↓ emailDrafts テーブルに保存（status: "pending"）

[STEP 5] ⚠️ HUMAN-IN-THE-LOOP — 事前チェック（必須）
  ↓ /sales ページに承認待ちカードとして表示
  ↓ 人間が内容を確認: 会社名・メアド・件名・本文プレビュー
  ↓ [承認] / [編集して承認] / [却下] の3択
  ↓ 承認しない限り送信は実行されない

[STEP 6] Sender Agent — メール送信
  ↓ Gmail API で送信
  ↓ salesLogs に送信ログを記録
  ↓ leads.status を "contacted" に更新

[STEP 7] Tracker Agent — 返信監視
  ↓ Gmail API で24時間ごとにポーリング
  ↓ 返信検知 → Dashboard通知 → leads.status を "replied" に更新
  ↓ 7日間返信なし → フォローアップメール草稿を自動生成
```

---

## 5. データモデル（DB設計）

### 5.1 新規テーブル

#### `leads` — 見込み企業管理

```typescript
{
  companyName: string,          // 会社名
  industry: string,             // 業種
  location: string,             // 所在地（東京都新宿区 等）
  estimatedSize: string,        // 推定規模（"〜10名", "10〜50名" 等）
  websiteUrl: string,           // WebサイトURL
  contactEmail: string,         // 連絡先メールアドレス
  contactName: optional string, // 担当者名（取得できた場合）
  researchSummary: string,      // AI調査サマリー（AI活用余地の分析）
  status: "researching"         // 調査中
       | "draft_ready"          // メール草稿生成済み（承認待ち）
       | "contacted"            // 送信済み
       | "replied"              // 返信あり
       | "negotiating"          // 商談中
       | "closed_won"           // 成約
       | "closed_lost"          // NG
       | "rejected",            // 人間が却下
  source: string,               // 発見経路（"tavily_search" 等）
  assignedAgentId: optional Id, // 担当エージェントID
  notes: optional string,       // 人間によるメモ
  createdAt: number,
  updatedAt: number,
}
```

#### `emailDrafts` — 生成メール草稿

```typescript
{
  leadId: Id<"leads">,           // 紐づくリード
  subject: string,               // 件名
  body: string,                  // 本文
  approvalStatus: "pending"      // 承認待ち（人間レビュー必要）
                | "approved"     // 承認済み
                | "rejected"     // 却下
                | "sent",        // 送信済み
  editedBody: optional string,   // 人間が編集した場合の本文
  approvedAt: optional number,   // 承認日時
  sentAt: optional number,       // 送信日時
  generatedBy: string,           // 生成エージェント名
  createdAt: number,
}
```

#### `salesLogs` — アクティビティログ

```typescript
{
  leadId: Id<"leads">,
  emailDraftId: optional Id<"emailDrafts">,
  event: "lead_created"          // リード作成
       | "research_done"         // 調査完了
       | "draft_generated"       // メール生成
       | "approved"              // 人間が承認
       | "rejected"              // 人間が却下
       | "sent"                  // 送信
       | "opened"                // 開封（トラッキング）
       | "replied"               // 返信受信
       | "follow_up_scheduled"   // フォローアップ予定
       | "meeting_scheduled",    // 商談予定
  detail: optional string,       // 詳細メモ
  performedBy: string,           // "agent:Prospector" | "human" 等
  createdAt: number,
}
```

### 5.2 既存テーブルの拡張

#### `agents` — Phase 3 エージェント可視化対応（オプショナル追加）

```typescript
// 以下をオプショナルフィールドとして追加
currentAction: optional string,  // "○○株式会社をリサーチ中..." （リアルタイム表示用）
department: optional string,     // 部署/ルーム: "sales" | "research" | "ops"
activityLog: optional array({    // 直近の活動ログ（最新20件）
  action: string,
  timestamp: number,
}),
```

---

## 6. UI/UX仕様

### 6.1 `/sales` ページ構成

```
┌──────────────────────────────────────────────────────────┐
│  📊 統計サマリー（上部）                                   │
│  [総リード数] [承認待ち] [送信済み] [返信あり] [成約]      │
├──────────────────────────────────────────────────────────┤
│  ⚠️ 承認キュー（メインセクション）                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │ #001 ○○食品株式会社          業種: 食品小売        │  │
│  │ 所在地: 渋谷区  規模: 〜30名                       │  │
│  │ 送信先: info@xxfood.co.jp                          │  │
│  │ ─────────────────────────────────────────────────  │  │
│  │ 📋 リサーチサマリー（クリックで展開）               │  │
│  │ 「在庫管理をExcelで運用中。月次発注ミスが課題と     │  │
│  │   見られる。AIによる自動化余地が大きい」            │  │
│  │ ─────────────────────────────────────────────────  │  │
│  │ ✉️ 件名: 在庫管理の自動化で月10時間削減できます     │  │
│  │ [本文プレビュー ▼]                                 │  │
│  │                                                    │  │
│  │ [✅ 承認して送信] [✏️ 編集] [❌ 却下]              │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  📋 リードパイプライン（下部タブ）                         │
│  [全て] [調査中] [草稿準備完了] [送信済み] [返信あり]      │
└──────────────────────────────────────────────────────────┘
```

### 6.2 操作フロー

1. **「エージェント起動」ボタン** → 対象条件を入力 → バックグラウンドでSTEP 1〜4が実行
2. 完了後、承認キューに新着カードが追加（Convexリアルタイム）
3. 承認→即時送信、却下→リードに「rejected」フラグ
4. 送信後は「送信済み」タブでステータス確認

---

## 7. Phase 3 エージェント可視化UI要件

> 参考: Claw-Empire のオフィス画面のような、各エージェントが今何をしているか一目でわかるUI

### 7.1 目指すUX

- 各エージェントが「部屋（Department）」に所属
- 部屋の中に個別エージェントカードが配置
- 各エージェントの上に**リアルタイムで今やっていること**が吹き出しで表示
- ステータスに応じてアニメーション（待機中/稼働中/エラー）

### 7.2 必要なスキーマ拡張

```typescript
// agents テーブルへの追加（オプショナルフィールド）
currentAction: optional string    // "渋谷区の飲食店30社を検索中..."
department: optional string       // "sales" | "research" | "ops" | "admin"
activityLog: optional array({
  action: string,                 // 実行した内容
  timestamp: number,              // 実行日時
})
```

### 7.3 必要なUIコンポーネント

| コンポーネント | 説明 |
|---|---|
| `DepartmentRoom` | 部署ごとの区画コンテナ（ヘッダー + 内部エージェント一覧） |
| `AgentCharacter` | エージェントカード（アバター + 名前 + ステータス + 吹き出し） |
| `ActivityBubble` | `currentAction` をアニメ付きで表示する吹き出しコンポーネント |
| `StatusPulse` | 稼働中エージェントのパルスアニメーション（緑の点滅） |
| `GlobalActivityFeed` | 全エージェントのアクティビティを流すタイムライン（画面下部） |

### 7.4 アニメーション仕様

| 状態 | アニメーション |
|---|---|
| `idle`（待機中） | 緩やかなフロートアニメーション（上下） |
| `working`（稼働中） | アクティブパルス（緑点滅）+ 吹き出し表示 |
| `新しいaction` | 吹き出しがポップイン → 3〜5秒表示 → フェードアウト |
| エラー発生時 | 赤い点滅 + エラーメッセージ吹き出し |

### 7.5 リアルタイムデータフロー

```
エージェント実行 → updateAgentActivity(agentId, "○○を実行中...")
                ↓
          Convex DBに保存
                ↓
        WebSocketで全クライアントへ即時配信（Convexが自動処理）
                ↓
    useQuery(api.agents.list) が再レンダリングをトリガー
                ↓
    ActivityBubble コンポーネントがアニメーション付きで表示
```

### 7.6 部署（Department）構成

```
Sales Department     → Prospector / Copywriter / Sender / Tracker
Research Department  → Researcher
Operations           → Commander（司令塔）
```

### 7.7 実装優先度

| 優先度 | 項目 |
|---|---|
| ⭐ 高 | `currentAction` フィールドの追加 + `ActivityBubble` コンポーネント |
| ⭐ 高 | `department` フィールドの追加 + `DepartmentRoom` コンポーネント |
| ⭐ 中 | `activityLog` + `GlobalActivityFeed` |
| ⭐ 低 | ピクセルアート風のアバタービジュアル（画像の世界観に寄せる場合） |

> **Phase 3 で実装予定**。Phase 2の営業エージェント稼働後に着手。
> Convexのリアルタイム同期は既に機能しているため、スキーマ追加 + UI作成のみで実現可能。

---

## 8. API・外部サービス一覧

| サービス | 用途 | 費用 | 公式URL |
|---|---|---|---|
| **Anthropic API** | Claude（企業調査・メール生成） | 従量課金 | console.anthropic.com |
| **Tavily API** | Web検索（企業リストアップ） | 月1,000回無料 | app.tavily.com |
| **Firecrawl API** | Webスクレイピング（企業サイト調査） | 月500クレジット無料 | firecrawl.dev |
| **Gmail API** | メール送信・返信監視 | 無料 | console.cloud.google.com |
| **Convex** | DB + リアルタイム同期 | 無料枠あり（既存） | convex.dev |

---

## 9. 実装フェーズ

### Phase 2-A（現在実装中）: 基盤構築

- [x] Convex スキーマ追加（leads / emailDrafts / salesLogs）
- [x] agents テーブル拡張（currentAction / department / activityLog）
- [x] convex/sales.ts CRUD関数
- [x] convex/agents.ts updateActivity関数
- [x] /sales 承認キューUI
- [x] Sidebar への営業エージェントリンク追加
- [x] agents seed にSalesエージェント追加
- [ ] **モック実行**: APIキーなしでダミーデータでE2Eフロー確認

### Phase 2-B: AI連携（APIキー設定後）

- [ ] Tavily APIによる企業リサーチ実装（convex/salesAgent.ts）
- [ ] Firecrawlによるウェブサイト内容抽出
- [ ] Claudeによるリサーチ分析・メール生成
- [ ] Gmail APIによる送信機能

### Phase 2-C: トラッキング

- [ ] Gmail API返信監視（Convex scheduled function）
- [ ] フォローアップ自動草稿生成
- [ ] ステータス自動更新

### Phase 3: エージェント可視化UI

- [ ] DepartmentRoom コンポーネント
- [ ] ActivityBubble コンポーネント
- [ ] GlobalActivityFeed
- [ ] /team ページの全面リニューアル

---

## 10. 必要なAPIキー一覧

> Phase 2-B 着手前に以下を取得・設定してください。

```bash
# Convexの環境変数に設定（npx convex env set で設定）

ANTHROPIC_API_KEY=sk-ant-...       # Anthropic Console で取得
TAVILY_API_KEY=tvly-...            # app.tavily.com で取得
FIRECRAWL_API_KEY=fc-...           # firecrawl.dev で取得

# Gmail API は OAuth2 認証情報（別途設定手順あり）
GMAIL_CLIENT_ID=...                # Google Cloud Console
GMAIL_CLIENT_SECRET=...            # Google Cloud Console
GMAIL_REFRESH_TOKEN=...            # OAuth2 フロー完了後に取得
GMAIL_SENDER_ADDRESS=your@gmail.com # 送信元アドレス
```

### 取得手順

| キー | 取得手順 |
|---|---|
| ANTHROPIC_API_KEY | https://console.anthropic.com → API Keys → Create Key |
| TAVILY_API_KEY | https://app.tavily.com → Sign up → API Keys |
| FIRECRAWL_API_KEY | https://firecrawl.dev → Sign up → API Keys |
| Gmail OAuth | Google Cloud Console → 新規プロジェクト → Gmail API有効化 → 認証情報作成 → OAuth2 Client ID |

---

*このドキュメントはmission-controlリポジトリのPhase 2要件定義書です。*
*Claude Codeと協力して設計・実装しています。*
