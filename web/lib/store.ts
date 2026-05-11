import { promises as fs } from "node:fs";
import path from "node:path";
import type { Store, CLIRegistration } from "./types";

const STORE_DIR = path.resolve(process.cwd(), "..", ".devos");
const STORE_PATH = path.join(STORE_DIR, "store.json");

const DEFAULT_CLIS: Record<string, CLIRegistration> = {
  "claude-code": { active: true, plan: "Max", until: "Dec 2026" },
  codex: { active: true, plan: "Plus", until: "Aug 2026" },
  gemini: { active: true, plan: "Pro", until: "Oct 2026" },
  cline: { active: true, plan: "Free", until: "—" },
  opencode: { active: true, plan: "Free", until: "—" },
  aider: { active: false },
};

const DEFAULT_STORE: Store = {
  projects: [],
  clis: DEFAULT_CLIS,
  version: 1,
};

async function ensureDir() {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

export async function readStore(): Promise<Store> {
  try {
    const txt = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(txt) as Partial<Store>;
    return {
      projects: parsed.projects ?? [],
      clis: { ...DEFAULT_CLIS, ...(parsed.clis ?? {}) },
      version: parsed.version ?? 1,
    };
  } catch {
    return structuredClone(DEFAULT_STORE);
  }
}

export async function writeStore(store: Store): Promise<void> {
  await ensureDir();
  const tmpPath = `${STORE_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(tmpPath, STORE_PATH);
}

export async function mutateStore(
  fn: (s: Store) => Store | Promise<Store>,
): Promise<Store> {
  const current = await readStore();
  const next = await fn(current);
  await writeStore(next);
  return next;
}

export const __storeConfig = { storeDir: STORE_DIR, storePath: STORE_PATH };
