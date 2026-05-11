# DevOS Stack — Read Before Adapting Imported Agents/Skills

DevOS is **Next.js 16 + React 19 + TypeScript (strict)**. The agents, skills, and commands in `.claude/` were imported from `ps3-portfolio` (Yii2 / PHP). Most are role/process-based and apply unchanged. PHP-specific guidance must be translated.

## Already Adapted

- `agents/senior-engineer.md` — rewritten for Next.js/TS
- `skills/senior-engineer-nextjs-skill/` — Next.js implementation skill (renamed from `senior-engineer-laravel-skill`)
- `agents/references/yii2-patterns.md` and `laravel-patterns.md` — **deleted** (not applicable)

## Translation Cheat Sheet

| PHP/Yii2 phrase                          | DevOS equivalent                                    |
|------------------------------------------|-----------------------------------------------------|
| `declare(strict_types=1);`               | `tsconfig.json` `strict: true`                       |
| ActiveRecord model                        | Server action + typed DTO in `lib/types.ts`         |
| Service class (composition)               | Function module / server action                      |
| Controller                                | Route handler `app/api/.../route.ts` or server action|
| Codeception feature/unit tests            | Vitest/Jest + React Testing Library                  |
| `Yii::info/error()`                       | Structured `console.error` with context             |
| `Yii::$app->db->beginTransaction()`       | Wrap multi-step DB ops in a transactional client API |
| PHPDoc `@param @return @throws`           | TypeScript types + JSDoc for non-obvious-why         |
| UUID via `UuidBehavior`                   | `crypto.randomUUID()` at the boundary                |
| `with()` eager-load                       | Single batched fetch / React Query `select`          |

## Code Quality Gates (DevOS)

- TypeScript `strict: true`, no `any` without justification
- Server actions validated at entry (Zod / manual guard)
- `"use client"` only when interactivity required
- React Query for server state — no ad-hoc `useEffect+fetch`
- No secrets in client bundle (`NEXT_PUBLIC_` prefix only for public values)
- Sandbox file-system writes via `isInsideApplication(target)` (see `app/api/run-task/route.ts`)
- `npm run build` must pass before submitting to code-reviewer
