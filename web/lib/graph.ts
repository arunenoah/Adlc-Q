import { promises as fs } from "node:fs";
import path from "node:path";
import type { GraphImpact, GraphImpactNode } from "./types";

type GraphNode = {
  id: string;
  label: string;
  file_type?: string;
  source_file?: string;
  source_location?: string;
  community?: number;
};

type GraphEdge = {
  source: string;
  target: string;
  weight?: number;
};

type GraphFile = {
  nodes: GraphNode[];
  links?: GraphEdge[];
  edges?: GraphEdge[];
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "this", "that", "feature",
  "bug", "api", "add", "use", "make", "new", "build", "create", "fix",
  "to", "in", "of", "on", "at", "by", "as", "an", "a", "is", "be",
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function scoreNode(label: string, tokens: string[]): number {
  const hay = label.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += t.length >= 5 ? 2 : 1;
    if (hay === t) score += 3;
  }
  return score;
}

export async function analyzeFeatureImpact(
  workspacePath: string,
  feature: string,
  brief: string,
  godNodeNames: string[] = [],
): Promise<GraphImpact> {
  const empty: GraphImpact = {
    keywords: [],
    matchedNodes: [],
    touchedGodNodes: [],
    affectedFiles: [],
    totalMatches: 0,
  };

  const tokens = [...new Set(tokenize(`${feature} ${brief}`))];
  if (tokens.length === 0) return empty;

  const graphPath = path.join(workspacePath, "graphify-out", "graph.json");
  let raw: string;
  try {
    raw = await fs.readFile(graphPath, "utf8");
  } catch {
    return { ...empty, keywords: tokens };
  }

  let graph: GraphFile;
  try {
    graph = JSON.parse(raw);
  } catch {
    return { ...empty, keywords: tokens };
  }

  const matches: { node: GraphNode; score: number }[] = [];
  for (const n of graph.nodes) {
    const s = scoreNode(n.label || "", tokens);
    if (s > 0) matches.push({ node: n, score: s });
  }
  matches.sort((a, b) => b.score - a.score);

  const top = matches.slice(0, 8);
  const matchedNodes: GraphImpactNode[] = top.map(({ node, score }) => ({
    id: node.id,
    label: node.label,
    file: node.source_file || "",
    location: node.source_location || "",
    matchScore: score,
  }));

  const matchedIds = new Set(top.map((m) => m.node.id));
  const edges = graph.links || graph.edges || [];
  const adjacent = new Set<string>();
  for (const e of edges) {
    if (matchedIds.has(e.source)) adjacent.add(e.target);
    if (matchedIds.has(e.target)) adjacent.add(e.source);
  }

  const adjLabels = new Set(
    graph.nodes
      .filter((n) => adjacent.has(n.id))
      .map((n) => (n.label || "").toLowerCase()),
  );
  const touchedGodNodes = godNodeNames
    .map((name) => ({ name, edges: 0 }))
    .filter((g) => adjLabels.has(g.name.toLowerCase()));

  const affectedFiles = [
    ...new Set(top.map((m) => m.node.source_file || "").filter(Boolean)),
  ].slice(0, 8);

  return {
    keywords: tokens,
    matchedNodes,
    touchedGodNodes,
    affectedFiles,
    totalMatches: matches.length,
  };
}
