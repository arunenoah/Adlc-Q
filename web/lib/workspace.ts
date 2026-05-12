import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  DiscoveredProject,
  ProjectGraphMeta,
  SkillMeta,
  AgentMeta,
  CommandMeta,
} from "./types";

const APPLICATION_ROOT =
  process.env.DEVOS_WORKSPACE_ROOT || "/Users/arunkumar/Documents/Application";

const CLAUDE_TABLE_PATH = path.join(APPLICATION_ROOT, "CLAUDE.md");

type StackTableEntry = { dirName: string; nodes: number; stackLabel: string };

async function parseStackTable(): Promise<Map<string, StackTableEntry>> {
  const map = new Map<string, StackTableEntry>();
  let content: string;
  try {
    content = await fs.readFile(CLAUDE_TABLE_PATH, "utf8");
  } catch {
    return map;
  }
  for (const line of content.split("\n")) {
    const m = line.match(
      /^\|\s*([^|]+?)\s*\|\s*([\d,]+)\*?\s*\|\s*([^|]+?)\s*\|\s*([^|/]+?)\/graphify-out\/?\s*\|/,
    );
    if (!m) continue;
    const [, name, nodesRaw, stack, dir] = m;
    if (name.toLowerCase() === "project") continue;
    const nodes = Number.parseInt(nodesRaw.replace(/,/g, ""), 10);
    if (Number.isNaN(nodes)) continue;
    map.set(dir.trim(), { dirName: dir.trim(), nodes, stackLabel: stack.trim() });
  }
  return map;
}

function parseGraphReport(content: string): ProjectGraphMeta {
  const meta: ProjectGraphMeta = {
    nodes: 0,
    edges: 0,
    communities: 0,
    files: 0,
    godNodes: [],
    surprisingConnections: [],
    suggestedQuestions: [],
  };

  const dateM = content.match(/\(\s*(\d{4}-\d{2}-\d{2})\s*\)/);
  if (dateM) meta.reportDate = dateM[1];

  const sumM = content.match(
    /-\s*([\d,]+)\s*nodes\s*·\s*([\d,]+)\s*edges\s*·\s*([\d,]+)\s*communities/i,
  );
  if (sumM) {
    meta.nodes = Number.parseInt(sumM[1].replace(/,/g, ""), 10);
    meta.edges = Number.parseInt(sumM[2].replace(/,/g, ""), 10);
    meta.communities = Number.parseInt(sumM[3].replace(/,/g, ""), 10);
  }

  const filesM = content.match(/-\s*([\d,]+)\s*files\s*·/);
  if (filesM) meta.files = Number.parseInt(filesM[1].replace(/,/g, ""), 10);

  const sectionAfter = (heading: string): string | null => {
    const re = new RegExp(`##\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
    const m = content.match(re);
    return m ? m[1] : null;
  };

  const godSection = sectionAfter("God Nodes");
  if (godSection) {
    for (const line of godSection.split("\n")) {
      const m = line.match(/`([^`]+)`\s*-\s*(\d+)\s*edges/);
      if (m) meta.godNodes.push({ name: m[1], edges: Number.parseInt(m[2], 10) });
    }
    meta.godNodes = meta.godNodes.slice(0, 8);
  }

  const surpSection = sectionAfter("Surprising Connections");
  if (surpSection) {
    const lines = surpSection
      .split("\n")
      .filter((l) => l.trim().startsWith("- ") && l.includes("-->"));
    meta.surprisingConnections = lines.slice(0, 5).map((l) => l.replace(/^\s*-\s*/, "").trim());
  }

  const qSection = sectionAfter("Suggested Questions");
  if (qSection) {
    const lines = qSection.split("\n").filter((l) => /^\s*-\s*\*\*/.test(l));
    meta.suggestedQuestions = lines
      .slice(0, 5)
      .map((l) => l.replace(/^\s*-\s*\*\*/, "").replace(/\*\*\s*$/, "").trim());
  }

  return meta;
}

type FrontmatterValue = string | string[];

function parseInlineList(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  return trimmed
    .slice(1, -1)
    .split(",")
    .map((s) => s.trim().replace(/^["'](.*)["']$/, "$1"))
    .filter(Boolean);
}

function parseFrontmatter(content: string): Record<string, FrontmatterValue> {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const block = m[1];
  const out: Record<string, FrontmatterValue> = {};
  const lines = block.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) {
      i++;
      continue;
    }
    const key = kv[1];
    const rawVal = kv[2];
    if (rawVal === "|" || rawVal === ">") {
      const collected: string[] = [];
      i++;
      while (i < lines.length && /^\s+/.test(lines[i])) {
        collected.push(lines[i].replace(/^\s+/, ""));
        i++;
      }
      out[key.toLowerCase()] = collected.join(rawVal === "|" ? "\n" : " ").trim();
      continue;
    }
    const inline = parseInlineList(rawVal);
    if (inline) {
      out[key.toLowerCase()] = inline;
      i++;
      continue;
    }
    if (rawVal.trim() === "") {
      const collected: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        collected.push(lines[j].replace(/^\s+-\s+/, "").replace(/^["'](.*)["']$/, "$1").trim());
        j++;
      }
      if (collected.length) {
        out[key.toLowerCase()] = collected;
        i = j;
        continue;
      }
    }
    out[key.toLowerCase()] = rawVal.replace(/^["'](.*)["']$/, "$1").trim();
    i++;
  }
  return out;
}

function fmString(fm: Record<string, FrontmatterValue>, key: string): string {
  const v = fm[key];
  return typeof v === "string" ? v : "";
}

function fmList(fm: Record<string, FrontmatterValue>, key: string): string[] {
  const v = fm[key];
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v) return [v];
  return [];
}

const ROLE_KEYWORDS: Record<string, string[]> = {
  lead: ["tech-lead", "techlead", "tech_lead", "lead-engineer", "lead"],
  writer: ["tech-writer", "techwriter", "tech_writer", "writer", "spec-writer", "doc"],
  ux: ["ux", "design", "wireframe"],
  fe: ["frontend", "fe", "ui-engineer"],
  be: ["backend", "be", "senior-engineer", "engineer"],
  db: ["database", "db", "schema"],
  qa: ["qa", "tester", "test"],
  rev: ["code-reviewer", "reviewer", "review"],
  sec: ["security", "sec"],
  dev: ["devops", "deploy", "ops"],
};

function deriveAgentRole(id: string, fmRole: string): string | undefined {
  if (fmRole) return fmRole.toLowerCase();
  const slug = id.toLowerCase();
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (keywords.some((k) => slug.includes(k))) return role;
  }
  return undefined;
}

// Explicit role → skill ID-fragment mapping. Each fragment is matched
// against skill IDs as substrings, in order; the first matching skill in the
// project's skills/ folder wins (multiple matches all get linked).
// Stack-aware fragments use {stack} which is resolved against the detected
// project stack key (laravel|yii2|nextjs|react|node|flutter|php|generic).
const EXPLICIT_ROLE_SKILLS: Record<string, string[]> = {
  secpre: ["security-first", "security-audit"],
  sec:    ["security-first", "security-audit"],
  qa:     ["qa-testing", "qa-integration-testing", "playwright"],
  rev:    ["code-reviewer-quality"],
  lead:   ["tech-lead-architecture", "tech-lead-gates"],
  writer: ["tech-writer-spec"],
  be:     ["senior-engineer-{stack}", "senior-engineer-debugging"],
  fe:     ["senior-engineer-{stack}", "senior-engineer-debugging"],
  db:     ["senior-engineer-{stack}", "senior-engineer-debugging"],
  dev:    ["senior-engineer-debugging"],
  ux:     [],
};

function autoMatchSkills(agentId: string, skills: SkillMeta[], stackKey?: string): string[] {
  const matches = new Set<string>();

  // 1. Explicit role mapping (preferred). Resolves {stack} placeholder.
  const explicit = EXPLICIT_ROLE_SKILLS[agentId.toLowerCase()];
  if (explicit) {
    for (const frag of explicit) {
      const resolved = stackKey ? frag.replace("{stack}", stackKey) : frag;
      const hit = skills.find((s) => s.id.toLowerCase().includes(resolved.toLowerCase()));
      if (hit) matches.add(hit.id);
    }
    if (matches.size > 0) return [...matches];
  }

  // 2. Fallback — token-based fuzzy match against skill id + name.
  const tokens = agentId
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter((t) => t.length > 2 && !["the", "and", "for"].includes(t));
  if (tokens.length === 0) return [];
  for (const s of skills) {
    const hay = `${s.id} ${s.name}`.toLowerCase();
    if (tokens.some((t) => hay.includes(t))) matches.add(s.id);
  }
  return [...matches];
}

async function scanSkills(projectPath: string): Promise<SkillMeta[]> {
  const skillsDir = path.join(projectPath, ".claude", "skills");
  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return [];
  }
  const out: SkillMeta[] = [];
  for (const entry of entries) {
    const entryPath = path.join(skillsDir, entry);
    let stat: import("node:fs").Stats;
    try {
      stat = await fs.stat(entryPath);
    } catch {
      continue;
    }
    let mdPath: string | null = null;
    let id = entry;
    if (stat.isDirectory()) {
      const candidate = path.join(entryPath, "SKILL.md");
      try {
        await fs.stat(candidate);
        mdPath = candidate;
      } catch {
        continue;
      }
    } else if (stat.isFile() && entry.endsWith(".md")) {
      mdPath = entryPath;
      id = entry.replace(/\.md$/, "");
    } else {
      continue;
    }
    if (!mdPath) continue;
    let content: string;
    try {
      content = await fs.readFile(mdPath, "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(content);
    out.push({
      id,
      name: fmString(fm, "name") || id,
      description: fmString(fm, "description"),
      path: mdPath,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function scanCommands(projectPath: string): Promise<CommandMeta[]> {
  const dir = path.join(projectPath, ".claude", "commands");
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: CommandMeta[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const filePath = path.join(dir, entry);
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(content);
    const id = entry.replace(/\.md$/, "");
    let description = fmString(fm, "description");
    if (!description) {
      const body = content.replace(/^---[\s\S]*?---\s*/, "");
      const firstLine = body
        .split(/\r?\n/)
        .find((l) => l.trim() && !l.trim().startsWith("#"));
      if (firstLine) description = firstLine.trim().slice(0, 200);
    }
    out.push({ id, name: fmString(fm, "name") || id, description, path: filePath });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function detectStackFromManifests(
  projectPath: string,
  fallbackLabel: string,
): Promise<string> {
  let composer: { require?: Record<string, string>; name?: string } | null = null;
  try {
    composer = JSON.parse(
      await fs.readFile(path.join(projectPath, "composer.json"), "utf8"),
    );
  } catch {}
  if (composer) {
    const reqKeys = Object.keys(composer.require || {}).map((k) => k.toLowerCase());
    const isYii2 =
      (composer.name || "").toLowerCase().includes("yii") ||
      reqKeys.some((k) => k.startsWith("yiisoft/"));
    const isLaravel = reqKeys.some((k) => k.startsWith("laravel/"));
    if (isYii2) return "PHP/Yii2";
    if (isLaravel) return "PHP/Laravel";
    return "PHP";
  }
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null = null;
  try {
    pkg = JSON.parse(
      await fs.readFile(path.join(projectPath, "package.json"), "utf8"),
    );
  } catch {}
  if (pkg) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (deps.next) return "TypeScript/Next.js";
    if (deps["react-native"]) return "React Native";
    if (deps.react) return deps.typescript ? "TypeScript/React" : "React";
    if (deps.vue) return "Vue";
    if (deps.svelte) return "Svelte";
    return "Node.js";
  }
  try {
    await fs.stat(path.join(projectPath, "pubspec.yaml"));
    return "Flutter/Dart";
  } catch {}
  return fallbackLabel;
}

function stackKeyFromLabel(label: string): string | undefined {
  const l = (label || "").toLowerCase();
  if (l.includes("yii")) return "yii2";
  if (l.includes("laravel")) return "laravel";
  if (l.includes("next")) return "nextjs";
  if (l.includes("react native")) return "react-native";
  if (l.includes("react")) return "react";
  if (l.includes("vue")) return "vue";
  if (l.includes("flutter") || l.includes("dart")) return "flutter";
  if (l.includes("node") || l.includes("typescript")) return "node";
  if (l.includes("php")) return "php";
  return undefined;
}

async function scanAgents(projectPath: string, skills: SkillMeta[], stackKey?: string): Promise<AgentMeta[]> {
  const agentsDir = path.join(projectPath, ".claude", "agents");
  let entries: string[];
  try {
    entries = await fs.readdir(agentsDir);
  } catch {
    return [];
  }
  const out: AgentMeta[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const filePath = path.join(agentsDir, entry);
    let content: string;
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(content);
    const id = entry.replace(/\.md$/, "");
    const explicitSkills = fmList(fm, "skills");
    const skillIds = explicitSkills.length ? explicitSkills : autoMatchSkills(id, skills, stackKey);
    out.push({
      id,
      name: fmString(fm, "name") || id,
      description: fmString(fm, "description"),
      path: filePath,
      role: deriveAgentRole(id, fmString(fm, "role")),
      skillIds,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export async function scanWorkspace(): Promise<DiscoveredProject[]> {
  const stackTable = await parseStackTable();
  let entries: string[];
  try {
    entries = await fs.readdir(APPLICATION_ROOT);
  } catch {
    return [];
  }

  const results: DiscoveredProject[] = [];
  for (const dirName of entries) {
    if (dirName.startsWith(".") || dirName === "DevOS") continue;
    const projectPath = path.join(APPLICATION_ROOT, dirName);
    const reportPath = path.join(projectPath, "graphify-out", "GRAPH_REPORT.md");
    try {
      const stat = await fs.stat(reportPath);
      if (!stat.isFile()) continue;
    } catch {
      continue;
    }

    let report: string;
    try {
      report = await fs.readFile(reportPath, "utf8");
    } catch {
      continue;
    }

    const graphMeta = parseGraphReport(report);
    const tableEntry = stackTable.get(dirName);
    const skills = await scanSkills(projectPath);
    const detectedLabel = await detectStackFromManifests(projectPath, tableEntry?.stackLabel || "Unknown");
    const stackKey = stackKeyFromLabel(detectedLabel);
    const [agents, commands] = await Promise.all([
      scanAgents(projectPath, skills, stackKey),
      scanCommands(projectPath),
    ]);
    results.push({
      dirName,
      workspacePath: projectPath,
      stackLabel: detectedLabel,
      approxNodes: tableEntry?.nodes || graphMeta.nodes,
      graphMeta,
      skills,
      agents,
      commands,
    });
  }

  results.sort((a, b) => b.approxNodes - a.approxNodes);
  return results;
}

export const __workspaceConfig = { applicationRoot: APPLICATION_ROOT };
