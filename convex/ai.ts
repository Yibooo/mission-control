"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ────────────────────────────────────────────────────────────
// Commander の System Prompt
// ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `あなたは「Commander」— Mission Control の司令塔AIです。
ユーザーからのコマンドを受け取り、以下の仕事を自律的に実行します。

## あなたの能力
ユーザーの指示を理解し、以下のアクションを JSON で返してください。
必ず以下の形式で応答してください：

{
  "message": "ユーザーへの返答メッセージ（日本語）",
  "actions": [
    // 実行するアクションの配列（不要なら空配列）
    {
      "type": "create_task",
      "title": "タスクのタイトル",
      "description": "詳細説明",
      "assignee": "ai" | "human",
      "priority": "high" | "medium" | "low"
    },
    {
      "type": "save_memory",
      "title": "メモリタイトル",
      "content": "保存する内容",
      "tags": ["タグ1", "タグ2"],
      "category": "カテゴリ名"
    },
    {
      "type": "update_agent_status",
      "agentName": "Writer" | "Developer" | "Designer" | "Researcher",
      "status": "working" | "idle" | "offline",
      "currentTask": "現在のタスク説明"
    }
  ]
}

## ルール
- 常に日本語で返答する
- タスク作成・メモリ保存などの実行結果を明確に伝える
- ユーザーが「〇〇して」と言ったら該当のactionを必ず含める
- 返答は必ず上記JSONフォーマットのみ（コードブロックなし）`;

// ────────────────────────────────────────────────────────────
// メイン Action: ユーザーメッセージを受け取り Claude API を呼ぶ
// ────────────────────────────────────────────────────────────
export const chat = action({
  args: {
    userMessage: v.string(),
  },
  handler: async (ctx, { userMessage }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません");

    // 会話履歴を取得（直近20件）
    const history = await ctx.runQuery(api.messages.list);
    const recentHistory = history.slice(-20);

    // Claude API 呼び出し
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          ...recentHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API エラー: ${err}`);
    }

    const data = await response.json();
    const rawText: string = data.content?.[0]?.text ?? "{}";

    // JSON パース
    let parsed: { message: string; actions: Action[] };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // JSON 以外が返ってきた場合はそのまま message として扱う
      parsed = { message: rawText, actions: [] };
    }

    // ── アクションを実行 ──────────────────────────────────────
    for (const action of parsed.actions ?? []) {
      if (action.type === "create_task") {
        await ctx.runMutation(api.tasks.create, {
          title: action.title ?? "無題タスク",
          description: action.description,
          status: "todo",
          assignee: action.assignee === "human" ? "human" : "ai",
          priority: (["high", "medium", "low"].includes(action.priority ?? ""))
            ? (action.priority as "high" | "medium" | "low")
            : "medium",
        });
      }

      if (action.type === "save_memory") {
        await ctx.runMutation(api.memories.create, {
          title: action.title ?? "無題メモリ",
          content: action.content ?? "",
          tags: action.tags ?? [],
          category: action.category,
        });
      }

      if (action.type === "update_agent_status") {
        const agents = await ctx.runQuery(api.agents.list);
        const target = agents.find(
          (a) => a.name.toLowerCase() === (action.agentName ?? "").toLowerCase()
        );
        if (target) {
          const status = (["idle", "working", "offline"].includes(action.status ?? ""))
            ? (action.status as "idle" | "working" | "offline")
            : "idle";
          await ctx.runMutation(api.agents.updateStatus, {
            id: target._id,
            status,
            currentTask: action.currentTask,
          });
        }
      }
    }

    // アシスタントの返答をDBに保存
    await ctx.runMutation(api.messages.add, {
      role: "assistant",
      content: parsed.message,
      agentName: "Commander",
    });

    return { message: parsed.message, actions: parsed.actions ?? [] };
  },
});

// アクション型定義
type Action = {
  type: string;
  title?: string;
  description?: string;
  assignee?: string;
  priority?: string;
  content?: string;
  tags?: string[];
  category?: string;
  agentName?: string;
  status?: string;
  currentTask?: string;
};
