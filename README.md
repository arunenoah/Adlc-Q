# Adlc-Q

**Agentic SDLC + Quality** — a DevOS-style orchestrator that runs the full software-delivery loop (scope → spec → security pre-check → impl → review → security audit → QA → drift → commit) using local Claude Code agents and project-aware skills.

## What's in this repo

```
DevOS/
├── web/                         Next.js 16 + React 19 dashboard (the orchestrator UI)
│   ├── app/                     App Router pages, server actions, SSE run-task route
│   ├── lib/                     workspace scanner, types, graph reader, store
│   └── public/
└── .claude/                     Claude Code agent + skill setup for THIS project
    ├── agents/                  10 role agents (lead, writer, secpre, be, fe, db, rev, sec, qa, dev)
    ├── skills/                  9 stack-aware skills incl. security-first
    ├── commands/                /build, /plan, /commit, /drift, /review, /test, /pr-reviewer, /prompt
    ├── hooks/check-secrets.sh   PreToolUse Bash hook that blocks raw secrets in commits
    ├── settings.json            Hook wiring (committed, shared)
    └── STACK.md                 Stack translation cheat sheet
```

## What the orchestrator does

For every feature / bug / API epic the dashboard runs:

1. **scope** — Tech Lead (Opus) outputs in/out-of-scope, files to touch, architecture, risks
2. **spec** — Tech Writer (Sonnet) outputs requirement spec + parallel-safe `parallel_subtasks` JSON
3. **secpre** — Security Pre-Check engineer runs `security-first` skill pass 1 (threat model + binding controls)
4. **impl-be / impl-fe / db** — Engineers implement under the binding controls; multiple impl tasks run in parallel when their files don't overlap
5. **review** — Code Reviewer (Opus) audits diff against spec
6. **sec** — Security Reviewer runs `security-first` skill pass 2 (cross-checks every MUST-VERIFY item against the diff)
7. **qa-evidence** — QA crawls endpoints, runs positive/negative/edge tests, captures evidence
8. **drift** — Tech Lead audits scope/spec vs implementation
9. **commit** — DevOps stages commit (never pushes, never `--no-verify`)

Each step's stdout is the next step's input. All outputs persist to `.devos/store.json` so refreshing the browser keeps progress. Handoff files write to `.devos/handoffs/<epicId>/<key>.md`. The dashboard renders a per-task right-side drawer with the handoff content + a live `git diff` Changes tab.

## Security model

- **`security-first` skill is mandatory** for every feature/bug. Two-pass protocol (pre-impl threat model, post-impl diff audit). 19 threat categories enforced. See `.claude/skills/security-first-skill/SKILL.md`.
- **`check-secrets.sh` hook** runs PreToolUse on every `Bash` tool call — blocks `git commit`/`git push` if staged files contain raw secrets.
- **File-system sandbox** in server actions via `isInsideApplication(path)` — every read/write checks the path is inside the workspace root.
- **No `env()` outside config files**, no `--no-verify`, no `git push` from agents.

## Run locally

```bash
cd web
npm install
NODE_OPTIONS='--max-old-space-size=1024' npm run build
NODE_OPTIONS='--max-old-space-size=512' npm start
# open http://localhost:3000
```

The dev server (`npm run dev`) is RAM-heavy on 8 GB machines. `npm run build` + `npm start` is the recommended path.

## Required environment

- macOS / Linux
- Node.js 20+
- Claude Code CLI on `$PATH` (`claude`)
- A workspace root containing your projects — defaults to `/Users/arunkumar/Documents/Application` and overridable via `DEVOS_WORKSPACE_ROOT`

## Per-project install

The agent + skill setup that ships in this repo is also designed to be installed across many projects. The companion script `install_claude_assets.py` (kept in the workspace root, not in this repo) detects each project's stack and installs a stack-tailored `.claude/` skeleton.

## Roadmap

- Background-safe task scheduler that survives lid close
- Pluggable model providers (Codex / Gemini / OpenCode / Aider already wired in `app/api/run-task/route.ts`)
- Per-project graphify integration in the orchestrator's recommendation loop
