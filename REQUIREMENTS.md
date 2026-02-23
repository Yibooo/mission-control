# Mission Control — 要件定義書

**バージョン**: 1.0.0
**作成日**: 2026年2月23日
**ステータス**: Phase 1 実装完了 / Phase 2・3 計画中

---

## 1. プロジェクト概要

### 1.1 目的

AIエージェントを「会社の従業員」として組織的に管理・運用するための
**AIマルチエージェント管理ダッシュボード「Mission Control」** を構築する。

単なるチャットAIの使い方から脱却し、**複数のAIが自律的にタスクをこなし、
その進捗をリアルタイムで可視化できるシステム**を実現する。

### 1.2 コンセプト

```
「AIを使う」から「AIに働いてもらう」へ
```

- **可視化**: 誰が何をやっているか、今この瞬間わかる
- **組織化**: 司令塔AIとサブエージェントによる役割分担
- **汎用化**: どんな種類の仕事にも対応できる柔軟な設計
- **マルチアクセス**: Open Clow・Claude Code・Web UIどこからでも操作可能

---

## 2. 技術スタック

| レイヤー | 技術 | 理由 |
|---------|------|------|
| フロントエンド | Next.js 16 (App Router / TypeScript) | React基盤・SSR対応・Vercel最適化 |
| データベース | Convex | リアルタイムDB・WebSocket自動同期・サーバーレス |
| スタイル | インラインスタイル + CSS変数 | 依存ゼロ・テーマ管理容易 |
| AI実装ツール | Claude Code | コード生成・ファイル操作・git管理 |
| AI操作ツール | Open Clow | 日常的な指示・タスク操作・会話的UI |
| ホスティング（予定） | Vercel | Next.js最適化・無料プラン対応 |
| AI脳みそ（予定） | Anthropic API (Claude) | エージェントの推論・実行エンジン |

---

## 3. アーキテクチャ

### 3.1 現在のアーキテクチャ（Phase 1）

```
┌─────────────────────────────────────────────┐
│           Mission Control (Next.js)          │
│                                             │
│  Dashboard / Tasks / Workspaces /           │
│  Calendar / Memories / Team                 │
└──────────────────┬──────────────────────────┘
                   │ リアルタイム同期（WebSocket）
                   ▼
┌─────────────────────────────────────────────┐
│              Convex Cloud (DB)               │
│                                             │
│  tasks / schedules / memories /             │
│  agents / workspaces / workspaceItems       │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
    Open Clow              Claude Code
  （チャットUI）           （ターミナル）
  日常的な指示・操作       コード実装・機能追加
```

### 3.2 目標アーキテクチャ（Phase 2・3）

```
スマホ / PC / タブレット
        │ HTTPS
        ▼
┌─────────────────────────────────────────────┐
│        Vercel（Next.js ホスティング）         │
│                                             │
│  + Command UI（チャット風コマンド入力）        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│           Convex Cloud (DB + Actions)        │
│                                             │
│  HTTP Actions → Anthropic API 呼び出し       │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────────────┐
│   Anthropic API      │  ← エージェントの「脳みそ」
│   (Claude モデル)    │
└─────────────────────┘
       │
       ▼ AIが判断・実行
タスク追加 / メモリ保存 / エージェント指示 / ...
```

---

## 4. エージェント構成

| 名前 | 役割 | タイプ | アバター |
|------|------|--------|---------|
| Commander | 全体統括・タスク割り振り・意思決定 | main（司令塔） | 👑 |
| Developer | コード実装・バグ修正・技術調査 | sub | 💻 |
| Writer | ライティング・コンテンツ制作・翻訳 | sub | ✍️ |
| Designer | UI/UX設計・画像生成・ビジュアル制作 | sub | 🎨 |
| Researcher | 情報収集・市場調査・データ分析 | sub | 🔍 |

**エージェントステータス**: `idle`（待機中）/ `working`（稼働中）/ `offline`（オフライン）

---

## 5. 機能要件（Phase 1 実装済み）

### 5.1 ダッシュボード（`/`）

- Todo数・進行中・完了・稼働エージェント数・メモリ数・スケジュール数をカード表示
- 最近のタスク5件をリスト表示
- 各カードから該当ページへ遷移

### 5.2 タスクボード（`/tasks`）

- **カンバン形式**: Todo / 進行中 / 完了 の3カラム
- タスク属性: タイトル・説明・ステータス・担当者（AI or 自分）・優先度（高/中/低）・期限
- ステータス変更: カラム間のワンクリック移動
- Convexリアルタイム同期: 変更が即座に全クライアントに反映

### 5.3 ワークスペース（`/workspaces`, `/workspaces/[id]`）

**設計の核心: 汎用仕事コンテナ**

```
workspaces テーブル
├── workspaceType  : 仕事の種類（自由文字列）
├── config         : カラム定義をJSON文字列で動的保持
│     例: {"columns": ["タイトル", "ステータス", "担当AI"]}
└── logs[]         : AIの作業ログ（最新50件）

workspaceItems テーブル
├── workspaceId    : 親ワークスペースのID
└── fields         : データをJSON文字列で格納
      例: {"タイトル": "記事A", "ステータス": "in_progress"}
```

**特性**:
- カラムを後から追加・削除しても既存データが壊れない
- コードを1行も変えずに新しい種類の仕事に対応可能
- テンプレート: SNS管理 / CRM / データ分析 / リサーチ / キャンペーン / 開発 / カスタム

### 5.4 カレンダー（`/calendar`）

- スケジュール種別: タスク / 定期実行(Cron) / 締め切り / イベント
- ステータス管理: 予定 / 実行中 / 完了 / 失敗
- 時系列ソート表示

### 5.5 メモリ（`/memories`）

- AIとの会話・指示内容の永続化
- **キーワード全文検索**: タイトル・本文・タグに対してリアルタイムフィルタ
- **ワンクリックコピー**:
  - カード右上「📋 コピー」ボタン（折りたたみ時）
  - 展開時「📋 全文コピー」ボタン（本文エリア右上固定）
  - クリック後2秒間「✅ コピー済」表示でフィードバック
- タグ・カテゴリによる分類
- Note/ブログ等への貼り付け用途を想定

### 5.6 チーム（`/team`）

- 司令塔AI（Commander）とサブエージェント一覧表示
- エージェントステータスのリアルタイム更新
- 初回アクセス時にデフォルト5エージェントを自動シード
- 完了タスク数の累積表示

---

## 6. データベース設計（Convex スキーマ）

```typescript
// tasks: タスク管理
tasks: {
  title: string
  description?: string
  status: "todo" | "in_progress" | "done"
  assignee: "human" | "ai"
  priority: "low" | "medium" | "high"
  dueDate?: string
  createdAt: number
  updatedAt: number
}

// schedules: カレンダー
schedules: {
  title: string
  description?: string
  scheduledAt: string        // ISO日時文字列
  type: "task" | "cron" | "deadline" | "event"
  agentId?: string
  status: "scheduled" | "running" | "done" | "failed"
  createdAt: number
}

// memories: メモリ
memories: {
  title: string
  content: string            // マークダウン対応
  tags: string[]
  category?: string
  createdAt: number
  updatedAt: number
}

// workspaces: 汎用仕事の枠
workspaces: {
  name: string
  icon?: string
  workspaceType: string      // "sns" | "crm" | "analytics" | ... | 自由文字列
  description?: string
  status: "active" | "paused" | "archived"
  config?: string            // JSON: { columns: string[] }
  assignedAgentIds: string[]
  logs: string[]             // 最新50件のタイムスタンプ付きログ
  createdAt: number
  updatedAt: number
}

// workspaceItems: ワークスペース内アイテム
workspaceItems: {
  workspaceId: string
  fields: string             // JSON: { [columnName]: value }
  status?: string            // "todo" | "in_progress" | "done" | "pending" | 自由文字列
  assignedAgentId?: string
  createdAt: number
  updatedAt: number
}

// agents: エージェント
agents: {
  name: string
  role: string
  description: string
  type: "main" | "sub"
  status: "idle" | "working" | "offline"
  currentTask?: string
  avatar?: string
  completedTasks: number
  createdAt: number
  updatedAt: number
}
```

---

## 7. 非機能要件

| 項目 | 要件 |
|------|------|
| リアルタイム性 | データ変更が全クライアントに即時反映（WebSocket） |
| レスポンシブ | デスクトップ優先・スマホ対応はPhase 2で対応 |
| テーマ | ダークモード固定（宇宙感のある配色） |
| 認証 | Phase 1: なし（ローカル開発のみ） / Phase 2: 要検討 |
| セキュリティ | APIキーはConvex環境変数で管理（クライアント非公開） |

---

## 8. 開発フェーズ

### ✅ Phase 1: 基盤構築（完了）

- [x] Next.js + Convex プロジェクト構築
- [x] 6機能のUI実装（Dashboard / Tasks / Workspaces / Calendar / Memories / Team）
- [x] 汎用ワークスペース設計（動的カラム・JSON設計）
- [x] エージェント管理基盤（5エージェント・自動シード）
- [x] メモリのワンクリックコピー機能
- [x] CLAUDE.md によるAI共通ルール定義
- [x] WriterエージェントによるNote記事執筆・メモリ保存の実証

### 🔲 Phase 2: AI脳みそ接続 + Web公開

- [ ] Anthropic API キー取得・設定
- [ ] Convex HTTP Actions でClaude API呼び出し実装
- [ ] Command UI（`/command`）: チャット風コマンド入力ページ
- [ ] CommanderエージェントのAI推論実装
  - タスク自動作成・更新
  - メモリ自動保存
  - エージェントへの指示割り振り
- [ ] GitHub リポジトリ作成・CI設定
- [ ] Vercel デプロイ（本番環境構築）
- [ ] Convex 本番デプロイ（`npx convex deploy`）
- [ ] スマホ対応レイアウト（レスポンシブ化）

### 🔲 Phase 3: マルチエージェント自律化

- [ ] エージェント間タスク受け渡し（Commander → Sub）
- [ ] 並列エージェント実行
- [ ] Webhook連携（外部サービスからタスク自動登録）
- [ ] 収益ダッシュボード（AIが稼いだ成果の可視化）
- [ ] 定期実行（Cron）によるAI自動稼働
- [ ] モバイルアプリ化（PWA対応）

---

## 9. 開発ルール（Open Clow / Claude Code 共通）

1. Convexスキーマを変更したら `convex/schema.ts` を必ず更新する
2. 新機能追加は `src/app/[機能名]/page.tsx` として追加する
3. `src/components/Sidebar.tsx` の `navItems` に新ページへのリンクを追加する
4. スタイルはインラインスタイル + CSS変数（`var(--surface)` 等）を使用
5. Convex関数は `convex/` ディレクトリに機能別ファイルで管理する
6. 汎用の仕事はワークスペースを活用し、専用ページは作らない

---

## 10. 環境変数

```bash
# .env.local（ローカル開発）
NEXT_PUBLIC_CONVEX_URL=https://xxxx.convex.cloud   # Convex dev で自動生成

# Phase 2 以降追加予定
ANTHROPIC_API_KEY=sk-ant-xxxx                       # Anthropic コンソールで取得
```

---

## 11. 起動方法

```bash
# ターミナル1: Convex開発サーバー
cd ~/Desktop/mission-control
npx convex dev

# ターミナル2: Next.js開発サーバー
cd ~/Desktop/mission-control
npm run dev

# ブラウザで開く
open http://localhost:3000
```

---

## 12. 実証済みユースケース

| ユースケース | 担当エージェント | 結果 |
|-------------|----------------|------|
| Mission Control開発プロセスのNote記事執筆 | Writer | ✅ 約3,500字のマークダウン記事を生成・メモリ保存 |
| タスクのステータス管理（進行中→完了） | Commander（UI経由） | ✅ リアルタイムでDBに反映 |
| 汎用ワークスペースの動的カラム追加 | Developer（Claude Code） | ✅ コード変更なしで対応 |

---

*本ドキュメントはMission Controlプロジェクトの要件定義書です。*
*Claude Code（Writerエージェント役）により言語化・整理されました。*
