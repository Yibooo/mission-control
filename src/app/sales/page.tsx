"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";

// ステータス表示マップ
const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  researching:      { label: "調査中",           color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  draft_ready:      { label: "草稿準備完了",     color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  captcha_required: { label: "🔐 手動送信待ち", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  contacted:        { label: "送信済み",         color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  replied:       { label: "返信あり",     color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  negotiating:   { label: "商談中",       color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  closed_won:    { label: "成約",         color: "#10b981", bg: "rgba(16,185,129,0.2)" },
  closed_lost:   { label: "NG",          color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  rejected:      { label: "却下済み",     color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

const EVENT_LABEL: Record<string, string> = {
  lead_created:         "🎯 リード追加",
  research_done:        "🔍 リサーチ完了",
  draft_generated:      "📝 メール生成",
  approved:             "✅ 承認",
  rejected:             "❌ 却下",
  sent:                 "📤 送信完了",
  opened:               "👁 開封確認",
  replied:              "💬 返信あり",
  follow_up_scheduled:  "🔔 フォローアップ予定",
  meeting_scheduled:    "📅 商談予定",
};

export default function SalesPage() {
  const stats = useQuery(api.sales.getSalesStats);
  const pendingApprovals = useQuery(api.sales.listPendingApprovals);
  const allLeads = useQuery(api.sales.listLeads, {});
  const recentLogs = useQuery(api.sales.listSalesLogs, { limit: 30 });

  const runMock = useMutation(api.sales.runMockSalesAgent);
  const runRealAgent = useAction(api.salesAgent.runSalesAgent);
  const approveDraft = useMutation(api.sales.approveDraft);
  const rejectDraft = useMutation(api.sales.rejectDraft);
  const markSent = useMutation(api.sales.markDraftSent);

  const [activeTab, setActiveTab] = useState<"all" | "draft_ready" | "contacted" | "replied" | "closed_won">("all");
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<{ id: string; body: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runMode, setRunMode] = useState<"real" | "mock">("real");
  const [agentLog, setAgentLog] = useState<string[]>([]);
  const [showLogFor, setShowLogFor] = useState<string | null>(null);

  const filteredLeads = activeTab === "all"
    ? allLeads
    : allLeads?.filter((l) => l.status === activeTab);

  const handleRunAgent = async () => {
    setIsRunning(true);
    setAgentLog([]);
    try {
      if (runMode === "real") {
        setAgentLog(["🔍 Tavily で首都圏の企業を検索中（advance検索 + ニュースドメイン除外）..."]);
        const result = await runRealAgent({ targetArea: "東京都・首都圏", maxLeads: 5 });
        const msgs = [
          `✅ 完了: ${result.leadsCreated}社のリードを追加`,
          `📝 ${result.draftsCreated}件のメッセージ草稿を生成`,
          `🔗 ${result.formUrlsFound}社のお問い合わせフォームURL発見`,
          `🔐 ${result.captchaDetected}社はCAPTCHA検出 → 手動送信待ち`,
          `🔎 検索結果合計: ${result.debug.searchResultsTotal}件`,
          `🚫 タイトルフィルタ除外: ${result.debug.skippedByTitle}件`,
          `🏢 企業ページ外として除外: ${result.debug.skippedNotCompany}件`,
          `♻️ 重複スキップ: ${result.debug.skippedDuplicate}件`,
        ];
        if (result.errors.length > 0) {
          msgs.push(`⚠️ エラー ${result.errors.length}件`);
          result.errors.slice(0, 3).forEach(e => msgs.push(`  └ ${e}`));
        }
        if (result.debug.processedUrls.length > 0) {
          msgs.push(`🌐 処理したURL:`);
          result.debug.processedUrls.slice(0, 5).forEach(u => msgs.push(`  └ ${u}`));
        }
        setAgentLog(msgs);
      } else {
        setAgentLog(["🎭 モックデータを生成中..."]);
        const result = await runMock({ targetArea: "東京都・首都圏", count: 3 });
        setAgentLog([`✅ モック完了: ${result.createdCount}件を生成`]);
      }
    } catch (e) {
      setAgentLog([`❌ エラー: ${String(e)}`]);
      alert(`エラーが発生しました: ${String(e)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleApprove = async (draftId: Id<"emailDrafts">) => {
    const edited = editingDraft?.id === draftId ? editingDraft.body : undefined;
    await approveDraft({ draftId, editedBody: edited });
    setEditingDraft(null);
    setExpandedDraft(null);
  };

  const handleApproveAndSend = async (draftId: Id<"emailDrafts">) => {
    const edited = editingDraft?.id === draftId ? editingDraft.body : undefined;
    await approveDraft({ draftId, editedBody: edited });
    await markSent({ draftId });
    setEditingDraft(null);
    setExpandedDraft(null);
    alert("✅ 承認＆送信完了（実際の送信はGmail API連携後に有効化されます）");
  };

  const handleReject = async (draftId: Id<"emailDrafts">) => {
    const reason = prompt("却下の理由（任意）:");
    await rejectDraft({ draftId, reason: reason ?? undefined });
    setExpandedDraft(null);
  };

  return (
    <div>
      {/* ページヘッダー */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e2e8f0" }}>
            🎯 営業エージェント
          </h1>
          <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
            AI駆け込み寺 — Gemini + Tavily 自動営業ワークフロー
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* モード切り替え */}
          <div style={{
            display: "flex",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            overflow: "hidden",
            fontSize: "12px",
          }}>
            {(["real", "mock"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setRunMode(mode)}
                style={{
                  padding: "6px 12px",
                  border: "none",
                  cursor: "pointer",
                  background: runMode === mode ? "rgba(99,102,241,0.25)" : "transparent",
                  color: runMode === mode ? "#a5b4fc" : "#64748b",
                  fontWeight: runMode === mode ? 600 : 400,
                }}
              >
                {mode === "real" ? "🤖 AI実行" : "🎭 モック"}
              </button>
            ))}
          </div>
          <button
            onClick={handleRunAgent}
            disabled={isRunning}
            style={{
              background: isRunning ? "#334155" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: isRunning ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isRunning ? (
              <><span>⏳</span> 実行中...</>
            ) : (
              <><span>🚀</span> エージェント起動</>
            )}
          </button>
        </div>
      </div>

      {/* エージェント実行ログ */}
      {(isRunning || agentLog.length > 0) && (
        <div style={{
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: "10px",
          padding: "14px 16px",
          marginBottom: "20px",
          fontSize: "13px",
        }}>
          <div style={{ color: "#a5b4fc", fontWeight: 600, marginBottom: "8px", fontSize: "12px" }}>
            🤖 エージェントログ
          </div>
          {isRunning && (
            <div style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }}>●</span>
              Gemini + Tavily で首都圏の企業をリサーチ中... （30秒〜2分かかります）
            </div>
          )}
          {agentLog.map((msg, i) => (
            <div key={i} style={{ color: "#94a3b8", marginTop: "4px" }}>{msg}</div>
          ))}
        </div>
      )}

      {/* 統計サマリー */}
      <div className="grid-5" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "28px" }}>
        {[
          { label: "総リード数", value: stats?.totalLeads ?? 0, icon: "🏢", color: "#6366f1" },
          { label: "承認待ち", value: stats?.pendingApprovals ?? 0, icon: "⚠️", color: "#f59e0b" },
          { label: "送信済み", value: stats?.sent ?? 0, icon: "📤", color: "#10b981" },
          { label: "返信あり", value: stats?.replied ?? 0, icon: "💬", color: "#06b6d4" },
          { label: "成約", value: stats?.closedWon ?? 0, icon: "🏆", color: "#f59e0b" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "16px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "22px", marginBottom: "6px" }}>{icon}</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ─── 承認キュー ─── */}
      {(pendingApprovals?.length ?? 0) > 0 && (
        <section style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#e2e8f0" }}>
              ⚠️ 承認キュー
            </h2>
            <span style={{
              background: "rgba(245,158,11,0.2)",
              color: "#f59e0b",
              fontSize: "12px",
              fontWeight: 700,
              padding: "2px 10px",
              borderRadius: "99px",
            }}>
              {pendingApprovals?.length ?? 0}件 承認待ち
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {pendingApprovals?.map(({ draft, lead }) => {
              if (!lead) return null;
              const isExpanded = expandedDraft === draft._id;
              const isEditing = editingDraft?.id === draft._id;

              return (
                <div key={draft._id} style={{
                  background: "var(--surface)",
                  border: "1px solid rgba(245,158,11,0.4)",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}>
                  {/* カードヘッダー */}
                  <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: "15px", color: "#e2e8f0" }}>
                          🏢 {lead.companyName}
                        </span>
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>{lead.industry}</span>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>📍 {lead.location}</span>
                        {lead.estimatedSize && (
                          <span style={{ fontSize: "12px", color: "#64748b" }}>👥 {lead.estimatedSize}</span>
                        )}
                      </div>
                      <div style={{ marginTop: "6px", fontSize: "13px", color: "#94a3b8" }}>
                        ✉️ {lead.contactEmail}
                        {lead.contactName && <span style={{ marginLeft: "8px", color: "#64748b" }}>({lead.contactName})</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedDraft(isExpanded ? null : draft._id)}
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        color: "#94a3b8",
                        padding: "4px 10px",
                        fontSize: "12px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isExpanded ? "▲ 折りたたむ" : "▼ 詳細を見る"}
                    </button>
                  </div>

                  {/* リサーチサマリー */}
                  {lead.researchSummary && (
                    <div style={{
                      margin: "0 20px 12px",
                      padding: "10px 14px",
                      background: "rgba(99,102,241,0.08)",
                      borderRadius: "8px",
                      border: "1px solid rgba(99,102,241,0.2)",
                    }}>
                      <div style={{ fontSize: "11px", color: "#6366f1", fontWeight: 600, marginBottom: "4px" }}>
                        📋 リサーチサマリー
                      </div>
                      <div style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.6" }}>
                        {lead.researchSummary}
                      </div>
                    </div>
                  )}

                  {/* 件名 */}
                  <div style={{ padding: "0 20px 12px" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>件名:</div>
                    <div style={{ fontSize: "14px", color: "#e2e8f0", fontWeight: 600 }}>
                      {draft.subject}
                    </div>
                  </div>

                  {/* 本文プレビュー（展開時） */}
                  {isExpanded && (
                    <div style={{ padding: "0 20px 16px" }}>
                      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>本文:</div>
                      {isEditing ? (
                        <textarea
                          value={editingDraft.body}
                          onChange={(e) => setEditingDraft({ id: draft._id, body: e.target.value })}
                          style={{
                            width: "100%",
                            minHeight: "200px",
                            background: "var(--surface-2)",
                            border: "1px solid #6366f1",
                            borderRadius: "8px",
                            color: "#e2e8f0",
                            fontSize: "13px",
                            padding: "12px",
                            resize: "vertical",
                            lineHeight: "1.7",
                            boxSizing: "border-box",
                          }}
                        />
                      ) : (
                        <div style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          padding: "12px",
                          fontSize: "13px",
                          color: "#94a3b8",
                          lineHeight: "1.7",
                          whiteSpace: "pre-wrap",
                        }}>
                          {draft.body}
                        </div>
                      )}
                    </div>
                  )}

                  {/* アクションボタン */}
                  <div style={{
                    padding: "12px 20px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    background: "rgba(0,0,0,0.1)",
                  }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleApproveAndSend(draft._id as Id<"emailDrafts">)}
                          style={{ ...btnStyle("#10b981") }}
                        >
                          ✅ 編集内容で承認・送信
                        </button>
                        <button
                          onClick={() => setEditingDraft(null)}
                          style={{ ...btnStyle("#64748b") }}
                        >
                          キャンセル
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApproveAndSend(draft._id as Id<"emailDrafts">)}
                          style={{ ...btnStyle("#10b981") }}
                        >
                          ✅ 承認して送信
                        </button>
                        <button
                          onClick={() => {
                            setExpandedDraft(draft._id);
                            setEditingDraft({ id: draft._id, body: draft.body });
                          }}
                          style={{ ...btnStyle("#6366f1") }}
                        >
                          ✏️ 編集
                        </button>
                        <button
                          onClick={() => handleReject(draft._id as Id<"emailDrafts">)}
                          style={{ ...btnStyle("#ef4444") }}
                        >
                          ❌ 却下
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── リードパイプライン ─── */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#e2e8f0", marginBottom: "14px" }}>
          📋 リードパイプライン
        </h2>

        {/* タブ */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
          {([
            { key: "all", label: "全て" },
            { key: "draft_ready", label: "草稿完了" },
            { key: "contacted", label: "送信済み" },
            { key: "replied", label: "返信あり" },
            { key: "closed_won", label: "成約" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                borderRadius: "6px",
                border: `1px solid ${activeTab === key ? "#6366f1" : "var(--border)"}`,
                background: activeTab === key ? "rgba(99,102,241,0.2)" : "var(--surface-2)",
                color: activeTab === key ? "#a5b4fc" : "#64748b",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* リード一覧テーブル */}
        {(filteredLeads?.length ?? 0) === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "48px 24px",
            background: "var(--surface)",
            borderRadius: "12px",
            border: "1px dashed var(--border)",
          }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🚀</div>
            <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "8px" }}>
              リードがまだありません
            </div>
            <div style={{ color: "#475569", fontSize: "12px" }}>
              「エージェント起動（モック）」ボタンでサンプルデータを生成できます
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filteredLeads?.map((lead) => {
              const statusInfo = STATUS_LABEL[lead.status] ?? { label: lead.status, color: "#94a3b8", bg: "transparent" };
              return (
                <div key={lead._id} style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: "14px" }}>
                      {lead.companyName}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                      {lead.industry} · {lead.location}
                      {lead.estimatedSize && ` · ${lead.estimatedSize}`}
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>
                      ✉️ {lead.contactEmail}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "99px",
                      background: statusInfo.bg,
                      color: statusInfo.color,
                    }}>
                      {statusInfo.label}
                    </span>
                    <button
                      onClick={() => setShowLogFor(showLogFor === lead._id ? null : lead._id)}
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "5px",
                        border: "1px solid var(--border)",
                        background: "var(--surface-2)",
                        color: "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      ログ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── アクティビティログ ─── */}
      {(recentLogs?.length ?? 0) > 0 && (
        <section>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#e2e8f0", marginBottom: "14px" }}>
            📜 アクティビティログ
          </h2>
          <div style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            overflow: "hidden",
          }}>
            {recentLogs?.map((log, i) => (
              <div key={log._id} style={{
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                borderBottom: i < (recentLogs.length - 1) ? "1px solid var(--border)" : "none",
                fontSize: "13px",
              }}>
                <span style={{ fontSize: "14px" }}>{EVENT_LABEL[log.event] ?? log.event}</span>
                {log.detail && (
                  <span style={{ color: "#94a3b8", flex: 1 }}>{log.detail}</span>
                )}
                <span style={{ fontSize: "11px", color: "#475569", whiteSpace: "nowrap" }}>
                  {log.performedBy && `by ${log.performedBy.replace("agent:", "")} · `}
                  {new Date(log.createdAt).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── ヘルパー: ボタンスタイル ───
function btnStyle(color: string): React.CSSProperties {
  return {
    background: `${color}22`,
    border: `1px solid ${color}66`,
    borderRadius: "7px",
    color,
    padding: "7px 16px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  };
}
