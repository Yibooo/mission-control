# Mission Control — CLAUDE.md

## プロジェクト概要
AIマルチエージェント管理システム。
NextJS + Convex で構築した「司令塔AI + サブエージェント」の管理ダッシュボード。

## 技術スタック
- フロントエンド: Next.js (App Router, TypeScript)
- データベース: Convex（リアルタイムDB）
- スタイル: インラインスタイル（CSS変数使用）

## ディレクトリ構成
```
src/
  app/
    page.tsx                      # ダッシュボード（サマリー）
    tasks/page.tsx                # タスクボード（カンバン）
    workspaces/page.tsx           # ワークスペース一覧（汎用仕事の枠）
    workspaces/[id]/page.tsx      # ワークスペース詳細（アイテム管理）
    calendar/page.tsx             # カレンダー・スケジュール管理
    memories/page.tsx             # メモリ（AIとの会話記録）
    team/page.tsx                 # チーム（エージェント管理）
  components/
    Sidebar.tsx                   # 左ナビゲーション
convex/
  schema.ts           # DBスキーマ定義
  tasks.ts            # タスクCRUD
  schedules.ts        # スケジュールCRUD
  memories.ts         # メモリCRUD
  agents.ts           # エージェントCRUD
  workspaces.ts       # ワークスペース・アイテムCRUD
```

## エージェント構成
| 名前 | 役割 | タイプ |
|------|------|--------|
| Commander | 全体統括・司令塔 | main |
| Developer | コード実装・バグ修正 | sub |
| Writer | ライティング・コンテンツ制作 | sub |
| Designer | UI/UX・デザイン | sub |
| Researcher | 情報収集・調査 | sub |

## 開発ルール（Open Clow / Claude Code 共通）
1. Convexスキーマを変更したら `convex/schema.ts` を必ず更新する
2. 新機能追加は `src/app/[機能名]/page.tsx` として追加する
3. Sidebarのnavitemsに新ページへのリンクを追加する
4. スタイルはインラインスタイル + CSS変数（`var(--surface)` 等）を使用
5. Convex関数は `convex/` ディレクトリに機能別ファイルで管理する

## 起動方法
```bash
# Convexの起動（別ターミナル）
npx convex dev

# Next.jsの起動
npm run dev
```

## 環境変数
```
NEXT_PUBLIC_CONVEX_URL=  # Convexダッシュボードから取得
```

## ワークスペース（汎用仕事の枠）の設計

### 概念
`workspaces` テーブルは「仕事の種類」を表す汎用コンテナ。
具体的なカラム構成は `config` フィールドに JSON で動的に保持する。

```json
// config の例
{
  "columns": ["タイトル", "プラットフォーム", "ステータス", "予定日"]
}
```

### workspaceItems との関係
- `workspaceItems.workspaceId` = `workspaces._id`
- `workspaceItems.fields` = JSON文字列で任意のキーバリュー
- カラムを追加・削除しても既存データは壊れない設計

### 仕事タイプ例（workspaceType）
| type | 用途 |
|------|------|
| sns | SNS投稿・コンテンツ管理 |
| crm | 顧客管理 |
| analytics | データ分析 |
| research | リサーチ・情報収集 |
| campaign | キャンペーン管理 |
| dev | 開発タスク管理 |
| custom | 完全カスタム |

新しい `workspaceType` はUIから自由に追加できる。
テンプレートを増やす場合は `workspaces/page.tsx` の `TYPE_TEMPLATES` 配列に追記する。

## 機能拡張ガイド
新しい専用ページ（固定スキーマ）を追加する場合：
1. `convex/schema.ts` にテーブル定義を追加
2. `convex/[機能名].ts` にCRUD関数を作成
3. `src/app/[機能名]/page.tsx` にUIを実装
4. `src/components/Sidebar.tsx` のnavItemsにエントリーを追加

汎用の仕事を追加する場合（推奨）：
1. ブラウザで「ワークスペース」ページを開く
2. 「+ ワークスペース追加」でテンプレートまたはカスタムを選択
3. カラム定義を入力して作成
4. 詳細ページからカラムをいつでも追加・削除可能
