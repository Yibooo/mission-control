"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "ダッシュボード", icon: "🏠" },
  { href: "/command", label: "Command", icon: "🤖" },
  { href: "/tasks", label: "タスクボード", icon: "📋" },
  { href: "/workspaces", label: "ワークスペース", icon: "⚡" },
  { href: "/calendar", label: "カレンダー", icon: "📅" },
  { href: "/memories", label: "メモリ", icon: "🧠" },
  { href: "/team", label: "チーム", icon: "👥" },
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
          {navItems.map(({ href, label, icon }) => {
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
