// SSE-based headless CLI runner.
// SRP: this module owns the wire protocol with the /api/run-task route only.
// Higher-level orchestration (which prompt, which model, persistence) lives
// in the caller (currently ProjectBoard's executeTask).

export type RunInput = {
  workspacePath: string;
  cliCmd: string;
  cliVendor: string;
  modelId: string;
  prompt: string;
  timeoutMs?: number;
};

export type RunResult =
  | { ok: true; data: { stdout: string; stderr: string; exitCode: number | null; durationMs: number; command: string } }
  | { ok: false; error: string };

export type SseEvent = "stdout" | "stderr" | "start" | "done" | "error";
export type SsePayload =
  | string                                                         // stdout/stderr chunk
  | { command?: string; modelId?: string; cwd?: string }           // start
  | { exitCode?: number | null; durationMs?: number; error?: string } // done
  | { error?: string };                                            // error
export type SseHandler = (event: SseEvent, payload: SsePayload) => void;

// Streams stdout/stderr from /api/run-task back via the onEvent callback,
// while also accumulating the full transcript for the final RunResult.
//
// Wire format: text/event-stream with `event:` + `data:` lines, each
// SSE record terminated by a blank line ("\n\n"). The route handler is in
// app/api/run-task/route.ts.
export const runViaSse = async (input: RunInput, onEvent: SseHandler): Promise<RunResult> => {
  let stdout = "";
  let stderr = "";
  let exitCode: number | null = null;
  let errorMsg: string | null = null;
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
      let idx: number;
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
        let payload: any;
        try { payload = JSON.parse(data); } catch { continue; }
        if (event === "stdout")      { stdout += payload.chunk; onEvent("stdout", payload.chunk); }
        else if (event === "stderr") { stderr += payload.chunk; onEvent("stderr", payload.chunk); }
        else if (event === "start")  onEvent("start", payload);
        else if (event === "done")   { exitCode = payload.exitCode; durationMs = payload.durationMs || 0; if (payload.error) errorMsg = payload.error; }
        else if (event === "error")  errorMsg = payload.error;
      }
    }
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || String(e) };
  }

  if (errorMsg && exitCode !== 0) return { ok: false, error: errorMsg };
  return {
    ok: true,
    data: { stdout, stderr, exitCode, durationMs, command: `${input.cliCmd} ${input.modelId}` },
  };
};

// Parse a writer's output looking for the mandated parallel_subtasks JSON
// block. Returns null when the writer didn't emit one (caller decides how
// to react — usually warns the user and shows the manual ✂ split button).
//
// Tolerates two shapes:
//   1. Bare array: [ {id, title, role, files, depends_on}, ... ]
//   2. Wrapped:    { parallel_subtasks: [ ... ] }
//
// Also tries a loose array-literal match anywhere in the text in case the
// writer forgot the fence.
export type ParallelSubtask = {
  id: string;
  title: string;
  role: string;
  files: string[];
  depends_on: string[];
};

const normalize = (raw: any[]): ParallelSubtask[] =>
  raw.map((p, i) => ({
    id: String(p.id ?? `t${i}`),
    title: String(p.title ?? ""),
    role: String(p.role ?? "be"),
    files: Array.isArray(p.files) ? p.files.map(String) : [],
    depends_on: Array.isArray(p.depends_on) ? p.depends_on.map(String) : [],
  }));

export const parseWriterParallelTasks = (writerOutput: string): ParallelSubtask[] | null => {
  if (!writerOutput) return null;

  const candidates: string[] = [];
  const fenceMatch = writerOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) candidates.push(fenceMatch[1]);
  const arrMatch = writerOutput.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arrMatch) candidates.push(arrMatch[0]);

  for (const txt of candidates) {
    try {
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed) && parsed.every((x) => x && x.id && x.title && x.role)) {
        return normalize(parsed);
      }
      if (parsed && Array.isArray(parsed.parallel_subtasks)) {
        return normalize(parsed.parallel_subtasks);
      }
    } catch { /* try next */ }
  }
  return null;
};
