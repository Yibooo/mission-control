import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---- Workspaces ----

export const listWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("workspaces").order("desc").collect();
  },
});

export const createWorkspace = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    workspaceType: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("archived")),
    config: v.optional(v.string()),         // JSON文字列: カラム定義・設定など
    assignedAgentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("workspaces", {
      ...args,
      logs: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateWorkspace = mutation({
  args: {
    id: v.id("workspaces"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"), v.literal("archived"))),
    config: v.optional(v.string()),
    assignedAgentIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

export const appendLog = mutation({
  args: {
    id: v.id("workspaces"),
    message: v.string(),
  },
  handler: async (ctx, { id, message }) => {
    const ws = await ctx.db.get(id);
    if (!ws) return;
    const logs = [...ws.logs, `[${new Date().toISOString()}] ${message}`].slice(-50); // 最大50件保持
    await ctx.db.patch(id, { logs, updatedAt: Date.now() });
  },
});

export const removeWorkspace = mutation({
  args: { id: v.id("workspaces") },
  handler: async (ctx, { id }) => {
    // 紐づくアイテムも削除
    const items = await ctx.db
      .query("workspaceItems")
      .filter((q) => q.eq(q.field("workspaceId"), id))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(id);
  },
});

// ---- WorkspaceItems ----

export const listItems = query({
  args: { workspaceId: v.string() },
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db
      .query("workspaceItems")
      .filter((q) => q.eq(q.field("workspaceId"), workspaceId))
      .order("desc")
      .collect();
  },
});

export const createItem = mutation({
  args: {
    workspaceId: v.string(),
    fields: v.string(),                       // JSON文字列
    status: v.optional(v.string()),
    assignedAgentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("workspaceItems", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateItem = mutation({
  args: {
    id: v.id("workspaceItems"),
    fields: v.optional(v.string()),
    status: v.optional(v.string()),
    assignedAgentId: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});

export const removeItem = mutation({
  args: { id: v.id("workspaceItems") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
