"use client";

import React from "react";
import { CreditCard } from "lucide-react";
import { C, mono, serif } from "@/lib/theme";
import { MODELS } from "@/lib/models";
import { Btn, Tag } from "./ui";
import type { CLIRegistration } from "@/lib/types";

// "Models" tab — lists every supported CLI vendor + variants and the
// connect/disconnect button. Persistence is delegated to the parent's
// onToggle callback (which fires the toggleCLI server action).
//
// SRP: presentation only. The CLI registry lives in lib/models.ts.

type Props = {
  clis: Record<string, CLIRegistration>;
  onToggle: (modelId: string) => void;
};

export const CLIsTab = ({ clis, onToggle }: Props) => (
  <div>
    <div style={{ ...mono, fontSize: 11, color: C.dim, marginBottom: 16 }}>
      bring any terminal model · each CLI can have multiple variants (Opus/Sonnet/Haiku, GPT-5/Mini, etc.)
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
      {MODELS.map((m) => {
        const sub = clis[m.id];
        const active = !!sub?.active;
        return (
          <div key={m.id} style={{ border: `1px solid ${C.line}`, padding: 14, background: C.paper }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, background: m.color }} />
                <div>
                  <div style={{ ...serif, fontSize: 17 }}>{m.name}</div>
                  <div style={{ ...mono, fontSize: 9, color: C.dim }}>{m.vendor}</div>
                </div>
              </div>
              {active ? <Tag color={C.ok}>connected</Tag> : <Tag color={C.dim}>not connected</Tag>}
            </div>

            <div style={{ ...mono, fontSize: 9, color: C.dim, marginBottom: 6, letterSpacing: "0.1em" }}>variants</div>
            {m.variants.map((v) => (
              <div
                key={v.id}
                style={{ ...mono, fontSize: 10, color: active ? C.ink : C.dim, padding: "3px 0", display: "flex", justifyContent: "space-between", borderBottom: `1px dashed ${C.dim}` }}
              >
                <span>{v.name}</span>
                <span style={{ fontSize: 9, color: C.dim }}>{v.strength}</span>
              </div>
            ))}

            <div style={{ ...mono, fontSize: 10, color: C.dim, padding: "6px 8px", background: C.soft, margin: "10px 0" }}>
              $ {m.cmd} ...
            </div>

            {active ? (
              <>
                <div style={{ ...mono, fontSize: 10, marginBottom: 4 }}>
                  Plan: <span style={{ color: C.ok }}>{sub.plan}</span> · renews {sub.until}
                </div>
                <Btn small onClick={() => onToggle(m.id)}>disconnect</Btn>
              </>
            ) : (
              <Btn small onClick={() => onToggle(m.id)}>
                <CreditCard size={9} /> connect
              </Btn>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
