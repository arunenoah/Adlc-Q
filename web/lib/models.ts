// CLI model registry + variant lookup helpers.
// Single source of truth for: which CLIs exist, which model variants each CLI
// offers, which variant is recommended per agent role.
//
// SRP: this module owns model metadata only. UI lives elsewhere; CLI execution
// is in app/api/run-task/route.ts; agent-to-model mapping is in agents.ts.

export type ModelVariant = {
  id: string;
  name: string;
  strength: string;
};

export type ModelDef = {
  id: string;
  name: string;
  vendor: string;
  cmd: string;
  color: string;
  variants: ModelVariant[];
};

export const MODELS: ModelDef[] = [
  {
    id: "claude-code", name: "Claude Code", vendor: "Anthropic", cmd: "claude", color: "#d4a373",
    variants: [
      { id: "claude-opus-4-7", name: "Opus 4.7", strength: "deep reasoning, architecture" },
      { id: "claude-sonnet-4-6", name: "Sonnet 4.6", strength: "balanced, fast iteration" },
      { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5", strength: "quick, cheap" },
    ],
  },
  {
    id: "codex", name: "Codex CLI", vendor: "OpenAI", cmd: "codex", color: "#3a7a3a",
    variants: [
      { id: "gpt-5", name: "GPT-5", strength: "general dev" },
      { id: "gpt-5-mini", name: "GPT-5 Mini", strength: "fast, cheap" },
    ],
  },
  {
    id: "gemini", name: "Gemini CLI", vendor: "Google", cmd: "gemini", color: "#3a5a78",
    variants: [
      { id: "gemini-2.5-pro", name: "2.5 Pro", strength: "long context" },
      { id: "gemini-2.5-flash", name: "2.5 Flash", strength: "speed" },
    ],
  },
  {
    id: "cline", name: "Cline", vendor: "OSS", cmd: "cline", color: "#7a3a78",
    variants: [{ id: "cline-default", name: "default", strength: "OSS workflows" }],
  },
  {
    id: "opencode", name: "OpenCode", vendor: "OSS", cmd: "opencode", color: "#a04a2c",
    variants: [{ id: "opencode-default", name: "default", strength: "open routing" }],
  },
  {
    id: "aider", name: "Aider", vendor: "OSS", cmd: "aider", color: "#5a6b3a",
    variants: [{ id: "aider-default", name: "default", strength: "git-native" }],
  },
];

export const findModelVariant = (variantId: string): { model: ModelDef; variant: ModelVariant } | null => {
  for (const m of MODELS) {
    const v = m.variants.find((x) => x.id === variantId);
    if (v) return { model: m, variant: v };
  }
  return null;
};

export const variantActive = (variantId: string, clis: Record<string, { active?: boolean }>): boolean => {
  const found = findModelVariant(variantId);
  if (!found) return false;
  return !!clis[found.model.id]?.active;
};

// Migrate legacy stored variant ids to current canonical ones. Idempotent.
// Lives next to MODELS so adding a new variant rename is a one-file edit.
const VARIANT_MIGRATION: Record<string, string> = {
  "claude-opus-4": "claude-opus-4-7",
  "claude-sonnet-4": "claude-sonnet-4-6",
  "claude-haiku-4": "claude-haiku-4-5-20251001",
  "gpt-5.5": "gpt-5",
  "gpt-5.5-mini": "gpt-5-mini",
};

// Resolve a stored {agentId → variantId} map against the current registry.
// - applies legacy renames
// - falls back to the agent's recommended variant when the stored id no longer exists
// - ensures every known agent has a value
// Caller passes AGENTS + defaultAgentModels via the deps object — keeps this
// module free of the agents.ts circular import.
export type MigrateDeps = {
  agents: { id: string; recommend: string }[];
  defaultModels: () => Record<string, string>;
};

export const migrateAgentModels = (
  m: Record<string, string> | null | undefined,
  deps: MigrateDeps,
): Record<string, string> => {
  if (!m) return deps.defaultModels();
  const out: Record<string, string> = { ...m };
  for (const k of Object.keys(out)) {
    if (VARIANT_MIGRATION[out[k]]) out[k] = VARIANT_MIGRATION[out[k]];
    if (!findModelVariant(out[k])) {
      const a = deps.agents.find((x) => x.id === k);
      out[k] = a?.recommend || "claude-sonnet-4-6";
    }
  }
  for (const a of deps.agents) {
    if (!out[a.id]) out[a.id] = a.recommend;
  }
  return out;
};
