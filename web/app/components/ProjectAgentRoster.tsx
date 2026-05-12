"use client";

import React, { useState } from "react";
import { Bot, Plus, AlertCircle, Sparkles } from "lucide-react";
import { C, mono } from "@/lib/theme";
import { AGENTS } from "@/lib/agents";
import { findModelVariant, variantActive } from "@/lib/models";
import { buildAgent } from "../actions";
import type { Project, AgentMeta, CLIRegistration } from "@/lib/types";

// Renders the project-bound agents grid + a "build missing" row.
// SRP: presentation + the single async call (buildAgent server action) that
// scaffolds a missing agent. The parent owns Project state via onUpdateProject.

type Props = {
  project: Project;
  clis: Record<string, CLIRegistration>;
  activeAgent: string | null;
  onUpdateProject: (next: Project) => void;
};

// Pure helper: token-fragment → keyword matcher used to seed skill links when
// we scaffold a brand-new agent file via the buildAgent server action.
const skillTokensForRole = (roleId: string): string[] => {
  switch (roleId) {
    case "rev": return ["review"];
    case "qa":  return ["qa", "test"];
    case "sec": return ["security", "audit"];
    case "dev": return ["devops", "deploy"];
    case "db":  return ["schema", "database"];
    case "ux":  return ["design", "ux"];
    case "fe":  return ["frontend"];
    case "be":  return ["backend", "engineer"];
    default:    return [];
  }
};

export const ProjectAgentRoster = ({ project, clis, activeAgent, onUpdateProject }: Props) => {
  const agents: AgentMeta[] = project.agents || [];
  const skills = project.skills || [];
  const skillById = React.useMemo(() => {
    const m = new Map(skills.map((s) => [s.id, s]));
    return m;
  }, [skills]);
  const coveredRoles = new Set(agents.map((a) => a.role).filter(Boolean));
  const missingRoles = AGENTS.filter((r) => !coveredRoles.has(r.id));
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBuild = async (role: typeof AGENTS[number]) => {
    if (!project.workspacePath) {
      setError("Project not linked to a workspace path");
      return;
    }
    setBusyRole(role.id);
    setError(null);
    const tokens = skillTokensForRole(role.id);
    const matchedSkills = skills
      .filter((s) => {
        const hay = `${s.id} ${s.name}`.toLowerCase();
        return tokens.some((t) => hay.includes(t));
      })
      .map((s) => s.id);
    const res = await buildAgent({
      workspacePath: project.workspacePath,
      roleId: role.id,
      roleName: role.name,
      description: role.desc,
      recommendedModel: role.recommend,
      skillIds: matchedSkills,
    });
    setBusyRole(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onUpdateProject({
      ...project,
      agents: [...agents, res.data].sort((a, b) => a.name.localeCompare(b.name)),
    });
  };

  if (agents.length === 0 && missingRoles.length === AGENTS.length) return null;

  return (
    <div style={{ border: `1px solid ${C.line}`, padding: 10, marginBottom: 12 }}>
      <div style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.dim, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <Bot size={10} /> project agents — {agents.length} configured · {missingRoles.length} missing role{missingRoles.length === 1 ? "" : "s"}
      </div>
      {agents.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6, marginBottom: missingRoles.length > 0 ? 10 : 0 }}>
          {agents.map((agent) => {
            const variantId = project.agentModels[agent.id];
            const found = variantId ? findModelVariant(variantId) : null;
            const subActive = found ? variantActive(variantId, clis) : false;
            const role = agent.role ? AGENTS.find((r) => r.id === agent.role) : null;
            const linkedSkills = (agent.skillIds || []).map((id) => skillById.get(id)).filter(Boolean) as typeof skills;
            const active = activeAgent === agent.id;
            return (
              <div
                key={agent.id}
                style={{ border: `1px solid ${active ? C.accent : C.line}`, padding: 8, background: active ? C.soft : C.paper }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...mono, fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={agent.description}>{agent.name}</div>
                    {role && <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 2 }}>{role.emoji} {role.name}</div>}
                  </div>
                  {found && (
                    <span style={{ ...mono, fontSize: 9, padding: "2px 6px", background: subActive ? found.model.color : C.soft, color: subActive ? C.paper : C.dim, whiteSpace: "nowrap" }}>
                      {found.variant.name}{!subActive && " 🔒"}
                    </span>
                  )}
                </div>
                {linkedSkills.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
                    {linkedSkills.slice(0, 4).map((s) => (
                      <span key={s.id} title={s.description} style={{ ...mono, fontSize: 9, padding: "1px 5px", border: `1px solid ${C.swarm}`, color: C.swarm }}>
                        <Sparkles size={8} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />{s.name}
                      </span>
                    ))}
                    {linkedSkills.length > 4 && <span style={{ ...mono, fontSize: 9, color: C.dim }}>+{linkedSkills.length - 4}</span>}
                  </div>
                )}
                {linkedSkills.length === 0 && (
                  <div style={{ ...mono, fontSize: 9, color: C.warn, marginTop: 6 }}>no skill linked</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {missingRoles.length > 0 && (
        <div style={{ borderTop: agents.length ? `1px dashed ${C.dim}` : "none", paddingTop: agents.length ? 10 : 0 }}>
          <div style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.warn, marginBottom: 6 }}>
            <AlertCircle size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} /> Missing — build agent connected to skills
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {missingRoles.map((r) => (
              <button
                key={r.id}
                onClick={() => handleBuild(r)}
                disabled={busyRole === r.id || !project.workspacePath}
                style={{ ...mono, fontSize: 10, padding: "4px 8px", border: `1px solid ${C.warn}`, background: busyRole === r.id ? C.soft : C.paper, color: C.ink, cursor: project.workspacePath ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 4 }}
              >
                {busyRole === r.id ? "…" : <Plus size={10} />} {r.emoji} {r.name}
              </button>
            ))}
          </div>
          {!project.workspacePath && (
            <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 4 }}>build disabled — project has no workspacePath</div>
          )}
          {error && (
            <div style={{ ...mono, fontSize: 9, color: C.accent, marginTop: 4 }}>{error}</div>
          )}
        </div>
      )}
    </div>
  );
};
