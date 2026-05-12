"use client";

import React from "react";
import { Settings } from "lucide-react";
import { C, mono } from "@/lib/theme";
import { AGENTS, defaultAgentModels } from "@/lib/agents";
import { MODELS, findModelVariant, variantActive } from "@/lib/models";
import { Btn } from "./ui";
import type { CLIRegistration } from "@/lib/types";

// Per-agent model picker grid + 3 quick presets.
// SRP: presentation. The applyPreset helper owns the preset → model-map
// translation in one place so future presets only touch this file.

type Preset = "balanced" | "quality" | "speed";

export const applyPreset = (preset: Preset): Record<string, string> => {
  if (preset === "quality") {
    return {
      lead: "claude-opus-4-7", writer: "claude-sonnet-4-6",
      ux: "claude-opus-4-7", secpre: "claude-opus-4-7",
      fe: "claude-sonnet-4-6", be: "claude-opus-4-7", db: "claude-sonnet-4-6",
      qa: "claude-sonnet-4-6", rev: "claude-opus-4-7", sec: "claude-opus-4-7",
      dev: "claude-sonnet-4-6",
    };
  }
  if (preset === "speed") {
    const h = "claude-haiku-4-5-20251001";
    return {
      lead: h, writer: h, ux: h, secpre: h, fe: h, be: h, db: h,
      qa: h, rev: h, sec: h, dev: h,
    };
  }
  return defaultAgentModels(); // balanced
};

type Props = {
  agentModels: Record<string, string>;
  onChange: (agentId: string, variantId: string) => void;
  clis: Record<string, CLIRegistration>;
  onPreset: (preset: Preset) => void;
};

export const AgentRouting = ({ agentModels, onChange, clis, onPreset }: Props) => {
  return (
    <div style={{ border: `1px solid ${C.line}`, padding: 14, background: C.paper, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ ...mono, fontSize: 12, fontWeight: 500, color: C.dim, display: "flex", alignItems: "center", gap: 6 }}>
          <Settings size={11} /> agent → model routing
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn small onClick={() => onPreset("balanced")}>balanced</Btn>
          <Btn small onClick={() => onPreset("quality")}>quality-first</Btn>
          <Btn small onClick={() => onPreset("speed")}>speed-first</Btn>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6 }}>
        {AGENTS.map((agent) => {
          const variantId = agentModels[agent.id];
          const found = findModelVariant(variantId);
          const active = variantActive(variantId, clis);
          return (
            <div
              key={agent.id}
              style={{ border: `1px solid ${C.line}`, padding: 8, background: C.paper, display: "flex", alignItems: "center", gap: 8 }}
            >
              <div style={{ ...mono, fontSize: 16, width: 20, textAlign: "center" }}>{agent.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...mono, fontSize: 11 }}>{agent.name}</div>
                <div style={{ ...mono, fontSize: 11, color: C.text2 }}>{agent.desc}</div>
              </div>
              <select
                value={variantId || ""}
                onChange={(e) => onChange(agent.id, e.target.value)}
                style={{
                  ...mono,
                  fontSize: 12,
                  padding: "4px 6px",
                  border: `1px solid ${active && found ? found.model.color : C.accent}`,
                  background: active && found ? found.model.color : "#fff",
                  color: active ? C.paper : C.accent,
                  cursor: "pointer",
                  minWidth: 130,
                }}
              >
                {MODELS.flatMap((m) => m.variants.map((v) => {
                  const vActive = clis[m.id]?.active;
                  return (
                    <option key={v.id} value={v.id} disabled={!vActive}>
                      {m.name} · {v.name}{!vActive ? " 🔒" : ""}
                    </option>
                  );
                }))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
};
