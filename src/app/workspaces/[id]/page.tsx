"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";

export default function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const workspaces = useQuery(api.workspaces.listWorkspaces);
  const ws = workspaces?.find((w) => w._id === id);

  const items = useQuery(api.workspaces.listItems, { workspaceId: id });
  const createItem = useMutation(api.workspaces.createItem);
  const updateItem = useMutation(api.workspaces.updateItem);
  const removeItem = useMutation(api.workspaces.removeItem);
  const appendLog  = useMutation(api.workspaces.appendLog);
  const updateWorkspace = useMutation(api.workspaces.updateWorkspace);

  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [newColumnName, setNewColumnName] = useState("");
  const [itemStatus, setItemStatus] = useState("todo");

  // config から カラム一覧を取得
  let columns: string[] = [];
  try { columns = JSON.parse(ws?.config ?? "{}").columns ?? []; } catch {}

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ws) return;
    await createItem({
      workspaceId: id,
      fields: JSON.stringify(fieldValues),
      status: itemStatus,
    });
    await appendLog({ id: ws._id as Id<"workspaces">, message: `アイテムを追加: ${Object.values(fieldValues)[0] ?? ""}` });
    setFieldValues({});
    setItemStatus("todo");
    setShowForm(false);
  };

  // カラム追加
  const handleAddColumn = async () => {
    if (!ws || !newColumnName.trim()) return;
    const newCols = [...columns, newColumnName.trim()];
    await updateWorkspace({
      id: ws._id as Id<"workspaces">,
      config: JSON.stringify({ columns: newCols }),
    });
    setNewColumnName("");
  };

  // カラム削除
  const handleRemoveColumn = async (col: string) => {
    if (!ws) return;
    const newCols = columns.filter((c) => c !== col);
    await updateWorkspace({
      id: ws._id as Id<"workspaces">,
      config: JSON.stringify({ columns: newCols }),
    });
  };

  if (!ws) {
    return <div style={{ color: "#64748b", padding: "48px 0", textAlign: "center" }}>読み込み中...</div>;
  }

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
        <Link href="/workspaces" style={{ color: "#64748b", textDecoration: "none", fontSize: "13px" }}>← 一覧</Link>
        <span style={{ color: "#475569" }}>/</span>
        <span style={{ fontSize: "22px" }}>{ws.icon ?? "⚙️"}</span>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e2e8f0" }}>{ws.name}</h1>
      </div>
      {ws.description && (
        <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "20px", paddingLeft: "80px" }}>{ws.description}</p>
      )}

      {/* カラム設定 */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editingConfig ? "12px" : "0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 500 }}>カラム定義</span>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {columns.map((col) => (
                <span key={col} style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "4px", background: "var(--surface-2)", color: "#94a3b8", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "4px" }}>
                  {col}
                  {editingConfig && (
                    <button onClick={() => handleRemoveColumn(col)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "11px", padding: "0" }}>×</button>
                  )}
                </span>
              ))}
            </div>
          </div>
          <button onClick={() => setEditingConfig(!editingConfig)} style={miniBtn}>
            {editingConfig ? "閉じる" : "✏️ カラム編集"}
          </button>
        </div>
        {editingConfig && (
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <input
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddColumn())}
              placeholder="新しいカラム名を入力 → Enter"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={handleAddColumn} style={submitBtnStyle}>追加</button>
          </div>
        )}
      </div>

      {/* ツールバー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <span style={{ fontSize: "13px", color: "#64748b" }}>{items?.length ?? 0} 件のアイテム</span>
        <button onClick={() => setShowForm(!showForm)} style={addBtnStyle}>+ アイテム追加</button>
      </div>

      {/* アイテム追加フォーム */}
      {showForm && (
        <form
          onSubmit={handleAddItem}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "16px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "10px" }}
        >
          {columns.length === 0 && (
            <p style={{ color: "#f59e0b", fontSize: "13px" }}>⚠️ カラムが未定義です。先に「カラム編集」からカラムを追加してください。</p>
          )}
          {columns.map((col) => (
            <div key={col}>
              <label style={labelStyle}>{col}</label>
              <input
                value={fieldValues[col] ?? ""}
                onChange={(e) => setFieldValues({ ...fieldValues, [col]: e.target.value })}
                style={inputStyle}
                placeholder={`${col}を入力`}
              />
            </div>
          ))}
          <div>
            <label style={labelStyle}>ステータス</label>
            <select value={itemStatus} onChange={(e) => setItemStatus(e.target.value)} style={inputStyle}>
              <option value="todo">Todo</option>
              <option value="in_progress">進行中</option>
              <option value="done">完了</option>
              <option value="pending">保留</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowForm(false)} style={cancelBtnStyle}>キャンセル</button>
            <button type="submit" style={submitBtnStyle}>追加する</button>
          </div>
        </form>
      )}

      {/* アイテム一覧（テーブル） */}
      {columns.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {columns.map((col) => (
                  <th key={col} style={{ padding: "10px 14px", textAlign: "left", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>{col}</th>
                ))}
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>ステータス</th>
                <th style={{ width: "40px" }} />
              </tr>
            </thead>
            <tbody>
              {items?.map((item) => {
                let fields: Record<string, string> = {};
                try { fields = JSON.parse(item.fields); } catch {}
                return (
                  <tr key={item._id} style={{ borderBottom: "1px solid var(--border)" }}>
                    {columns.map((col) => (
                      <td key={col} style={{ padding: "10px 14px", fontSize: "13px", color: "#cbd5e1" }}>
                        {fields[col] ?? "—"}
                      </td>
                    ))}
                    <td style={{ padding: "10px 14px" }}>
                      <select
                        value={item.status ?? "todo"}
                        onChange={(e) => updateItem({ id: item._id as Id<"workspaceItems">, status: e.target.value })}
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "4px", color: "#94a3b8", fontSize: "12px", padding: "2px 6px" }}
                      >
                        <option value="todo">Todo</option>
                        <option value="in_progress">進行中</option>
                        <option value="done">完了</option>
                        <option value="pending">保留</option>
                      </select>
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <button onClick={() => removeItem({ id: item._id as Id<"workspaceItems"> })} style={{ ...miniBtn, color: "#ef4444", padding: "2px 6px" }}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(!items || items.length === 0) && (
            <div style={{ color: "#475569", textAlign: "center", padding: "32px 0", fontSize: "13px" }}>
              アイテムがありません。「+ アイテム追加」から追加してください。
            </div>
          )}
        </div>
      )}

      {/* ログ */}
      {ws.logs.length > 0 && (
        <div style={{ marginTop: "24px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 500, marginBottom: "8px" }}>📋 ログ</div>
          {ws.logs.slice(-10).reverse().map((log, i) => (
            <div key={i} style={{ fontSize: "11px", color: "#475569", fontFamily: "monospace", padding: "2px 0" }}>{log}</div>
          ))}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" };
const inputStyle: React.CSSProperties = { width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 10px", color: "#e2e8f0", fontSize: "14px" };
const addBtnStyle: React.CSSProperties = { background: "#6366f1", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "14px", cursor: "pointer", fontWeight: 500 };
const submitBtnStyle: React.CSSProperties = { background: "#6366f1", color: "white", border: "none", borderRadius: "6px", padding: "8px 16px", fontSize: "14px", cursor: "pointer" };
const cancelBtnStyle: React.CSSProperties = { background: "var(--surface-2)", color: "#94a3b8", border: "1px solid var(--border)", borderRadius: "6px", padding: "8px 16px", fontSize: "14px", cursor: "pointer" };
const miniBtn: React.CSSProperties = { background: "var(--surface-2)", color: "#94a3b8", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: "pointer" };
