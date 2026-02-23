"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export default function MemoriesPage() {
  const memories = useQuery(api.memories.list);
  const createMemory = useMutation(api.memories.create);
  const removeMemory = useMutation(api.memories.remove);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", content: "", tags: "", category: "" });

  const handleCopy = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    await createMemory({
      title: form.title,
      content: form.content,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      category: form.category || undefined,
    });
    setForm({ title: "", content: "", tags: "", category: "" });
    setShowForm(false);
  };

  const filtered = memories?.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.content.toLowerCase().includes(search.toLowerCase()) ||
      m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  ) ?? [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e2e8f0" }}>🧠 メモリ</h1>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>AIとの会話・指示の記録を検索・管理</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={addBtnStyle}>+ メモリを追加</button>
      </div>

      {/* 検索バー */}
      <div style={{ position: "relative", marginBottom: "20px" }}>
        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }}>🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="キーワードで検索..."
          style={{ ...inputStyle, paddingLeft: "36px" }}
        />
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div>
            <label style={labelStyle}>タイトル *</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} placeholder="メモリのタイトル" />
          </div>
          <div>
            <label style={labelStyle}>内容 *</label>
            <textarea required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} style={{ ...inputStyle, height: "100px", resize: "vertical" }} placeholder="メモリの内容" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>タグ（カンマ区切り）</label>
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} style={inputStyle} placeholder="AI, タスク, 設計" />
            </div>
            <div>
              <label style={labelStyle}>カテゴリ</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle} placeholder="例: 指示, 設定, メモ" />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowForm(false)} style={cancelBtnStyle}>キャンセル</button>
            <button type="submit" style={submitBtnStyle}>保存する</button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map((m) => {
          const isExpanded = expanded === m._id;
          const date = new Date(m.createdAt).toLocaleDateString("ja-JP");
          return (
            <div
              key={m._id}
              style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px", cursor: "pointer" }}
              onClick={() => setExpanded(isExpanded ? null : m._id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#e2e8f0" }}>{m.title}</div>
                  {m.category && <div style={{ fontSize: "11px", color: "#6366f1", marginTop: "2px" }}>📁 {m.category}</div>}
                  {!isExpanded && (
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "500px" }}>
                      {m.content}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>{date}</span>
                  {/* コピーボタン */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopy(m._id, m.content); }}
                    style={{
                      ...miniBtn,
                      color: copied === m._id ? "#10b981" : "#94a3b8",
                      border: `1px solid ${copied === m._id ? "#10b981" : "var(--border)"}`,
                      background: copied === m._id ? "rgba(16,185,129,0.12)" : "var(--surface-2)",
                      transition: "all 0.2s",
                      minWidth: "64px",
                    }}
                  >
                    {copied === m._id ? "✅ コピー済" : "📋 コピー"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeMemory({ id: m._id as Id<"memories"> }); }}
                    style={{ ...miniBtn, color: "#ef4444" }}
                  >🗑</button>
                </div>
              </div>

              {isExpanded && (
                <div style={{ marginTop: "12px" }}>
                  {/* 本文エリア */}
                  <div style={{
                    position: "relative",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "14px",
                    marginBottom: "10px",
                  }}>
                    <div style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.8", whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                      {m.content}
                    </div>
                    {/* 展開時の大きいコピーボタン */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopy(m._id, m.content); }}
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        background: copied === m._id ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)",
                        border: `1px solid ${copied === m._id ? "#10b981" : "#6366f1"}`,
                        borderRadius: "6px",
                        color: copied === m._id ? "#10b981" : "#a5b4fc",
                        fontSize: "12px",
                        padding: "4px 12px",
                        cursor: "pointer",
                        fontWeight: 600,
                        transition: "all 0.2s",
                      }}
                    >
                      {copied === m._id ? "✅ コピー完了！" : "📋 全文コピー"}
                    </button>
                  </div>
                  {/* タグ */}
                  {m.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {m.tags.map((tag) => (
                        <span key={tag} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ color: "#64748b", textAlign: "center", padding: "48px 0", fontSize: "14px" }}>
            {search ? "検索結果がありません" : "メモリがありません。追加ボタンから登録してください。"}
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
