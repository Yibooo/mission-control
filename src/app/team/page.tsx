"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useEffect } from "react";

type AgentStatus = "idle" | "working" | "offline";

const STATUS_STYLE: Record<AgentStatus, { label: string; color: string; dot: string }> = {
  idle: { label: "待機中", color: "#64748b", dot: "#64748b" },
  working: { label: "稼働中", color: "#10b981", dot: "#10b981" },
  offline: { label: "オフライン", color: "#475569", dot: "#475569" },
};

export default function TeamPage() {
  const agents = useQuery(api.agents.list);
  const seed = useMutation(api.agents.seed);
  const updateStatus = useMutation(api.agents.updateStatus);

  // 初回：デフォルトエージェントを投入
  useEffect(() => {
    if (agents !== undefined && agents.length === 0) {
      seed({});
    }
  }, [agents, seed]);

  const mainAgent = agents?.find((a) => a.type === "main");
  const subAgents = agents?.filter((a) => a.type === "sub") ?? [];

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e2e8f0" }}>👥 チーム</h1>
        <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>司令塔AIとサブエージェントの管理</p>
      </div>

      {/* 司令塔AI */}
      {mainAgent && (
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "14px", color: "#94a3b8", fontWeight: 500, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            司令塔
          </h2>
          <AgentCard agent={mainAgent} onStatusChange={updateStatus} highlight />
        </div>
      )}

      {/* サブエージェント */}
      <div>
        <h2 style={{ fontSize: "14px", color: "#94a3b8", fontWeight: 500, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          サブエージェント
        </h2>
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
          {subAgents.map((agent) => (
            <AgentCard key={agent._id} agent={agent} onStatusChange={updateStatus} />
          ))}
        </div>
      </div>

      {(!agents || agents.length === 0) && (
        <div style={{ color: "#64748b", textAlign: "center", padding: "48px 0", fontSize: "14px" }}>
          エージェントを読み込み中...
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  onStatusChange,
  highlight = false,
}: {
  agent: {
    _id: Id<"agents">;
    name: string;
    role: string;
    description: string;
    type: "main" | "sub";
    status: AgentStatus;
    currentTask?: string;
    avatar?: string;
    completedTasks: number;
  };
  onStatusChange: (args: { id: Id<"agents">; status: AgentStatus; currentTask?: string }) => void;
  highlight?: boolean;
}) {
  const statusInfo = STATUS_STYLE[agent.status];

  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${highlight ? "#6366f1" : "var(--border)"}`,
        borderRadius: "12px",
        padding: "20px",
        position: "relative",
      }}
    >
      {highlight && (
        <div style={{ position: "absolute", top: "12px", right: "12px", fontSize: "11px", color: "#6366f1", background: "rgba(99,102,241,0.15)", padding: "2px 8px", borderRadius: "99px" }}>
          MAIN
        </div>
      )}

      {/* アバター＋名前 */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "14px" }}>
        <div style={{
          width: "52px",
          height: "52px",
          borderRadius: "12px",
          background: "var(--surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "26px",
          border: "1px solid var(--border)",
        }}>
          {agent.avatar ?? "🤖"}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "16px", color: "#e2e8f0" }}>{agent.name}</div>
          <div style={{ fontSize: "12px", color: "#6366f1", marginTop: "1px" }}>{agent.role}</div>
        </div>
      </div>

      <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "14px", lineHeight: "1.5" }}>
        {agent.description}
      </div>

      {/* ステータス */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: statusInfo.dot, display: "inline-block" }} />
        <span style={{ fontSize: "13px", color: statusInfo.color }}>{statusInfo.label}</span>
        {agent.currentTask && (
          <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "4px" }}>— {agent.currentTask}</span>
        )}
      </div>

      <div style={{ fontSize: "12px", color: "#475569", marginBottom: "14px" }}>
        完了タスク: {agent.completedTasks}件
      </div>

      {/* ステータス変更 */}
      <div style={{ display: "flex", gap: "6px" }}>
        {(["idle", "working", "offline"] as AgentStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange({ id: agent._id, status: s })}
            style={{
              fontSize: "11px",
              padding: "3px 10px",
              borderRadius: "6px",
              border: `1px solid ${agent.status === s ? STATUS_STYLE[s].color : "var(--border)"}`,
              background: agent.status === s ? `${STATUS_STYLE[s].color}22` : "var(--surface-2)",
              color: agent.status === s ? STATUS_STYLE[s].color : "#64748b",
              cursor: "pointer",
            }}
          >
            {STATUS_STYLE[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}
