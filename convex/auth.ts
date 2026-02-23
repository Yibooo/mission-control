"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

// セッション有効期限: 30日
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// ─── ログイン ───────────────────────────────────────────────
export const login = action({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { username, password }) => {
    const user = await ctx.runQuery(internal.authHelpers.getUserByUsername, { username });
    if (!user) {
      throw new Error("IDまたはパスワードが正しくありません");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error("IDまたはパスワードが正しくありません");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + SESSION_DURATION_MS;

    await ctx.runMutation(internal.authHelpers.createSession, {
      userId: user._id,
      token,
      expiresAt,
    });

    return {
      token,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName ?? user.username,
        role: user.role,
      },
    };
  },
});

// ─── セッション検証 ─────────────────────────────────────────
export const me = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await ctx.runQuery(internal.authHelpers.getSession, { token });
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      await ctx.runMutation(internal.authHelpers.deleteSession, { token });
      return null;
    }
    const user = await ctx.runQuery(internal.authHelpers.getUserById, { userId: session.userId });
    if (!user) return null;
    return {
      id: user._id,
      username: user.username,
      displayName: user.displayName ?? user.username,
      role: user.role,
    };
  },
});

// ─── ログアウト ─────────────────────────────────────────────
export const logout = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await ctx.runMutation(internal.authHelpers.deleteSession, { token });
    return { ok: true };
  },
});

// ─── 初期ユーザー作成（ADMIN_SECRET_KEYで保護）─────────────
export const createInitialUser = action({
  args: {
    username: v.string(),
    password: v.string(),
    displayName: v.optional(v.string()),
    secretKey: v.string(),
  },
  handler: async (ctx, { username, password, displayName, secretKey }) => {
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (!adminSecret || secretKey !== adminSecret) {
      throw new Error("不正なリクエストです");
    }

    const existing = await ctx.runQuery(internal.authHelpers.getUserByUsername, { username });
    if (existing) {
      throw new Error(`ユーザー「${username}」はすでに存在します`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await ctx.runMutation(internal.authHelpers.insertUser, {
      username,
      passwordHash,
      displayName,
      role: "admin",
    });

    return { ok: true, username };
  },
});
