"use client";

import React, { useState } from "react";
import { Network, Search, FileCode, Sparkles, Bot, Check, Plus } from "lucide-react";
import { C, mono, serif } from "@/lib/theme";
import { Btn, Tag } from "./ui";
import type { DiscoveredProject } from "@/lib/types";

// "Discoverable from workspace" panel: shows every project under
// /Application/* that has a graphify-out/, with godNodes + suggested
// questions + .claude asset summary, and an import button.
//
// SRP: presentation + local filter state. Discovery happens server-side
// in lib/workspace.ts; import wiring is the parent's job (onImport).

type Props = {
  projects: DiscoveredProject[];
  importedPaths: Set<string>;
  onImport: (project: DiscoveredProject) => void;
  onOpen?: (project: DiscoveredProject) => void;
};

export const ImportFromWorkspace = ({ projects, importedPaths, onImport }: Props) => {
  const [filter, setFilter] = useState("");
  const filtered = projects.filter((d) =>
    !filter ||
    d.dirName.toLowerCase().includes(filter.toLowerCase()) ||
    d.stackLabel.toLowerCase().includes(filter.toLowerCase())
  );
  if (projects.length === 0) return null;

  return (
    <div style={{ marginTop: 28, paddingTop: 24, borderTop: `1px dashed ${C.dim}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ ...serif, fontSize: 22, fontWeight: 600 }}>
            <Network size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            Discoverable from Workspace
          </div>
          <div style={{ ...mono, fontSize: 12, color: C.text2 }}>
            {projects.length} project{projects.length === 1 ? "" : "s"} with graphify metadata · click import to bring under Adlc-Q management
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.line}`, padding: "4px 8px", background: C.paper }}>
          <Search size={11} color={C.dim} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filter…"
            style={{ ...mono, fontSize: 11, border: "none", outline: "none", background: "transparent", width: 160 }}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10, marginTop: 14 }}>
        {filtered.map((d) => {
          const imported = importedPaths.has(d.workspacePath);
          const top = d.graphMeta.godNodes.slice(0, 3);
          return (
            <div key={d.workspacePath} style={{ border: `1px solid ${C.line}`, padding: 14, background: C.paper, opacity: imported ? 0.55 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...serif, fontSize: 17, fontWeight: 600 }}>{d.dirName}</div>
                  <div style={{ ...mono, fontSize: 12, color: C.text2, wordBreak: "break-all" }}>{d.workspacePath}</div>
                </div>
                <Tag color={C.swarm}>{d.stackLabel}</Tag>
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 10, ...mono, fontSize: 12, color: C.text2 }}>
                <span><Network size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{d.graphMeta.nodes.toLocaleString()} nodes</span>
                <span>{d.graphMeta.edges.toLocaleString()} edges</span>
                <span>{d.graphMeta.communities} communities</span>
                {d.graphMeta.files > 0 && <span><FileCode size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{d.graphMeta.files.toLocaleString()} files</span>}
              </div>
              {top.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.dim}` }}>
                  <div style={{ ...mono, fontSize: 11, color: C.text2, marginBottom: 4 }}>God Nodes</div>
                  {top.map((g) => (
                    <div key={g.name} style={{ ...mono, fontSize: 12, display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{g.name}</span>
                      <span style={{ color: C.dim }}>{g.edges} edges</span>
                    </div>
                  ))}
                </div>
              )}
              {d.graphMeta.suggestedQuestions.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.dim}` }}>
                  <div style={{ ...mono, fontSize: 11, color: C.text2, marginBottom: 4 }}>
                    <Sparkles size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />Suggested
                  </div>
                  <div style={{ ...mono, fontSize: 12, color: C.ink, lineHeight: 1.4 }}>
                    {d.graphMeta.suggestedQuestions[0]}
                  </div>
                </div>
              )}
              {(d.skills.length > 0 || d.agents.length > 0 || d.commands.length > 0) && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.dim}` }}>
                  <div style={{ ...mono, fontSize: 11, color: C.text2, marginBottom: 4 }}>
                    <Sparkles size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                    .claude — {d.skills.length} skills · {d.agents.length} agents · {d.commands.length} commands
                  </div>
                  {d.skills.slice(0, 3).map((s) => (
                    <div key={s.id} title={s.description} style={{ ...mono, fontSize: 12, padding: "1px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Sparkles size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3, color: C.swarm }} />
                      <span style={{ color: C.ink }}>{s.name}</span>
                    </div>
                  ))}
                  {d.agents.slice(0, 3).map((a) => (
                    <div key={a.id} title={a.description} style={{ ...mono, fontSize: 12, padding: "1px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Bot size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3, color: C.accent }} />
                      <span style={{ color: C.ink }}>{a.name}</span>
                    </div>
                  ))}
                  {(d.skills.length + d.agents.length) > 6 && (
                    <div style={{ ...mono, fontSize: 11, color: C.text2, marginTop: 2 }}>+{(d.skills.length + d.agents.length) - 6} more</div>
                  )}
                </div>
              )}
              <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
                {imported ? (
                  <Tag color={C.ok}><Check size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />imported</Tag>
                ) : (
                  <Btn small primary onClick={() => onImport(d)}>
                    <Plus size={10} /> import
                  </Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
