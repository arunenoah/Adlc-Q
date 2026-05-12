"use client";

import React, { useState } from "react";
import { Package, Sparkles, Bot, Terminal } from "lucide-react";
import { C, mono } from "@/lib/theme";
import type { Project } from "@/lib/types";

// Renders the per-project .claude/ asset browser (skills/agents/commands tabs).
// SRP: pure presentation. Data comes from Project.skills|agents|commands which
// are scanned server-side in lib/workspace.ts.

export const ProjectClaudeAssets = ({ project }: { project: Project }) => {
  const skills = project.skills || [];
  const agents = project.agents || [];
  const commands = project.commands || [];
  const total = skills.length + agents.length + commands.length;
  const [tab, setTab] = useState<"skills" | "agents" | "commands">("skills");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (total === 0) return null;

  const items = tab === "skills" ? skills : tab === "agents" ? agents : commands;
  const tabs = [
    { id: "skills" as const,   label: "skills",   count: skills.length,   icon: Sparkles },
    { id: "agents" as const,   label: "agents",   count: agents.length,   icon: Bot },
    { id: "commands" as const, label: "commands", count: commands.length, icon: Terminal },
  ];

  return (
    <div style={{ border: `1px solid ${C.line}`, padding: 10, marginBottom: 12 }}>
      <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <Package size={10} /> .claude assets — {skills.length} skills · {agents.length} agents · {commands.length} commands
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setExpandedId(null); }}
              style={{ background: active ? C.ink : "transparent", color: active ? C.paper : C.ink, border: `1px solid ${C.line}`, padding: "4px 10px", ...mono, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            >
              <Icon size={10} /> {t.label} {t.count > 0 && <span style={{ color: active ? C.paper : C.dim }}>{t.count}</span>}
            </button>
          );
        })}
      </div>
      {items.length === 0 ? (
        <div style={{ ...mono, fontSize: 10, color: C.dim, padding: "6px 0" }}>none</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6 }}>
          {items.map((it) => {
            const expanded = expandedId === it.id;
            return (
              <div
                key={it.id}
                onClick={() => setExpandedId(expanded ? null : it.id)}
                style={{ border: `1px solid ${C.soft}`, padding: 8, cursor: "pointer", background: expanded ? C.soft : "transparent" }}
              >
                <div style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>{it.name}</div>
                {it.description && (
                  <div style={{ ...mono, fontSize: 10, color: C.dim, marginTop: 3, lineHeight: 1.4, overflow: "hidden", display: expanded ? "block" : "-webkit-box", WebkitLineClamp: expanded ? "unset" : 2, WebkitBoxOrient: "vertical" }}>
                    {it.description}
                  </div>
                )}
                {expanded && (
                  <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 4, wordBreak: "break-all" }}>{it.path}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
