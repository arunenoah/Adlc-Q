"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { revalidatePath } from "next/cache";
import { mutateStore } from "@/lib/store";
import { analyzeFeatureImpact } from "@/lib/graph";
import type { Project, CLIRegistration, AgentMeta, Epic, DynamicImplTask } from "@/lib/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const errMsg = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "unknown error";

export async function toggleCLI(cliId: string): Promise<Result<CLIRegistration>> {
  try {
    const next = await mutateStore((s) => {
      const cur = s.clis[cliId];
      const newReg: CLIRegistration = cur?.active
        ? { active: false }
        : { active: true, plan: "Pro", until: "Dec 2026" };
      s.clis[cliId] = newReg;
      return s;
    });
    revalidatePath("/");
    return { ok: true, data: next.clis[cliId] };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function saveProject(project: Project): Promise<Result<Project>> {
  try {
    await mutateStore((s) => {
      const idx = s.projects.findIndex((p) => p.id === project.id);
      if (idx === -1) s.projects.push(project);
      else s.projects[idx] = project;
      return s;
    });
    revalidatePath("/");
    return { ok: true, data: project };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

type BuildAgentInput = {
  workspacePath: string;
  roleId: string;
  roleName: string;
  description: string;
  recommendedModel?: string;
  skillIds: string[];
};

const APPLICATION_ROOT =
  process.env.DEVOS_WORKSPACE_ROOT || "/Users/arunkumar/Documents/Application";

function isInsideApplication(target: string): boolean {
  const resolved = path.resolve(target);
  const root = path.resolve(APPLICATION_ROOT);
  return resolved === root || resolved.startsWith(root + path.sep);
}

export async function buildAgent(input: BuildAgentInput): Promise<Result<AgentMeta>> {
  try {
    const { workspacePath, roleId, roleName, description, recommendedModel, skillIds } = input;
    if (!isInsideApplication(workspacePath)) {
      return { ok: false, error: "workspacePath outside Application root" };
    }
    if (!/^[a-z0-9-]+$/i.test(roleId)) {
      return { ok: false, error: "invalid roleId" };
    }
    const agentsDir = path.join(workspacePath, ".claude", "agents");
    await fs.mkdir(agentsDir, { recursive: true });
    const filePath = path.join(agentsDir, `${roleId}.md`);
    try {
      await fs.stat(filePath);
      return { ok: false, error: `Agent already exists at ${filePath}` };
    } catch {}
    const skillsYaml = skillIds.length
      ? `skills: [${skillIds.map((s) => JSON.stringify(s)).join(", ")}]`
      : "skills: []";
    const safeDesc = description.replace(/\n+/g, " ").trim();
    const body = `---
name: ${roleId}
description: ${JSON.stringify(safeDesc)}
role: ${roleId}
${skillsYaml}
${recommendedModel ? `model: ${recommendedModel}` : "model: inherit"}
---

# ${roleName}

${safeDesc}

## Connected skills
${skillIds.length ? skillIds.map((s) => `- ${s}`).join("\n") : "_(none yet)_"}

## Responsibilities
_(scaffolded by DevOS — fill in role responsibilities, gates, and prompts)_
`;
    await fs.writeFile(filePath, body, "utf8");
    revalidatePath("/");
    return {
      ok: true,
      data: {
        id: roleId,
        name: roleId,
        description: safeDesc,
        path: filePath,
        role: roleId,
        skillIds,
      },
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

type CreateFeatureInput = {
  projectId: string;
  title: string;
  type: Epic["type"];
  brief: string;
  subtaskKeys?: string[];
};

export async function createFeatureWorkflow(
  input: CreateFeatureInput,
): Promise<Result<{ project: Project; epic: Epic }>> {
  try {
    const { projectId, title, type, brief, subtaskKeys } = input;
    const safeTitle = title.trim();
    if (!safeTitle) return { ok: false, error: "title required" };

    const epicId = `e-${Date.now()}`;
    const next = await mutateStore(async (s) => {
      const idx = s.projects.findIndex((p) => p.id === projectId);
      if (idx === -1) throw new Error(`Project ${projectId} not found`);
      const p = s.projects[idx];
      const godNames = (p.graphMeta?.godNodes || []).map((g) => g.name);
      const impact = p.workspacePath
        ? await analyzeFeatureImpact(p.workspacePath, safeTitle, brief, godNames)
        : undefined;
      const epic: Epic = {
        id: epicId,
        title: safeTitle,
        type,
        brief: brief.trim() || undefined,
        graphImpact: impact,
        subtaskKeys: subtaskKeys && subtaskKeys.length ? subtaskKeys : undefined,
      };
      s.projects[idx] = { ...p, epics: [...p.epics, epic] };
      return s;
    });
    revalidatePath("/");
    const updated = next.projects.find((p) => p.id === projectId);
    const epic = updated?.epics.find((e) => e.id === epicId);
    if (!updated || !epic) {
      return { ok: false, error: "store mutation produced no project" };
    }
    return { ok: true, data: { project: updated, epic } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

type WriteHandoffInput = {
  workspacePath: string;
  epicId: string;
  taskKey: string;
  taskTitle: string;
  agentRole: string;
  content: string;
};

type ChangedFile = {
  path: string;            // path relative to workspace
  status: string;          // M, A, D, R, U (untracked), I (ignored)
  additions: number;
  deletions: number;
  diff: string;            // unified diff (truncated if large)
  truncated: boolean;
  binary: boolean;
  mtimeISO?: string;
};

type RecentChangesResult = {
  workspacePath: string;
  baseline: "HEAD" | "none";
  filteredSinceISO?: string;
  files: ChangedFile[];
  totalAdditions: number;
  totalDeletions: number;
  warning?: string;
};

function runGit(args: string[], cwd: string, timeoutMs = 10000): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("git", args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    const killer = setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} }, timeoutMs);
    proc.stdout?.on("data", (d) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => { clearTimeout(killer); resolve({ exitCode: code ?? 1, stdout, stderr }); });
    proc.on("error", () => { clearTimeout(killer); resolve({ exitCode: 1, stdout: "", stderr: "spawn failed" }); });
  });
}

function parsePorcelain(out: string): { path: string; status: string }[] {
  const items: { path: string; status: string }[] = [];
  for (const raw of out.split("\n")) {
    if (!raw) continue;
    const xy = raw.slice(0, 2);
    const rest = raw.slice(3);
    let status = "M";
    if (xy.includes("?")) status = "U";
    else if (xy.includes("A")) status = "A";
    else if (xy.includes("D")) status = "D";
    else if (xy.includes("R")) status = "R";
    else if (xy.trim()) status = xy.trim()[0];
    const filePath = rest.includes(" -> ") ? rest.split(" -> ")[1] : rest;
    items.push({ path: filePath, status });
  }
  return items;
}

function splitDiffByFile(diff: string): Record<string, string> {
  const map: Record<string, string> = {};
  const chunks = diff.split(/^diff --git /m).slice(1);
  for (const chunk of chunks) {
    const m = chunk.match(/^a\/(\S+) b\/(\S+)/);
    if (!m) continue;
    map[m[2]] = "diff --git " + chunk;
  }
  return map;
}

function countAddDel(diff: string): { add: number; del: number } {
  let add = 0, del = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) add++;
    else if (line.startsWith("-")) del++;
  }
  return { add, del };
}

export async function getRecentChanges(input: {
  workspacePath: string;
  sinceISO?: string;
  maxFiles?: number;
  maxDiffBytes?: number;
}): Promise<Result<RecentChangesResult>> {
  try {
    const { workspacePath, sinceISO } = input;
    const maxFiles = input.maxFiles ?? 80;
    const maxDiffBytes = input.maxDiffBytes ?? 60_000;

    if (!isInsideApplication(workspacePath)) {
      return { ok: false, error: "workspacePath outside Application root" };
    }

    const gitDir = path.join(workspacePath, ".git");
    let isRepo = true;
    try { await fs.stat(gitDir); } catch { isRepo = false; }
    if (!isRepo) {
      return { ok: true, data: { workspacePath, baseline: "none", files: [], totalAdditions: 0, totalDeletions: 0, warning: "not a git repo — cannot diff" } };
    }

    const [statusRes, diffRes] = await Promise.all([
      runGit(["status", "--porcelain"], workspacePath),
      runGit(["diff", "HEAD", "--unified=3"], workspacePath),
    ]);

    const porcelain = parsePorcelain(statusRes.stdout);
    const diffByFile = splitDiffByFile(diffRes.stdout);

    const sinceMs = sinceISO ? new Date(sinceISO).getTime() : 0;
    const out: ChangedFile[] = [];
    let totalAdd = 0, totalDel = 0;

    for (const item of porcelain) {
      const abs = path.join(workspacePath, item.path);
      let mtimeISO: string | undefined;
      let mtimeMs = 0;
      try { const st = await fs.stat(abs); mtimeISO = st.mtime.toISOString(); mtimeMs = st.mtimeMs; }
      catch { /* deleted */ }

      if (sinceMs && mtimeMs && mtimeMs < sinceMs) continue;

      let diff = diffByFile[item.path] ?? "";
      let binary = false;
      let truncated = false;

      if (item.status === "U") {
        try {
          const buf = await fs.readFile(abs);
          if (buf.includes(0)) { binary = true; diff = "(binary file)"; }
          else {
            const text = buf.toString("utf8");
            const lines = text.split("\n").map((l) => "+" + l).join("\n");
            diff = `diff --git a/${item.path} b/${item.path}\nnew file (untracked)\n--- /dev/null\n+++ b/${item.path}\n${lines}`;
          }
        } catch { diff = "(unreadable)"; }
      } else if (!diff && item.status !== "D") {
        diff = "(no diff captured — possibly binary or staged-only change)";
      }

      if (diff.length > maxDiffBytes) {
        diff = diff.slice(0, maxDiffBytes) + `\n... (truncated, total ${diff.length} bytes)`;
        truncated = true;
      }

      const counts = binary ? { add: 0, del: 0 } : countAddDel(diff);
      totalAdd += counts.add; totalDel += counts.del;

      out.push({
        path: item.path,
        status: item.status,
        additions: counts.add,
        deletions: counts.del,
        diff,
        truncated,
        binary,
        mtimeISO,
      });

      if (out.length >= maxFiles) break;
    }

    return {
      ok: true,
      data: {
        workspacePath,
        baseline: "HEAD",
        filteredSinceISO: sinceISO,
        files: out,
        totalAdditions: totalAdd,
        totalDeletions: totalDel,
        warning: porcelain.length > out.length ? `showing ${out.length} of ${porcelain.length} changed files` : undefined,
      },
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function readHandoffFile(
  filePath: string,
): Promise<Result<{ path: string; content: string; sizeBytes: number; mtime: string }>> {
  try {
    if (!isInsideApplication(filePath)) {
      return { ok: false, error: "filePath outside Application root" };
    }
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return { ok: false, error: "not a regular file" };
    }
    const MAX = 1_500_000;
    if (stat.size > MAX) {
      return { ok: false, error: `file too large (${stat.size} bytes; max ${MAX})` };
    }
    const content = await fs.readFile(filePath, "utf8");
    return { ok: true, data: { path: filePath, content, sizeBytes: stat.size, mtime: stat.mtime.toISOString() } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function writeHandoff(
  input: WriteHandoffInput,
): Promise<Result<{ path: string }>> {
  try {
    if (!isInsideApplication(input.workspacePath)) {
      return { ok: false, error: "workspacePath outside Application root" };
    }
    const safeEpic = input.epicId.replace(/[^A-Za-z0-9_-]/g, "_");
    const safeKey = input.taskKey.replace(/[^A-Za-z0-9_-]/g, "_");
    const dir = path.join(input.workspacePath, ".devos", "handoffs", safeEpic);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${safeKey}.md`);
    const header =
      `# ${input.taskTitle}\n` +
      `Role: ${input.agentRole}\n` +
      `Subtask key: ${input.taskKey}\n` +
      `Generated: ${new Date().toISOString()}\n\n---\n\n`;
    await fs.writeFile(filePath, header + (input.content || ""), "utf8");
    return { ok: true, data: { path: filePath } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

type RunSubtaskInput = {
  workspacePath: string;
  cliCmd: string;
  cliVendor: string;
  modelId: string;
  prompt: string;
  timeoutMs?: number;
};

type RunSubtaskOutput = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  command: string;
};

function buildCliArgs(vendor: string, modelId: string, prompt: string): string[] | null {
  switch (vendor) {
    case "claude-code":
      return [
        "--model", modelId,
        "--permission-mode", "bypassPermissions",
        "--print", prompt,
      ];
    case "codex":
      return ["exec", "--model", modelId, prompt];
    case "gemini":
      return ["--model", modelId, "--prompt", prompt];
    case "opencode":
      return ["run", "--model", modelId, prompt];
    case "aider":
      return ["--model", modelId, "--message", prompt, "--yes-always"];
    case "cline":
      return ["--model", modelId, prompt];
    default:
      return null;
  }
}

export async function runSubtaskHeadless(
  input: RunSubtaskInput,
): Promise<Result<RunSubtaskOutput>> {
  try {
    if (!isInsideApplication(input.workspacePath)) {
      return { ok: false, error: "workspacePath outside Application root" };
    }
    const args = buildCliArgs(input.cliVendor, input.modelId, input.prompt);
    if (!args) {
      return { ok: false, error: `Unsupported CLI vendor: ${input.cliVendor}` };
    }
    const timeoutMs = Math.min(Math.max(input.timeoutMs || 120000, 5000), 600000);
    const start = Date.now();
    const command = `${input.cliCmd} ${args.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")}`;

    return await new Promise<Result<RunSubtaskOutput>>((resolve) => {
      let proc;
      try {
        proc = spawn(input.cliCmd, args, {
          cwd: input.workspacePath,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (e) {
        resolve({ ok: false, error: errMsg(e) });
        return;
      }
      let stdout = "";
      let stderr = "";
      let settled = false;
      const settle = (result: Result<RunSubtaskOutput>) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      proc.stdout.on("data", (d) => { stdout += d.toString(); });
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("error", (e) => {
        const hint = (e as NodeJS.ErrnoException).code === "ENOENT"
          ? `${input.cliCmd} not found on PATH. Install or add to PATH.`
          : errMsg(e);
        settle({ ok: false, error: hint });
      });
      proc.on("close", (code) => {
        settle({
          ok: true,
          data: {
            stdout,
            stderr,
            exitCode: code,
            durationMs: Date.now() - start,
            command,
          },
        });
      });
      const killer = setTimeout(() => {
        proc.kill("SIGKILL");
        settle({
          ok: false,
          error: `Timeout after ${timeoutMs}ms. Partial stdout: ${stdout.slice(-400)}`,
        });
      }, timeoutMs);
      proc.on("close", () => clearTimeout(killer));
    });
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

type SplitInput = {
  workspacePath: string;
  cliCmd: string;
  cliVendor: string;
  modelId: string;
  specPath?: string;
  specInline?: string;
  scopeText?: string;
  timeoutMs?: number;
};

export async function splitEpicIntoSubtasks(
  input: SplitInput,
): Promise<Result<{ tasks: DynamicImplTask[]; rawStdout: string }>> {
  try {
    if (!isInsideApplication(input.workspacePath)) {
      return { ok: false, error: "workspacePath outside Application root" };
    }
    let specText = input.specInline || "";
    if (!specText && input.specPath) {
      const candidate = path.isAbsolute(input.specPath)
        ? input.specPath
        : path.join(input.workspacePath, input.specPath);
      if (!isInsideApplication(candidate)) {
        return { ok: false, error: "specPath outside Application root" };
      }
      try {
        specText = await fs.readFile(candidate, "utf8");
      } catch (e) {
        return { ok: false, error: `Could not read spec file: ${candidate}: ${errMsg(e)}` };
      }
    }
    if (!specText.trim()) {
      return { ok: false, error: "No spec content provided" };
    }

    const prompt = `You are a planner. Read the spec below and emit ONLY a fenced JSON block.

Schema:
\`\`\`json
[
  {"id":"slug-id","title":"one-sentence task","role":"be","files":["path/to/file.php"],"depends_on":[]}
]
\`\`\`

Rules:
- "role": "be" | "fe" | "db"
- "files": files this subtask edits (used for conflict detection — no two subtasks may list the same file)
- "depends_on": ids of subtasks that must complete first (use [] when independent)
- Cover ALL implementation work in the spec. Do NOT include review/security/qa/drift/commit.
- Reply with the JSON block ONLY. No prose, no preamble, no explanation.

${input.scopeText ? `## Scope (context)\n${input.scopeText}\n\n` : ""}## Spec
${specText}`;

    const args = [
      "--model", input.modelId,
      "--permission-mode", "bypassPermissions",
      "--print", prompt,
    ];
    const timeoutMs = Math.min(Math.max(input.timeoutMs || 240000, 10000), 600000);

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number | null }>((resolve) => {
      const proc = spawn(input.cliCmd, args, {
        cwd: input.workspacePath,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d) => { stdout += d.toString(); });
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      const killer = setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch {}
        resolve({ stdout, stderr, exitCode: 124 });
      }, timeoutMs);
      proc.on("error", (e) => { clearTimeout(killer); resolve({ stdout, stderr: stderr + (e as Error).message, exitCode: 1 }); });
      proc.on("close", (code) => { clearTimeout(killer); resolve({ stdout, stderr, exitCode: code }); });
    });

    if (result.exitCode !== 0) {
      return { ok: false, error: `splitter exited ${result.exitCode}: ${result.stderr.slice(0, 400) || "(no stderr)"}` };
    }

    const parsed = parseJsonBlock(result.stdout);
    if (!parsed) {
      return { ok: false, error: `splitter produced no parsable JSON. Raw stdout:\n${result.stdout.slice(0, 800)}` };
    }
    return { ok: true, data: { tasks: parsed, rawStdout: result.stdout } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

function parseJsonBlock(out: string): DynamicImplTask[] | null {
  const candidates: string[] = [];
  const fence = out.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1]);
  const arr = out.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arr) candidates.push(arr[0]);
  candidates.push(out);
  for (const txt of candidates) {
    try {
      const parsed = JSON.parse(txt);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.parallel_subtasks) ? parsed.parallel_subtasks : null;
      if (!list) continue;
      const valid = list
        .filter((p: any) => p && p.id && p.title)
        .map((p: any, i: number) => ({
          id: String(p.id || `t${i}`),
          title: String(p.title),
          role: String(p.role || "be"),
          files: Array.isArray(p.files) ? p.files.map(String) : [],
          depends_on: Array.isArray(p.depends_on) ? p.depends_on.map(String) : [],
        }));
      if (valid.length) return valid;
    } catch {}
  }
  return null;
}

export async function checkCliAvailability(
  cmds: string[],
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  await Promise.all(
    cmds.map(
      (cmd) =>
        new Promise<void>((resolve) => {
          const proc = spawn("which", [cmd], { stdio: ["ignore", "ignore", "ignore"] });
          proc.on("error", () => { out[cmd] = false; resolve(); });
          proc.on("close", (code) => { out[cmd] = code === 0; resolve(); });
        }),
    ),
  );
  return out;
}

export async function removeProject(projectId: string): Promise<Result<{ id: string }>> {
  try {
    await mutateStore((s) => {
      s.projects = s.projects.filter((p) => p.id !== projectId);
      return s;
    });
    revalidatePath("/");
    return { ok: true, data: { id: projectId } };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
