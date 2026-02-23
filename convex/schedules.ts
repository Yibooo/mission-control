import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("schedules").order("desc").collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    scheduledAt: v.string(),
    type: v.union(v.literal("task"), v.literal("cron"), v.literal("deadline"), v.literal("event")),
    agentId: v.optional(v.string()),
    status: v.union(v.literal("scheduled"), v.literal("running"), v.literal("done"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("schedules", { ...args, createdAt: Date.now() });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("schedules"),
    status: v.union(v.literal("scheduled"), v.literal("running"), v.literal("done"), v.literal("failed")),
  },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status });
  },
});

export const remove = mutation({
  args: { id: v.id("schedules") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
