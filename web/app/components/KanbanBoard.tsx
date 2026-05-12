"use client";

import React from "react";
import { Layers } from "lucide-react";
import { C, mono } from "@/lib/theme";
import { AGENTS, STAGES } from "@/lib/agents";
import { findModelVariant } from "@/lib/models";

// Stage-grouped kanban columns rendered below the per-epic list.
// SRP: presentation only. Click a card → fires onOpenLog so the parent can
// expand the matching task row + scroll to it.

type Task = {
  id: string;
  parentTitle: string;
  title: string;
  agent: string;
  stage: string;
};

const stageColor = (id: string) =>
  id === "done" ? C.ok :
  (id === "qa" || id === "review" || id === "sec") ? C.warn :
  (id === "progress" || id === "unit") ? C.swarm :
  C.dim;

type Props = {
  byStage: Record<string, Task[]>;
  taskBusy: Record<string, boolean>;
  taskStart: Record<string, number>;
  taskLogs: Record<string, string>;
  taskVariantId: (t: Task) => string | undefined;
  onOpenLog: (taskId: string) => void;
};

export const KanbanBoard = ({ byStage, taskBusy, taskStart, taskLogs, taskVariantId, onOpenLog }: Props) => (
  <>
    <div style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.dim, marginBottom: 8 }}>
      <Layers size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
      stages
    </div>
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 6, overflowX: "auto" }}>
      {STAGES.map((stage) => (
        <div key={stage.id} style={{ border: `1px solid ${C.line}`, background: C.paper, minHeight: 200 }}>
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.line}`, background: stageColor(stage.id), color: C.paper, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.text2 }}>{stage.label}</span>
            <span style={{ ...mono, fontSize: 9 }}>{(byStage[stage.id] || []).length}</span>
          </div>
          <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {(byStage[stage.id] || []).map((t) => {
              const a = AGENTS.find((x) => x.id === t.agent);
              const variantId = taskVariantId(t);
              const found = variantId ? findModelVariant(variantId) : null;
              const isBusy = !!taskBusy[t.id];
              const hasLogs = !!taskLogs[t.id];
              const elapsedMs = isBusy && taskStart[t.id] ? Date.now() - taskStart[t.id] : 0;
              const interactive = hasLogs || isBusy;
              return (
                <div
                  key={t.id}
                  onClick={() => interactive && onOpenLog(t.id)}
                  title={interactive ? "click to view live output" : undefined}
                  style={{ border: `1px solid ${isBusy ? C.accent : C.line}`, padding: 6, background: isBusy ? "#fff8f4" : "#fff", cursor: interactive ? "pointer" : "default" }}
                >
                  <div style={{ ...mono, fontSize: 9, color: C.dim, marginBottom: 2 }}>{t.parentTitle}</div>
                  <div style={{ ...mono, fontSize: 11, lineHeight: 1.3 }}>
                    {isBusy ? "⟳ " : ""}{t.title}
                    {isBusy && <span style={{ color: C.accent, marginLeft: 4 }}>{Math.floor(elapsedMs / 1000)}s</span>}
                  </div>
                  <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <span>{a?.emoji} {a?.name}</span>
                    {hasLogs && <span style={{ color: C.swarm }}>· log ↗</span>}
                  </div>
                  {found && (
                    <div style={{ ...mono, fontSize: 8, color: C.paper, background: found.model.color, padding: "1px 4px", marginTop: 3, display: "inline-block" }}>
                      {found.variant.name}
                    </div>
                  )}
                </div>
              );
            })}
            {(byStage[stage.id] || []).length === 0 && (
              <div style={{ ...mono, fontSize: 9, color: C.dim, padding: 10, textAlign: "center" }}>—</div>
            )}
          </div>
        </div>
      ))}
    </div>
  </>
);
