"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

type Message = {
  _id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  createdAt: number;
};

type ActionItem = {
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

export default function CommandPage() {
  const messages = useQuery(api.messages.list) as Message[] | undefined;
  const addMessage = useMutation(api.messages.add);
  const clearMessages = useMutation(api.messages.clear);
  const chat = useAction(api.ai.chat);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastActions, setLastActions] = useState<ActionItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);
    setLastActions([]);

    try {
      // ユーザーメッセージをDBに保存
      await addMessage({ role: "user", content: text });

      // Claude API呼び出し（ai.tsのchat actionを使用）
      const result = await chat({ userMessage: text });
      setLastActions(result.actions ?? []);
    } catch (err) {
      console.error("エラー:", err);
      await addMessage({
        role: "assistant",
        content: "⚠️ エラーが発生しました。しばらくしてから再試行してください。",
        agentName: "System",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = async () => {
    if (confirm("会話履歴をすべて削除しますか？")) {
      await clearMessages();
      setLastActions([]);
    }
  };

  // アクションバッジの色
  const actionColor = (type: string) => {
    if (type === "create_task") return { bg: "rgba(99,102,241,0.15)", border: "#6366f1", text: "#a5b4fc" };
    if (type === "save_memory") return { bg: "rgba(16,185,129,0.15)", border: "#10b981", text: "#6ee7b7" };
    if (type === "update_agent_status") return { bg: "rgba(245,158,11,0.15)", border: "#f59e0b", text: "#fcd34d" };
    return { bg: "rgba(100,116,139,0.15)", border: "#64748b", text: "#94a3b8" };
  };

  const actionLabel = (type: string) => {
    if (type === "create_task") return "📋 タスク作成";
    if (type === "save_memory") return "🧠 メモリ保存";
    if (type === "update_agent_status") return "👤 エージェント更新";
    return type;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", maxHeight: "calc(100vh - 48px)" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e2e8f0" }}>🤖 Command</h1>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
            Commanderに指示を送る — タスク作成・メモリ保存・エージェント制御
          </p>
        </div>
        <button
          onClick={handleClear}
          style={{
            background: "var(--surface-2)",
            color: "#64748b",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          🗑 履歴をクリア
        </button>
      </div>

      {/* 実行されたアクション表示 */}
      {lastActions.length > 0 && (
        <div style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "12px",
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "12px", color: "#64748b", alignSelf: "center" }}>実行済みアクション:</span>
          {lastActions.map((a, i) => {
            const c = actionColor(a.type);
            return (
              <span
                key={i}
                style={{
                  fontSize: "11px",
                  padding: "3px 10px",
                  borderRadius: "99px",
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  color: c.text,
                  fontWeight: 500,
                }}
              >
                {actionLabel(a.type)}{a.title ? `: ${a.title}` : ""}
              </span>
            );
          })}
        </div>
      )}

      {/* メッセージエリア */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        paddingRight: "4px",
        marginBottom: "16px",
      }}>
        {/* 初期ガイダンス */}
        {(!messages || messages.length === 0) && !isLoading && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "16px",
            color: "#475569",
          }}>
            <div style={{ fontSize: "48px" }}>👑</div>
            <div style={{ fontSize: "16px", color: "#94a3b8", fontWeight: 600 }}>Commander AI に指示を送ろう</div>
            <div style={{ fontSize: "13px", color: "#475569", textAlign: "center", lineHeight: "1.8", maxWidth: "400px" }}>
              例：<br />
              「記事執筆タスクを作成して、WriterをWorkingにして」<br />
              「このプロジェクトの設計方針をメモリに保存して」<br />
              「今週のタスクを整理して優先度をつけて」
            </div>
            <div style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: "8px",
            }}>
              {[
                "📋 タスク作成",
                "🧠 メモリ保存",
                "👤 エージェント制御",
              ].map((label) => (
                <span
                  key={label}
                  style={{
                    fontSize: "12px",
                    padding: "4px 12px",
                    borderRadius: "99px",
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.3)",
                    color: "#a5b4fc",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* メッセージ一覧 */}
        {messages?.map((m) => {
          const isUser = m.role === "user";
          return (
            <div
              key={m._id}
              style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
                gap: "10px",
                alignItems: "flex-start",
              }}
            >
              {/* アシスタントアバター */}
              {!isUser && (
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "rgba(99,102,241,0.2)",
                  border: "1px solid rgba(99,102,241,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  flexShrink: 0,
                }}>
                  👑
                </div>
              )}

              <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: "4px", alignItems: isUser ? "flex-end" : "flex-start" }}>
                {/* エージェント名 */}
                {!isUser && m.agentName && (
                  <span style={{ fontSize: "11px", color: "#6366f1", fontWeight: 600 }}>
                    {m.agentName}
                  </span>
                )}
                {/* バブル */}
                <div style={{
                  background: isUser ? "#6366f1" : "var(--surface)",
                  border: isUser ? "none" : "1px solid var(--border)",
                  borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                  padding: "10px 14px",
                  fontSize: "14px",
                  color: isUser ? "white" : "#cbd5e1",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {m.content}
                </div>
                {/* タイムスタンプ */}
                <span style={{ fontSize: "10px", color: "#475569" }}>
                  {new Date(m.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* ユーザーアバター */}
              {isUser && (
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#6366f1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  flexShrink: 0,
                }}>
                  🧑
                </div>
              )}
            </div>
          );
        })}

        {/* ローディング表示 */}
        {isLoading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              flexShrink: 0,
            }}>
              👑
            </div>
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "4px 16px 16px 16px",
              padding: "12px 16px",
            }}>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#6366f1",
                      animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div style={{
        flexShrink: 0,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "12px",
        display: "flex",
        gap: "10px",
        alignItems: "flex-end",
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Commanderへの指示を入力... (Enter で送信 / Shift+Enter で改行)"
          disabled={isLoading}
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#e2e8f0",
            fontSize: "14px",
            resize: "none",
            lineHeight: "1.5",
            maxHeight: "120px",
            overflowY: "auto",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          style={{
            background: isLoading || !input.trim() ? "rgba(99,102,241,0.3)" : "#6366f1",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "14px",
            cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
            fontWeight: 600,
            flexShrink: 0,
            transition: "all 0.2s",
          }}
        >
          {isLoading ? "⏳" : "送信 ↑"}
        </button>
      </div>

      {/* アニメーションCSS */}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
