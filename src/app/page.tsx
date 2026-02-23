"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Link from "next/link";

export default function Dashboard() {
  const tasks = useQuery(api.tasks.list);
  const agents = useQuery(api.agents.list);
  const memories = useQuery(api.memories.list);
  const schedules = useQuery(api.schedules.list);

  const todoCount = tasks?.filter((t) => t.status === "todo").length ?? 0;
  const inProgressCount = tasks?.filter((t) => t.status === "in_progress").length ?? 0;
  const doneCount = tasks?.filter((t) => t.status === "done").length ?? 0;
  const workingAgents = agents?.filter((a) => a.status === "working").length ?? 0;

  const cards = [
    { label: "Todo", value: todoCount, color: "#64748b", icon: "📌", href: "/tasks" },
    { label: "進行中", value: inProgressCount, color: "#f59e0b", icon: "⚡", href: "/tasks" },
    { label: "完了", value: doneCount, color: "#10b981", icon: "✅", href: "/tasks" },
    { label: "稼働中エージェント", value: workingAgents, color: "#6366f1", icon: "🤖", href: "/team" },
    { label: "メモリ数", value: memories?.length ?? 0, color: "#8b5cf6", icon: "🧠", href: "/memories" },
    { label: "スケジュール", value: schedules?.length ?? 0, color: "#0ea5e9", icon: "📅", href: "/calendar" },
  ];

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e2e8f0" }}>
          🛸 Mission Control
        </h1>
        <p style={{ color: "#64748b", marginTop: "4px", fontSize: "13px" }}>
          AIマルチエージェント管理システム
        </p>
      </div>

      {/* サマリーカード — grid-3クラスでレスポンシブ */}
      <div
        className="grid-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {cards.map(({ label, value, color, icon, href }) => (
          <Link key={label} href={href} style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ fontSize: "20px", marginBottom: "6px" }}>{icon}</div>
              <div style={{ fontSize: "26px", fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* 最近のタスク */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "16px",
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "14px",
        }}>
          <h2 style={{ fontSize: "15px", fontWeight: 600 }}>最近のタスク</h2>
          <Link href="/tasks" style={{ fontSize: "13px", color: "#6366f1", textDecoration: "none" }}>
            すべて見る →
          </Link>
        </div>
        {tasks?.slice(0, 5).map((task) => (
          <div
            key={task._id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: "18px", flexShrink: 0 }}>
              {task.status === "todo" ? "📌" : task.status === "in_progress" ? "⚡" : "✅"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: "14px",
                color: "#e2e8f0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {task.title}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                担当: {task.assignee === "ai" ? "🤖 AI" : "👤 自分"}
              </div>
            </div>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "99px",
                flexShrink: 0,
                background:
                  task.priority === "high" ? "rgba(239,68,68,0.15)" :
                  task.priority === "medium" ? "rgba(245,158,11,0.15)" :
                  "rgba(100,116,139,0.15)",
                color:
                  task.priority === "high" ? "#ef4444" :
                  task.priority === "medium" ? "#f59e0b" :
                  "#94a3b8",
              }}
            >
              {task.priority}
            </span>
          </div>
        ))}
        {(!tasks || tasks.length === 0) && (
          <p style={{ color: "#64748b", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>
            タスクがありません。タスクボードから追加してください。
          </p>
        )}
      </div>
    </div>
  );
}
