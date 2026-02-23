"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

type User = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "member";
};

type AuthState = "loading" | "authenticated" | "unauthenticated";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const me = useAction(api.auth.me);
  const logout = useAction(api.auth.logout);

  // /login ページ自体はガードをスキップ
  const [isLoginPage, setIsLoginPage] = useState(false);
  useEffect(() => {
    if (window.location.pathname === "/login") {
      setIsLoginPage(true);
    }
  }, []);

  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // loginページはチェック不要
    if (isLoginPage) return;

    const token = localStorage.getItem("mc_token");
    if (!token) {
      setAuthState("unauthenticated");
      return;
    }

    // トークン検証
    me({ token })
      .then((u) => {
        if (u) {
          setUser(u as User);
          setAuthState("authenticated");
        } else {
          localStorage.removeItem("mc_token");
          localStorage.removeItem("mc_user");
          setAuthState("unauthenticated");
        }
      })
      .catch(() => {
        setAuthState("unauthenticated");
      });
  }, [me]);

  // 未認証 → ログインページへリダイレクト
  useEffect(() => {
    if (authState === "unauthenticated") {
      window.location.href = "/login";
    }
  }, [authState]);

  const handleLogout = async () => {
    const token = localStorage.getItem("mc_token");
    if (token) {
      try { await logout({ token }); } catch { /* ignore */ }
    }
    localStorage.removeItem("mc_token");
    localStorage.removeItem("mc_user");
    window.location.href = "/login";
  };

  // /loginページはそのままレンダリング
  if (isLoginPage) {
    return <>{children}</>;
  }

  // ローディング中
  if (authState === "loading") {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--background)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "16px",
      }}>
        <div style={{ fontSize: "36px" }}>🛸</div>
        <div style={{ fontSize: "14px", color: "#64748b" }}>認証中...</div>
      </div>
    );
  }

  // 未認証（リダイレクト中）
  if (authState === "unauthenticated") {
    return null;
  }

  // 認証済み — userInfoバーとchildrenを表示
  return (
    <>
      {/* ユーザー情報バー（右上固定） */}
      <div
        style={{
          position: "fixed",
          top: "10px",
          right: "14px",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "99px",
          padding: "5px 12px 5px 8px",
          fontSize: "12px",
          color: "#94a3b8",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        <span style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          background: "#6366f1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          color: "white",
          fontWeight: 700,
          flexShrink: 0,
        }}>
          {(user?.displayName ?? "U")[0].toUpperCase()}
        </span>
        <span style={{ color: "#cbd5e1", fontWeight: 500 }}>
          {user?.displayName ?? user?.username}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            fontSize: "11px",
            padding: "0",
            marginLeft: "2px",
          }}
        >
          ログアウト
        </button>
      </div>

      {children}
    </>
  );
}
