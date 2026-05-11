# /prompt — Refine a Vague Prompt (Yii2 project shortcut)

Refine a vague prompt into a structured, copy-ready format. This project-scoped variant pre-loads Yii2-specific context from the project's `CLAUDE.md` so the rewritten prompt's Context section is enriched without you having to repeat stack details.

The skill **proactively picks the right framework** — R.O.L.E. / C.O.T.O. / I.C.E. / F.E.W. / S.P.I.N. — based on signals in your draft.

**Usage:**
- `/prompt <draft>` — refine inline; skill picks framework
- `/prompt` (no args) — ask the user to paste the draft on the next turn
- `/prompt --target plan|build|test|drift|none <draft>` — shape for a downstream command
- `/prompt --framework role|coto|ice|few|spin <draft>` — force a specific framework

**Valid `--target` values for this project:** `plan` · `build` · `test` · `drift` · `none`

When auto-run fires, the skill routes to the Yii2-specific commands: `/yii2-plan`, `/yii2-build`, `/yii2-test`, `/yii2-drift`.

## Instructions

### Step 1 — Pre-load project context

Read `CLAUDE.md` from the project root and surface these Yii2-specific facts so the skill can fold them into the chosen framework's Context-equivalent section:

- **Stack:** Yii2 2.0+ Advanced template (backend / frontend / console / common), PHP 7.0+, MySQL
- **Models:** extend `\backend\models\AppModel` (audit-trail + UUID + lifecycle)
- **Validation:** scenario-based via `Model::rules()` (`SCENARIO_CREATE`, etc.) — defined in `common/config/main.php`
- **Authorization:** custom `AccessRule` (role weights, NOT stock RBAC); roles + user-types in `common/config/main.php`
- **XSS:** `TraitModel` trait applies `SecurityService::modelXssFilter()` in `beforeValidate()`; excluded fields in `EXCLUDE_XSS_FIELD` constant
- **Services:** stateless, in `backend/modules/{module}/services/`
- **Migrations:** `safeUp()` / `safeDown()` (transaction-safe), in `console/migrations/`
- **Tests:** Codeception (unit + functional) in `backend/tests/`
- **Logging:** `Yii::error()` / `Yii::info()` — never `var_dump()` / `print_r()` / `die()`
- **Knowledge graph:** `graphify-out/graph.json` is available for ripple-impact queries

Don't dump the entire `CLAUDE.md` — only fold facts that are directly relevant to what the user is asking about.

### Step 2 — Invoke the skill

```
Skill(skill: "improve-prompt", args: "$ARGUMENTS")
```

The skill handles the rest: framework picking + announcement, scoring, batched questioning, follow-ups, template rendering (R.O.L.E. / C.O.T.O. / I.C.E. / F.E.W. / S.P.I.N.), and auto-run routing to `/yii2-{target}`.

If `$ARGUMENTS` is empty, ask the user to paste their draft prompt and stop.

## Notes

- Auto-trigger fires (without explicit `/prompt`) when a user task prompt is missing 2+ of role / task / context / constraints / output format. See `~/.claude/skills/improve-prompt/SKILL.md` for the full activation rules and non-triggers.
- The skill detects stack from `composer.json` and routes to `/yii2-{target}` automatically when the user accepts auto-run.
- For Yii2 projects: debugging tasks → typically **C.O.T.O.**; module/persona work → **R.O.L.E.**; migration scripts / batch transforms → **I.C.E.**; classification (e.g. labelling tickets) → **F.E.W.**; architecture decisions (refactor, module split) → **S.P.I.N.**
