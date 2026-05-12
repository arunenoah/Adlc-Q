"use client";

import React from "react";
import { Check, Play, Pause, Lock, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { C, mono, serif } from "@/lib/theme";
import { AGENTS, STAGES } from "@/lib/agents";
import { MODELS, findModelVariant } from "@/lib/models";
import { Btn, Tag } from "./ui";
import { EpicGraphImpact } from "./EpicGraphImpact";
import type { Epic, Project, AgentMeta } from "@/lib/types";

// One epic card: header (title + progress + run/stop/mark-complete buttons)
// + per-task rows (model picker + actions + handoff chip + live log panel).
//
// SRP: pure presentation. The runtime (executeTask, runEpic, persistence)
// stays in the parent; this component fires callbacks.

type Task = {
  id: string;
  key: string;
  parentId: string;
  parentTitle: string;
  title: string;
  agent: string;
  stage: string;
  modelOverride?: string;
  files?: string[];
  dependsOn?: string[];
  dynId?: string;
};

export type EpicProgress = {
  done: number;
  total: number;
  complete: boolean;
  manualComplete: boolean;
  completedAt?: string;
  completedNote?: string;
};

type EpicCardProps = {
  epic: Epic;
  project: Project;
  tasks: Task[];
  progress: EpicProgress;
  collapsed: boolean;
  epicBusy: boolean;
  // task-level signals
  cliAvail: Record<string, boolean | null>;
  taskBusy: Record<string, boolean>;
  taskStart: Record<string, number>;
  taskLogs: Record<string, string>;
  taskExpand: Record<string, boolean>;
  // helpers
  taskVariantId: (t: Task) => string | undefined;
  isTaskGated: (t: Task) => boolean;
  // callbacks
  onToggleCollapsed: () => void;
  onRunEpic: () => void;
  onStopEpic: () => void;
  onMarkComplete: () => void;
  onReopen: () => void;
  onSetTaskOverride: (taskId: string, variantId: string) => void;
  onResetTask: (taskId: string) => void;
  onRunOneTask: (taskId: string) => void;
  onOpenHandoff: (path: string, opts: { taskTitle: string; sinceISO: string | null }) => void;
  onOpenSplitModal: (epic: Epic) => void;
  onToggleExpand: (taskId: string) => void;
};

const stageColor = (id: string) =>
  id === "done" ? C.ok :
  (id === "qa" || id === "review" || id === "sec") ? C.warn :
  (id === "progress" || id === "unit") ? C.swarm :
  C.dim;

const TaskRow: React.FC<{
  t: Task;
  epic: Epic;
  project: EpicCardProps["project"];
  cliAvail: EpicCardProps["cliAvail"];
  taskBusy: EpicCardProps["taskBusy"];
  taskStart: EpicCardProps["taskStart"];
  taskLogs: EpicCardProps["taskLogs"];
  taskExpand: EpicCardProps["taskExpand"];
  taskVariantId: EpicCardProps["taskVariantId"];
  isTaskGated: EpicCardProps["isTaskGated"];
  onSetTaskOverride: EpicCardProps["onSetTaskOverride"];
  onResetTask: EpicCardProps["onResetTask"];
  onRunOneTask: EpicCardProps["onRunOneTask"];
  onOpenHandoff: EpicCardProps["onOpenHandoff"];
  onOpenSplitModal: EpicCardProps["onOpenSplitModal"];
  onToggleExpand: EpicCardProps["onToggleExpand"];
}> = ({ t, epic, project, cliAvail, taskBusy, taskStart, taskLogs, taskExpand, taskVariantId, isTaskGated, onSetTaskOverride, onResetTask, onRunOneTask, onOpenHandoff, onOpenSplitModal, onToggleExpand }) => {
  const a = AGENTS.find((x) => x.id === t.agent);
  const variantId = taskVariantId(t);
  const found = variantId ? findModelVariant(variantId) : null;
  const projectAgent = (project.agents || []).find((pa: AgentMeta) => pa.role === t.agent);
  const cliInstalled = found ? cliAvail[found.model.cmd] : false;
  const isBusy = !!taskBusy[t.id];
  const isDone = t.stage === "done";
  const gated = isTaskGated(t);
  const elapsedMs = isBusy && taskStart[t.id] ? Date.now() - taskStart[t.id] : 0;
  const showLockIcon = gated && !isDone && !isBusy;
  const handoffPath = epic?.handoffPaths?.[t.key];

  return (
    <div id={`task-row-${t.id}`}>
      <div style={{ ...mono, fontSize: 11, padding: "4px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderTop: `1px solid ${C.soft}`, opacity: gated && !isDone ? 0.55 : 1 }}>
        <span style={{ color: isDone ? C.ok : C.ink, flex: 1, minWidth: 0 }}>
          {isBusy ? "⟳" : isDone ? "✓" : showLockIcon ? <Lock size={9} style={{ display: "inline", verticalAlign: "middle" }} /> : "○"} {t.title}
          {isBusy && <span style={{ color: C.accent, marginLeft: 4 }}>· running {Math.floor(elapsedMs / 1000)}s</span>}
          <span style={{ color: C.dim }}> · {a?.emoji} {a?.name}</span>
          {projectAgent ? (
            <span style={{ ...mono, fontSize: 9, marginLeft: 6, padding: "1px 5px", border: `1px solid ${C.swarm}`, color: C.swarm }} title={projectAgent.description}>
              .claude:{projectAgent.id}
            </span>
          ) : (
            <span style={{ ...mono, fontSize: 9, marginLeft: 6, color: C.warn }} title="No project agent — falls back to standard role">
              ⚠ no project agent
            </span>
          )}
          {t.modelOverride && (
            <span style={{ ...mono, fontSize: 9, marginLeft: 6, color: C.accent }} title="Model overridden for this task">override</span>
          )}
        </span>
        <select
          value={variantId || ""}
          onChange={(e) => onSetTaskOverride(t.id, e.target.value)}
          disabled={isBusy}
          style={{ ...mono, fontSize: 10, padding: "2px 4px", border: `1px solid ${C.line}`, background: C.paper, color: C.ink, maxWidth: 180 }}
          title="Override model for this task"
        >
          {MODELS.flatMap((m) =>
            m.variants.map((v) => {
              const installed = cliAvail[m.cmd];
              return (
                <option key={v.id} value={v.id}>
                  {m.name} · {v.name}{installed === false ? " (not installed)" : ""}
                </option>
              );
            }),
          )}
        </select>
        {isDone && (
          <button onClick={() => onResetTask(t.id)} disabled={isBusy}
            title="Reset to backlog"
            style={{ ...mono, fontSize: 10, padding: "3px 8px", border: `1px solid ${C.line}`, background: C.paper, cursor: "pointer" }}>
            <RotateCcw size={10} />
          </button>
        )}
        <button
          onClick={() => onRunOneTask(t.id)}
          disabled={isBusy || !project.workspacePath || cliInstalled === false || (gated && !isDone)}
          title={gated && !isDone ? "Locked — complete scope + spec first" : cliInstalled === false ? `${found?.model.cmd} not on PATH` : isDone ? "Re-run this task" : "Run this task"}
          style={{ ...mono, fontSize: 10, padding: "3px 8px", border: `1px solid ${(gated && !isDone) ? C.dim : cliInstalled === false ? C.warn : C.ink}`, background: (gated && !isDone) ? C.soft : cliInstalled === false ? C.soft : C.ink, color: (gated && !isDone) || cliInstalled === false ? C.dim : C.paper, cursor: ((gated && !isDone) || cliInstalled === false) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 3 }}
        >
          {isBusy ? "⟳" : (gated && !isDone) ? <Lock size={9} /> : <Play size={9} />} {isDone ? "rerun" : (gated && !isDone) ? "locked" : "run"}
        </button>
        <Tag color={stageColor(t.stage)}>{STAGES.find((s) => s.id === t.stage)?.label}</Tag>
        {handoffPath && (
          <button
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              const startMs = taskStart[t.id];
              onOpenHandoff(handoffPath, {
                taskTitle: t.title,
                sinceISO: startMs ? new Date(startMs).toISOString() : null,
              });
            }}
            title={`Open ${handoffPath}`}
            style={{ ...mono, fontSize: 9, color: C.swarm, background: "transparent", border: `1px dashed ${C.swarm}`, padding: "2px 5px", cursor: "pointer", borderRadius: 2 }}
          >
            📄 {handoffPath.split("/").slice(-2).join("/")}
          </button>
        )}
        {t.key === "spec" && isDone && (
          <button onClick={() => onOpenSplitModal(epic)}
            title="Break spec into parallel implementation subtasks"
            style={{ ...mono, fontSize: 10, padding: "3px 8px", border: `1px solid ${C.swarm}`, background: C.paper, color: C.swarm, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
            ✂ split
          </button>
        )}
        {(taskLogs[t.id] || isBusy) && (
          <button onClick={() => onToggleExpand(t.id)}
            title={taskExpand[t.id] ? "hide live output" : "show live output"}
            style={{ background: "transparent", border: `1px solid ${C.line}`, padding: "2px 4px", cursor: "pointer", display: "flex" }}>
            {taskExpand[t.id] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        )}
      </div>
      {taskExpand[t.id] && (taskLogs[t.id] || isBusy) && (
        <div style={{ borderTop: `1px dashed ${C.dim}`, background: "#0a0e1a", color: "#9be59b", padding: 8, ...mono, fontSize: 10, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {taskLogs[t.id] || (isBusy ? "(waiting for output…)" : "(no output)")}
          {isBusy && <div style={{ color: "#e8c46c", marginTop: 4 }}>⟳ still running…</div>}
        </div>
      )}
    </div>
  );
};

export const EpicCard = (props: EpicCardProps) => {
  const { epic, progress: p, collapsed, epicBusy, project, tasks } = props;

  return (
    <div style={{ border: `1px solid ${C.line}`, marginBottom: 6, background: C.paper }}>
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={props.onToggleCollapsed}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <div style={{ flex: 1, cursor: "pointer" }} onClick={props.onToggleCollapsed}>
          <div style={{ ...serif, fontSize: 15 }}>
            {epic.title} {p.complete && <Check size={14} style={{ display: "inline", color: C.ok, verticalAlign: "middle" }} />}
          </div>
          <div style={{ ...mono, fontSize: 10, color: C.dim, marginTop: 2 }}>
            {p.done}/{p.total} subtasks complete
          </div>
        </div>
        <div style={{ width: 100, height: 6, background: C.soft, position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${p.total ? (p.done / p.total) * 100 : 0}%`, background: p.complete ? C.ok : C.accent, transition: "width 300ms" }} />
        </div>
        {epicBusy ? (
          <Btn small onClick={props.onStopEpic}><Pause size={10} /> stop</Btn>
        ) : !p.manualComplete ? (
          <Btn small primary onClick={props.onRunEpic} disabled={!project.workspacePath}>
            <Play size={10} /> {p.done > 0 && p.done < p.total ? "resume" : "run epic"}
          </Btn>
        ) : null}
        {!p.manualComplete && !epicBusy && (
          <Btn small onClick={props.onMarkComplete} title="Mark this epic as complete (overrides subtask stages)">
            <Check size={10} /> mark complete
          </Btn>
        )}
        {p.manualComplete && (
          <Btn small onClick={props.onReopen} title={`Completed ${p.completedAt ? new Date(p.completedAt).toLocaleString() : ""}${p.completedNote ? ` — ${p.completedNote}` : ""}. Click to reopen.`}>
            <RotateCcw size={10} /> reopen
          </Btn>
        )}
        {p.manualComplete && (
          <Tag color={C.ok} title={p.completedNote || ""}>
            ✓ done {p.completedAt ? new Date(p.completedAt).toLocaleDateString() : ""}
          </Tag>
        )}
        {p.complete && !p.manualComplete && <Tag color={C.ok}>done</Tag>}
      </div>
      {!collapsed && (
        <div style={{ borderTop: `1px dashed ${C.dim}`, padding: 8, display: "flex", flexDirection: "column", gap: 3 }}>
          {epic.brief && (
            <div style={{ ...mono, fontSize: 11, color: C.dim, padding: "4px 8px", marginBottom: 4 }}>{epic.brief}</div>
          )}
          {epic.graphImpact && <EpicGraphImpact impact={epic.graphImpact} />}
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              t={t}
              epic={epic}
              project={project}
              cliAvail={props.cliAvail}
              taskBusy={props.taskBusy}
              taskStart={props.taskStart}
              taskLogs={props.taskLogs}
              taskExpand={props.taskExpand}
              taskVariantId={props.taskVariantId}
              isTaskGated={props.isTaskGated}
              onSetTaskOverride={props.onSetTaskOverride}
              onResetTask={props.onResetTask}
              onRunOneTask={props.onRunOneTask}
              onOpenHandoff={props.onOpenHandoff}
              onOpenSplitModal={props.onOpenSplitModal}
              onToggleExpand={props.onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};
