"use client";

import React from "react";
import { ChevronDown, ChevronRight, X, RotateCcw } from "lucide-react";
import { C, mono } from "@/lib/theme";

// Right-side handoff drawer.
// SRP: pure presentation. The owning component (ProjectBoard) holds the
// viewmodel + fetches data via server actions; this file renders only and
// signals back via callbacks.

export type ChangedFileVM = {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  diff: string;
  truncated: boolean;
  binary: boolean;
  mtimeISO?: string;
};

export type ChangesResultVM = {
  baseline: "HEAD" | "none";
  filteredSinceISO?: string;
  files: ChangedFileVM[];
  totalAdditions: number;
  totalDeletions: number;
  warning?: string;
};

export type HandoffViewerVM = {
  tab: "handoff" | "changes";
  path: string;
  content: string;
  sizeBytes: number;
  mtime: string;
  loading: boolean;
  error: string | null;
  taskTitle?: string;
  sinceISO?: string | null;
  changes: ChangesResultVM | null;
  changesLoading: boolean;
  changesError: string | null;
  expandedDiff: Record<string, boolean>;
};

const STATUS_LABEL: Record<string, string> = {
  M: "modified", A: "added", D: "deleted", R: "renamed", U: "untracked", "?": "untracked",
};
const STATUS_COLOR: Record<string, string> = {
  M: "#c98a2b", A: "#3a7a3a", D: "#c14a3c", R: "#3a5a78", U: "#3a7a3a", "?": "#3a7a3a",
};

const DiffLine = ({ line }: { line: string }) => {
  const first = line[0] || "";
  let color: string = C.termText;
  let bg = "transparent";
  if (line.startsWith("+++") || line.startsWith("---")) color = "#c0c8b8";
  else if (line.startsWith("@@")) { color = "#7aa3c5"; bg = "#0e1830"; }
  else if (first === "+") { color = C.termOk; bg = "rgba(58,122,58,0.18)"; }
  else if (first === "-") { color = C.termErr; bg = "rgba(193,74,60,0.18)"; }
  return (
    <div style={{ color, background: bg, padding: "0 6px", whiteSpace: "pre" }}>
      {line || " "}
    </div>
  );
};

type ChangesTabProps = {
  vm: HandoffViewerVM;
  setVm: React.Dispatch<React.SetStateAction<HandoffViewerVM | null>>;
};

export const ChangesTab = ({ vm, setVm }: ChangesTabProps) => {
  const toggle = (p: string) => setVm((prev) =>
    prev ? { ...prev, expandedDiff: { ...prev.expandedDiff, [p]: !prev.expandedDiff?.[p] } } : prev,
  );

  if (vm.changesLoading) {
    return <div style={{ padding: 14, ...mono, fontSize: 11, color: C.dim }}>scanning git…</div>;
  }
  if (vm.changesError) {
    return <div style={{ padding: 14, ...mono, fontSize: 11, color: C.accent }}>error: {vm.changesError}</div>;
  }
  if (!vm.changes) {
    return <div style={{ padding: 14, ...mono, fontSize: 11, color: C.dim }}>click reload to scan</div>;
  }
  if (vm.changes.warning && vm.changes.baseline === "none") {
    return <div style={{ padding: 14, ...mono, fontSize: 11, color: C.warn }}>{vm.changes.warning}</div>;
  }
  if (vm.changes.files.length === 0) {
    return (
      <div style={{ padding: 14, ...mono, fontSize: 11, color: C.dim }}>
        no changes since {vm.sinceISO ? new Date(vm.sinceISO).toLocaleString() : "HEAD"}.
        {vm.sinceISO && <> (try reloading without the time filter — clicking refresh after the run completes)</>}
      </div>
    );
  }

  return (
    <div>
      {vm.changes.warning && (
        <div style={{ padding: "8px 14px", background: "#fff7e0", borderBottom: `1px solid ${C.warn}`, ...mono, fontSize: 10, color: "#5a3e00" }}>
          {vm.changes.warning}
        </div>
      )}
      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.line}`, background: C.soft, ...mono, fontSize: 10, color: C.dim }}>
        baseline: {vm.changes.baseline}
        {vm.sinceISO && <> · filtered to files modified ≥ {new Date(vm.sinceISO).toLocaleTimeString()}</>}
        · totals: <span style={{ color: "#3a7a3a" }}>+{vm.changes.totalAdditions}</span> <span style={{ color: "#c14a3c" }}>-{vm.changes.totalDeletions}</span>
      </div>
      {vm.changes!.files.map((f) => {
        const expanded = !!vm.expandedDiff?.[f.path];
        const statusKey = f.status in STATUS_LABEL ? f.status : "M";
        return (
          <div key={f.path} style={{ borderBottom: `1px solid ${C.line}` }}>
            <button
              type="button"
              onClick={() => toggle(f.path)}
              style={{ width: "100%", textAlign: "left", padding: "8px 14px", background: C.paper, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, ...mono, fontSize: 11 }}
            >
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span style={{ display: "inline-block", padding: "1px 6px", border: `1px solid ${STATUS_COLOR[statusKey]}`, color: STATUS_COLOR[statusKey], fontSize: 9, letterSpacing: "0.08em" }}>
                {STATUS_LABEL[statusKey]}
              </span>
              <span style={{ flex: 1, wordBreak: "break-all" }}>{f.path}</span>
              {!f.binary && (f.additions > 0 || f.deletions > 0) && (
                <span style={{ ...mono, fontSize: 10 }}>
                  <span style={{ color: "#3a7a3a" }}>+{f.additions}</span> <span style={{ color: "#c14a3c" }}>-{f.deletions}</span>
                </span>
              )}
              {f.binary && <span style={{ color: C.dim, fontSize: 10 }}>binary</span>}
              {f.truncated && <span style={{ color: C.warn, fontSize: 10 }}>truncated</span>}
            </button>
            {expanded && (
              <div style={{ background: C.terminal, color: C.termText, ...mono, fontSize: 10.5, lineHeight: 1.45, padding: "6px 0", maxHeight: 480, overflow: "auto" }}>
                {f.diff.split("\n").map((line, i) => <DiffLine key={i} line={line} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ----- Drawer shell -----

type DrawerProps = {
  vm: HandoffViewerVM;
  setVm: React.Dispatch<React.SetStateAction<HandoffViewerVM | null>>;
  onClose: () => void;
  onSwitchTab: (tab: "handoff" | "changes") => void;
  onReloadHandoff: () => void;
  onReloadChanges: () => void;
};

const TabBtn = ({ id, label, active, onClick }: { id: string; label: string; active: boolean; onClick: () => void }) => (
  <button
    key={id}
    onClick={onClick}
    style={{
      ...mono,
      fontSize: 11,
      padding: "8px 14px",
      border: "none",
      borderBottom: active ? `2px solid ${C.ink}` : "2px solid transparent",
      background: active ? C.paper : "transparent",
      color: active ? C.ink : C.dim,
      cursor: "pointer",
      fontWeight: active ? 600 : 400,
    }}
  >
    {label}
  </button>
);

export const HandoffDrawer = ({ vm, setVm, onClose, onSwitchTab, onReloadHandoff, onReloadChanges }: DrawerProps) => {
  const changesLabel = vm.changes
    ? `Changes (${vm.changes.files.length} files · +${vm.changes.totalAdditions} -${vm.changes.totalDeletions})`
    : "Changes";

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 250 }} />
      <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 760, maxWidth: "92vw", background: C.paper, borderLeft: `1px solid ${C.line}`, boxShadow: "-4px 0 16px rgba(0,0,0,0.18)", zIndex: 260, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.dim }}>
              handoff{vm.taskTitle ? ` · ${vm.taskTitle}` : ""}
            </div>
            <div style={{ ...mono, fontSize: 11, fontWeight: 600, wordBreak: "break-all" }}>{vm.path}</div>
            {!vm.loading && !vm.error && (
              <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 2 }}>
                {(vm.sizeBytes / 1024).toFixed(1)} kB · modified {new Date(vm.mtime).toLocaleString()}
                {vm.sinceISO && <> · task started {new Date(vm.sinceISO).toLocaleString()}</>}
              </div>
            )}
          </div>
          <button onClick={onClose} title="close" style={{ ...mono, fontSize: 12, padding: "4px 8px", border: `1px solid ${C.line}`, background: C.paper, cursor: "pointer", display: "flex", alignItems: "center" }}>
            <X size={12} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${C.line}`, background: C.soft }}>
          <TabBtn id="handoff" label="Handoff"     active={vm.tab === "handoff"} onClick={() => onSwitchTab("handoff")} />
          <TabBtn id="changes" label={changesLabel} active={vm.tab === "changes"} onClick={() => onSwitchTab("changes")} />
          <div style={{ flex: 1 }} />
          {vm.tab === "handoff" && (
            <>
              <button
                onClick={() => navigator.clipboard?.writeText(vm.content || "")}
                disabled={vm.loading || !!vm.error}
                title="copy file content"
                style={{ ...mono, fontSize: 10, padding: "4px 10px", border: "none", background: "transparent", cursor: "pointer", borderLeft: `1px solid ${C.line}` }}
              >
                copy
              </button>
              <button
                onClick={onReloadHandoff}
                title="reload"
                style={{ ...mono, fontSize: 10, padding: "4px 10px", border: "none", background: "transparent", cursor: "pointer", borderLeft: `1px solid ${C.line}`, display: "flex", alignItems: "center" }}
              >
                <RotateCcw size={11} />
              </button>
            </>
          )}
          {vm.tab === "changes" && (
            <button
              onClick={onReloadChanges}
              disabled={vm.changesLoading}
              title="reload diff"
              style={{ ...mono, fontSize: 10, padding: "4px 10px", border: "none", background: "transparent", cursor: "pointer", borderLeft: `1px solid ${C.line}`, display: "flex", alignItems: "center" }}
            >
              <RotateCcw size={11} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {vm.tab === "handoff" && (
            <>
              {!vm.loading && !vm.error && vm.sizeBytes < 200 && (
                <div style={{ padding: "10px 14px", background: "#fff7e0", borderBottom: `1px solid ${C.warn}`, ...mono, fontSize: 10, color: "#5a3e00" }}>
                  ⚠ Handoff body is empty (file = header only). The agent likely wrote
                  its result to a skill-managed file instead of stdout. Open the
                  <strong> Changes </strong> tab to see what files actually changed during this run.
                </div>
              )}
              <div style={{ padding: 14, background: C.terminal, color: C.termText, ...mono, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", minHeight: "100%" }}>
                {vm.loading
                  ? "loading…"
                  : vm.error
                    ? <span style={{ color: C.termErr }}>error: {vm.error}</span>
                    : (vm.content || "(empty file)")}
              </div>
            </>
          )}
          {vm.tab === "changes" && <ChangesTab vm={vm} setVm={setVm} />}
        </div>
      </aside>
    </>
  );
};
