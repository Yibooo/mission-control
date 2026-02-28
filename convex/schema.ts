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

  // ユーザー認証
  users: defineTable({
    username: v.string(),          // ログインID
    passwordHash: v.string(),      // bcryptハッシュ
    displayName: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("member")),
    createdAt: v.number(),
  }).index("by_username", ["username"]),

  // セッショントークン
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),             // ランダムトークン
    expiresAt: v.number(),         // UNIXミリ秒
    createdAt: v.number(),
  }).index("by_token", ["token"]),

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
    // Phase 3: エージェント可視化UI用フィールド
    currentAction: v.optional(v.string()),     // リアルタイムアクション表示用
    department: v.optional(v.string()),         // 部署: "sales" | "research" | "ops"
    activityLog: v.optional(v.array(v.object({
      action: v.string(),
      timestamp: v.number(),
    }))),
  }),

  // ─────────────────────────────────────────────
  // Phase 2: AI駆け込み寺 営業エージェント
  // ─────────────────────────────────────────────

  // 見込み企業管理
  leads: defineTable({
    companyName: v.string(),
    industry: v.string(),
    location: v.string(),
    estimatedSize: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    // ── Phase 2-D: フォーム送信PIVOT ─────────────
    contactFormUrl: v.optional(v.string()),   // お問い合わせフォームURL（Firecrawl で発見）
    formFields: v.optional(v.string()),       // フォームフィールド構造（JSON文字列）
    // ─────────────────────────────────────────────
    contactEmail: v.string(),
    contactName: v.optional(v.string()),
    researchSummary: v.optional(v.string()),
    status: v.union(
      v.literal("researching"),
      v.literal("draft_ready"),
      v.literal("captcha_required"),  // CAPTCHA検出 → 手動送信待ち
      v.literal("contacted"),
      v.literal("replied"),
      v.literal("negotiating"),
      v.literal("closed_won"),
      v.literal("closed_lost"),
      v.literal("rejected")
    ),
    source: v.optional(v.string()),
    assignedAgentId: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // 生成メール草稿（Phase 2-D: フォーム送信にも対応）
  emailDrafts: defineTable({
    leadId: v.id("leads"),
    subject: v.string(),
    body: v.string(),
    approvalStatus: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("sent"),
      v.literal("submitted"),   // フォーム経由で送信済み
      v.literal("failed")       // 送信失敗
    ),
    editedBody: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),    // フォーム送信日時
    failureReason: v.optional(v.string()),  // 失敗理由
    generatedBy: v.optional(v.string()),
    createdAt: v.number(),
  }),

  // 営業アクティビティログ
  salesLogs: defineTable({
    leadId: v.id("leads"),
    emailDraftId: v.optional(v.id("emailDrafts")),
    event: v.union(
      v.literal("lead_created"),
      v.literal("research_done"),
      v.literal("form_url_found"),       // フォームURL発見
      v.literal("captcha_detected"),     // CAPTCHA検出 → スキップ
      v.literal("draft_generated"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("sent"),
      v.literal("form_submitted"),       // フォーム経由で送信成功
      v.literal("submission_failed"),    // フォーム送信失敗
      v.literal("opened"),
      v.literal("replied"),
      v.literal("follow_up_scheduled"),
      v.literal("meeting_scheduled")
    ),
    detail: v.optional(v.string()),
    performedBy: v.optional(v.string()),
    createdAt: v.number(),
  }),
});
