---
name: senior-engineer-nextjs-skill
description: Next.js 16 + React 19 + TypeScript implementation standards with App Router, Server Actions, strict typing, and React Query patterns
---

# Senior Engineer Next.js Implementation Skill

## Graph-First Protocol (MANDATORY — Run Before Implementing Any Module)

Before writing any new component, hook, or server action, find existing patterns in the graph. Avoid reinventing patterns that already exist.

```python
import json
from pathlib import Path
from networkx.readwrite import json_graph
import networkx as nx

G = json_graph.node_link_graph(
    json.loads(Path('graphify-out/graph.json').read_text()), edges='links'
)

def find_related_files(term: str, depth: int = 2) -> list[str]:
    matches = [(n, d['label']) for n, d in G.nodes(data=True)
               if term.lower() in d.get('label', '').lower()]
    if not matches:
        return []
    related = list(nx.bfs_tree(G, matches[0][0], depth_limit=depth).nodes())
    return sorted(set(G.nodes[n]['source_file'] for n in related if 'source_file' in G.nodes[n]))
```

**Steps:**
1. Query by the symbol you're implementing (e.g., `find_related_files('FeatureWizard')`)
2. Read similar component/action files returned — understand naming, structure, patterns
3. Check if the symbol already exists before creating it
4. Implement following the patterns you found — no guessing at conventions

---

## Implementation Workflow

1. Read `[feature-name].md` thoroughly — understand all requirements before coding
2. Query graph to find existing similar components/actions — follow established patterns
3. Define types in `lib/types.ts` — single source of truth for shared shapes
4. Implement server action in `app/actions.ts` (or scoped file) — `"use server"` directive
5. Implement client component — functional component with hooks, typed props
6. Wire up state — React Query for server state, `useState`/`useReducer` for local
7. Write tests — Vitest/Jest + React Testing Library
8. Run quality checklist — before submitting to code-reviewer

---

## MANDATORY Rules (No Exceptions)

- TypeScript `strict: true` in `tsconfig.json` — no `any` without justification comment
- Functional components only — no class components
- App Router conventions — `app/` directory, `page.tsx`, `layout.tsx`, `route.ts`
- Server Actions for mutations — `"use server"` at top of file or function
- Client components opt-in — `"use client"` only when interactivity required
- Typed props — explicit `Props` interface, no implicit `any`
- React Query (`@tanstack/react-query`) for server-state fetching/caching — no ad-hoc `useEffect+fetch`
- Hooks at top of component, never conditional
- Zod (or similar) for runtime validation at boundaries (API routes, server actions input)
- Stable references via `useMemo`/`useCallback` for props passed into memoized children
- Error boundaries around async/data-loading subtrees
- Env access only via `process.env.X` in server code; never expose secrets to client (use `NEXT_PUBLIC_` prefix only for public values)
- No `console.log` in committed code — use a logger or structured `console.error` with context
- File-system writes go through guard like `isInsideApplication(target)` — never trust caller paths

---

## Code Quality Checklist (Before Submitting to Code-Reviewer)

- [ ] All new files have explicit types (props, return values, action params)
- [ ] No `any` without a `// eslint-disable-next-line` + justification
- [ ] Server actions validated at entry (Zod or manual guard)
- [ ] Client components marked `"use client"` only when needed
- [ ] No secrets in client bundle (grep `NEXT_PUBLIC_` usage)
- [ ] React Query keys are stable + namespaced (e.g., `['epics', projectId]`)
- [ ] No N+1 fetches in `useEffect` — batch via React Query or server action
- [ ] Lists use stable `key` (id, not index)
- [ ] Async errors caught + surfaced to UI (toast, error boundary)
- [ ] `revalidatePath`/`revalidateTag` called after mutations
- [ ] Tailwind classes — no inline styles unless dynamic
- [ ] Tests cover happy path + one error case
- [ ] `npm run build` passes (catches type + lint errors)

---

## Key Reminders

- TypeScript strict mode is mandatory — no escapes
- Server actions own all mutations — client components dispatch only
- React Query owns server state — no parallel `useState` mirrors
- Validate input at the server-action boundary — trust nothing from the client
- Stream long-running work via SSE (`ReadableStream`) — never block a server action for >5s
- Sandbox file-system writes — verify path is inside the allowed root before any `fs` call
