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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "220px",
        minHeight: "100vh",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        padding: "24px 0",
        display: "flex",
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
  );
}
