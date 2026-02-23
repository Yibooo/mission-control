"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

type ScheduleType = "task" | "cron" | "deadline" | "event";
type ScheduleStatus = "scheduled" | "running" | "done" | "failed";

const TYPE_LABELS: Record<ScheduleType, { label: string; icon: string; color: string }> = {
  task: { label: "タスク", icon: "📋", color: "#6366f1" },
  cron: { label: "定期実行", icon: "🔄", color: "#0ea5e9" },
  deadline: { label: "締め切り", icon: "⏰", color: "#ef4444" },
  event: { label: "イベント", icon: "📅", color: "#10b981" },
};

const STATUS_LABELS: Record<ScheduleStatus, { label: string; color: string }> = {
  scheduled: { label: "予定", color: "#6366f1" },
  running: { label: "実行中", color: "#f59e0b" },
  done: { label: "完了", color: "#10b981" },
  failed: { label: "失敗", color: "#ef4444" },
};

export default function CalendarPage() {
  const schedules = useQuery(api.schedules.list);
  const createSchedule = useMutation(api.schedules.create);
  const updateStatus = useMutation(api.schedules.updateStatus);
  const removeSchedule = useMutation(api.schedules.remove);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    scheduledAt: "",
    type: "task" as ScheduleType,
    status: "scheduled" as ScheduleStatus,
    agentId: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.scheduledAt) return;
    await createSchedule({
      title: form.title,
      description: form.description || undefined,
      scheduledAt: form.scheduledAt,
      type: form.type,
      status: form.status,
      agentId: form.agentId || undefined,
    });
    setForm({ title: "", description: "", scheduledAt: "", type: "task", status: "scheduled", agentId: "" });
    setShowForm(false);
  };

  const sorted = [...(schedules ?? [])].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e2e8f0" }}>📅 カレンダー</h1>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>スケジュール・CronジョブをAIと管理</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={addBtnStyle}>+ スケジュール追加</button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "24px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>タイトル *</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} placeholder="スケジュールのタイトル" />
          </div>
          <div>
            <label style={labelStyle}>日時 *</label>
            <input required type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>種別</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ScheduleType })} style={inputStyle}>
              {(Object.entries(TYPE_LABELS) as [ScheduleType, typeof TYPE_LABELS[ScheduleType]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>説明</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, height: "60px", resize: "vertical" }} placeholder="詳細説明（任意）" />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowForm(false)} style={cancelBtnStyle}>キャンセル</button>
            <button type="submit" style={submitBtnStyle}>追加する</button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {sorted.map((s) => {
          const typeInfo = TYPE_LABELS[s.type as ScheduleType];
          const statusInfo = STATUS_LABELS[s.status as ScheduleStatus];
          const dt = new Date(s.scheduledAt);
          return (
            <div key={s._id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ fontSize: "26px" }}>{typeInfo?.icon ?? "📅"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "#e2e8f0" }}>{s.title}</div>
                {s.description && <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{s.description}</div>}
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  📅 {dt.toLocaleDateString("ja-JP")} {dt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: `${typeInfo?.color}22`, color: typeInfo?.color }}>
                  {typeInfo?.label}
                </span>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: `${statusInfo?.color}22`, color: statusInfo?.color }}>
                  {statusInfo?.label}
                </span>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                {s.status !== "done" && (
                  <button onClick={() => updateStatus({ id: s._id as Id<"schedules">, status: "done" })} style={miniBtn}>✅</button>
                )}
                <button onClick={() => removeSchedule({ id: s._id as Id<"schedules"> })} style={{ ...miniBtn, color: "#ef4444" }}>🗑</button>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div style={{ color: "#64748b", textAlign: "center", padding: "48px 0", fontSize: "14px" }}>
            スケジュールがありません。追加ボタンから登録してください。
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" };
const inputStyle: React.CSSProperties = { width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 10px", color: "#e2e8f0", fontSize: "14px" };
const addBtnStyle: React.CSSProperties = { background: "#6366f1", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "14px", cursor: "pointer", fontWeight: 500 };
const submitBtnStyle: React.CSSProperties = { background: "#6366f1", color: "white", border: "none", borderRadius: "6px", padding: "8px 16px", fontSize: "14px", cursor: "pointer" };
const cancelBtnStyle: React.CSSProperties = { background: "var(--surface-2)", color: "#94a3b8", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 16px", fontSize: "14px", cursor: "pointer" };
const miniBtn: React.CSSProperties = { background: "var(--surface-2)", color: "#94a3b8", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", fontSize: "13px", cursor: "pointer" };
