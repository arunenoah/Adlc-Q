"use client";

import React, { useState } from "react";
import { Play } from "lucide-react";
import { C, mono, serif } from "@/lib/theme";
import { Btn } from "./ui";

// Pause-and-reply modal that fires after scope/spec to let the user accept,
// annotate, or abort before the orchestrator continues.
// SRP: pure presentation + local note state. The gate.resolve callback is
// owned by the orchestrator runner.

export type EpicReviewGate = {
  taskTitle: string;
  taskKey: string;
  output: string;
  resolve: (note: string | null) => void;
};

export const EpicReviewModal = ({ gate }: { gate: EpicReviewGate }) => {
  const [note, setNote] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, padding: 18, width: 720, maxWidth: "92vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ ...serif, fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Review: {gate.taskTitle}</div>
        <div style={{ ...mono, fontSize: 9, color: C.dim, marginBottom: 8 }}>
          step output ({gate.taskKey})
        </div>
        <pre style={{ ...mono, fontSize: 11, color: C.ink, background: "#f6f5f0", border: `1px solid ${C.soft}`, padding: 10, overflow: "auto", maxHeight: "40vh", whiteSpace: "pre-wrap" }}>
          {gate.output || "(no output)"}
        </pre>
        <div style={{ ...mono, fontSize: 9, color: C.dim, margin: "10px 0 4px" }}>
          your note / answer (optional, fed to next step)
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Answer questions, clarify scope, request changes. Empty = continue as-is."
          style={{ ...mono, fontSize: 11, padding: 8, border: `1px solid ${C.line}`, background: C.paper, resize: "vertical" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 12 }}>
          <Btn onClick={() => gate.resolve(null)}>abort epic</Btn>
          <Btn primary onClick={() => gate.resolve(note)}>
            <Play size={11} /> continue
          </Btn>
        </div>
      </div>
    </div>
  );
};
