"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "ダッシュボード", icon: "🏠", group: "main" },
  { href: "/command", label: "Command", icon: "🤖", group: "main" },
  { href: "/tasks", label: "タスクボード", icon: "📋", group: "main" },
  { href: "/workspaces", label: "ワークスペース", icon: "⚡", group: "main" },
  { href: "/calendar", label: "カレンダー", icon: "📅", group: "main" },
  { href: "/memories", label: "メモリ", icon: "🧠", group: "main" },
  { href: "/team", label: "チーム", icon: "👥", group: "main" },
  // ─── Phase 2: AI駆け込み寺 営業エージェント ───
  { href: "/sales", label: "営業エージェント", icon: "🎯", group: "sales" },
  // ─── Phase 3: YouTube PDCA 自動化 ───
  { href: "/youtube-pdca", label: "YouTube PDCA", icon: "📺", group: "youtube" },
];

// モバイル下部ナビに表示する項目（5個まで）
const bottomNavItems = [
  { href: "/", label: "ホーム", icon: "🏠" },
  { href: "/command", label: "Command", icon: "🤖" },
  { href: "/tasks", label: "タスク", icon: "📋" },
  { href: "/memories", label: "メモリ", icon: "🧠" },
  { href: "/team", label: "チーム", icon: "👥" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* ─── デスクトップサイドバー ─── */}
      <aside
        className="sidebar-desktop"
        style={{
          width: "220px",
          minHeight: "100vh",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          padding: "24px 0",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* ロゴ */}
        <div style={{ padding: "0 20px 28px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#a5b4fc", letterSpacing: "-0.3px" }}>
            🛸 Mission Control
          </div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
            AI Multi-Agent System
          </div>
        </div>

        {/* ナビゲーション */}
        <nav style={{ flex: 1 }}>
          {/* メインナビ */}
          {navItems.filter((i) => i.group === "main").map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: active ? 600 : 400,
                  color: active ? "#a5b4fc" : "#94a3b8",
                  background: active ? "rgba(99,102,241,0.12)" : "transparent",
                  borderLeft: active ? "3px solid #6366f1" : "3px solid transparent",
                  textDecoration: "none",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: "16px" }}>{icon}</span>
                {label}
              </Link>
            );
          })}

          {/* セクション区切り: AI駆け込み寺 */}
          <div style={{ margin: "12px 20px 4px", borderTop: "1px solid var(--border)" }} />
          <div style={{ padding: "4px 20px 6px", fontSize: "10px", color: "#475569", letterSpacing: "0.08em", fontWeight: 600 }}>
            AI駆け込み寺
          </div>
          {navItems.filter((i) => i.group === "sales").map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: active ? 600 : 400,
                  color: active ? "#fbbf24" : "#94a3b8",
                  background: active ? "rgba(251,191,36,0.1)" : "transparent",
                  borderLeft: active ? "3px solid #f59e0b" : "3px solid transparent",
                  textDecoration: "none",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: "16px" }}>{icon}</span>
                {label}
              </Link>
            );
          })}

          {/* セクション区切り: YouTube PDCA */}
          <div style={{ margin: "12px 20px 4px", borderTop: "1px solid var(--border)" }} />
          <div style={{ padding: "4px 20px 6px", fontSize: "10px", color: "#475569", letterSpacing: "0.08em", fontWeight: 600 }}>
            YouTube自動化
          </div>
          {navItems.filter((i) => i.group === "youtube").map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: active ? 600 : 400,
                  color: active ? "#f87171" : "#94a3b8",
                  background: active ? "rgba(248,113,113,0.1)" : "transparent",
                  borderLeft: active ? "3px solid #ef4444" : "3px solid transparent",
                  textDecoration: "none",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: "16px" }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* フッター */}
        <div style={{ padding: "20px", fontSize: "11px", color: "#475569", borderTop: "1px solid var(--border)" }}>
          <div>Powered by Claude Code</div>
          <div style={{ marginTop: "2px" }}>+ Convex</div>
        </div>
      </aside>

      {/* ─── モバイル下部ナビゲーション ─── */}
      <nav className="nav-bottom">
        {bottomNavItems.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                flex: 1,
                textDecoration: "none",
                color: active ? "#a5b4fc" : "#64748b",
                background: active ? "rgba(99,102,241,0.1)" : "transparent",
                borderTop: active ? "2px solid #6366f1" : "2px solid transparent",
                padding: "6px 4px",
                fontSize: "10px",
                fontWeight: active ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: "20px", lineHeight: 1 }}>{icon}</span>
              <span style={{ fontSize: "10px", whiteSpace: "nowrap" }}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
