import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("memories").order("desc").collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("memories", { ...args, createdAt: now, updatedAt: now });
  },
});

export const remove = mutation({
  args: { id: v.id("memories") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});
