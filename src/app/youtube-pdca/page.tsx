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

interface PerfEntry {
  trials: number;
  avg_views: number;
  score: number;
}

interface DailyReport {
  date: string;
  generated_at: string;
  today_uploaded: {
    video_id: string;
    title: string;
    theme_id: string;
    title_formula: string;
    thumbnail_style: string;
    hook_style: string;
    upload_time: string;
  }[];
  checked_today: {
    video_id: string;
    title: string;
    views_48h: number | null;
    status: string;
    title_formula: string;
    thumbnail_style: string;
    hook_style: string;
  }[];
  check_summary: { checked: number; success: number; pivoted: number };
  channel_stats: {
    total_videos: number;
    success_count: number;
    pivot_count: number;
    pending_count: number;
    overall_avg_views: number;
  };
  performance_insights: {
    best_title_formula: string | null;
    best_thumbnail_style: string | null;
    best_hook_style: string | null;
    total_experiments: number;
    note?: string;
  };
  performance_db_summary: {
    title_formulas: Record<string, PerfEntry>;
    thumbnail_styles: Record<string, PerfEntry>;
    hook_styles: Record<string, PerfEntry>;
  };
  next_run: string;
}

// ─── ユーティリティ ───
const STATE_URL =
  "https://raw.githubusercontent.com/Yibooo/youtube-pdca/main/state.json";
const REPORT_URL =
  "https://raw.githubusercontent.com/Yibooo/youtube-pdca/main/data/daily_report.json";

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

// スコアバー（0〜1）
function ScoreBar({ score, trials }: { score: number; trials: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.6 ? "#10b981" : score >= 0.5 ? "#fbbf24" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
      <div style={{ flex: 1, height: "6px", background: "var(--surface-2)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "3px", transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: "10px", color: "#64748b", whiteSpace: "nowrap", minWidth: "52px" }}>
        {pct}% ({trials}回)
      </span>
    </div>
  );
}

// ─── メインコンポーネント ───
export default function YouTubePdcaPage() {
  const [state, setState] = useState<PdcaState | null>(null);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "pdca" | "history">("overview");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stateRes, reportRes] = await Promise.all([
        fetch(`${STATE_URL}?t=${Date.now()}`),
        fetch(`${REPORT_URL}?t=${Date.now()}`),
      ]);
      if (!stateRes.ok) throw new Error(`state.json HTTP ${stateRes.status}`);
      const stateData: PdcaState = await stateRes.json();
      setState(stateData);

      if (reportRes.ok) {
        const reportData: DailyReport = await reportRes.json();
        setReport(reportData);
      }
      setFetchedAt(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  // ─── 集計 ───
  const total     = state?.videos.length ?? 0;
  const pending   = state?.videos.filter((v) => v.status === "pending_check").length ?? 0;
  const success   = state?.videos.filter((v) => v.status === "success").length ?? 0;
  const todayVids = state?.videos.filter((v) => isToday(v.upload_time)) ?? [];
  const histVids  = [...(state?.videos ?? [])].reverse();

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

  const tabStyle = (tab: string) => ({
    padding: "8px 18px",
    fontSize: "13px",
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? "#f87171" : "#64748b",
    background: activeTab === tab ? "rgba(248,113,113,0.1)" : "transparent",
    border: "1px solid",
    borderColor: activeTab === tab ? "#ef444433" : "var(--border)",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  return (
    <div style={{ padding: "32px 28px", maxWidth: "960px", margin: "0 auto", fontFamily: "-apple-system, sans-serif" }}>

      {/* ─── ヘッダー ─── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
            📺 YouTube PDCA ダッシュボード
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>
            毎朝09:00に自動実行 &nbsp;|&nbsp; 閾値: 48h後 30再生以上で成功
            {report?.date && (
              <span style={{ color: "#475569" }}> &nbsp;|&nbsp; 最新レポート: {report.date}</span>
            )}
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "8px 16px",
            background: loading ? "var(--surface-2)" : "rgba(99,102,241,0.15)",
            border: "1px solid",
            borderColor: loading ? "var(--border)" : "#6366f1",
            borderRadius: "8px",
            color: loading ? "#64748b" : "#a5b4fc",
            fontSize: "13px", fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {loading ? "⏳ 取得中..." : "🔄 更新"}
        </button>
      </div>

      {/* ─── エラー表示 ─── */}
      {error && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", color: "#fca5a5", fontSize: "13px" }}>
          ❌ データ取得エラー: {error}
        </div>
      )}

      {/* ─── サマリーカード ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "総動画数",   value: total,                           color: "#a5b4fc", icon: "🎬" },
          { label: "確認待ち",   value: pending,                         color: "#fbbf24", icon: "⏳" },
          { label: "成功",       value: success,                         color: "#10b981", icon: "✅" },
          { label: "PIVOT回数",  value: state?.pivot_count ?? 0,         color: "#ef4444", icon: "🔄" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: "22px", marginBottom: "4px" }}>{icon}</div>
            <div style={{ fontSize: "28px", fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ─── タブ ─── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle("overview")} onClick={() => setActiveTab("overview")}>📊 概要</button>
        <button style={tabStyle("pdca")}     onClick={() => setActiveTab("pdca")}>🧪 PDCA学習</button>
        <button style={tabStyle("history")}  onClick={() => setActiveTab("history")}>📋 全履歴</button>
      </div>

      {/* ─── タブ: 概要 ─── */}
      {activeTab === "overview" && (
        <div>
          {/* 本日の実験 */}
          <Section title="🗓 本日の実験">
            {loading && <Muted>読み込み中...</Muted>}
            {!loading && todayVids.length === 0 && report?.today_uploaded.length === 0 && (
              <Muted>本日の動画なし（次回: {nextRun}）</Muted>
            )}
            {report?.today_uploaded.map((v) => (
              <div key={v.video_id} style={{ background: "rgba(99,102,241,0.06)", border: "1px solid #6366f144", borderRadius: "12px", padding: "16px 20px", marginBottom: "10px" }}>
                <a
                  href={`https://www.youtube.com/watch?v=${v.video_id}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0", textDecoration: "none" }}
                >
                  ▶ {v.title}
                </a>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                  <Tag color="#a5b4fc">📝 {v.title_formula}</Tag>
                  <Tag color="#f87171">🖼 {v.thumbnail_style}</Tag>
                  <Tag color="#34d399">🎙 {v.hook_style}</Tag>
                  <Tag color="#64748b">📅 {toJST(v.upload_time)}</Tag>
                </div>
              </div>
            ))}
            {todayVids.filter(v => !report?.today_uploaded.some(r => r.video_id === v.video_id)).map((v) => (
              <VideoCard key={v.video_id} video={v} highlight />
            ))}
          </Section>

          {/* 本日のチェック結果 */}
          {report && report.checked_today.length > 0 && (
            <Section title="📊 本日の48hチェック結果">
              <div style={{ display: "grid", gap: "8px" }}>
                {report.checked_today.map((v) => (
                  <div key={v.video_id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <a href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: "#e2e8f0", textDecoration: "none", flex: 1, minWidth: "200px" }}>
                      ▶ {v.title}
                    </a>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <Tag color="#a5b4fc">📝 {v.title_formula}</Tag>
                      <Tag color="#f87171">🖼 {v.thumbnail_style}</Tag>
                      <Tag color="#34d399">🎙 {v.hook_style}</Tag>
                      {v.views_48h !== null && (
                        <span style={{ fontSize: "13px", fontWeight: 700, color: (v.views_48h ?? 0) >= 30 ? "#10b981" : "#ef4444" }}>
                          👁 {v.views_48h}回
                        </span>
                      )}
                      <StatusPill status={v.status as "success" | "pivoted" | "pending_check"} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* チャンネル統計 */}
          {report && (
            <Section title="📈 チャンネル統計">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                {[
                  { label: "総動画数",       value: report.channel_stats.total_videos,   unit: "本" },
                  { label: "成功動画",         value: report.channel_stats.success_count,  unit: "本" },
                  { label: "PIVOT合計",        value: report.channel_stats.pivot_count,    unit: "回" },
                  { label: "48h平均再生数",    value: Math.round(report.channel_stats.overall_avg_views), unit: "回" },
                ].map(({ label, value, unit }) => (
                  <div key={label} style={{ background: "var(--surface-2)", borderRadius: "8px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>{label}</span>
                    <span style={{ fontSize: "18px", fontWeight: 700, color: "#e2e8f0" }}>{value}<span style={{ fontSize: "12px", color: "#475569", marginLeft: "3px" }}>{unit}</span></span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 使用済みテーマ */}
          {state && state.used_themes.length > 0 && (
            <Section title={`🗂 使用済みテーマ (${state.used_themes.length}/15)`}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {state.used_themes.map((t) => (
                  <span key={t} style={{ fontSize: "11px", background: "rgba(99,102,241,0.12)", border: "1px solid #6366f133", color: "#a5b4fc", borderRadius: "6px", padding: "2px 8px" }}>
                    {t}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ─── タブ: PDCA学習 ─── */}
      {activeTab === "pdca" && (
        <div>
          {/* パフォーマンスインサイト */}
          {report && (
            <Section title="💡 学習インサイト">
              {report.performance_insights.note && (
                <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid #6366f133", borderRadius: "8px", padding: "12px 16px", marginBottom: "14px", fontSize: "13px", color: "#a5b4fc" }}>
                  ℹ️ {report.performance_insights.note}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                {[
                  { label: "最優秀タイトル形式", value: report.performance_insights.best_title_formula, icon: "📝" },
                  { label: "最優秀サムネ",        value: report.performance_insights.best_thumbnail_style, icon: "🖼" },
                  { label: "最優秀フック",         value: report.performance_insights.best_hook_style, icon: "🎙" },
                ].map(({ label, value, icon }) => (
                  <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
                    <div style={{ fontSize: "20px", marginBottom: "6px" }}>{icon}</div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: value ? "#10b981" : "#475569" }}>
                      {value ?? "未計測"}
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748b", marginTop: "4px" }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "12px", fontSize: "12px", color: "#475569", textAlign: "right" }}>
                累計実験数: {report.performance_insights.total_experiments}回
              </div>
            </Section>
          )}

          {/* パフォーマンスDB */}
          {report && (
            <>
              <PerfTable
                title="📝 タイトル形式スコア"
                data={report.performance_db_summary.title_formulas}
                labelMap={{
                  listicle: "リスト型",
                  question: "疑問型",
                  reversal: "逆説型",
                  urgency:  "緊急型",
                  secret:   "秘密型",
                  steps:    "ステップ型",
                  target:   "ターゲット型",
                }}
              />
              <PerfTable
                title="🖼 サムネイルスタイルスコア"
                data={report.performance_db_summary.thumbnail_styles}
                labelMap={{
                  dark_navy:     "ネイビー",
                  bright_red:    "レッド",
                  bright_yellow: "イエロー",
                  gradient_blue: "グラデ青",
                  split_dark:    "スプリット",
                  minimal_white: "ミニマル白",
                }}
              />
              <PerfTable
                title="🎙 フックスタイルスコア"
                data={report.performance_db_summary.hook_styles}
                labelMap={{
                  problem:  "問題提起型",
                  number:   "数字型",
                  result:   "結果提示型",
                  reversal: "逆説型",
                  question: "質問型",
                }}
              />
            </>
          )}

          {!report && !loading && (
            <Muted>daily_report.json がまだ生成されていません。明日09:00の自動実行後に表示されます。</Muted>
          )}
        </div>
      )}

      {/* ─── タブ: 全履歴 ─── */}
      {activeTab === "history" && (
        <div>
          {loading && <Muted>読み込み中...</Muted>}
          {!loading && histVids.length === 0 && <Muted>動画なし</Muted>}
          {histVids.map((v) => (
            <VideoCard key={v.video_id} video={v} />
          ))}
        </div>
      )}

      {/* ─── フッター ─── */}
      <div style={{ fontSize: "12px", color: "#475569", borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "20px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
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

// ─── 共通コンポーネント ───

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 20px", marginBottom: "16px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#94a3b8", marginBottom: "14px", letterSpacing: "0.04em" }}>{title}</div>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#475569", fontSize: "13px", padding: "12px 0" }}>{children}</div>;
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: "11px", color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: "5px", padding: "2px 8px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: "success" | "pivoted" | "pending_check" }) {
  const map = {
    pending_check: { label: "確認待ち", color: "#fbbf24" },
    success:       { label: "✅ 成功",   color: "#10b981" },
    pivoted:       { label: "🔄 PIVOT",  color: "#ef4444" },
  };
  const s = map[status] ?? map.pending_check;
  return (
    <span style={{ fontSize: "11px", fontWeight: 600, color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}33`, borderRadius: "5px", padding: "2px 8px", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function PerfTable({ title, data, labelMap }: { title: string; data: Record<string, PerfEntry>; labelMap: Record<string, string> }) {
  const sorted = Object.entries(data).sort((a, b) => b[1].score - a[1].score);
  return (
    <Section title={title}>
      <div style={{ display: "grid", gap: "8px" }}>
        {sorted.map(([key, val]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", minWidth: "90px" }}>
              {labelMap[key] ?? key}
            </span>
            <ScoreBar score={val.score} trials={val.trials} />
            <span style={{ fontSize: "11px", color: "#64748b", minWidth: "42px", textAlign: "right" }}>
              {val.avg_views > 0 ? `avg ${Math.round(val.avg_views)}再生` : "未計測"}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── 動画カードコンポーネント ───
function VideoCard({ video, highlight = false }: { video: VideoEntry; highlight?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ background: highlight ? "rgba(99,102,241,0.06)" : "var(--surface)", border: `1px solid ${highlight ? "#6366f144" : "var(--border)"}`, borderRadius: "12px", padding: "16px 20px", marginBottom: "10px", transition: "all 0.15s" }}>
      {/* 1行目: タイトル + ステータス */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <a href={`https://www.youtube.com/watch?v=${video.video_id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0", textDecoration: "none", flex: 1, lineHeight: 1.4 }}>
          ▶ {video.title}
        </a>
        {statusBadge(video.status)}
      </div>

      {/* 2行目: メタ情報 */}
      <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "12px", color: "#64748b" }}>
        <span>🎯 {video.hypothesis.theme_name}</span>
        <span>👤 {video.hypothesis.target}</span>
        <span>🔑 {video.hypothesis.keyword}</span>
        {video.tts_engine === "voicevox" && (
          <span style={{ color: "#a5b4fc" }}>🎵 VOICEVOX</span>
        )}
      </div>

      {/* 3行目: 時刻 + 視聴数 */}
      <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "12px", color: "#475569" }}>
        <span>📅 アップロード: {toJST(video.upload_time)}</span>
        {video.status === "pending_check" && (
          <span style={{ color: "#fbbf24" }}>⏳ チェック予定: {getCheckDeadline(video.upload_time)} JST</span>
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
        <button onClick={() => setExpanded((e) => !e)} style={{ fontSize: "11px", color: "#475569", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          {expanded ? "▲ 閉じる" : "▼ タグ・詳細を見る"}
        </button>

        {expanded && (
          <div style={{ marginTop: "10px" }}>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px" }}>
              ニーズ: {video.hypothesis.need}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {video.hypothesis.tags.map((tag) => (
                <span key={tag} style={{ fontSize: "11px", background: "var(--surface-2)", border: "1px solid var(--border)", color: "#94a3b8", borderRadius: "4px", padding: "1px 7px" }}>
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
