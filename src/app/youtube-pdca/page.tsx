"use client";

import { useState, useEffect, useCallback } from "react";

// ─── 型定義 ───
interface VideoEntry {
  video_id: string;
  title: string;
  upload_time: string;
  views_48h: number | null;
  status: "pending_check" | "success" | "pivoted";
  tts_engine?: string;
  checked_at?: string | null;
  note?: string;
  hypothesis: {
    theme_id: string;
    theme_name: string;
    target: string;
    need: string;
    keyword: string;
    tags: string[];
  };
}

interface PdcaState {
  videos: VideoEntry[];
  used_themes: string[];
  pivot_count: number;
  success_patterns: string[];
  last_run: string | null;
}

// ─── ユーティリティ ───
const STATE_URL =
  "https://raw.githubusercontent.com/Yibooo/youtube-pdca/main/state.json";

function toJST(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCheckDeadline(uploadTime: string): string {
  const d = new Date(uploadTime);
  d.setHours(d.getHours() + 48);
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(isoString: string): boolean {
  const d = new Date(isoString);
  const now = new Date();
  const jst = (date: Date) =>
    new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const dJST = jst(d);
  const nowJST = jst(now);
  return (
    dJST.getFullYear() === nowJST.getFullYear() &&
    dJST.getMonth() === nowJST.getMonth() &&
    dJST.getDate() === nowJST.getDate()
  );
}

function statusBadge(status: VideoEntry["status"]) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending_check: { label: "確認待ち", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
    success:       { label: "✅ 成功",   color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    pivoted:       { label: "🔄 PIVOT",  color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  };
  const s = map[status] ?? map.pending_check;
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 600,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.color}33`,
        borderRadius: "6px",
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ─── メインコンポーネント ───
export default function YouTubePdcaPage() {
  const [state, setState] = useState<PdcaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${STATE_URL}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PdcaState = await res.json();
      setState(data);
      setFetchedAt(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    // 5分ごとに自動更新
    const timer = setInterval(fetchState, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchState]);

  // ─── 集計 ───
  const total     = state?.videos.length ?? 0;
  const pending   = state?.videos.filter((v) => v.status === "pending_check").length ?? 0;
  const success   = state?.videos.filter((v) => v.status === "success").length ?? 0;
  const pivoted   = state?.videos.filter((v) => v.status === "pivoted").length ?? 0;
  const todayVids = state?.videos.filter((v) => isToday(v.upload_time)) ?? [];
  const histVids  = [...(state?.videos ?? [])].reverse(); // 新しい順

  const nextRun = (() => {
    const now = new Date();
    const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const next = new Date(jst);
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    const diff = next.getTime() - jst.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `明日09:00（あと${h}時間${m}分）`;
  })();

  return (
    <div
      style={{
        padding: "32px 28px",
        maxWidth: "900px",
        margin: "0 auto",
        fontFamily: "-apple-system, sans-serif",
      }}
    >
      {/* ─── ヘッダー ─── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
            📺 YouTube PDCA ダッシュボード
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>
            毎朝09:00に自動実行 &nbsp;|&nbsp; 閾値: 48h後 30再生以上で成功
          </p>
        </div>
        <button
          onClick={fetchState}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            background: loading ? "var(--surface-2)" : "rgba(99,102,241,0.15)",
            border: "1px solid",
            borderColor: loading ? "var(--border)" : "#6366f1",
            borderRadius: "8px",
            color: loading ? "#64748b" : "#a5b4fc",
            fontSize: "13px",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {loading ? "⏳ 取得中..." : "🔄 更新"}
        </button>
      </div>

      {/* ─── エラー表示 ─── */}
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid #ef4444",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "20px",
            color: "#fca5a5",
            fontSize: "13px",
          }}
        >
          ❌ データ取得エラー: {error}
        </div>
      )}

      {/* ─── サマリーカード ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "28px",
        }}
      >
        {[
          { label: "総動画数",   value: total,   color: "#a5b4fc", icon: "🎬" },
          { label: "確認待ち",   value: pending,  color: "#fbbf24", icon: "⏳" },
          { label: "成功",       value: success,  color: "#10b981", icon: "✅" },
          { label: "PIVOT回数",  value: state?.pivot_count ?? 0, color: "#ef4444", icon: "🔄" },
        ].map(({ label, value, color, icon }) => (
          <div
            key={label}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "22px", marginBottom: "4px" }}>{icon}</div>
            <div style={{ fontSize: "28px", fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ─── 本日の動画 ─── */}
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#94a3b8", marginBottom: "12px", letterSpacing: "0.05em" }}>
          🗓 本日の動画 {todayVids.length === 0 && !loading && "(なし)"}
        </h2>
        {loading && (
          <div style={{ color: "#475569", fontSize: "13px", padding: "20px 0" }}>読み込み中...</div>
        )}
        {todayVids.map((v) => (
          <VideoCard key={v.video_id} video={v} highlight />
        ))}
      </div>

      {/* ─── 全動画履歴 ─── */}
      {!loading && histVids.length > 0 && (
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#94a3b8", marginBottom: "12px", letterSpacing: "0.05em" }}>
            📋 全動画履歴
          </h2>
          {histVids.map((v) => (
            <VideoCard key={v.video_id} video={v} />
          ))}
        </div>
      )}

      {/* ─── 使用済みテーマ ─── */}
      {state && state.used_themes.length > 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "20px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "10px" }}>
            🗂 使用済みテーマ ({state.used_themes.length}/15)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {state.used_themes.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: "11px",
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid #6366f133",
                  color: "#a5b4fc",
                  borderRadius: "6px",
                  padding: "2px 8px",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── フッター ─── */}
      <div
        style={{
          fontSize: "12px",
          color: "#475569",
          borderTop: "1px solid var(--border)",
          paddingTop: "16px",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <span>⏰ 次回自動実行: {nextRun}</span>
        <span>
          {fetchedAt
            ? `GitHub から ${Math.floor((Date.now() - fetchedAt.getTime()) / 60000)} 分前に取得`
            : "取得中..."}
        </span>
      </div>
    </div>
  );
}

// ─── 動画カードコンポーネント ───
function VideoCard({ video, highlight = false }: { video: VideoEntry; highlight?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: highlight ? "rgba(99,102,241,0.06)" : "var(--surface)",
        border: `1px solid ${highlight ? "#6366f144" : "var(--border)"}`,
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "10px",
        transition: "all 0.15s",
      }}
    >
      {/* 1行目: タイトル + ステータス */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <a
          href={`https://www.youtube.com/watch?v=${video.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#e2e8f0",
            textDecoration: "none",
            flex: 1,
            lineHeight: 1.4,
          }}
        >
          ▶ {video.title}
        </a>
        {statusBadge(video.status)}
      </div>

      {/* 2行目: メタ情報 */}
      <div
        style={{
          marginTop: "10px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "12px",
          color: "#64748b",
        }}
      >
        <span>🎯 {video.hypothesis.theme_name}</span>
        <span>👤 {video.hypothesis.target}</span>
        <span>🔑 {video.hypothesis.keyword}</span>
        {video.tts_engine === "voicevox" && (
          <span style={{ color: "#a5b4fc" }}>🎵 VOICEVOX</span>
        )}
      </div>

      {/* 3行目: 時刻 + 視聴数 */}
      <div
        style={{
          marginTop: "8px",
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          fontSize: "12px",
          color: "#475569",
        }}
      >
        <span>📅 アップロード: {toJST(video.upload_time)}</span>
        {video.status === "pending_check" && (
          <span style={{ color: "#fbbf24" }}>
            ⏳ チェック予定: {getCheckDeadline(video.upload_time)} JST
          </span>
        )}
        {video.status !== "pending_check" && video.views_48h !== null && (
          <span style={{ color: video.views_48h >= 30 ? "#10b981" : "#ef4444" }}>
            👁 48h視聴数: {video.views_48h} 回
          </span>
        )}
        {video.checked_at && (
          <span>✓ チェック済み: {toJST(video.checked_at)}</span>
        )}
      </div>

      {/* 展開: タグ */}
      <div style={{ marginTop: "10px" }}>
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            fontSize: "11px",
            color: "#475569",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {expanded ? "▲ 閉じる" : "▼ タグ・詳細を見る"}
        </button>

        {expanded && (
          <div style={{ marginTop: "10px" }}>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
              ニーズ: {video.hypothesis.need}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {video.hypothesis.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: "11px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "#94a3b8",
                    borderRadius: "4px",
                    padding: "1px 7px",
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
            {video.note && (
              <div style={{ marginTop: "8px", fontSize: "11px", color: "#475569" }}>
                📝 {video.note}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
