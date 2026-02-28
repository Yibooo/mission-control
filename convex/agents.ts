import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    description: v.string(),
    type: v.union(v.literal("main"), v.literal("sub")),
    status: v.union(v.literal("idle"), v.literal("working"), v.literal("offline")),
    currentTask: v.optional(v.string()),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("agents", {
      ...args,
      completedTasks: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("agents"),
    status: v.union(v.literal("idle"), v.literal("working"), v.literal("offline")),
    currentTask: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, currentTask }) => {
    await ctx.db.patch(id, { status, currentTask, updatedAt: Date.now() });
  },
});

// Phase 3: エージェント可視化用 — リアルタイムアクション更新
export const updateActivity = mutation({
  args: {
    id: v.id("agents"),
    currentAction: v.optional(v.string()),
  },
  handler: async (ctx, { id, currentAction }) => {
    const now = Date.now();
    const agent = await ctx.db.get(id);
    if (!agent) return;

    const prevLog = agent.activityLog ?? [];
    const newLog = currentAction
      ? [{ action: currentAction, timestamp: now }, ...prevLog].slice(0, 20)
      : prevLog;

    await ctx.db.patch(id, {
      currentAction,
      activityLog: newLog,
      updatedAt: now,
    });
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("agents").collect();
    if (existing.length > 0) return;
    const now = Date.now();
    const defaultAgents = [
      { name: "Commander",   role: "司令塔AI",      description: "全体の統括・タスク割り振り・意思決定",         type: "main" as const, avatar: "👑", department: "ops" },
      { name: "Developer",   role: "開発者",        description: "コード実装・バグ修正・技術調査",               type: "sub" as const,  avatar: "💻", department: "dev" },
      { name: "Writer",      role: "ライター",      description: "コンテンツ制作・文章生成・翻訳",               type: "sub" as const,  avatar: "✍️", department: "ops" },
      { name: "Designer",    role: "デザイナー",    description: "UI/UX設計・画像生成・ビジュアル制作",          type: "sub" as const,  avatar: "🎨", department: "ops" },
      { name: "Researcher",  role: "リサーチャー",  description: "情報収集・市場調査・データ分析",               type: "sub" as const,  avatar: "🔍", department: "research" },
      // Phase 2: AI駆け込み寺 営業エージェント
      { name: "Prospector",  role: "営業リサーチ",  description: "ターゲット企業のリストアップ・Web検索（Tavily）", type: "sub" as const, avatar: "🎯", department: "sales" },
      { name: "Copywriter",  role: "メール生成",    description: "企業ごとにパーソナライズされた営業メールを生成（Claude）", type: "sub" as const, avatar: "📝", department: "sales" },
      { name: "Sender",      role: "メール送信",    description: "承認済みメールをGmail APIで送信（人間承認後のみ）", type: "sub" as const, avatar: "📤", department: "sales" },
      { name: "Tracker",     role: "返信監視",      description: "返信・開封を監視しフォローアップを管理（Gmail API）", type: "sub" as const, avatar: "📊", department: "sales" },
    ];
    for (const agent of defaultAgents) {
      await ctx.db.insert("agents", {
        ...agent,
        status: "idle",
        completedTasks: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
