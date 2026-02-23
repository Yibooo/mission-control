"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";

type WsStatus = "active" | "paused" | "archived";

// ワークスペースのタイプテンプレート（後から自由に追加可能）
const TYPE_TEMPLATES = [
  { type: "custom",     icon: "⚙️",  label: "カスタム（自由設定）",      columns: [] },
  { type: "sns",        icon: "📣",  label: "SNS投稿管理",              columns: ["タイトル", "プラットフォーム", "ステータス", "予定日"] },
  { type: "crm",        icon: "🤝",  label: "顧客管理（CRM）",          columns: ["顧客名", "ステータス", "最終連絡日", "メモ"] },
  { type: "analytics",  icon: "📊",  label: "データ分析",              columns: ["指標名", "値", "期間", "メモ"] },
  { type: "research",   icon: "🔬",  label: "リサーチ",                columns: ["テーマ", "情報源", "ステータス", "メモ"] },
  { type: "campaign",   icon: "🎯",  label: "キャンペーン管理",          columns: ["名称", "目標", "期間", "ステータス"] },
  { type: "dev",        icon: "💻",  label: "開発タスク",              columns: ["機能名", "担当AI", "優先度", "ステータス"] },
];

const STATUS_STYLE: Record<WsStatus, { label: string; color: string }> = {
  active:   { label: "稼働中",    color: "#10b981" },
  paused:   { label: "一時停止",  color: "#f59e0b" },
  archived: { label: "アーカイブ", color: "#475569" },
};

export default function WorkspacesPage() {
  const workspaces = useQuery(api.workspaces.listWorkspaces);
  const createWorkspace = useMutation(api.workspaces.createWorkspace);
  const removeWorkspace = useMutation(api.workspaces.removeWorkspace);
  const updateWorkspace = useMutation(api.workspaces.updateWorkspace);

  const [showForm, setShowForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(TYPE_TEMPLATES[0]);
  const [form, setForm] = useState({
    name: "",
    icon: "",
    workspaceType: "custom",
    description: "",
    customColumns: "",   // カスタムカラム（カンマ区切り）
  });

  const handleTemplateChange = (type: string) => {
    const tpl = TYPE_TEMPLATES.find((t) => t.type === type) ?? TYPE_TEMPLATES[0];
    setSelectedTemplate(tpl);
    setForm((f) => ({
      ...f,
      workspaceType: type,
      icon: tpl.icon,
      customColumns: tpl.columns.join(", "),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const columns = form.customColumns
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const config = JSON.stringify({ columns });
    await createWorkspace({
      name: form.name,
      icon: form.icon || selectedTemplate.icon,
      workspaceType: form.workspaceType,
      description: form.description || undefined,
      status: "active",
      config,
      assignedAgentIds: [],
    });
    setForm({ name: "", icon: "", workspaceType: "custom", description: "", customColumns: "" });
    setSelectedTemplate(TYPE_TEMPLATES[0]);
    setShowForm(false);
  };

  const active   = workspaces?.filter((w) => w.status === "active")   ?? [];
  const paused   = workspaces?.filter((w) => w.status === "paused")   ?? [];
  const archived = workspaces?.filter((w) => w.status === "archived") ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e2e8f0" }}>⚡ ワークスペース</h1>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
            仕事の種類ごとに「枠」を作成。カラム構成は後から自由に変更可能。
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={addBtnStyle}>+ ワークスペース追加</button>
      </div>

      {/* 作成フォーム */}
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
            gap: "14px",
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>テンプレートから選ぶ</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {TYPE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.type}
                  type="button"
                  onClick={() => handleTemplateChange(tpl.type)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${selectedTemplate.type === tpl.type ? "#6366f1" : "var(--border)"}`,
                    background: selectedTemplate.type === tpl.type ? "rgba(99,102,241,0.15)" : "var(--surface-2)",
                    color: selectedTemplate.type === tpl.type ? "#a5b4fc" : "#94a3b8",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  {tpl.icon} {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>ワークスペース名 *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
              placeholder="例: SNSコンテンツ管理"
            />
          </div>
          <div>
            <label style={labelStyle}>アイコン（絵文字）</label>
            <input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              style={inputStyle}
              placeholder={selectedTemplate.icon}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>説明</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              style={inputStyle}
              placeholder="このワークスペースの目的・概要"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>
              カラム定義（カンマ区切り）
              <span style={{ color: "#64748b", fontWeight: 400, marginLeft: "8px" }}>
                ← アイテムの各フィールド名。後から変更可能。
              </span>
            </label>
            <input
              value={form.customColumns}
              onChange={(e) => setForm({ ...form, customColumns: e.target.value })}
              style={inputStyle}
              placeholder="例: タイトル, ステータス, 担当AI, メモ"
            />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowForm(false)} style={cancelBtnStyle}>キャンセル</button>
            <button type="submit" style={submitBtnStyle}>作成する</button>
          </div>
        </form>
      )}

      {/* 稼働中 */}
      {active.length > 0 && (
        <Section title="稼働中" color="#10b981">
          {active.map((ws) => (
            <WorkspaceCard key={ws._id} ws={ws} onRemove={removeWorkspace} onUpdate={updateWorkspace} />
          ))}
        </Section>
      )}

      {/* 一時停止 */}
      {paused.length > 0 && (
        <Section title="一時停止" color="#f59e0b">
          {paused.map((ws) => (
            <WorkspaceCard key={ws._id} ws={ws} onRemove={removeWorkspace} onUpdate={updateWorkspace} />
          ))}
        </Section>
      )}

      {/* アーカイブ */}
      {archived.length > 0 && (
        <Section title="アーカイブ" color="#475569">
          {archived.map((ws) => (
            <WorkspaceCard key={ws._id} ws={ws} onRemove={removeWorkspace} onUpdate={updateWorkspace} />
          ))}
        </Section>
      )}

      {(!workspaces || workspaces.length === 0) && (
        <div style={{ color: "#64748b", textAlign: "center", padding: "64px 0", fontSize: "14px" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚡</div>
          ワークスペースがありません。<br />
          「+ ワークスペース追加」ボタンから仕事の枠を作成してください。
        </div>
      )}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <h2 style={{ fontSize: "13px", color, fontWeight: 600, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        ● {title}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
        {children}
      </div>
    </div>
  );
}

function WorkspaceCard({
  ws,
  onRemove,
  onUpdate,
}: {
  ws: {
    _id: Id<"workspaces">;
    name: string;
    icon?: string;
    workspaceType: string;
    description?: string;
    status: WsStatus;
    config?: string;
    logs: string[];
    assignedAgentIds: string[];
    updatedAt: number;
  };
  onRemove: (args: { id: Id<"workspaces"> }) => void;
  onUpdate: (args: { id: Id<"workspaces">; status?: WsStatus }) => void;
}) {
  let columns: string[] = [];
  try { columns = JSON.parse(ws.config ?? "{}").columns ?? []; } catch {}

  const statusInfo = STATUS_STYLE[ws.status];
  const tpl = TYPE_TEMPLATES.find((t) => t.type === ws.workspaceType);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "24px" }}>{ws.icon ?? tpl?.icon ?? "⚙️"}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "#e2e8f0" }}>{ws.name}</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>{tpl?.label ?? ws.workspaceType}</div>
          </div>
        </div>
        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: `${statusInfo.color}22`, color: statusInfo.color }}>
          {statusInfo.label}
        </span>
      </div>

      {ws.description && (
        <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "10px" }}>{ws.description}</div>
      )}

      {/* カラム一覧 */}
      {columns.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "12px" }}>
          {columns.map((col) => (
            <span key={col} style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "4px", background: "var(--surface-2)", color: "#64748b", border: "1px solid var(--border)" }}>
              {col}
            </span>
          ))}
        </div>
      )}

      {/* 最新ログ */}
      {ws.logs.length > 0 && (
        <div style={{ fontSize: "11px", color: "#475569", background: "var(--surface-2)", borderRadius: "6px", padding: "6px 8px", marginBottom: "12px", fontFamily: "monospace" }}>
          {ws.logs[ws.logs.length - 1]}
        </div>
      )}

      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <Link
          href={`/workspaces/${ws._id}`}
          style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "6px", background: "#6366f1", color: "white", textDecoration: "none", fontWeight: 500 }}
        >
          開く →
        </Link>
        {ws.status === "active" && (
          <button onClick={() => onUpdate({ id: ws._id, status: "paused" })} style={miniBtn}>一時停止</button>
        )}
        {ws.status === "paused" && (
          <button onClick={() => onUpdate({ id: ws._id, status: "active" })} style={miniBtn}>再開</button>
        )}
        {ws.status !== "archived" && (
          <button onClick={() => onUpdate({ id: ws._id, status: "archived" })} style={miniBtn}>アーカイブ</button>
        )}
        <button onClick={() => onRemove({ id: ws._id })} style={{ ...miniBtn, marginLeft: "auto", color: "#ef4444" }}>🗑</button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" };
const inputStyle: React.CSSProperties = { width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 10px", color: "#e2e8f0", fontSize: "14px" };
const addBtnStyle: React.CSSProperties = { background: "#6366f1", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "14px", cursor: "pointer", fontWeight: 500 };
const submitBtnStyle: React.CSSProperties = { background: "#6366f1", color: "white", border: "none", borderRadius: "6px", padding: "8px 16px", fontSize: "14px", cursor: "pointer" };
const cancelBtnStyle: React.CSSProperties = { background: "var(--surface-2)", color: "#94a3b8", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 16px", fontSize: "14px", cursor: "pointer" };
const miniBtn: React.CSSProperties = { background: "var(--surface-2)", color: "#94a3b8", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: "pointer" };
