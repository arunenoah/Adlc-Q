"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Network } from "lucide-react";
import { C, mono } from "@/lib/theme";
import type { GraphImpact } from "@/lib/types";

// Renders the per-epic graphify impact summary.
// SRP: pure presentation. Data is computed server-side in lib/graph.ts.

export const EpicGraphImpact = ({ impact }: { impact?: GraphImpact }) => {
  const [open, setOpen] = useState(true);

  const empty = !impact || (
    !impact.matchedNodes.length &&
    !impact.affectedFiles.length &&
    !impact.touchedGodNodes.length
  );

  if (empty) {
    return (
      <div style={{ ...mono, fontSize: 10, color: C.dim, padding: "4px 8px", marginBottom: 4 }}>
        graph: no matches for keywords [{(impact?.keywords || []).join(", ") || "—"}]
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${C.soft}`, padding: 8, marginBottom: 6, background: "#f6f5f0" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.swarm, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <Network size={10} /> graph impact — {impact!.matchedNodes.length} top matches · {impact!.totalMatches} total · {impact!.affectedFiles.length} files · {impact!.touchedGodNodes.length} god-nodes touched
      </div>
      {open && (
        <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ ...mono, fontSize: 9, color: C.dim, marginBottom: 3 }}>keywords</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
              {impact!.keywords.map((k) => (
                <span key={k} style={{ ...mono, fontSize: 9, padding: "1px 5px", border: `1px solid ${C.dim}`, color: C.ink }}>{k}</span>
              ))}
            </div>
            <div style={{ ...mono, fontSize: 9, color: C.dim, marginBottom: 3 }}>matched nodes</div>
            {impact!.matchedNodes.slice(0, 6).map((n) => (
              <div
                key={n.id}
                title={`${n.file}${n.location ? ":" + n.location : ""}`}
                style={{ ...mono, fontSize: 10, padding: "1px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                <span style={{ color: C.swarm }}>{n.label}</span>
                <span style={{ color: C.dim, marginLeft: 4 }}>·{n.matchScore}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ ...mono, fontSize: 9, color: C.dim, marginBottom: 3 }}>affected files</div>
            {impact!.affectedFiles.slice(0, 6).map((f) => (
              <div
                key={f}
                title={f}
                style={{ ...mono, fontSize: 9, color: C.ink, padding: "1px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {f.split("/").slice(-2).join("/")}
              </div>
            ))}
            {impact!.touchedGodNodes.length > 0 && (
              <>
                <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 6, marginBottom: 3 }}>god-nodes 1-hop</div>
                {impact!.touchedGodNodes.map((g) => (
                  <div key={g.name} style={{ ...mono, fontSize: 10, color: C.accent, padding: "1px 0" }}>★ {g.name}</div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
