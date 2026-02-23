import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "./ConvexClientProvider";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Mission Control",
  description: "AI Multi-Agent Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <ConvexClientProvider>
          <div style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar />
            <main style={{ flex: 1, padding: "24px", overflow: "auto" }}>
              {children}
            </main>
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
