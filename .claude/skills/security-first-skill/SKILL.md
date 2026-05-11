---
name: security-first
description: MANDATORY pre-implementation security check for every feature/bug/refactor. Verifies injection, authn/authz, data exposure, secrets, and OWASP Top 10 risks BEFORE code is written or merged. Runs in two passes — pre-impl threat model, post-impl diff audit.
---

# Security-First Skill (mandatory pre-impl + post-impl)

## When to use this skill

Invoke **automatically** before AND after every:
- New feature (`/build`, "implement X", `feature` epic in DevOS)
- Bug fix (any `bug` epic, regression patch, hotfix)
- Refactor that touches request handlers, auth, DB queries, file I/O, or external API calls
- Dependency upgrade
- Any code that processes untrusted input (HTTP request, queue message, file upload, webhook)

If the user asks "is this safe?" or "review for security" — also use this skill.

You **must** invoke this skill if there is a 1% chance the change touches a security boundary. Refusing the check because "it's just a small fix" is the most common path to vulnerabilities reaching production.

## Two-pass protocol

### Pass 1 — Pre-implementation threat model (BEFORE writing code)

Required output (printed to stdout, not to a file):

```
## Security Pre-Check (pass 1)

### Trust Boundaries Crossed
- [list every boundary the change introduces or modifies: HTTP→app, app→DB, app→external API, app→filesystem, app→queue, browser→server, server→browser]

### Untrusted Inputs
- [every field/source the change reads from an untrusted side, with type + max size + allowed character set]

### Threat Categories to Verify
For each category below, write either "N/A — <reason>" or "MUST VERIFY — <approach>":
- SQL/NoSQL injection
- OS command injection
- Cross-site scripting (XSS) — reflected, stored, DOM
- CSRF (state-changing endpoints)
- IDOR / broken object-level authz
- Broken function-level authz (missing role/permission check)
- Authentication bypass / weak session handling
- SSRF (server-makes-outbound-request based on user input)
- Path traversal / arbitrary file read or write
- Open redirect
- XXE / unsafe deserialization
- Mass assignment
- Sensitive data exposure (PII in logs, error messages, API responses)
- Secrets leakage (.env, API keys, tokens in code/logs/error pages)
- Unsafe file upload (type, size, extension, storage path)
- Rate limiting / brute-force exposure
- Race condition / TOCTOU on auth or balance changes
- Cache poisoning / key collision
- Dependency vulnerabilities (newly added deps)

### Required Controls
For each MUST-VERIFY item: name the exact control + where it will be enforced (e.g. "FormRequest::rules() with explicit allow-list", "Eloquent parameterized binding", "Policy::view() check before returning record", "json_encode + escape in Blade").

### Implementation Constraints (BINDING on the engineer)
- Inputs must be validated at the OUTER boundary (controller / route handler / queue consumer), never trusted from inner layers.
- All DB writes via parameterized API (Eloquent / query builder / prepared statement). Never string-concat SQL.
- All shell calls via array-arg form (`Process::run(['cmd', $arg])`), never `shell_exec`/`exec`/`system` with concatenated string.
- All file paths derived from user input must be validated against an allow-list AND realpath-checked to be inside an allowed root.
- All outbound HTTP from user input must validate scheme + host against an allow-list (no SSRF).
- All authz checks happen at the entry point (Policy/Gate/middleware) AND at any privileged action.
- No secrets in code. `config()` only — never `env()` outside `config/*.php`. Never log tokens, passwords, or full PII.
- Mass-assignment guarded by `$fillable` (Eloquent) or explicit DTO mapping.

### Pre-Check Verdict
- READY TO IMPLEMENT — all controls identified
- BLOCKED — missing/unsafe pattern: <list>
```

If verdict is BLOCKED, the engineer must NOT proceed until the design is fixed.

### Pass 2 — Post-implementation diff audit (AFTER code is written, BEFORE commit)

Required output (printed to stdout):

```
## Security Post-Check (pass 2)

### Files Reviewed (with line ranges)
- path:start-end — what was checked

### Pre-Check Items — Verification
For every MUST-VERIFY item from pass 1:
- Item — VERIFIED at path:line — control: <what was actually shipped> — quote 2-line evidence

### New Findings (not predicted in pass 1)
- [BLOCKER|HIGH|MEDIUM|LOW] path:line — vulnerability class — concrete exploit scenario — required fix

### Negative Tests Run
- Test name — input — expected (rejected) — actual (rejected? quoted response)

### Post-Check Verdict
- APPROVED — safe to commit
- NEEDS FIX — list of required changes (BLOCKER/HIGH must be fixed; MEDIUM/LOW logged as follow-ups)
```

## Stack-specific quick references

### PHP / Laravel
- DB: Eloquent or Query Builder; never `DB::raw()` with user input.
- Validation: FormRequest with explicit `rules()` + `authorize()`. Don't trust `$request->all()`.
- Authz: Policies + Gates. Apply via `authorize()` in controller OR `can` middleware.
- Output: Blade `{{ $x }}` (auto-escapes). Never `{!! $x !!}` with user data unless sanitised by HTMLPurifier.
- Mass assignment: `$fillable` set on every model. Or use `$guarded = ['*']` + explicit `fill()`.
- Files: `Storage::disk()` + UUID filenames; never user-supplied paths. Validate MIME server-side, not by extension.
- Secrets: `config('services.x.key')`, never `env()` at runtime. `.env` not in git.
- Shell: `Symfony\Process` array-form. Never `shell_exec(\"$x\")`.
- Sessions: `regenerate()` after login + `invalidate()` after logout.

### PHP / Yii2
- DB: ActiveRecord or `createCommand()->bindValues()`. Never raw SQL with concat.
- Authz: RBAC via `Yii::$app->user->can()` at entry + privileged action.
- Output: Blade-equivalent — use `Html::encode()` always; `HtmlPurifier::process()` for rich text.
- CSRF: `Yii::$app->request->csrfToken` enforced; only disable for stateless API endpoints.
- Files: `\\yii\\web\\UploadedFile` with allow-list of extensions + MIME validation.

### Next.js / React / TypeScript
- Server actions / route handlers: validate input with Zod at the entry. No trust on `request.body`.
- DB: Prisma / Drizzle / parameterized client; never string interpolation.
- XSS: React auto-escapes JSX. Danger: `dangerouslySetInnerHTML` (audit every use), unsanitized `<a href={user}>` (validate scheme), `<iframe src={user}>`.
- Auth: every server action that mutates must call `getSession()` + authz check. Cookies: `httpOnly`, `secure`, `sameSite: 'lax'` minimum.
- Secrets: server-only env. NEVER prefix secrets with `NEXT_PUBLIC_`.
- File-system access from server actions: sandbox to allowed root via `path.resolve` + prefix check (see `isInsideApplication` pattern in DevOS).
- Streaming/SSE: terminate on client abort, cap timeout, sanitise data fed back.

### Node.js (general)
- Validate at every boundary with Zod / Joi / class-validator.
- `child_process`: prefer `spawn(cmd, [...args])` over `exec` / `execSync`.
- `fs`: validate path inside allowed root before any read/write.
- `JSON.parse`: wrap in try/catch; cap input size before parsing.
- HTTP outbound: allow-list of hostnames; reject private IP ranges (SSRF).

### React Native / mobile
- Secrets in Keychain / Keystore — never AsyncStorage or plain `SecureStore` for tokens.
- Deep links: validate URL scheme + host before acting.
- WebView: disable JavaScript bridge unless required; sanitise injected JS.
- Certificate pinning for sensitive APIs.
- Biometric prompts: validate the OS attestation, not just the boolean result.

### Flutter
- Secure storage: `flutter_secure_storage`; not `shared_preferences`.
- Deep links / app links: validate scheme + signature.
- HTTP: certificate pinning for sensitive endpoints.
- WebView: disable JS unless needed; same-origin policy enforced.

### Generic / language-agnostic
- All untrusted input is hostile until proven otherwise.
- Default-deny on authorization. Allow-list, never deny-list.
- Fail closed on errors — never expose stack traces, query strings, or internal paths to the client.
- Logging: redact tokens, passwords, full PII. Hash + truncate identifiers.
- Dependency upgrades: check the changelog for security advisories; run a SCA tool (npm audit / composer audit / snyk) before merge.

## Hard rules (no exceptions)

1. Never disable a security hook (`--no-verify`, `--no-gpg-sign`) unless the user explicitly asks.
2. Never commit `.env`, credentials, API keys, private keys, or files matching `*.pem`, `*.key`, `id_rsa*`.
3. Never log full tokens, passwords, or full PII. Use last-4 / SHA-256 prefix when an identifier is needed in logs.
4. Never bypass an existing auth check "temporarily for debugging" without a TODO + revert plan.
5. Never use `eval`, `exec` with shell-string, `pickle.load` on untrusted, `unserialize` on untrusted, raw `innerHTML` on untrusted.
6. Always run pass 2 before declaring a task complete. The post-check verdict is the gate to commit.
7. If unsure, ESCALATE — print "SECURITY UNCERTAIN — needs human review" rather than guess.

## Integration points

- Pre-commit hook `check-secrets.sh` (already wired via `.claude/settings.json` PreToolUse) blocks raw secrets in any `git commit`/`git push`. This skill is broader — it covers logic, not just literal strings.
- `security-audit-skill` (per-project) is the deeper code-review variant; this `security-first` skill is the gate that decides whether `security-audit-skill` is required for the change.
- The DevOS workflow runs this skill via the `secpre` task before `impl-be`/`impl-fe`, and again as part of `sec` after impl.
