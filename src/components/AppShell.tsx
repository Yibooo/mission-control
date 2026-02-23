"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  // ログインページはSidebar不要・AuthGuard不要
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 通常ページ: AuthGuard + Sidebar
  return (
    <AuthGuard>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main
          className="main-content"
          style={{ flex: 1, padding: "20px", overflow: "auto" }}
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
