"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";
type Assignee = "human" | "ai";

const COLUMNS: { key: Status; label: string; icon: string; color: string }[] = [
  { key: "todo", label: "Todo", icon: "📌", color: "#64748b" },
  { key: "in_progress", label: "進行中", icon: "⚡", color: "#f59e0b" },
  { key: "done", label: "完了", icon: "✅", color: "#10b981" },
];

export default function TasksPage() {
  const tasks = useQuery(api.tasks.list);
  const createTask = useMutation(api.tasks.create);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const removeTask = useMutation(api.tasks.remove);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "todo" as Status,
    assignee: "ai" as Assignee,
    priority: "medium" as Priority,
    dueDate: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await createTask({
      title: form.title,
      description: form.description || undefined,
      status: form.status,
      assignee: form.assignee,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
    });
    setForm({ title: "", description: "", status: "todo", assignee: "ai", priority: "medium", dueDate: "" });
    setShowForm(false);
  };

  return (
    <div>
      {/* ヘッダー — page-headerクラスでモバイルwrap対応 */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          gap: "10px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#e2e8f0" }}>📋 タスクボード</h1>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>AIと自分のタスクをリアルタイムで管理</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: "#6366f1",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "8px 16px",
            fontSize: "14px",
            cursor: "pointer",
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          + タスクを追加
        </button>
      </div>

      {/* 追加フォーム — grid-formクラスでモバイル1列対応 */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="grid-form"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "20px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>タイトル *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={inputStyle}
              placeholder="タスクのタイトル"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>説明</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={{ ...inputStyle, height: "70px", resize: "vertical" }}
              placeholder="詳細説明（任意）"
            />
          </div>
          <div>
            <label style={labelStyle}>ステータス</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} style={inputStyle}>
              <option value="todo">Todo</option>
              <option value="in_progress">進行中</option>
              <option value="done">完了</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>担当者</label>
            <select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value as Assignee })} style={inputStyle}>
              <option value="ai">🤖 AI</option>
              <option value="human">👤 自分</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>優先度</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })} style={inputStyle}>
              <option value="high">🔴 高</option>
              <option value="medium">🟡 中</option>
              <option value="low">🔵 低</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>期限</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowForm(false)} style={cancelBtnStyle}>キャンセル</button>
            <button type="submit" style={submitBtnStyle}>追加する</button>
          </div>
        </form>
      )}

      {/* カンバンボード — grid-kanbanクラスでモバイル1列対応 */}
      <div
        className="grid-kanban"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}
      >
        {COLUMNS.map(({ key, label, icon, color }) => {
          const colTasks = tasks?.filter((t) => t.status === key) ?? [];
          return (
            <div key={key} style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span>{icon}</span>
                <span style={{ fontWeight: 600, fontSize: "14px", color }}>{label}</span>
                <span style={{
                  marginLeft: "auto",
                  background: "var(--surface-2)",
                  borderRadius: "99px",
                  padding: "1px 8px",
                  fontSize: "12px",
                  color: "#64748b",
                }}>
                  {colTasks.length}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {colTasks.map((task) => (
                  <div
                    key={task._id}
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "#e2e8f0", marginBottom: "6px" }}>
                      {task.title}
                    </div>
                    {task.description && (
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>{task.description}</div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={badgeStyle(task.priority === "high" ? "#ef4444" : task.priority === "medium" ? "#f59e0b" : "#64748b")}>
                        {task.priority === "high" ? "高" : task.priority === "medium" ? "中" : "低"}
                      </span>
                      <span style={badgeStyle("#6366f1")}>
                        {task.assignee === "ai" ? "🤖 AI" : "👤 自分"}
                      </span>
                      {task.dueDate && (
                        <span style={badgeStyle("#0ea5e9")}>📅 {task.dueDate}</span>
                      )}
                    </div>

                    {/* ステータス変更ボタン */}
                    <div style={{ display: "flex", gap: "4px", marginTop: "10px", flexWrap: "wrap" }}>
                      {key !== "todo" && (
                        <button onClick={() => updateStatus({ id: task._id as Id<"tasks">, status: "todo" })} style={miniBtn}>← Todo</button>
                      )}
                      {key !== "in_progress" && (
                        <button onClick={() => updateStatus({ id: task._id as Id<"tasks">, status: "in_progress" })} style={miniBtn}>
                          {key === "todo" ? "進行中 →" : "← 進行中"}
                        </button>
                      )}
                      {key !== "done" && (
                        <button onClick={() => updateStatus({ id: task._id as Id<"tasks">, status: "done" })} style={miniBtn}>完了 ✅</button>
                      )}
                      <button onClick={() => removeTask({ id: task._id as Id<"tasks"> })} style={{ ...miniBtn, marginLeft: "auto", color: "#ef4444" }}>🗑</button>
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div style={{ color: "#475569", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
                    タスクなし
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" };
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  padding: "8px 10px",
  color: "#e2e8f0",
  fontSize: "14px",
};
const submitBtnStyle: React.CSSProperties = {
  background: "#6366f1",
  color: "white",
  border: "none",
  borderRadius: "6px",
  padding: "8px 16px",
  fontSize: "14px",
  cursor: "pointer",
};
const cancelBtnStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  color: "#94a3b8",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  padding: "8px 16px",
  fontSize: "14px",
  cursor: "pointer",
};
const miniBtn: React.CSSProperties = {
  background: "var(--surface)",
  color: "#94a3b8",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  padding: "3px 8px",
  fontSize: "11px",
  cursor: "pointer",
};
const badgeStyle = (color: string): React.CSSProperties => ({
  fontSize: "11px",
  padding: "1px 6px",
  borderRadius: "99px",
  background: `${color}22`,
  color,
});
