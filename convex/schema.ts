import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // タスクボード
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("todo"), v.literal("in_progress"), v.literal("done")),
    assignee: v.union(v.literal("human"), v.literal("ai")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    dueDate: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // カレンダー・スケジュール
  schedules: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    scheduledAt: v.string(),
    type: v.union(v.literal("task"), v.literal("cron"), v.literal("deadline"), v.literal("event")),
    agentId: v.optional(v.string()),
    status: v.union(v.literal("scheduled"), v.literal("running"), v.literal("done"), v.literal("failed")),
    createdAt: v.number(),
  }),

  // メモリ
  memories: defineTable({
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    category: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // ワークスペース（汎用仕事の枠）
  // 具体的な仕事の種類は workspaceType で動的に定義し、
  // config フィールドに JSON 文字列として任意の設定を保持する
  workspaces: defineTable({
    name: v.string(),                          // 表示名（例: "SNS投稿管理"）
    icon: v.optional(v.string()),              // 絵文字アイコン
    workspaceType: v.string(),                 // 仕事の種類（自由文字列: "sns", "crm", "analytics" 等）
    description: v.optional(v.string()),       // 説明
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    // 仕事ごとの動的設定（JSON文字列で任意のキーバリューを保持）
    config: v.optional(v.string()),
    // このワークスペースを担当するエージェントID（複数可）
    assignedAgentIds: v.array(v.string()),
    // 進捗メモ・ログ（最新N件）
    logs: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // ワークスペース内のアイテム（汎用レコード）
  // workspaceItems は workspaceId に紐づく汎用データ行
  workspaceItems: defineTable({
    workspaceId: v.string(),
    // カラム定義は workspaces.config で定義したものを参照
    // 実データは fields に { key: value } 形式で格納
    fields: v.string(),          // JSON文字列: { "タイトル": "...", "ステータス": "todo", ... }
    status: v.optional(v.string()),
    assignedAgentId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // Commandチャット履歴
  messages: defineTable({
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    agentName: v.optional(v.string()),   // 応答したエージェント名
    createdAt: v.number(),
  }),

  // エージェント（チーム）
  agents: defineTable({
    name: v.string(),
    role: v.string(),
    description: v.string(),
    type: v.union(v.literal("main"), v.literal("sub")),
    status: v.union(v.literal("idle"), v.literal("working"), v.literal("offline")),
    currentTask: v.optional(v.string()),
    avatar: v.optional(v.string()),
    completedTasks: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
});
