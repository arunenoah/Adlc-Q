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
import { HandoffDrawer } from "./components/HandoffDrawer";
import { EpicCard } from "./components/EpicCard";
import { SplitModal } from "./components/SplitModal";
import { KanbanBoard } from "./components/KanbanBoard";
import { EpicReviewModal } from "./components/EpicReviewModal";
import { EpicGraphImpact } from "./components/EpicGraphImpact";
import { ProjectClaudeAssets } from "./components/ProjectClaudeAssets";
import { ProjectAgentRoster } from "./components/ProjectAgentRoster";
import { AgentRouting, applyPreset } from "./components/AgentRouting";
import { FeatureWizard } from "./components/FeatureWizard";
import { CLIsTab } from "./components/CLIsTab";
import { NewProjectWizard } from "./components/NewProjectWizard";
import { ImportFromWorkspace } from "./components/ImportFromWorkspace";
import { stackFromLabel } from "@/lib/stack";
import { runViaSse, parseWriterParallelTasks } from "@/lib/runner";
import { useConnectedCLIs } from "@/lib/hooks/useConnectedCLIs";

// ---------- CLIs (terminal models) with variants ----------





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
        <HandoffDrawer
          vm={handoffViewer}
          setVm={setHandoffViewer}
          onClose={closeHandoffViewer}
          onSwitchTab={switchHandoffTab}
          onReloadHandoff={() => openHandoffViewer(handoffViewer.path, { taskTitle: handoffViewer.taskTitle, sinceISO: handoffViewer.sinceISO })}
          onReloadChanges={loadChangesTab}
        />
      )}

      {splitModal && (
        <SplitModal
          state={splitModal}
          workspacePath={project.workspacePath}
          onChangeSpecPath={(p) => setSplitModal((m) => ({ ...m, specPath: p }))}
          onCancel={() => setSplitModal(null)}
          onRun={runSplit}
        />
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

      <div style={{ border: `1px solid ${C.line}`, background: C.terminal, color: C.termOk, padding: 10, marginBottom: 16, minHeight: 120, maxHeight: 200, overflowY: "auto", ...mono, fontSize: 11 }}>
        <div style={{ color: "#666", marginBottom: 4 }}># terminal · multi-model session</div>
        {terminal.length === 0 ? (
          <div style={{ color: "#666" }}>$ _ press run to execute</div>
        ) : (
          terminal.map((l, i) => (
            <div key={i} style={{
              color: l.kind === "cmd" ? C.termOk : l.kind === "ok" ? C.termOk : l.kind === "warn" ? C.termWarn : l.kind === "boot" ? "#9bc7e5" : "#ccc",
              lineHeight: 1.5, whiteSpace: "pre-wrap",
            }}>{l.text}</div>
          ))
        )}
      </div>

      <ProjectClaudeAssets project={project} />

      <div style={{ marginBottom: 16 }}>
        <div style={{ ...mono, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>epics</div>
        {project.epics.map((epic) => (
          <EpicCard
            key={epic.id}
            epic={epic}
            project={project}
            tasks={tasks.filter((t) => t.parentId === epic.id)}
            progress={epicProgress(epic.id)}
            collapsed={!!collapsedEpics[epic.id]}
            epicBusy={!!epicRunning[epic.id]}
            cliAvail={cliAvail}
            taskBusy={taskBusy}
            taskStart={taskStart}
            taskLogs={taskLogs}
            taskExpand={taskExpand}
            taskVariantId={taskVariantId}
            isTaskGated={isTaskGated}
            onToggleCollapsed={() => setCollapsedEpics({ ...collapsedEpics, [epic.id]: !collapsedEpics[epic.id] })}
            onRunEpic={() => runEpic(epic.id)}
            onStopEpic={() => stopEpic(epic.id)}
            onMarkComplete={() => markEpicComplete(epic.id)}
            onReopen={() => reopenEpic(epic.id)}
            onSetTaskOverride={setTaskOverride}
            onResetTask={resetTask}
            onRunOneTask={runOneTask}
            onOpenHandoff={openHandoffViewer}
            onOpenSplitModal={openSplitModal}
            onToggleExpand={(taskId) => setTaskExpand((m) => ({ ...m, [taskId]: !m[taskId] }))}
          />
        ))}
      </div>

      <KanbanBoard
        byStage={byStage}
        taskBusy={taskBusy}
        taskStart={taskStart}
        taskLogs={taskLogs}
        taskVariantId={taskVariantId}
        onOpenLog={(taskId) => {
          setTaskExpand((m) => ({ ...m, [taskId]: !m[taskId] }));
          document.getElementById(`task-row-${taskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
      />
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
        stack: stackLabelChanged ? stackFromLabel(fresh.stackLabel) : p.stack,
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
      stack: stackFromLabel(d.stackLabel),
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
