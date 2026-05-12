// @ts-nocheck
// PR 2 — Wired to .devos/store.json via Server Actions. Discoverable projects from /Application/*/graphify-out/.
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Package, X, Check, GitBranch, Play, Pause, RotateCcw,
  Plus, FolderPlus, ChevronRight, ChevronDown, Layers, Cpu, Database, Globe,
  ArrowLeft, Bot, Terminal, Lock, CreditCard, AlertCircle, Settings, Shuffle,
  Network, FileCode, Sparkles, Search,
} from "lucide-react";
import { toggleCLI as toggleCLIAction, saveProject, removeProject, buildAgent, createFeatureWorkflow, runSubtaskHeadless, checkCliAvailability, writeHandoff, splitEpicIntoSubtasks, readHandoffFile, getRecentChanges } from "./actions";
import { C, mono, serif, TECH } from "@/lib/theme";
import { MODELS, findModelVariant, variantActive, migrateAgentModels } from "@/lib/models";
import { AGENTS, STAGES, SUBTASK_TEMPLATES, defaultAgentModels } from "@/lib/agents";
import { STDOUT_MANDATE, ROLE_PROMPTS, ROLE_PROMPTS_DRIFT } from "@/lib/prompts";
import { Btn, Tag } from "./components/ui";
import { ChangesTab } from "./components/HandoffDrawer";
import { EpicReviewModal } from "./components/EpicReviewModal";

// ---------- CLIs (terminal models) with variants ----------

// Loose stack inference for imported workspace projects (label → picker shape; the stackLabel survives for display)
const STACK_FROM_LABEL = (label) => {
  const l = (label || "").toLowerCase();
  const stack = { frontend: "react", backend: "node", database: "mysql" };
  if (l.includes("yii")) {
    stack.backend = "php-yii2";
    stack.frontend = "blade";
  } else if (l.includes("laravel")) {
    stack.backend = "php-laravel";
    stack.frontend = "blade";
  } else if (l.includes("php")) {
    stack.backend = "php";
    stack.frontend = "blade";
  }
  if (l.includes("next")) stack.frontend = "next";
  else if (l.includes("react native")) stack.frontend = "react";
  else if (l.includes("typescript/react") || l.includes("react")) stack.frontend = "react";
  else if (l.includes("vue")) stack.frontend = "vue";
  else if (l.includes("svelte")) stack.frontend = "svelte";
  if (l.includes("python") || l.includes("fastapi")) stack.backend = "python";
  if (l.includes(" go") || l.startsWith("go")) stack.backend = "go";
  if (l.includes("rails") || l.includes("ruby")) stack.backend = "rails";
  if (l.includes("postgres")) stack.database = "postgres";
  if (l.includes("mongo")) stack.database = "mongo";
  if (l.includes("supabase")) stack.database = "supabase";
  return stack;
};


// ---------- Connected CLIs state — seeded from server, persisted via Server Action ----------
const useConnectedCLIs = (initial) => {
  const [clis, setClis] = useState(initial);
  const toggle = (id) => {
    setClis((s) => ({
      ...s,
      [id]: s[id]?.active ? { active: false } : { active: true, plan: "Pro", until: "Dec 2026" },
    }));
    void toggleCLIAction(id);
  };
  return [clis, toggle];
};

// ---------- Connected CLIs tab ----------
const CLIsTab = ({ clis, onToggle }) => (
  <div>
    <div style={{ ...mono, fontSize: 11, color: C.dim, marginBottom: 16 }}>
      bring any terminal model · each CLI can have multiple variants (Opus/Sonnet/Haiku, GPT-5/Mini, etc.)
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
      {MODELS.map((m) => {
        const sub = clis[m.id];
        const active = sub?.active;
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

            <div style={{ ...mono, fontSize: 9, color: C.dim, marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>variants</div>
            {m.variants.map((v) => (
              <div key={v.id} style={{ ...mono, fontSize: 10, color: active ? C.ink : C.dim, padding: "3px 0", display: "flex", justifyContent: "space-between", borderBottom: `1px dashed ${C.dim}` }}>
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

// ---------- Per-Agent Model Picker ----------
const AgentRouting = ({ agentModels, onChange, clis, onPreset }) => {
  return (
    <div style={{ border: `1px solid ${C.line}`, padding: 14, background: C.paper, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim, display: "flex", alignItems: "center", gap: 6 }}>
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
            <div key={agent.id} style={{ border: `1px solid ${C.line}`, padding: 8, background: C.paper, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ ...mono, fontSize: 16, width: 20, textAlign: "center" }}>{agent.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...mono, fontSize: 11 }}>{agent.name}</div>
                <div style={{ ...mono, fontSize: 9, color: C.dim }}>{agent.desc}</div>
              </div>
              <select value={variantId} onChange={(e) => onChange(agent.id, e.target.value)}
                style={{
                  ...mono, fontSize: 10, padding: "4px 6px",
                  border: `1px solid ${active ? found.model.color : C.accent}`,
                  background: active ? found.model.color : "#fff",
                  color: active ? C.paper : C.accent,
                  cursor: "pointer", minWidth: 130,
                }}>
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

const applyPreset = (preset) => {
  if (preset === "quality") {
    return {
      lead: "claude-opus-4-7", writer: "claude-sonnet-4-6",
      ux: "claude-opus-4-7", fe: "claude-sonnet-4-6", be: "claude-opus-4-7", db: "claude-sonnet-4-6",
      qa: "claude-sonnet-4-6", rev: "claude-opus-4-7", sec: "claude-opus-4-7", dev: "claude-sonnet-4-6",
    };
  }
  if (preset === "speed") {
    const h = "claude-haiku-4-5-20251001";
    return {
      lead: h, writer: h, ux: h, fe: h, be: h, db: h, qa: h, rev: h, sec: h, dev: h,
    };
  }
  return defaultAgentModels();
};


// ---------- New Project Wizard ----------
const NewProjectWizard = ({ onCreate, onCancel, clis }) => {
  const [name, setName] = useState("");
  const [pm, setPm] = useState("");
  const [stack, setStack] = useState({ frontend: "", backend: "", database: "" });
  const [agentModels, setAgentModels] = useState(defaultAgentModels());
  const [epicTitle, setEpicTitle] = useState("");
  const [epics, setEpics] = useState([]);

  const addEpic = () => {
    if (!epicTitle.trim()) return;
    setEpics([...epics, { id: `e-${Date.now()}`, title: epicTitle, type: "feature" }]);
    setEpicTitle("");
  };

  const ready = name && pm && stack.frontend && stack.backend && stack.database;

  const StackPicker = ({ label, icon: Icon, opts, value, onChange }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={11} /> {label}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {opts.map((o) => (
          <button key={o.id} onClick={() => onChange(o.id)}
            style={{ background: value === o.id ? C.ink : "transparent", color: value === o.id ? C.paper : C.ink, border: `1px solid ${C.line}`, padding: "6px 10px", ...mono, fontSize: 10, cursor: "pointer" }}>
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ border: `1px solid ${C.line}`, padding: 20, maxWidth: 760 }}>
      <div style={{ ...serif, fontSize: 22, marginBottom: 4 }}>New Project</div>
      <div style={{ ...mono, fontSize: 11, color: C.dim, marginBottom: 18 }}>
        define project · pick stack · route each agent to its best model
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>Project name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Tenant Portal v2"
          style={{ width: "100%", padding: 10, border: `1px solid ${C.line}`, background: C.paper, ...mono, fontSize: 13, outline: "none" }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>PM</div>
        <input value={pm} onChange={(e) => setPm(e.target.value)} placeholder="your name"
          style={{ width: "100%", padding: 10, border: `1px solid ${C.line}`, background: C.paper, ...mono, fontSize: 13, outline: "none" }} />
      </div>

      <StackPicker label="Frontend" icon={Globe} opts={TECH.frontend} value={stack.frontend} onChange={(v) => setStack({ ...stack, frontend: v })} />
      <StackPicker label="Backend" icon={Cpu} opts={TECH.backend} value={stack.backend} onChange={(v) => setStack({ ...stack, backend: v })} />
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
          <input value={epicTitle} onChange={(e) => setEpicTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEpic()}
            placeholder="e.g., User authentication"
            style={{ flex: 1, padding: 8, border: `1px solid ${C.line}`, background: C.paper, ...mono, fontSize: 12, outline: "none" }} />
          <Btn onClick={addEpic} small><Plus size={11} /> add</Btn>
        </div>
        {epics.map((e, i) => (
          <div key={e.id} style={{ ...mono, fontSize: 12, padding: "6px 10px", border: `1px solid ${C.line}`, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>{i + 1}. {e.title}</span>
            <button onClick={() => setEpics(epics.filter((x) => x.id !== e.id))} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.dim }}><X size={11} /></button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <Btn primary disabled={!ready} onClick={() => onCreate({ id: `p-${Date.now()}`, name, pm, stack, agentModels, epics })}>
          create project
        </Btn>
        <Btn onClick={onCancel}>cancel</Btn>
      </div>
    </div>
  );
};

// ---------- Project Board ----------
const ProjectBoard = ({ project, onBack, clis, onUpdateProject }) => {
  const buildTasks = () => {
    const tasks = [];
    project.epics.forEach((epic) => {
      const tmpl = SUBTASK_TEMPLATES[epic.type] || SUBTASK_TEMPLATES.feature;
      const keys = epic.subtaskKeys;
      const filtered = keys && keys.length ? tmpl.filter((s) => keys.includes(s.key)) : tmpl;
      const stageMap = epic.taskStages || {};
      const dynImpls = epic.dynamicImplTasks || [];
      const hasDyn = dynImpls.length > 0;
      filtered.forEach((sub, i) => {
        if (hasDyn && (sub.key === "impl-be" || sub.key === "impl-fe")) {
          if (sub.key === "impl-be") {
            dynImpls.forEach((d) => {
              const id = `${epic.id}-d${d.id}`;
              tasks.push({
                id,
                key: `dyn:${d.id}`,
                dynId: d.id,
                files: d.files || [],
                dependsOn: d.depends_on || [],
                parentId: epic.id, parentTitle: epic.title,
                title: d.title, agent: d.role || "be",
                stage: stageMap[id] || "backlog",
              });
            });
          }
          return;
        }
        const id = `${epic.id}-s${sub.key || i}`;
        tasks.push({
          id,
          key: sub.key,
          parentId: epic.id, parentTitle: epic.title,
          title: sub.title, agent: sub.agent,
          stage: stageMap[id] || "backlog",
        });
      });
    });
    return tasks;
  };

  const [tasks, setTasks] = useState(buildTasks());
  const [running, setRunning] = useState(false);
  const [collapsedEpics, setCollapsedEpics] = useState({});
  const [activeAgent, setActiveAgent] = useState(null);
  const [terminal, setTerminal] = useState([]);
  const [showRouting, setShowRouting] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const timerRef = useRef(null);
  const epicsKey = project.epics.map((e) => `${e.id}:${(e.dynamicImplTasks || []).length}`).join("|");
  useEffect(() => {
    setTasks((curr) => {
      const fresh = buildTasks();
      const freshIds = new Set(fresh.map((t) => t.id));
      const stageOverrides = new Map(curr.filter((t) => freshIds.has(t.id)).map((t) => [t.id, t.stage]));
      return fresh.map((t) => ({ ...t, stage: stageOverrides.get(t.id) || t.stage }));
    });
  }, [epicsKey]);

  const addTerm = (line) => setTerminal((t) => [...t, line].slice(-40));

  const assignedVariants = [...new Set(Object.values(project.agentModels))];
  const blockedAgents = AGENTS.filter((a) => !variantActive(project.agentModels[a.id], clis));
  const canRun = blockedAgents.length === 0;

  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const runningRef = useRef(false);
  const projectRef = useRef(project);
  useEffect(() => { projectRef.current = project; }, [project]);

  const persistEpicChange = (epicId, mut) => {
    const cur = projectRef.current;
    const updatedEpics = cur.epics.map((e) => e.id === epicId ? mut(e) : e);
    const updated = { ...cur, epics: updatedEpics };
    projectRef.current = updated;
    onUpdateProject(updated);
  };

  const recordOutput = (epicId, key, stdout) => {
    if (!key) return;
    persistEpicChange(epicId, (e) => ({
      ...e,
      outputs: { ...(e.outputs || {}), [key]: stdout },
    }));
  };

  const recordTaskStage = (epicId, taskId, stage) => {
    persistEpicChange(epicId, (e) => ({
      ...e,
      taskStages: { ...(e.taskStages || {}), [taskId]: stage },
    }));
  };

  const recordDynamicTasks = (epicId, dynamicImplTasks) => {
    persistEpicChange(epicId, (e) => ({ ...e, dynamicImplTasks }));
  };

  const openSplitModal = (epic) => {
    const defaultPath = epic.handoffPaths?.spec || ".claude/docs/upcoming-maintenance-widget-intended-docs.md";
    setSplitModal({ epicId: epic.id, specPath: defaultPath, busy: false, error: null, raw: null });
  };

  const runSplit = async () => {
    if (!splitModal) return;
    const epic = projectRef.current.epics.find((e) => e.id === splitModal.epicId);
    if (!epic || !project.workspacePath) return;
    const variantId = project.agentModels.writer || "claude-sonnet-4-6";
    const found = findModelVariant(variantId);
    if (!found) {
      setSplitModal((m) => ({ ...m, error: "no model assigned to writer" }));
      return;
    }
    setSplitModal((m) => ({ ...m, busy: true, error: null, raw: null }));
    addTerm({ kind: "cmd", text: `$ split spec → parallel_subtasks (${found.variant.name})` });
    const res = await splitEpicIntoSubtasks({
      workspacePath: project.workspacePath,
      cliCmd: found.model.cmd,
      cliVendor: found.model.id,
      modelId: found.variant.id,
      specPath: splitModal.specPath,
      scopeText: epic.outputs?.scope || "",
    });
    if (!res.ok) {
      addTerm({ kind: "warn", text: `  ✗ split failed: ${res.error}` });
      setSplitModal((m) => ({ ...m, busy: false, error: res.error }));
      return;
    }
    recordDynamicTasks(splitModal.epicId, res.data.tasks);
    addTerm({ kind: "ok", text: `  ✓ produced ${res.data.tasks.length} parallel impl tasks` });
    res.data.tasks.forEach((t) => addTerm({ kind: "info", text: `    ↳ [${t.id}] ${t.role} — ${t.title}` }));
    setSplitModal(null);
  };

  const recordHandoffPath = (epicId, key, path) => {
    if (!key || !path) return;
    persistEpicChange(epicId, (e) => ({
      ...e,
      handoffPaths: { ...(e.handoffPaths || {}), [key]: path },
    }));
  };
  const [cliAvail, setCliAvail] = useState({});
  const [taskBusy, setTaskBusy] = useState({});
  const [taskStart, setTaskStart] = useState({});
  const [tick, setTick] = useState(0);
  const [taskLogs, setTaskLogs] = useState({});
  const [taskExpand, setTaskExpand] = useState({});
  useEffect(() => {
    if (Object.keys(taskBusy).length === 0) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [Object.keys(taskBusy).length]);
  const [epicRunning, setEpicRunning] = useState({});
  const epicRunningRef = useRef({});
  const epicOutputsRef = useRef({});
  const [reviewGate, setReviewGate] = useState(null);
  const [splitModal, setSplitModal] = useState(null);
  const [handoffViewer, setHandoffViewer] = useState(null);
  // shape: { tab: "handoff"|"changes", path, content, sizeBytes, mtime, loading, error,
  //          taskTitle, sinceISO, changes: { files, totalAdditions, totalDeletions, warning } | null,
  //          changesLoading, changesError, expandedDiff: { [path]: true } }

  const openHandoffViewer = async (filePath, opts = {}) => {
    setHandoffViewer({
      tab: "handoff",
      path: filePath,
      content: "", sizeBytes: 0, mtime: "",
      loading: true, error: null,
      taskTitle: opts.taskTitle || "",
      sinceISO: opts.sinceISO || null,
      changes: null, changesLoading: false, changesError: null, expandedDiff: {},
    });
    const res = await readHandoffFile(filePath);
    setHandoffViewer((prev) => prev && prev.path === filePath
      ? (res.ok
          ? { ...prev, ...res.data, loading: false, error: null }
          : { ...prev, loading: false, error: res.error })
      : prev);
  };

  const loadChangesTab = async () => {
    setHandoffViewer((prev) => prev ? { ...prev, changesLoading: true, changesError: null } : prev);
    const res = await getRecentChanges({
      workspacePath: project.workspacePath,
      sinceISO: handoffViewer?.sinceISO || undefined,
    });
    setHandoffViewer((prev) => prev
      ? (res.ok
          ? { ...prev, changesLoading: false, changes: res.data, changesError: null }
          : { ...prev, changesLoading: false, changesError: res.error })
      : prev);
  };

  const switchHandoffTab = (tab) => {
    setHandoffViewer((prev) => prev ? { ...prev, tab } : prev);
    if (tab === "changes" && handoffViewer && !handoffViewer.changes && !handoffViewer.changesLoading) {
      setTimeout(loadChangesTab, 0);
    }
  };

  const closeHandoffViewer = () => setHandoffViewer(null);

  useEffect(() => {
    for (const e of project.epics) {
      if (e.outputs && Object.keys(e.outputs).length) {
        epicOutputsRef.current[e.id] = { ...e.outputs };
      }
    }
    const seedLogs = {};
    for (const t of tasks) {
      const epic = project.epics.find((e) => e.id === t.parentId);
      if (!epic?.outputs) continue;
      const lookupKey = t.key && t.key.startsWith("dyn:") ? t.key : t.key;
      const out = epic.outputs[lookupKey];
      if (out) seedLogs[t.id] = out;
    }
    if (Object.keys(seedLogs).length) setTaskLogs((m) => ({ ...seedLogs, ...m }));
  }, []);
  useEffect(() => {
    const cmds = [...new Set(MODELS.map((m) => m.cmd))];
    checkCliAvailability(cmds).then(setCliAvail).catch(() => {});
  }, []);

  const taskVariantId = (task) => task.modelOverride || project.agentModels[task.agent];

  const isTaskGated = (task) => {
    if (task.key === "scope") return false;
    const epicTasks = tasksRef.current.filter((x) => x.parentId === task.parentId);
    const scope = epicTasks.find((x) => x.key === "scope");
    const spec = epicTasks.find((x) => x.key === "spec");
    const scopeOk = !scope || scope.stage === "done";
    if (task.key === "spec") return !scopeOk;
    const specOk = !spec || spec.stage === "done";
    return !(scopeOk && specOk);
  };

  const setTaskOverride = (taskId, variantId) => {
    setTasks((curr) => {
      const idx = curr.findIndex((x) => x.id === taskId);
      if (idx === -1) return curr;
      const next = [...curr];
      next[idx] = { ...next[idx], modelOverride: variantId || undefined };
      return next;
    });
  };

  const buildPrompt = (epic, task, agent, priorOutputs) => {
    const lines = [
      "# Adlc-Q subtask",
      `Project: ${project.name} (${project.stackLabel || "unknown stack"})`,
      `Epic: ${epic?.title || "(untitled)"} (type: ${epic?.type || "feature"})`,
    ];
    if (epic?.brief) lines.push(`Brief: ${epic.brief}`);
    lines.push(`Subtask: ${task.title}`);
    lines.push(`Role: ${agent?.name || task.agent} (${task.agent})`);
    const projectAgent = (project.agents || []).find((pa) => pa.role === task.agent);
    if (projectAgent) {
      lines.push(`Project agent: .claude/agents/${projectAgent.id}.md`);
      lines.push(`Agent description: ${projectAgent.description}`);
      if ((projectAgent.skillIds || []).length) {
        lines.push(`Linked skills: ${projectAgent.skillIds.join(", ")}`);
      }
    }
    const impact = epic?.graphImpact;
    if (impact?.affectedFiles?.length) {
      lines.push("Likely affected files (from graph analysis):");
      for (const f of impact.affectedFiles.slice(0, 6)) lines.push(`  - ${f}`);
    }
    if (impact?.touchedGodNodes?.length) {
      lines.push(`God-nodes touched: ${impact.touchedGodNodes.map((g) => g.name).join(", ")}`);
    }
    if (impact?.matchedNodes?.length) {
      lines.push("Top matched graph nodes:");
      for (const n of impact.matchedNodes.slice(0, 5)) {
        lines.push(`  - ${n.label} @ ${n.file}${n.location ? ":" + n.location : ""}`);
      }
    }
    if (epic?.subtaskKeys?.length) {
      lines.push(`Workflow steps in this epic: ${epic.subtaskKeys.join(" → ")}`);
    }
    if (priorOutputs && Object.keys(priorOutputs).length) {
      const handoffs = epic?.handoffPaths || {};
      lines.push("");
      lines.push("# Prior subtask outputs (your input)");
      for (const [k, txt] of Object.entries(priorOutputs)) {
        const handoffPath = handoffs[k];
        lines.push(`--- [${k}]${handoffPath ? ` (full text saved at ${handoffPath})` : ""} ---`);
        lines.push(String(txt || "").slice(0, 6000));
      }
      lines.push("");
    }
    const roleGuidance = task.key === "drift"
      ? ROLE_PROMPTS_DRIFT
      : ROLE_PROMPTS[task.agent];
    lines.push("");
    lines.push("Instructions:");
    if (roleGuidance) lines.push(roleGuidance);
    lines.push("Stay within the project workspace. Reference real files only. Be concise.");
    return lines.join("\n");
  };

  const runViaSse = async (input, onEvent) => {
    let stdout = "";
    let stderr = "";
    let exitCode = null;
    let errorMsg = null;
    let durationMs = 0;
    try {
      const resp = await fetch("/api/run-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!resp.ok || !resp.body) {
        return { ok: false, error: `HTTP ${resp.status}` };
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let event = "message";
          let data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          let payload;
          try { payload = JSON.parse(data); } catch { continue; }
          if (event === "stdout") { stdout += payload.chunk; onEvent("stdout", payload.chunk); }
          else if (event === "stderr") { stderr += payload.chunk; onEvent("stderr", payload.chunk); }
          else if (event === "start") onEvent("start", payload);
          else if (event === "done") { exitCode = payload.exitCode; durationMs = payload.durationMs || 0; if (payload.error) errorMsg = payload.error; }
          else if (event === "error") errorMsg = payload.error;
        }
      }
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
    if (errorMsg && exitCode !== 0) return { ok: false, error: errorMsg };
    return { ok: true, data: { stdout, stderr, exitCode, durationMs, command: `${input.cliCmd} ${input.modelId}` } };
  };

  const executeTask = async (t, opts = {}) => {
    const epic = project.epics.find((e) => e.id === t.parentId);
    const agent = AGENTS.find((a) => a.id === t.agent);
    const variantId = t.modelOverride || project.agentModels[t.agent];
    const found = findModelVariant(variantId);
    if (!found) {
      addTerm({ kind: "warn", text: `  ✗ no model assigned for ${t.title} — open routing or pick model on row` });
      return { ok: false };
    }
    if (!project.workspacePath) {
      addTerm({ kind: "warn", text: "  ✗ project has no workspacePath — cannot run CLI" });
      return { ok: false };
    }
    if (cliAvail[found.model.cmd] === false) {
      addTerm({ kind: "warn", text: `  ✗ ${found.model.cmd} not on PATH — install ${found.model.name} or pick another model` });
      return { ok: false };
    }
    setActiveAgent(t.agent);
    setTaskBusy((m) => ({ ...m, [t.id]: true }));
    setTaskStart((m) => ({ ...m, [t.id]: Date.now() }));
    setTaskLogs((m) => ({ ...m, [t.id]: "" }));
    setTaskExpand((m) => ({ ...m, [t.id]: true }));
    setTasks((cs) => cs.map((x) => x.id === t.id ? { ...x, stage: "progress" } : x));
    const prompt = buildPrompt(epic, t, agent, opts.priorOutputs);
    addTerm({ kind: "cmd", text: `$ cd ${project.workspacePath} && ${found.model.cmd} --model ${found.variant.id} --print "<prompt>"` });
    addTerm({ kind: "info", text: `  ${agent?.emoji} ${t.title} · ${found.model.name} ${found.variant.name}${t.modelOverride ? " (override)" : ""}` });

    let liveBuf = "";
    const flushLive = (chunk, kind) => {
      liveBuf += chunk;
      setTaskLogs((m) => ({ ...m, [t.id]: (m[t.id] || "") + chunk }));
      let idx;
      while ((idx = liveBuf.indexOf("\n")) !== -1) {
        const line = liveBuf.slice(0, idx);
        liveBuf = liveBuf.slice(idx + 1);
        if (line.trim() || kind === "stderr") {
          addTerm({ kind: kind === "stderr" ? "warn" : "info", text: kind === "stderr" ? `  ⚠ ${line}` : `  ${line}` });
        }
      }
    };
    const res = await runViaSse(
      {
        workspacePath: project.workspacePath,
        cliCmd: found.model.cmd,
        cliVendor: found.model.id,
        modelId: found.variant.id,
        prompt,
        timeoutMs: opts.timeoutMs || 300000,
      },
      (event, payload) => {
        if (event === "stdout") flushLive(payload, "stdout");
        else if (event === "stderr") flushLive(payload, "stderr");
        else if (event === "start") addTerm({ kind: "info", text: `  → spawned ${payload.command} (${payload.modelId})` });
      },
    );
    if (liveBuf.trim()) {
      addTerm({ kind: "info", text: `  ${liveBuf}` });
      liveBuf = "";
    }

    setTaskBusy((m) => { const n = { ...m }; delete n[t.id]; return n; });
    setTaskStart((m) => { const n = { ...m }; delete n[t.id]; return n; });

    if (!res.ok) {
      addTerm({ kind: "warn", text: `  ✗ ${res.error}` });
      setTasks((cs) => cs.map((x) => x.id === t.id ? { ...x, stage: "backlog" } : x));
      recordTaskStage(t.parentId, t.id, "backlog");
      return { ok: false };
    }
    addTerm({ kind: "ok", text: `  ✓ exit ${res.data.exitCode} in ${(res.data.durationMs / 1000).toFixed(1)}s` });

    setTasks((cs) => {
      const next = [...cs];
      const tIdx = next.findIndex((x) => x.id === t.id);
      if (tIdx !== -1) next[tIdx] = { ...next[tIdx], stage: "done" };
      return next;
    });
    recordOutput(t.parentId, t.key, res.data.stdout || "");
    recordTaskStage(t.parentId, t.id, "done");
    if (project.workspacePath && t.key) {
      const wh = await writeHandoff({
        workspacePath: project.workspacePath,
        epicId: t.parentId,
        taskKey: t.key,
        taskTitle: t.title,
        agentRole: agent?.id || t.agent,
        content: res.data.stdout || "",
      });
      if (wh.ok) {
        recordHandoffPath(t.parentId, t.key, wh.data.path);
        addTerm({ kind: "info", text: `  📄 handoff → ${wh.data.path.replace(project.workspacePath, ".")}` });
      } else {
        addTerm({ kind: "warn", text: `  ⚠ handoff write failed: ${wh.error}` });
      }
    }
    return { ok: true, stdout: res.data.stdout || "" };
  };

  const parseWriterParallelTasks = (writerOutput) => {
    if (!writerOutput) return null;
    const fenceMatch = writerOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidates = [];
    if (fenceMatch) candidates.push(fenceMatch[1]);
    const arrMatch = writerOutput.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (arrMatch) candidates.push(arrMatch[0]);
    for (const txt of candidates) {
      try {
        const parsed = JSON.parse(txt);
        if (Array.isArray(parsed) && parsed.every((x) => x && x.id && x.title && x.role)) {
          return parsed.map((p, i) => ({
            id: String(p.id),
            title: String(p.title),
            role: String(p.role),
            files: Array.isArray(p.files) ? p.files.map(String) : [],
            depends_on: Array.isArray(p.depends_on) ? p.depends_on.map(String) : [],
          }));
        }
        if (parsed && Array.isArray(parsed.parallel_subtasks)) {
          return parsed.parallel_subtasks.map((p, i) => ({
            id: String(p.id || `t${i}`),
            title: String(p.title || ""),
            role: String(p.role || "be"),
            files: Array.isArray(p.files) ? p.files.map(String) : [],
            depends_on: Array.isArray(p.depends_on) ? p.depends_on.map(String) : [],
          }));
        }
      } catch {}
    }
    return null;
  };

  const runOne = async () => {
    if (!runningRef.current) return;
    const curr = tasksRef.current;
    const idx = curr.findIndex((t) => t.stage !== "done");
    if (idx === -1) {
      addTerm({ kind: "ok", text: "✓ all tasks complete · session ended" });
      runningRef.current = false;
      setRunning(false);
      setActiveAgent(null);
      return;
    }
    const result = await executeTask(curr[idx]);
    if (!result.ok) {
      runningRef.current = false;
      setRunning(false);
      setActiveAgent(null);
      return;
    }
    if (runningRef.current) {
      timerRef.current = setTimeout(runOne, 300);
    }
  };

  const runOneTask = async (taskId) => {
    const t = tasksRef.current.find((x) => x.id === taskId);
    if (!t || taskBusy[taskId]) return;
    await executeTask(t);
    setActiveAgent(null);
  };

  const SEPARATE_FE_FRONTENDS = new Set(["react", "vue", "next", "svelte"]);
  const PAUSE_AFTER_KEYS = new Set(["scope", "spec"]);

  const awaitReview = (epicId, completedTask, output) =>
    new Promise((resolve) => {
      setReviewGate({ epicId, taskKey: completedTask.key, taskTitle: completedTask.title, output, resolve });
    });

  const runEpic = async (epicId) => {
    const epic = project.epics.find((e) => e.id === epicId);
    if (!epic) return;
    if (epicRunningRef.current[epicId]) return;
    if (!project.workspacePath) {
      addTerm({ kind: "warn", text: "✗ project has no workspacePath — cannot run CLI" });
      return;
    }
    const epicTasks = tasksRef.current.filter((t) => t.parentId === epicId);
    if (epicTasks.length === 0) {
      addTerm({ kind: "warn", text: `✗ epic ${epic.title} has no subtasks` });
      return;
    }
    const hasSeparateFE = SEPARATE_FE_FRONTENDS.has(project.stack?.frontend);
    if (!epicOutputsRef.current[epicId]) epicOutputsRef.current[epicId] = {};
    const outputs = epicOutputsRef.current[epicId];

    epicRunningRef.current = { ...epicRunningRef.current, [epicId]: true };
    setEpicRunning((m) => ({ ...m, [epicId]: true }));
    addTerm({ kind: "boot", text: `◉ epic: ${epic.title} — ${epicTasks.length} steps` });
    if (!hasSeparateFE) {
      addTerm({ kind: "info", text: `  monolith stack (${project.stack?.frontend || "—"}) — frontend step routed through backend` });
    }

    let halted = false;
    for (const t of epicTasks) {
      if (!epicRunningRef.current[epicId]) { halted = true; break; }
      if (t.key === "impl-fe" && !hasSeparateFE) {
        addTerm({ kind: "info", text: `  ⏭ skip "${t.title}" — no separate frontend` });
        setTasks((cs) => cs.map((x) => x.id === t.id ? { ...x, stage: "done" } : x));
        continue;
      }
      const fresh = tasksRef.current.find((x) => x.id === t.id);
      if (fresh?.stage === "done") {
        if (fresh.key && outputs[fresh.key] === undefined && epic.outputs?.[fresh.key] !== undefined) {
          outputs[fresh.key] = epic.outputs[fresh.key];
        }
        addTerm({ kind: "info", text: `  ⏭ "${t.title}" already done — skipping` });
        continue;
      }
      // Parallel impl phase: when we hit a dynamic impl task, execute the whole batch concurrently
      if (t.key && t.key.startsWith("dyn:")) {
        const dynTasks = tasksRef.current.filter((x) => x.parentId === epicId && x.key && x.key.startsWith("dyn:"));
        const ok = await runImplBatch(epicId, dynTasks, outputs);
        if (!ok) { halted = true; break; }
        // skip past all dyn tasks in epicTasks loop
        continue;
      }
      const res = await executeTask(fresh || t, { priorOutputs: outputs });
      if (!res.ok) {
        halted = true;
        addTerm({ kind: "warn", text: `  ✗ epic halted at "${t.title}"` });
        break;
      }
      if (t.key) outputs[t.key] = res.stdout;
      if (t.key === "spec") {
        const parsed = parseWriterParallelTasks(res.stdout);
        if (parsed && parsed.length) {
          addTerm({ kind: "info", text: `  ✎ writer produced ${parsed.length} parallel impl tasks` });
          recordDynamicTasks(epic.id, parsed);
        } else {
          addTerm({ kind: "warn", text: `  ⚠ writer did not produce parsable parallel_subtasks JSON — use the ✂ split button on the spec row to break it manually` });
        }
      }
      if (PAUSE_AFTER_KEYS.has(t.key)) {
        addTerm({ kind: "info", text: `  ⏸ awaiting your review of "${t.title}"` });
        const reply = await awaitReview(epicId, t, res.stdout);
        setReviewGate(null);
        if (reply === null) {
          halted = true;
          addTerm({ kind: "warn", text: `  ⏹ stopped after "${t.title}" — user aborted` });
          break;
        }
        const trimmed = (reply || "").trim();
        if (trimmed) {
          outputs[`${t.key}__user_note`] = trimmed;
          addTerm({ kind: "info", text: `  ✎ user note: ${trimmed.slice(0, 120)}` });
        }
      }
    }

    epicRunningRef.current = { ...epicRunningRef.current, [epicId]: false };
    setEpicRunning((m) => ({ ...m, [epicId]: false }));
    setActiveAgent(null);
    if (!halted) addTerm({ kind: "ok", text: `✓ epic complete: ${epic.title}` });
  };

  const runImplBatch = async (epicId, implTasks, outputs) => {
    const remaining = implTasks.filter((t) => t.stage !== "done").map((t) => ({ ...t }));
    const done = new Set(implTasks.filter((t) => t.stage === "done").map((t) => t.dynId));
    const running = new Map();
    const totalCount = implTasks.length;
    addTerm({ kind: "info", text: `  ▶ parallel impl phase — ${remaining.length} tasks pending` });

    const filesLocked = () => {
      const s = new Set();
      running.forEach(({ task }) => (task.files || []).forEach((f) => s.add(f)));
      return s;
    };
    const canStart = (t) => {
      if (!(t.dependsOn || []).every((d) => done.has(d))) return false;
      const lock = filesLocked();
      return !(t.files || []).some((f) => lock.has(f));
    };

    while ((remaining.length > 0 || running.size > 0) && epicRunningRef.current[epicId]) {
      let started = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const t = remaining[i];
        if (canStart(t)) {
          remaining.splice(i, 1);
          addTerm({ kind: "info", text: `    ↳ start [${t.dynId}] ${t.title}` });
          const p = (async () => {
            const r = await executeTask(t, { priorOutputs: outputs });
            running.delete(t.dynId);
            if (r.ok) {
              done.add(t.dynId);
              if (t.key) outputs[t.key] = r.stdout;
            }
            return r;
          })();
          running.set(t.dynId, { task: t, promise: p });
          started = true;
        }
      }
      if (running.size === 0) {
        addTerm({ kind: "warn", text: `    ⚠ no eligible tasks (deadlock or all blocked) — halting batch` });
        return false;
      }
      const settled = await Promise.race([...running.values()].map((r) => r.promise));
      if (!settled.ok) {
        for (const r of running.values()) {
          // best-effort: do not abort still-running tasks; await them
        }
        await Promise.all([...running.values()].map((r) => r.promise));
        addTerm({ kind: "warn", text: `    ✗ a parallel impl task failed — halting epic` });
        return false;
      }
    }
    addTerm({ kind: "ok", text: `  ✓ parallel impl phase complete (${done.size}/${totalCount})` });
    return done.size === totalCount;
  };

  const stopEpic = (epicId) => {
    epicRunningRef.current = { ...epicRunningRef.current, [epicId]: false };
    setEpicRunning((m) => ({ ...m, [epicId]: false }));
    addTerm({ kind: "warn", text: `⏸ epic stopped` });
  };

  const resetTask = (taskId) => {
    setTasks((curr) => {
      const idx = curr.findIndex((x) => x.id === taskId);
      if (idx === -1) return curr;
      const next = [...curr];
      next[idx] = { ...next[idx], stage: "backlog" };
      return next;
    });
  };

  const start = () => {
    if (!canRun) return;
    if (!project.workspacePath) {
      addTerm({ kind: "warn", text: "✗ project has no workspacePath — import or set workspacePath first" });
      return;
    }
    addTerm({ kind: "boot", text: "◉ Adlc-Q booting · headless CLI runner" });
    addTerm({ kind: "boot", text: `◉ workspace: ${project.workspacePath}` });
    assignedVariants.forEach((vid) => {
      const found = findModelVariant(vid);
      if (!found) return;
      addTerm({ kind: "boot", text: `◉ ${found.model.name} · ${found.variant.name} · plan: ${clis[found.model.id]?.plan || "—"}` });
    });
    addTerm({ kind: "boot", text: `◉ project: ${project.name}` });
    runningRef.current = true;
    setRunning(true);
    runOne();
  };
  const pause = () => {
    runningRef.current = false;
    setRunning(false);
    setActiveAgent(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    addTerm({ kind: "warn", text: "⏸ paused" });
  };
  const reset = () => { pause(); setTasks(buildTasks()); setTerminal([]); };

  const updateAgentModel = (agentId, variantId) => {
    onUpdateProject({ ...project, agentModels: { ...project.agentModels, [agentId]: variantId } });
    addTerm({ kind: "warn", text: `↻ ${AGENTS.find((a) => a.id === agentId).name} → ${findModelVariant(variantId).variant.name}` });
  };
  const applyProjectPreset = (p) => {
    onUpdateProject({ ...project, agentModels: applyPreset(p) });
    addTerm({ kind: "warn", text: `↻ preset applied: ${p}` });
  };

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  const epicProgress = (epicId) => {
    const subsT = tasks.filter((t) => t.parentId === epicId);
    const done = subsT.filter((t) => t.stage === "done").length;
    const epic = project.epics.find((e) => e.id === epicId);
    const manualComplete = !!epic?.completedAt;
    return {
      done,
      total: subsT.length,
      complete: manualComplete || (done === subsT.length && subsT.length > 0),
      manualComplete,
      completedAt: epic?.completedAt,
      completedNote: epic?.completedNote,
    };
  };

  const markEpicComplete = (epicId) => {
    const epic = project.epics.find((e) => e.id === epicId);
    if (!epic) return;
    const note = window.prompt(`Mark "${epic.title}" as complete?\n\nOptional note (e.g. "shipped in v1.2.0", "merged in PR #42"):`, "");
    if (note === null) return; // user hit cancel
    const stamp = new Date().toISOString();
    persistEpicChange(epicId, (e) => ({ ...e, completedAt: stamp, completedNote: note || undefined }));
    addTerm({ kind: "info", text: `✓ epic marked complete: ${epic.title}${note ? ` — ${note}` : ""}` });
  };

  const reopenEpic = (epicId) => {
    const epic = project.epics.find((e) => e.id === epicId);
    if (!epic) return;
    if (!window.confirm(`Reopen "${epic.title}"? This clears the completed timestamp.`)) return;
    persistEpicChange(epicId, (e) => { const { completedAt, completedNote, ...rest } = e; return rest; });
    addTerm({ kind: "info", text: `↻ epic reopened: ${epic.title}` });
  };

  const techName = (cat, id) => TECH[cat].find((t) => t.id === id)?.name || id;
  const byStage = STAGES.reduce((acc, s) => { acc[s.id] = tasks.filter((t) => t.stage === s.id); return acc; }, {});
  const stageColor = (id) => id === "done" ? C.ok : (id === "qa" || id === "review" || id === "sec") ? C.warn : (id === "progress" || id === "unit") ? C.swarm : C.dim;
  const agentById = (id) => AGENTS.find((a) => a.id === id);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: "transparent", border: `1px solid ${C.line}`, padding: 6, cursor: "pointer", display: "flex" }}>
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ ...mono, fontSize: 9, color: C.dim, letterSpacing: "0.14em" }}>PROJECT · PM: {project.pm}</div>
          <div style={{ ...serif, fontSize: 24, fontWeight: 600 }}>{project.name}</div>
        </div>
        <Btn onClick={() => setShowRouting(!showRouting)}><Settings size={11} /> routing</Btn>
        <Btn onClick={() => setShowFeatureModal(true)}><Plus size={11} /> feature</Btn>
        {!running ? (
          <Btn primary onClick={start} disabled={!canRun}>
            <Play size={11} /> {canRun ? "run agents" : `${blockedAgents.length} blocked`}
          </Btn>
        ) : <Btn onClick={pause}><Pause size={11} /> pause</Btn>}
        <Btn onClick={reset}><RotateCcw size={11} /> reset</Btn>
      </div>

      {showFeatureModal && (
        <FeatureWizard
          project={project}
          onClose={() => setShowFeatureModal(false)}
          onCreated={(updatedProject) => {
            onUpdateProject(updatedProject);
            setShowFeatureModal(false);
          }}
        />
      )}

      {reviewGate && (
        <EpicReviewModal gate={reviewGate} />
      )}

      {handoffViewer && (
        <>
          <div onClick={closeHandoffViewer}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 250 }} />
          <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 760, maxWidth: "92vw", background: C.paper, borderLeft: `1px solid ${C.line}`, boxShadow: "-4px 0 16px rgba(0,0,0,0.18)", zIndex: 260, display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim }}>
                  handoff{handoffViewer.taskTitle ? ` · ${handoffViewer.taskTitle}` : ""}
                </div>
                <div style={{ ...mono, fontSize: 11, fontWeight: 600, wordBreak: "break-all" }}>{handoffViewer.path}</div>
                {!handoffViewer.loading && !handoffViewer.error && (
                  <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 2 }}>
                    {(handoffViewer.sizeBytes / 1024).toFixed(1)} kB · modified {new Date(handoffViewer.mtime).toLocaleString()}
                    {handoffViewer.sinceISO && <> · task started {new Date(handoffViewer.sinceISO).toLocaleString()}</>}
                  </div>
                )}
              </div>
              <button onClick={closeHandoffViewer} title="close" style={{ ...mono, fontSize: 12, padding: "4px 8px", border: `1px solid ${C.line}`, background: C.paper, cursor: "pointer", display: "flex", alignItems: "center" }}>
                <X size={12} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: `1px solid ${C.line}`, background: C.soft }}>
              {[
                { id: "handoff", label: "Handoff" },
                { id: "changes", label: handoffViewer.changes
                    ? `Changes (${handoffViewer.changes.files.length} files · +${handoffViewer.changes.totalAdditions} -${handoffViewer.changes.totalDeletions})`
                    : "Changes" },
              ].map((t) => (
                <button key={t.id} onClick={() => switchHandoffTab(t.id)}
                  style={{
                    ...mono, fontSize: 11,
                    padding: "8px 14px",
                    border: "none",
                    borderBottom: handoffViewer.tab === t.id ? `2px solid ${C.ink}` : "2px solid transparent",
                    background: handoffViewer.tab === t.id ? C.paper : "transparent",
                    color: handoffViewer.tab === t.id ? C.ink : C.dim,
                    cursor: "pointer",
                    fontWeight: handoffViewer.tab === t.id ? 600 : 400,
                  }}>
                  {t.label}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              {handoffViewer.tab === "handoff" && (
                <>
                  <button onClick={() => navigator.clipboard?.writeText(handoffViewer.content || "")}
                    disabled={handoffViewer.loading || !!handoffViewer.error}
                    title="copy file content"
                    style={{ ...mono, fontSize: 10, padding: "4px 10px", border: "none", background: "transparent", cursor: "pointer", borderLeft: `1px solid ${C.line}` }}>
                    copy
                  </button>
                  <button onClick={() => openHandoffViewer(handoffViewer.path, { taskTitle: handoffViewer.taskTitle, sinceISO: handoffViewer.sinceISO })}
                    title="reload" style={{ ...mono, fontSize: 10, padding: "4px 10px", border: "none", background: "transparent", cursor: "pointer", borderLeft: `1px solid ${C.line}`, display: "flex", alignItems: "center" }}>
                    <RotateCcw size={11} />
                  </button>
                </>
              )}
              {handoffViewer.tab === "changes" && (
                <button onClick={loadChangesTab} disabled={handoffViewer.changesLoading}
                  title="reload diff" style={{ ...mono, fontSize: 10, padding: "4px 10px", border: "none", background: "transparent", cursor: "pointer", borderLeft: `1px solid ${C.line}`, display: "flex", alignItems: "center" }}>
                  <RotateCcw size={11} />
                </button>
              )}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: "auto" }}>
              {handoffViewer.tab === "handoff" && (
                <>
                  {!handoffViewer.loading && !handoffViewer.error && handoffViewer.sizeBytes < 200 && (
                    <div style={{ padding: "10px 14px", background: "#fff7e0", borderBottom: `1px solid ${C.warn}`, ...mono, fontSize: 10, color: "#5a3e00" }}>
                      ⚠ Handoff body is empty (file = header only). The agent likely wrote
                      its result to a skill-managed file instead of stdout. Open the
                      <strong> Changes </strong> tab to see what files actually changed during this run.
                    </div>
                  )}
                  <div style={{ padding: 14, background: "#0a0e1a", color: "#d6e2c7", ...mono, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", minHeight: "100%" }}>
                    {handoffViewer.loading
                      ? "loading…"
                      : handoffViewer.error
                        ? <span style={{ color: "#ff8b6b" }}>error: {handoffViewer.error}</span>
                        : (handoffViewer.content || "(empty file)")}
                  </div>
                </>
              )}
              {handoffViewer.tab === "changes" && (
                <ChangesTab vm={handoffViewer} setVm={setHandoffViewer} />
              )}
            </div>
          </aside>
        </>
      )}

      {splitModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
          onClick={(e) => { if (!splitModal.busy && e.target === e.currentTarget) setSplitModal(null); }}>
          <div style={{ background: C.paper, border: `1px solid ${C.line}`, padding: 18, width: 600, maxWidth: "92vw" }}>
            <div style={{ ...serif, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Split spec into parallel subtasks</div>
            <div style={{ ...mono, fontSize: 10, color: C.dim, marginBottom: 12 }}>
              Reads spec from a file in <code>{project.workspacePath}</code>, asks the writer model to emit ONLY a <code>parallel_subtasks</code> JSON block, parses it, and replaces the static impl rows with one row per parallel task.
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>spec file (relative or absolute)</div>
              <input value={splitModal.specPath} onChange={(e) => setSplitModal((m) => ({ ...m, specPath: e.target.value }))}
                disabled={splitModal.busy}
                style={{ ...mono, fontSize: 11, padding: 8, width: "100%", border: `1px solid ${C.line}`, background: C.paper }} />
            </div>
            {splitModal.error && (
              <pre style={{ ...mono, fontSize: 10, color: C.accent, background: "#fff5f3", border: `1px solid ${C.accent}`, padding: 8, marginBottom: 10, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>{splitModal.error}</pre>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <Btn onClick={() => setSplitModal(null)} disabled={splitModal.busy}>cancel</Btn>
              <Btn primary onClick={runSplit} disabled={splitModal.busy || !splitModal.specPath.trim()}>
                {splitModal.busy ? "splitting…" : <>✂ split now</>}
              </Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <Tag><Globe size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> {techName("frontend", project.stack.frontend)}</Tag>
        <Tag><Cpu size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> {techName("backend", project.stack.backend)}</Tag>
        <Tag><Database size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> {techName("database", project.stack.database)}</Tag>
        <span style={{ width: 1, height: 16, background: C.dim, margin: "0 4px" }} />
        <Tag color={C.swarm}><Shuffle size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> {assignedVariants.length} model{assignedVariants.length === 1 ? "" : "s"} in mix</Tag>
      </div>

      {showRouting && (
        <AgentRouting
          agentModels={project.agentModels}
          onChange={updateAgentModel}
          clis={clis}
          onPreset={applyProjectPreset}
        />
      )}

      {!canRun && (
        <div style={{ border: `1px solid ${C.accent}`, background: "#fff", padding: 10, marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertCircle size={16} color={C.accent} />
          <div style={{ flex: 1 }}>
            <div style={{ ...mono, fontSize: 11 }}>{blockedAgents.length} agent{blockedAgents.length === 1 ? "" : "s"} blocked — CLI not connected</div>
            <div style={{ ...mono, fontSize: 10, color: C.dim }}>
              {blockedAgents.map((a) => a.name).join(", ")} → reroute via Routing panel or connect the CLI
            </div>
          </div>
        </div>
      )}

      <ProjectAgentRoster
        project={project}
        clis={clis}
        activeAgent={activeAgent}
        onUpdateProject={onUpdateProject}
      />
      <div style={{ border: `1px solid ${C.line}`, padding: 10, marginBottom: 12 }}>
        <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim, marginBottom: 6 }}>
          <Bot size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
          standard role coverage · model assignment
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {AGENTS.map((a) => {
            const active = activeAgent === a.id;
            const variantId = project.agentModels[a.id];
            const found = findModelVariant(variantId);
            const subActive = variantActive(variantId, clis);
            return (
              <div key={a.id} style={{
                border: `1px solid ${active ? C.accent : C.line}`,
                background: active ? C.accent : C.paper,
                color: active ? C.paper : C.ink,
                ...mono, fontSize: 10,
                display: "flex", alignItems: "center", gap: 6,
                transition: "all 200ms",
                opacity: subActive ? 1 : 0.5,
              }}>
                <div style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: 4, borderRight: `1px solid ${active ? C.paper : C.line}` }}>
                  <span>{a.emoji}</span> {a.name}
                </div>
                <div style={{ padding: "4px 8px", background: active ? "transparent" : found.model.color, color: C.paper, fontSize: 9, display: "flex", alignItems: "center", gap: 3 }}>
                  {found.variant.name}
                  {!subActive && <Lock size={8} />}
                </div>
                {active && <span style={{ width: 5, height: 5, background: C.paper, borderRadius: "50%", animation: "pulse 1s infinite", marginRight: 6 }} />}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ border: `1px solid ${C.line}`, background: "#0a0e1a", color: "#9be59b", padding: 10, marginBottom: 16, minHeight: 120, maxHeight: 200, overflowY: "auto", ...mono, fontSize: 11 }}>
        <div style={{ color: "#666", marginBottom: 4 }}># terminal · multi-model session</div>
        {terminal.length === 0 ? (
          <div style={{ color: "#666" }}>$ _ press run to execute</div>
        ) : (
          terminal.map((l, i) => (
            <div key={i} style={{
              color: l.kind === "cmd" ? "#9be59b" : l.kind === "ok" ? "#9be59b" : l.kind === "warn" ? "#e8c46c" : l.kind === "boot" ? "#9bc7e5" : "#ccc",
              lineHeight: 1.5, whiteSpace: "pre-wrap",
            }}>{l.text}</div>
          ))
        )}
      </div>

      <ProjectClaudeAssets project={project} />

      <div style={{ marginBottom: 16 }}>
        <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>epics</div>
        {project.epics.map((epic) => {
          const p = epicProgress(epic.id);
          const collapsed = collapsedEpics[epic.id];
          const epicBusy = !!epicRunning[epic.id];
          return (
            <div key={epic.id} style={{ border: `1px solid ${C.line}`, marginBottom: 6, background: C.paper }}>
              <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setCollapsedEpics({ ...collapsedEpics, [epic.id]: !collapsed })}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                  {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setCollapsedEpics({ ...collapsedEpics, [epic.id]: !collapsed })}>
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
                  <Btn small onClick={() => stopEpic(epic.id)}><Pause size={10} /> stop</Btn>
                ) : !p.manualComplete ? (
                  <Btn small primary onClick={() => runEpic(epic.id)} disabled={!project.workspacePath}>
                    <Play size={10} /> {p.done > 0 && p.done < p.total ? "resume" : "run epic"}
                  </Btn>
                ) : null}
                {!p.manualComplete && !epicBusy && (
                  <Btn small onClick={() => markEpicComplete(epic.id)} title="Mark this epic as complete (overrides subtask stages)">
                    <Check size={10} /> mark complete
                  </Btn>
                )}
                {p.manualComplete && (
                  <Btn small onClick={() => reopenEpic(epic.id)} title={`Completed ${new Date(p.completedAt).toLocaleString()}${p.completedNote ? ` — ${p.completedNote}` : ""}. Click to reopen.`}>
                    <RotateCcw size={10} /> reopen
                  </Btn>
                )}
                {p.manualComplete && (
                  <Tag color={C.ok} title={p.completedNote || ""}>
                    ✓ done {new Date(p.completedAt).toLocaleDateString()}
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
                  {tasks.filter((t) => t.parentId === epic.id).map((t) => {
                    const a = agentById(t.agent);
                    const variantId = taskVariantId(t);
                    const found = findModelVariant(variantId);
                    const projectAgent = (project.agents || []).find((pa) => pa.role === t.agent);
                    const cliInstalled = found ? cliAvail[found.model.cmd] : false;
                    const isBusy = !!taskBusy[t.id];
                    const isDone = t.stage === "done";
                    const gated = isTaskGated(t);
                    const elapsedMs = isBusy && taskStart[t.id] ? Date.now() - taskStart[t.id] : 0;
                    const showLockIcon = gated && !isDone && !isBusy;
                    return (
                      <div key={t.id} id={`task-row-${t.id}`}>
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
                          onChange={(e) => setTaskOverride(t.id, e.target.value)}
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
                        {isDone ? (
                          <button onClick={() => resetTask(t.id)} disabled={isBusy}
                            title="Reset to backlog"
                            style={{ ...mono, fontSize: 10, padding: "3px 8px", border: `1px solid ${C.line}`, background: C.paper, cursor: "pointer" }}>
                            <RotateCcw size={10} />
                          </button>
                        ) : null}
                        <button onClick={() => runOneTask(t.id)} disabled={isBusy || !project.workspacePath || cliInstalled === false || (gated && !isDone)}
                          title={gated && !isDone ? "Locked — complete scope + spec first" : cliInstalled === false ? `${found?.model.cmd} not on PATH` : isDone ? "Re-run this task" : "Run this task"}
                          style={{ ...mono, fontSize: 10, padding: "3px 8px", border: `1px solid ${(gated && !isDone) ? C.dim : cliInstalled === false ? C.warn : C.ink}`, background: (gated && !isDone) ? C.soft : cliInstalled === false ? C.soft : C.ink, color: (gated && !isDone) || cliInstalled === false ? C.dim : C.paper, cursor: ((gated && !isDone) || cliInstalled === false) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                          {isBusy ? "⟳" : (gated && !isDone) ? <Lock size={9} /> : <Play size={9} />} {isDone ? "rerun" : (gated && !isDone) ? "locked" : "run"}
                        </button>
                        <Tag color={stageColor(t.stage)}>{STAGES.find((s) => s.id === t.stage)?.label}</Tag>
                        {epic?.handoffPaths?.[t.key] && (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              const startMs = taskStart[t.id];
                              openHandoffViewer(epic.handoffPaths[t.key], {
                                taskTitle: t.title,
                                sinceISO: startMs ? new Date(startMs).toISOString() : null,
                              });
                            }}
                            title={`Open ${epic.handoffPaths[t.key]}`}
                            style={{ ...mono, fontSize: 9, color: C.swarm, background: "transparent", border: `1px dashed ${C.swarm}`, padding: "2px 5px", cursor: "pointer", borderRadius: 2 }}>
                            📄 {epic.handoffPaths[t.key].split("/").slice(-2).join("/")}
                          </button>
                        )}
                        {t.key === "spec" && isDone && (
                          <button onClick={() => openSplitModal(epic)}
                            title="Break spec into parallel implementation subtasks"
                            style={{ ...mono, fontSize: 10, padding: "3px 8px", border: `1px solid ${C.swarm}`, background: C.paper, color: C.swarm, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                            ✂ split
                          </button>
                        )}
                        {(taskLogs[t.id] || isBusy) && (
                          <button onClick={() => setTaskExpand((m) => ({ ...m, [t.id]: !m[t.id] }))}
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
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>
        <Layers size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
        stages
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 6, overflowX: "auto" }}>
        {STAGES.map((stage) => (
          <div key={stage.id} style={{ border: `1px solid ${C.line}`, background: C.paper, minHeight: 200 }}>
            <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.line}`, background: stageColor(stage.id), color: C.paper, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>{stage.label}</span>
              <span style={{ ...mono, fontSize: 9 }}>{byStage[stage.id].length}</span>
            </div>
            <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {byStage[stage.id].map((t) => {
                const a = agentById(t.agent);
                const variantId = taskVariantId(t);
                const found = findModelVariant(variantId);
                const isBusy = !!taskBusy[t.id];
                const hasLogs = !!taskLogs[t.id];
                const elapsedMs = isBusy && taskStart[t.id] ? Date.now() - taskStart[t.id] : 0;
                const onClick = () => {
                  if (!hasLogs && !isBusy) return;
                  setTaskExpand((m) => ({ ...m, [t.id]: !m[t.id] }));
                  document.getElementById(`task-row-${t.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                };
                return (
                  <div key={t.id} onClick={onClick} title={hasLogs || isBusy ? "click to view live output" : undefined}
                    style={{ border: `1px solid ${isBusy ? C.accent : C.line}`, padding: 6, background: isBusy ? "#fff8f4" : "#fff", cursor: hasLogs || isBusy ? "pointer" : "default" }}>
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
              {byStage[stage.id].length === 0 && (
                <div style={{ ...mono, fontSize: 9, color: C.dim, padding: 10, textAlign: "center" }}>—</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- Projects List ----------
const ProjectsList = ({ projects, onOpen, onNew, onDelete }) => (
  <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <div style={{ ...mono, fontSize: 11, color: C.dim }}>{projects.length} managed project{projects.length === 1 ? "" : "s"} · per-agent model routing</div>
      <Btn primary onClick={onNew}><FolderPlus size={11} /> new project</Btn>
    </div>
    {projects.length === 0 && (
      <div style={{ ...mono, fontSize: 11, color: C.dim, padding: 24, border: `1px dashed ${C.dim}`, textAlign: "center" }}>
        No managed projects yet. Import one from your workspace below, or click <strong>new project</strong>.
      </div>
    )}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
      {projects.map((p) => {
        const techName = (cat, id) => TECH[cat].find((t) => t.id === id)?.name || id;
        const variantsUsed = [...new Set(Object.values(p.agentModels))];
        const isWorkspaceProject = !!p.workspacePath;
        return (
          <div key={p.id}
            style={{ border: `1px solid ${C.line}`, padding: 14, background: C.paper, transition: "transform 100ms", position: "relative" }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "translate(-2px,-2px)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "translate(0,0)"}>
            <button
              onClick={(e) => { e.stopPropagation(); if (window.confirm(`Remove "${p.name}" from Adlc-Q?`)) onDelete(p.id); }}
              style={{ position: "absolute", top: 8, right: 8, background: "transparent", border: "none", cursor: "pointer", color: C.dim, padding: 4 }}
              title="remove from Adlc-Q">
              <X size={11} />
            </button>
            <div onClick={() => onOpen(p)} style={{ cursor: "pointer" }}>
              <div style={{ ...mono, fontSize: 9, color: C.dim, letterSpacing: "0.14em" }}>
                PM · {p.pm}{isWorkspaceProject && " · WORKSPACE"}
              </div>
              <div style={{ ...serif, fontSize: 18, marginTop: 4, paddingRight: 18 }}>{p.name}</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 10 }}>
                {p.stackLabel ? (
                  <Tag color={C.swarm}>{p.stackLabel}</Tag>
                ) : (
                  <>
                    <Tag>{techName("frontend", p.stack.frontend)}</Tag>
                    <Tag>{techName("backend", p.stack.backend)}</Tag>
                    <Tag>{techName("database", p.stack.database)}</Tag>
                  </>
                )}
              </div>
              {p.graphMeta && (
                <div style={{ ...mono, fontSize: 10, color: C.dim, marginTop: 8, display: "flex", gap: 10 }}>
                  <span><Network size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{p.graphMeta.nodes.toLocaleString()}n</span>
                  <span>{p.graphMeta.edges.toLocaleString()}e</span>
                  {p.graphMeta.godNodes[0] && <span style={{ color: C.swarm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>★ {p.graphMeta.godNodes[0].name}</span>}
                </div>
              )}
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 8 }}>
                {variantsUsed.map((vid) => {
                  const found = findModelVariant(vid);
                  return (
                    <span key={vid} style={{ ...mono, fontSize: 8, color: C.paper, background: found.model.color, padding: "1px 5px" }}>
                      {found.variant.name}
                    </span>
                  );
                })}
              </div>
              <div style={{ ...mono, fontSize: 10, color: C.dim, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.dim}` }}>
                {p.epics.length} epic{p.epics.length === 1 ? "" : "s"} → {p.epics.length * 8} subtasks
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ---------- Epic graph impact ----------
const EpicGraphImpact = ({ impact }) => {
  const [open, setOpen] = useState(true);
  if (!impact || (!impact.matchedNodes.length && !impact.affectedFiles.length && !impact.touchedGodNodes.length)) {
    return (
      <div style={{ ...mono, fontSize: 10, color: C.dim, padding: "4px 8px", marginBottom: 4 }}>
        graph: no matches for keywords [{(impact?.keywords || []).join(", ") || "—"}]
      </div>
    );
  }
  return (
    <div style={{ border: `1px solid ${C.soft}`, padding: 8, marginBottom: 6, background: "#f6f5f0" }}>
      <div onClick={() => setOpen(!open)} style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.swarm, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <Network size={10} /> graph impact — {impact.matchedNodes.length} top matches · {impact.totalMatches} total · {impact.affectedFiles.length} files · {impact.touchedGodNodes.length} god-nodes touched
      </div>
      {open && (
        <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ ...mono, fontSize: 9, color: C.dim, marginBottom: 3 }}>keywords</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
              {impact.keywords.map((k) => (
                <span key={k} style={{ ...mono, fontSize: 9, padding: "1px 5px", border: `1px solid ${C.dim}`, color: C.ink }}>{k}</span>
              ))}
            </div>
            <div style={{ ...mono, fontSize: 9, color: C.dim, marginBottom: 3 }}>matched nodes</div>
            {impact.matchedNodes.slice(0, 6).map((n) => (
              <div key={n.id} title={`${n.file}${n.location ? ":" + n.location : ""}`}
                style={{ ...mono, fontSize: 10, padding: "1px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ color: C.swarm }}>{n.label}</span>
                <span style={{ color: C.dim, marginLeft: 4 }}>·{n.matchScore}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ ...mono, fontSize: 9, color: C.dim, marginBottom: 3 }}>affected files</div>
            {impact.affectedFiles.slice(0, 6).map((f) => (
              <div key={f} style={{ ...mono, fontSize: 9, color: C.ink, padding: "1px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={f}>{f.split("/").slice(-2).join("/")}</div>
            ))}
            {impact.touchedGodNodes.length > 0 && (
              <>
                <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 6, marginBottom: 3 }}>god-nodes 1-hop</div>
                {impact.touchedGodNodes.map((g) => (
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


// ---------- Feature Wizard ----------
const FeatureWizard = ({ project, onClose, onCreated }) => {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("feature");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const tmpl = SUBTASK_TEMPLATES[type] || SUBTASK_TEMPLATES.feature;
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(tmpl.map((s) => s.key)));

  useEffect(() => {
    const keys = (SUBTASK_TEMPLATES[type] || SUBTASK_TEMPLATES.feature).map((s) => s.key);
    setSelectedKeys(new Set(keys));
  }, [type]);

  const toggleKey = (key) => {
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.paper, border: `1px solid ${C.line}`, padding: 18, width: 520, maxWidth: "90vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ ...serif, fontSize: 18, fontWeight: 600 }}>New feature workflow</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={16} /></button>
        </div>
        <div style={{ ...mono, fontSize: 10, color: C.dim, marginBottom: 12 }}>
          Generates graph impact analysis from <code>{project.workspacePath || "(no workspace path)"}/graphify-out/graph.json</code> and breaks the feature into role-bound subtasks.
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>title</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Add 2FA login"
            style={{ ...mono, fontSize: 12, padding: 8, width: "100%", border: `1px solid ${C.line}`, background: C.paper }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>type</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["feature", "bug", "api"].map((t) => (
              <button key={t} onClick={() => setType(t)}
                style={{ ...mono, fontSize: 10, padding: "6px 12px", border: `1px solid ${C.line}`, background: type === t ? C.ink : C.paper, color: type === t ? C.paper : C.ink, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 4 }}>brief (used as graph keywords)</div>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)}
            placeholder="Short description. Words here become keywords searched against graphify nodes."
            rows={4}
            style={{ ...mono, fontSize: 11, padding: 8, width: "100%", border: `1px solid ${C.line}`, background: C.paper, resize: "vertical" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>subtasks ({selectedKeys.size}/{tmpl.length})</span>
            <span>
              <button onClick={() => setSelectedKeys(new Set(tmpl.map((s) => s.key)))} style={{ ...mono, fontSize: 9, padding: "1px 6px", background: "transparent", border: `1px solid ${C.line}`, marginRight: 4, cursor: "pointer" }}>all</button>
              <button onClick={() => setSelectedKeys(new Set())} style={{ ...mono, fontSize: 9, padding: "1px 6px", background: "transparent", border: `1px solid ${C.line}`, cursor: "pointer" }}>none</button>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 4, maxHeight: 200, overflowY: "auto", border: `1px solid ${C.soft}`, padding: 6 }}>
            {tmpl.map((s) => {
              const agent = AGENTS.find((a) => a.id === s.agent);
              const checked = selectedKeys.has(s.key);
              return (
                <label key={s.key} style={{ ...mono, fontSize: 10, padding: "3px 4px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", background: checked ? C.soft : "transparent" }}>
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

// ---------- Project agents (top roster — driven by .claude/agents) ----------
const ProjectAgentRoster = ({ project, clis, activeAgent, onUpdateProject }) => {
  const agents = project.agents || [];
  const skills = project.skills || [];
  const skillById = React.useMemo(() => {
    const m = new Map();
    for (const s of skills) m.set(s.id, s);
    return m;
  }, [skills]);
  const coveredRoles = new Set(agents.map((a) => a.role).filter(Boolean));
  const missingRoles = AGENTS.filter((r) => !coveredRoles.has(r.id));
  const [busyRole, setBusyRole] = useState(null);
  const [error, setError] = useState(null);

  const handleBuild = async (role) => {
    if (!project.workspacePath) {
      setError("Project not linked to a workspace path");
      return;
    }
    setBusyRole(role.id);
    setError(null);
    const matchedSkills = skills
      .filter((s) => {
        const hay = `${s.id} ${s.name}`.toLowerCase();
        return role.id === "rev" ? hay.includes("review")
          : role.id === "qa" ? hay.includes("qa") || hay.includes("test")
          : role.id === "sec" ? hay.includes("security") || hay.includes("audit")
          : role.id === "dev" ? hay.includes("devops") || hay.includes("deploy")
          : role.id === "db" ? hay.includes("schema") || hay.includes("database")
          : role.id === "ux" ? hay.includes("design") || hay.includes("ux")
          : role.id === "fe" ? hay.includes("frontend")
          : role.id === "be" ? hay.includes("backend") || hay.includes("engineer")
          : false;
      })
      .map((s) => s.id);
    const res = await buildAgent({
      workspacePath: project.workspacePath,
      roleId: role.id,
      roleName: role.name,
      description: role.desc,
      recommendedModel: role.recommend,
      skillIds: matchedSkills,
    });
    setBusyRole(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onUpdateProject({
      ...project,
      agents: [...agents, res.data].sort((a, b) => a.name.localeCompare(b.name)),
    });
  };

  if (agents.length === 0 && missingRoles.length === AGENTS.length) return null;

  return (
    <div style={{ border: `1px solid ${C.line}`, padding: 10, marginBottom: 12 }}>
      <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <Bot size={10} /> project agents — {agents.length} configured · {missingRoles.length} missing role{missingRoles.length === 1 ? "" : "s"}
      </div>
      {agents.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6, marginBottom: missingRoles.length > 0 ? 10 : 0 }}>
          {agents.map((agent) => {
            const variantId = project.agentModels[agent.id];
            const found = variantId ? findModelVariant(variantId) : null;
            const subActive = found ? variantActive(variantId, clis) : false;
            const role = agent.role ? AGENTS.find((r) => r.id === agent.role) : null;
            const linkedSkills = (agent.skillIds || []).map((id) => skillById.get(id)).filter(Boolean);
            const active = activeAgent === agent.id;
            return (
              <div key={agent.id} style={{ border: `1px solid ${active ? C.accent : C.line}`, padding: 8, background: active ? C.soft : C.paper }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...mono, fontSize: 11, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={agent.description}>{agent.name}</div>
                    {role && <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 2 }}>{role.emoji} {role.name}</div>}
                  </div>
                  {found && (
                    <span style={{ ...mono, fontSize: 9, padding: "2px 6px", background: subActive ? found.model.color : C.soft, color: subActive ? C.paper : C.dim, whiteSpace: "nowrap" }}>
                      {found.variant.name}{!subActive && " 🔒"}
                    </span>
                  )}
                </div>
                {linkedSkills.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
                    {linkedSkills.slice(0, 4).map((s) => (
                      <span key={s.id} title={s.description} style={{ ...mono, fontSize: 9, padding: "1px 5px", border: `1px solid ${C.swarm}`, color: C.swarm }}>
                        <Sparkles size={8} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />{s.name}
                      </span>
                    ))}
                    {linkedSkills.length > 4 && <span style={{ ...mono, fontSize: 9, color: C.dim }}>+{linkedSkills.length - 4}</span>}
                  </div>
                )}
                {linkedSkills.length === 0 && (
                  <div style={{ ...mono, fontSize: 9, color: C.warn, marginTop: 6 }}>no skill linked</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {missingRoles.length > 0 && (
        <div style={{ borderTop: agents.length ? `1px dashed ${C.dim}` : "none", paddingTop: agents.length ? 10 : 0 }}>
          <div style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: C.warn, marginBottom: 6 }}>
            <AlertCircle size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} /> Missing — build agent connected to skills
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {missingRoles.map((r) => (
              <button key={r.id} onClick={() => handleBuild(r)} disabled={busyRole === r.id || !project.workspacePath}
                style={{ ...mono, fontSize: 10, padding: "4px 8px", border: `1px solid ${C.warn}`, background: busyRole === r.id ? C.soft : C.paper, color: C.ink, cursor: project.workspacePath ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 4 }}>
                {busyRole === r.id ? "…" : <Plus size={10} />} {r.emoji} {r.name}
              </button>
            ))}
          </div>
          {!project.workspacePath && (
            <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 4 }}>build disabled — project has no workspacePath</div>
          )}
          {error && (
            <div style={{ ...mono, fontSize: 9, color: C.accent, marginTop: 4 }}>{error}</div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------- Project Claude assets (skills/agents/commands from .claude) ----------
const ProjectClaudeAssets = ({ project }) => {
  const skills = project.skills || [];
  const agents = project.agents || [];
  const commands = project.commands || [];
  const total = skills.length + agents.length + commands.length;
  const [tab, setTab] = useState("skills");
  const [expandedId, setExpandedId] = useState(null);

  if (total === 0) return null;

  const items = tab === "skills" ? skills : tab === "agents" ? agents : commands;
  const tabs = [
    { id: "skills", label: "skills", count: skills.length, icon: Sparkles },
    { id: "agents", label: "agents", count: agents.length, icon: Bot },
    { id: "commands", label: "commands", count: commands.length, icon: Terminal },
  ];

  return (
    <div style={{ border: `1px solid ${C.line}`, padding: 10, marginBottom: 12 }}>
      <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <Package size={10} /> .claude assets — {skills.length} skills · {agents.length} agents · {commands.length} commands
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setExpandedId(null); }}
              style={{ background: active ? C.ink : "transparent", color: active ? C.paper : C.ink, border: `1px solid ${C.line}`, padding: "4px 10px", ...mono, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Icon size={10} /> {t.label} {t.count > 0 && <span style={{ color: active ? C.paper : C.dim }}>{t.count}</span>}
            </button>
          );
        })}
      </div>
      {items.length === 0 ? (
        <div style={{ ...mono, fontSize: 10, color: C.dim, padding: "6px 0" }}>none</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6 }}>
          {items.map((it) => {
            const expanded = expandedId === it.id;
            return (
              <div key={it.id} onClick={() => setExpandedId(expanded ? null : it.id)}
                style={{ border: `1px solid ${C.soft}`, padding: 8, cursor: "pointer", background: expanded ? C.soft : "transparent" }}>
                <div style={{ ...mono, fontSize: 11, fontWeight: 500, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>{it.name}</div>
                {it.description && (
                  <div style={{ ...mono, fontSize: 10, color: C.dim, marginTop: 3, lineHeight: 1.4, overflow: "hidden", display: expanded ? "block" : "-webkit-box", WebkitLineClamp: expanded ? "unset" : 2, WebkitBoxOrient: "vertical" }}>
                    {it.description}
                  </div>
                )}
                {expanded && (
                  <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 4, wordBreak: "break-all" }}>{it.path}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------- Import from Workspace ----------
const ImportFromWorkspace = ({ projects, importedPaths, onImport, onOpen }) => {
  const [filter, setFilter] = useState("");
  const filtered = projects.filter((d) =>
    !filter || d.dirName.toLowerCase().includes(filter.toLowerCase())
    || d.stackLabel.toLowerCase().includes(filter.toLowerCase())
  );
  if (projects.length === 0) return null;
  return (
    <div style={{ marginTop: 28, paddingTop: 24, borderTop: `1px dashed ${C.dim}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ ...serif, fontSize: 22, fontWeight: 600 }}>
            <Network size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            Discoverable from Workspace
          </div>
          <div style={{ ...mono, fontSize: 11, color: C.dim }}>
            {projects.length} project{projects.length === 1 ? "" : "s"} with graphify metadata · click import to bring under Adlc-Q management
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.line}`, padding: "4px 8px", background: C.paper }}>
          <Search size={11} color={C.dim} />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="filter…"
            style={{ ...mono, fontSize: 11, border: "none", outline: "none", background: "transparent", width: 160 }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10, marginTop: 14 }}>
        {filtered.map((d) => {
          const imported = importedPaths.has(d.workspacePath);
          const top = d.graphMeta.godNodes.slice(0, 3);
          return (
            <div key={d.workspacePath} style={{ border: `1px solid ${C.line}`, padding: 14, background: C.paper, opacity: imported ? 0.55 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...serif, fontSize: 17, fontWeight: 600 }}>{d.dirName}</div>
                  <div style={{ ...mono, fontSize: 10, color: C.dim, wordBreak: "break-all" }}>{d.workspacePath}</div>
                </div>
                <Tag color={C.swarm}>{d.stackLabel}</Tag>
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 10, ...mono, fontSize: 10, color: C.dim }}>
                <span><Network size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{d.graphMeta.nodes.toLocaleString()} nodes</span>
                <span>{d.graphMeta.edges.toLocaleString()} edges</span>
                <span>{d.graphMeta.communities} communities</span>
                {d.graphMeta.files > 0 && <span><FileCode size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{d.graphMeta.files.toLocaleString()} files</span>}
              </div>
              {top.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.dim}` }}>
                  <div style={{ ...mono, fontSize: 9, color: C.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>God Nodes</div>
                  {top.map((g) => (
                    <div key={g.name} style={{ ...mono, fontSize: 10, display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{g.name}</span>
                      <span style={{ color: C.dim }}>{g.edges} edges</span>
                    </div>
                  ))}
                </div>
              )}
              {d.graphMeta.suggestedQuestions.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.dim}` }}>
                  <div style={{ ...mono, fontSize: 9, color: C.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
                    <Sparkles size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />Suggested
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: C.ink, lineHeight: 1.4 }}>
                    {d.graphMeta.suggestedQuestions[0]}
                  </div>
                </div>
              )}
              {(d.skills.length > 0 || d.agents.length > 0 || d.commands.length > 0) && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.dim}` }}>
                  <div style={{ ...mono, fontSize: 9, color: C.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
                    <Sparkles size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                    .claude — {d.skills.length} skills · {d.agents.length} agents · {d.commands.length} commands
                  </div>
                  {d.skills.slice(0, 3).map((s) => (
                    <div key={s.id} title={s.description} style={{ ...mono, fontSize: 10, padding: "1px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Sparkles size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3, color: C.swarm }} />
                      <span style={{ color: C.ink }}>{s.name}</span>
                    </div>
                  ))}
                  {d.agents.slice(0, 3).map((a) => (
                    <div key={a.id} title={a.description} style={{ ...mono, fontSize: 10, padding: "1px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Bot size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3, color: C.accent }} />
                      <span style={{ color: C.ink }}>{a.name}</span>
                    </div>
                  ))}
                  {(d.skills.length + d.agents.length) > 6 && (
                    <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 2 }}>+{(d.skills.length + d.agents.length) - 6} more</div>
                  )}
                </div>
              )}
              <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
                {imported ? (
                  <Tag color={C.ok}><Check size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />imported</Tag>
                ) : (
                  <Btn small primary onClick={() => onImport(d)}>
                    <Plus size={10} /> import
                  </Btn>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- Shell ----------
export function DevOSShell({ initialProjects, initialClis, discoveredProjects }) {
  const [tab, setTab] = useState("projects");
  const discoveredByPath = React.useMemo(() => {
    const m = new Map();
    for (const d of discoveredProjects) m.set(d.workspacePath, d);
    return m;
  }, [discoveredProjects]);
  const mergedInitial = React.useMemo(() => {
    return initialProjects.map((p) => {
      const migratedModels = migrateAgentModels(p.agentModels, { agents: AGENTS, defaultModels: defaultAgentModels });
      const base = { ...p, agentModels: migratedModels };
      if (!p.workspacePath) return base;
      const fresh = discoveredByPath.get(p.workspacePath);
      if (!fresh) return base;
      const stackLabelChanged = fresh.stackLabel && fresh.stackLabel !== p.stackLabel;
      return {
        ...base,
        stackLabel: fresh.stackLabel || p.stackLabel,
        stack: stackLabelChanged ? STACK_FROM_LABEL(fresh.stackLabel) : p.stack,
        graphMeta: fresh.graphMeta,
        skills: fresh.skills,
        agents: fresh.agents,
        commands: fresh.commands,
      };
    });
  }, [initialProjects, discoveredByPath]);
  const [projects, setProjects] = useState(mergedInitial);
  const [openProject, setOpenProject] = useState(null);
  const [creating, setCreating] = useState(false);
  const [clis, toggleCLI] = useConnectedCLIs(initialClis);

  useEffect(() => {
    for (const p of mergedInitial) {
      const original = initialProjects.find((x) => x.id === p.id);
      if (original && p !== original) void saveProject(p);
    }
  }, []);

  const importedIds = new Set(projects.map((p) => p.workspacePath).filter(Boolean));

  const updateProject = (p) => {
    setProjects((curr) => {
      const idx = curr.findIndex((x) => x.id === p.id);
      if (idx === -1) return [...curr, p];
      const next = [...curr];
      next[idx] = p;
      return next;
    });
    setOpenProject(p);
    void saveProject(p);
  };

  const deleteProject = (projectId) => {
    setProjects((curr) => curr.filter((p) => p.id !== projectId));
    if (openProject?.id === projectId) setOpenProject(null);
    void removeProject(projectId);
  };

  const importDiscovered = (d) => {
    const newProj = {
      id: `p-${Date.now()}`,
      name: d.dirName,
      pm: "(workspace)",
      stack: STACK_FROM_LABEL(d.stackLabel),
      stackLabel: d.stackLabel,
      agentModels: defaultAgentModels(),
      epics: [],
      workspacePath: d.workspacePath,
      graphMeta: d.graphMeta,
      skills: d.skills,
      agents: d.agents,
      commands: d.commands,
    };
    setProjects((curr) => [...curr, newProj]);
    void saveProject(newProj);
  };

  const tabs = [
    { id: "projects", label: "Projects", icon: GitBranch, count: projects.length },
    { id: "clis", label: "Connected CLIs", icon: Terminal, count: Object.values(clis).filter((s) => s.active).length },
    { id: "agents", label: "Agents", icon: Package, count: AGENTS.length },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <div style={{ borderBottom: `1px solid ${C.line}`, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 22, height: 22, border: `2px solid ${C.ink}`, position: "relative" }}>
            <div style={{ position: "absolute", inset: 3, background: C.accent }} />
          </div>
          <div style={{ ...serif, fontSize: 18, fontWeight: 600 }}>Adlc-Q</div>
          <div style={{ ...mono, fontSize: 9, color: C.dim, letterSpacing: "0.14em" }}>v0.7 · BYO-CLI</div>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${C.line}`, overflowX: "auto" }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setOpenProject(null); setCreating(false); }}
              style={{ background: active ? C.ink : "transparent", color: active ? C.paper : C.ink, border: "none", borderRight: `1px solid ${C.line}`, padding: "12px 18px", ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon size={12} />
              {t.label}
              {t.count !== undefined && (
                <span style={{ background: active ? C.accent : C.soft, color: active ? C.paper : C.ink, padding: "1px 6px", fontSize: 9 }}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "24px 20px", maxWidth: 1320, margin: "0 auto" }}>
        {tab === "projects" && !openProject && !creating && (
          <>
            <div style={{ ...serif, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4 }}>Projects</div>
            <div style={{ ...mono, fontSize: 11, color: C.dim, marginBottom: 20 }}>route each agent to its best model · Opus for review · Codex for QA · Gemini for ops</div>
            <ProjectsList projects={projects} onOpen={setOpenProject} onNew={() => setCreating(true)} onDelete={deleteProject} />
            <ImportFromWorkspace projects={discoveredProjects} importedPaths={importedIds} onImport={importDiscovered} />
          </>
        )}
        {tab === "projects" && creating && (
          <NewProjectWizard clis={clis}
            onCreate={(p) => { setProjects((curr) => [...curr, p]); setCreating(false); setOpenProject(p); void saveProject(p); }}
            onCancel={() => setCreating(false)} />
        )}
        {tab === "projects" && openProject && (
          <ProjectBoard project={openProject} onBack={() => setOpenProject(null)} clis={clis} onUpdateProject={updateProject} />
        )}
        {tab === "clis" && (
          <>
            <div style={{ ...serif, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4 }}>Connected CLIs</div>
            <div style={{ ...mono, fontSize: 11, color: C.dim, marginBottom: 20 }}>your installed terminal models · Adlc-Q shells out to whichever you connect · auth stays with the CLI</div>
            <CLIsTab clis={clis} onToggle={toggleCLI} />
          </>
        )}
        {tab === "agents" && (
          <>
            <div style={{ ...serif, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4 }}>Agents</div>
            <div style={{ ...mono, fontSize: 11, color: C.dim, marginBottom: 20 }}>specialists with recommended model defaults · override per project</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {AGENTS.map((a) => {
                const found = findModelVariant(a.recommend);
                return (
                  <div key={a.id} style={{ border: `1px solid ${C.line}`, padding: 14, background: C.paper }}>
                    <div style={{ ...mono, fontSize: 22 }}>{a.emoji}</div>
                    <div style={{ ...serif, fontSize: 17, marginTop: 6 }}>{a.name}</div>
                    <div style={{ ...mono, fontSize: 11, color: C.dim, marginTop: 4 }}>{a.desc}</div>
                    <div style={{ ...mono, fontSize: 9, color: C.dim, marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${C.dim}` }}>
                      DEFAULT MODEL
                    </div>
                    <div style={{ ...mono, fontSize: 10, color: C.paper, background: found.model.color, padding: "2px 6px", marginTop: 4, display: "inline-block" }}>
                      {found.model.name} · {found.variant.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div style={{ borderTop: `1px solid ${C.line}`, padding: "10px 20px", ...mono, fontSize: 9, color: C.dim, letterSpacing: "0.14em", textTransform: "uppercase", display: "flex", justifyContent: "space-between" }}>
        <span>devos · per-agent model routing</span>
        <span>right model · right job</span>
      </div>
    </div>
  );
}
