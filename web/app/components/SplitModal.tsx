"use client";

import React from "react";
import { C, mono, serif } from "@/lib/theme";
import { Btn } from "./ui";

// Modal: prompt the writer to split its spec into parallel-safe subtasks.
// SRP: presentation only. Caller owns the splitModal state shape and the
// runSplit() async; this just dispatches via callbacks.

export type SplitModalState = {
  epicId: string;
  specPath: string;
  busy: boolean;
  error: string | null;
  raw: string | null;
};

type Props = {
  state: SplitModalState;
  workspacePath?: string;
  onChangeSpecPath: (path: string) => void;
  onCancel: () => void;
  onRun: () => void;
};

export const SplitModal = ({ state, workspacePath, onChangeSpecPath, onCancel, onRun }: Props) => (
  <div
    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
    onClick={(e) => { if (!state.busy && e.target === e.currentTarget) onCancel(); }}
  >
    <div style={{ background: C.paper, border: `1px solid ${C.line}`, padding: 18, width: 600, maxWidth: "92vw" }}>
      <div style={{ ...serif, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Split spec into parallel subtasks</div>
      <div style={{ ...mono, fontSize: 10, color: C.dim, marginBottom: 12 }}>
        Reads spec from a file in <code>{workspacePath}</code>, asks the writer model to emit ONLY a <code>parallel_subtasks</code> JSON block, parses it, and replaces the static impl rows with one row per parallel task.
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.dim, marginBottom: 4 }}>spec file (relative or absolute)</div>
        <input
          value={state.specPath}
          onChange={(e) => onChangeSpecPath(e.target.value)}
          disabled={state.busy}
          style={{ ...mono, fontSize: 11, padding: 8, width: "100%", border: `1px solid ${C.line}`, background: C.paper }}
        />
      </div>
      {state.error && (
        <pre style={{ ...mono, fontSize: 10, color: C.accent, background: "#fff5f3", border: `1px solid ${C.accent}`, padding: 8, marginBottom: 10, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
          {state.error}
        </pre>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <Btn onClick={onCancel} disabled={state.busy}>cancel</Btn>
        <Btn primary onClick={onRun} disabled={state.busy || !state.specPath.trim()}>
          {state.busy ? "splitting…" : <>✂ split now</>}
        </Btn>
      </div>
    </div>
  </div>
);
