"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function LoginPage() {
  const login = useAction(api.auth.login);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const result = await login({ username: username.trim(), password });
      // トークンとユーザー情報をlocalStorageに保存
      localStorage.setItem("mc_token", result.token);
      localStorage.setItem("mc_user", JSON.stringify(result.user));
      // ダッシュボードへリダイレクト（ハードリロードで認証状態を反映）
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--background)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "380px",
      }}>
        {/* ロゴ */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🛸</div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.5px" }}>
            Mission Control
          </h1>
          <p style={{ color: "#64748b", fontSize: "14px", marginTop: "6px" }}>
            AI Multi-Agent System
          </p>
        </div>

        {/* ログインフォーム */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "28px 24px",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#e2e8f0", marginBottom: "24px", textAlign: "center" }}>
            ログイン
          </h2>

          {/* エラーメッセージ */}
          {error && (
            <div style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              padding: "10px 14px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "#ef4444",
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* ID */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block",
              fontSize: "12px",
              color: "#94a3b8",
              marginBottom: "6px",
              fontWeight: 500,
            }}>
              ユーザーID
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="your-id"
              disabled={loading}
              style={{
                width: "100%",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#e2e8f0",
                fontSize: "15px",
                outline: "none",
              }}
            />
          </div>

          {/* パスワード */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              fontSize: "12px",
              color: "#94a3b8",
              marginBottom: "6px",
              fontWeight: 500,
            }}>
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              disabled={loading}
              style={{
                width: "100%",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#e2e8f0",
                fontSize: "15px",
                outline: "none",
              }}
            />
          </div>

          {/* ログインボタン */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            style={{
              width: "100%",
              background: loading || !username.trim() || !password.trim()
                ? "rgba(99,102,241,0.4)"
                : "#6366f1",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "12px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: loading || !username.trim() || !password.trim() ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {loading ? "ログイン中..." : "ログイン →"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#475569", marginTop: "20px" }}>
          Mission Control — Private Access Only
        </p>
      </div>
    </div>
  );
}
