// "use node" なし — Convexランタイムで動くinternal query/mutation

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ─── Internal Queries ───────────────────────────────────────

export const getUserByUsername = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
  },
});

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const getSession = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
  },
});

// ─── Internal Mutations ─────────────────────────────────────

export const createSession = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { userId, token, expiresAt }) => {
    await ctx.db.insert("sessions", {
      userId,
      token,
      expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const deleteSession = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

export const insertUser = internalMutation({
  args: {
    username: v.string(),
    passwordHash: v.string(),
    displayName: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, { username, passwordHash, displayName, role }) => {
    await ctx.db.insert("users", {
      username,
      passwordHash,
      displayName,
      role,
      createdAt: Date.now(),
    });
  },
});
