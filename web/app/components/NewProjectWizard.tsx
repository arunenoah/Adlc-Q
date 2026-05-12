"use client";

import React, { useState } from "react";
import { Plus, X, Globe, Cpu, Database } from "lucide-react";
import { C, mono, serif, TECH } from "@/lib/theme";
import { defaultAgentModels } from "@/lib/agents";
import { Btn } from "./ui";
import { AgentRouting, applyPreset } from "./AgentRouting";
import type { CLIRegistration, Project, Epic } from "@/lib/types";

// "Create project" form. Pure form state — submission goes through onCreate.
// SRP: gather inputs + validate locally; persistence is the parent's job
// (saveProject server action via the parent's onCreate).

type StackOpt = { id: string; name: string };

type StackPickerProps = {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  opts: StackOpt[];
  value: string;
  onChange: (id: string) => void;
};

const StackPicker = ({ label, icon: Icon, opts, value, onChange }: StackPickerProps) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
      <Icon size={11} /> {label}
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{ background: value === o.id ? C.ink : "transparent", color: value === o.id ? C.paper : C.ink, border: `1px solid ${C.line}`, padding: "6px 10px", ...mono, fontSize: 10, cursor: "pointer" }}
        >
          {o.name}
        </button>
      ))}
    </div>
  </div>
);

type Props = {
  onCreate: (project: Project) => void;
  onCancel: () => void;
  clis: Record<string, CLIRegistration>;
};

export const NewProjectWizard = ({ onCreate, onCancel, clis }: Props) => {
  const [name, setName] = useState("");
  const [pm, setPm] = useState("");
  const [stack, setStack] = useState({ frontend: "", backend: "", database: "" });
  const [agentModels, setAgentModels] = useState<Record<string, string>>(defaultAgentModels());
  const [epicTitle, setEpicTitle] = useState("");
  const [epics, setEpics] = useState<Epic[]>([]);

  const addEpic = () => {
    if (!epicTitle.trim()) return;
    setEpics([...epics, { id: `e-${Date.now()}`, title: epicTitle, type: "feature" }]);
    setEpicTitle("");
  };

  const ready = !!(name && pm && stack.frontend && stack.backend && stack.database);

  return (
    <div style={{ border: `1px solid ${C.line}`, padding: 20, maxWidth: 760 }}>
      <div style={{ ...serif, fontSize: 22, marginBottom: 4 }}>New Project</div>
      <div style={{ ...mono, fontSize: 11, color: C.dim, marginBottom: 18 }}>
        define project · pick stack · route each agent to its best model
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>Project name</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Tenant Portal v2"
          style={{ width: "100%", padding: 10, border: `1px solid ${C.line}`, background: C.paper, ...mono, fontSize: 13, outline: "none" }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>PM</div>
        <input
          value={pm}
          onChange={(e) => setPm(e.target.value)}
          placeholder="your name"
          style={{ width: "100%", padding: 10, border: `1px solid ${C.line}`, background: C.paper, ...mono, fontSize: 13, outline: "none" }}
        />
      </div>

      <StackPicker label="Frontend" icon={Globe}    opts={TECH.frontend} value={stack.frontend} onChange={(v) => setStack({ ...stack, frontend: v })} />
      <StackPicker label="Backend"  icon={Cpu}      opts={TECH.backend}  value={stack.backend}  onChange={(v) => setStack({ ...stack, backend: v })} />
      <StackPicker label="Database" icon={Database} opts={TECH.database} value={stack.database} onChange={(v) => setStack({ ...stack, database: v })} />

      <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px dashed ${C.dim}` }}>
        <AgentRouting
          agentModels={agentModels}
          onChange={(aid, vid) => setAgentModels({ ...agentModels, [aid]: vid })}
          clis={clis}
          onPreset={(p) => setAgentModels(applyPreset(p))}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 6 }}>
          Initial epics
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input
            value={epicTitle}
            onChange={(e) => setEpicTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEpic()}
            placeholder="e.g., User authentication"
            style={{ flex: 1, padding: 8, border: `1px solid ${C.line}`, background: C.paper, ...mono, fontSize: 12, outline: "none" }}
          />
          <Btn onClick={addEpic} small><Plus size={11} /> add</Btn>
        </div>
        {epics.map((e, i) => (
          <div
            key={e.id}
            style={{ ...mono, fontSize: 12, padding: "6px 10px", border: `1px solid ${C.line}`, marginBottom: 4, display: "flex", justifyContent: "space-between" }}
          >
            <span>{i + 1}. {e.title}</span>
            <button onClick={() => setEpics(epics.filter((x) => x.id !== e.id))} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.dim }}>
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <Btn
          primary
          disabled={!ready}
          onClick={() => onCreate({
            id: `p-${Date.now()}`,
            name,
            pm,
            stack,
            agentModels,
            epics,
          } as Project)}
        >
          create project
        </Btn>
        <Btn onClick={onCancel}>cancel</Btn>
      </div>
    </div>
  );
};
