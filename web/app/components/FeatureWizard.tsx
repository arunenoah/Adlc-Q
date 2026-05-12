"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { C, mono, serif } from "@/lib/theme";
import { AGENTS, SUBTASK_TEMPLATES } from "@/lib/agents";
import { Btn } from "./ui";
import { createFeatureWorkflow } from "../actions";
import type { Project } from "@/lib/types";

// Modal: pick title + type + brief + which subtasks to spin up.
// SRP: form state + submit. The actual workflow creation lives server-side
// in createFeatureWorkflow which writes to .devos/store.json.

type EpicType = "feature" | "bug" | "api";

type Props = {
  project: Project;
  onClose: () => void;
  onCreated: (project: Project) => void;
};

export const FeatureWizard = ({ project, onClose, onCreated }: Props) => {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EpicType>("feature");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tmpl = SUBTASK_TEMPLATES[type] || SUBTASK_TEMPLATES.feature;
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(tmpl.map((s) => s.key)));

  useEffect(() => {
    const keys = (SUBTASK_TEMPLATES[type] || SUBTASK_TEMPLATES.feature).map((s) => s.key);
    setSelectedKeys(new Set(keys));
  }, [type]);

  const toggleKey = (key: string) => {
    setSelectedKeys((curr) => {
      const next = new Set(curr);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const submit = async () => {
    if (!title.trim()) {
      setError("title required");
      return;
    }
    if (selectedKeys.size === 0) {
      setError("pick at least one subtask");
      return;
    }
    setBusy(true);
    setError(null);
    const orderedKeys = tmpl.map((s) => s.key).filter((k) => selectedKeys.has(k));
    const res = await createFeatureWorkflow({
      projectId: project.id,
      title: title.trim(),
      type,
      brief: brief.trim(),
      subtaskKeys: orderedKeys,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onCreated(res.data.project);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, padding: 18, width: 520, maxWidth: "90vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ ...serif, fontSize: 18, fontWeight: 600 }}>New feature workflow</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={16} /></button>
        </div>
        <div style={{ ...mono, fontSize: 10, color: C.dim, marginBottom: 12 }}>
          Generates graph impact analysis from <code>{project.workspacePath || "(no workspace path)"}/graphify-out/graph.json</code> and breaks the feature into role-bound subtasks.
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.dim, marginBottom: 4 }}>title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Add 2FA login"
            style={{ ...mono, fontSize: 12, padding: 8, width: "100%", border: `1px solid ${C.line}`, background: C.paper }}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.dim, marginBottom: 4 }}>type</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["feature", "bug", "api"] as EpicType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{ ...mono, fontSize: 10, padding: "6px 12px", border: `1px solid ${C.line}`, background: type === t ? C.ink : C.paper, color: type === t ? C.paper : C.ink, cursor: "pointer", letterSpacing: "0.12em" }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.dim, marginBottom: 4 }}>brief (used as graph keywords)</div>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Short description. Words here become keywords searched against graphify nodes."
            rows={4}
            style={{ ...mono, fontSize: 11, padding: 8, width: "100%", border: `1px solid ${C.line}`, background: C.paper, resize: "vertical" }}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.dim, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>subtasks ({selectedKeys.size}/{tmpl.length})</span>
            <span>
              <button
                onClick={() => setSelectedKeys(new Set(tmpl.map((s) => s.key)))}
                style={{ ...mono, fontSize: 9, padding: "1px 6px", background: "transparent", border: `1px solid ${C.line}`, marginRight: 4, cursor: "pointer" }}
              >all</button>
              <button
                onClick={() => setSelectedKeys(new Set())}
                style={{ ...mono, fontSize: 9, padding: "1px 6px", background: "transparent", border: `1px solid ${C.line}`, cursor: "pointer" }}
              >none</button>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 4, maxHeight: 200, overflowY: "auto", border: `1px solid ${C.soft}`, padding: 6 }}>
            {tmpl.map((s) => {
              const agent = AGENTS.find((a) => a.id === s.agent);
              const checked = selectedKeys.has(s.key);
              return (
                <label
                  key={s.key}
                  style={{ ...mono, fontSize: 10, padding: "3px 4px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", background: checked ? C.soft : "transparent" }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggleKey(s.key)} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                  <span style={{ color: C.dim, fontSize: 9 }}>{agent?.emoji} {agent?.name}</span>
                </label>
              );
            })}
          </div>
        </div>
        {error && <div style={{ ...mono, fontSize: 10, color: C.accent, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <Btn onClick={onClose}>cancel</Btn>
          <Btn primary onClick={submit} disabled={busy || !title.trim()}>
            {busy ? "analyzing…" : <><Sparkles size={11} /> analyze + create</>}
          </Btn>
        </div>
      </div>
    </div>
  );
};
