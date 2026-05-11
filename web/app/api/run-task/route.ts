import { spawn } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPLICATION_ROOT =
  process.env.DEVOS_WORKSPACE_ROOT || "/Users/arunkumar/Documents/Application";

function isInsideApplication(target: string): boolean {
  const resolved = path.resolve(target);
  const root = path.resolve(APPLICATION_ROOT);
  return resolved === root || resolved.startsWith(root + path.sep);
}

type Body = {
  workspacePath: string;
  cliCmd: string;
  cliVendor: string;
  modelId: string;
  prompt: string;
  timeoutMs?: number;
};

function buildArgs(vendor: string, modelId: string, prompt: string): string[] | null {
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

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const args = buildArgs(body.cliVendor, body.modelId, body.prompt);
  if (!args) {
    return new Response(
      sse("error", { error: `Unsupported CLI vendor: ${body.cliVendor}` }) +
        sse("done", { exitCode: 1, durationMs: 0 }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  }
  if (!isInsideApplication(body.workspacePath)) {
    return new Response(
      sse("error", { error: "workspacePath outside Application root" }) +
        sse("done", { exitCode: 1, durationMs: 0 }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const timeoutMs = Math.min(Math.max(body.timeoutMs || 300000, 5000), 900000);
  const start = Date.now();

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      let killer: ReturnType<typeof setTimeout> | null = null;
      let proc: ReturnType<typeof spawn>;
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(sse(event, data)));
        } catch {}
      };
      const finish = (payload: { exitCode: number | null; error?: string }) => {
        if (closed) return;
        closed = true;
        send("done", { ...payload, durationMs: Date.now() - start });
        try { controller.close(); } catch {}
        if (killer) clearTimeout(killer);
      };
      try {
        proc = spawn(body.cliCmd, args, {
          cwd: body.workspacePath,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (e) {
        finish({ exitCode: 1, error: (e as Error).message });
        return;
      }
      send("start", { command: body.cliCmd, modelId: body.modelId, cwd: body.workspacePath });
      proc.stdout?.on("data", (d) => send("stdout", { chunk: d.toString() }));
      proc.stderr?.on("data", (d) => send("stderr", { chunk: d.toString() }));
      proc.on("error", (e) => {
        const code = (e as NodeJS.ErrnoException).code;
        const hint = code === "ENOENT"
          ? `${body.cliCmd} not found on PATH`
          : (e as Error).message;
        finish({ exitCode: 1, error: hint });
      });
      proc.on("close", (exitCode) => finish({ exitCode }));
      killer = setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch {}
        finish({ exitCode: 124, error: `Timeout after ${timeoutMs}ms` });
      }, timeoutMs);
      req.signal?.addEventListener("abort", () => {
        try { proc.kill("SIGKILL"); } catch {}
        finish({ exitCode: 130, error: "client aborted" });
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
