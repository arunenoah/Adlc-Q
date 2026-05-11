# /test — Playwright QA Pipeline

End-to-end QA workflow: detect what changed in git, write any missing Playwright tests, run them, generate a PM report, and compare results against the intended spec.

**Arguments:** `$ARGUMENTS` (optional — a spec file pattern to scope the run, e.g. `compliance` or `tests/compliance-category-dashboard.spec.ts`)

---

## Step 1 — Detect recent changes

Run the URL mapper to find what changed and which pages to test:

```bash
bash ~/.claude/skills/playwright-git-qa/url-mapper.sh http://localhost:8080
```

Also read the git log to understand what was built:

```bash
git log --oneline -10
git diff HEAD~3 --stat
```

Identify:
- Which modules/features were changed
- Which URLs need testing
- Whether a matching `tests/*.spec.ts` file already exists

---

## Step 2 — Check for missing tests

For each URL identified in Step 1, check if a spec file covers it:

```bash
ls tests/
```

If `$ARGUMENTS` is provided, scope to that spec file/pattern.  
If no spec exists for a changed URL, **write one now** using the patterns from `~/.claude/skills/playwright-git-qa/SKILL.md`.

### Test writing rules
- Name the file `tests/{module}-{feature}.spec.ts`
- Import `dotenv` and load `.env.test`
- Use `gotoDashboard()` / `ensureLoggedIn()` helpers (copy from `tests/compliance-category-dashboard.spec.ts`)
- Add `testInfo.annotations` with Feature, User Story, Acceptance for every test
- Call `snap(page, testInfo, 'label')` at each key assertion point
- Group tests in `test.describe('Feature: ...')` blocks
- Check if a `.claude/docs/*-intended.md` exists for this feature — use it to derive test cases from REQ-*/AC-*/TEST-* items

---

## Step 3 — Ensure auth is set up

Check that credentials exist:

```bash
cat .env.test 2>/dev/null | grep -c TEST_USER
```

If output is `0`, tell the user:
```
Run: npm run auth:setup
```
and stop. Otherwise continue.

Also confirm the auth session file exists:

```bash
ls tests/.auth/user.json 2>/dev/null && echo "exists" || echo "missing"
```

If missing, run auth setup automatically:

```bash
BASE_URL=$(grep BASE_URL .env.test | cut -d= -f2) \
TEST_USER=$(grep TEST_USER .env.test | cut -d= -f2) \
TEST_PASS=$(grep TEST_PASS .env.test | cut -d= -f2) \
npx playwright test tests/auth.setup.ts --reporter=list
```

---

## Step 4 — Run Playwright tests

If `$ARGUMENTS` is provided and matches a spec file:
```bash
npx playwright test $ARGUMENTS --reporter=list
```

Otherwise run all tests:
```bash
npx playwright test --reporter=list
```

Capture exit code. If tests fail:
- Read the error lines (test name + error message only — no full HTML)
- Fix the failing assertion or selector
- Re-run once (max 2 cycles before stopping and reporting the failure)

---

## Step 5 — Generate PM report

```bash
node scripts/generate-pm-report.js
```

This writes `qa-report/QA-REPORT.md` — a PM-readable pass/fail table with user stories, git branch, and a sign-off table.

---

## Step 6 — Check requirement coverage

Find the relevant intended doc:

```bash
ls .claude/docs/*-intended.md 2>/dev/null
```

If one exists, run the coverage checker:

```bash
node scripts/review-against-intended.js .claude/docs/<feature>-intended.md
```

This writes `qa-report/<feature>-coverage.md` showing which REQ-*/AC-*/TEST-*/SEC-* items are:
- ✅ Covered by a Playwright test
- ➕ Need a new test written
- 🔍 Not browser-testable (code review only)

---

## Step 7 — Present results to the lead

Show the following summary inline:

### Test Results
```
Total: X  |  Passed: X  |  Failed: X  |  Duration: Xs
```

### Changed Files → URLs Tested
| File changed | URL tested | Spec file |
|---|---|---|
| (from Step 1) | (mapped URL) | (tests/*.spec.ts) |

### Requirement Coverage
Paste the coverage table from `qa-report/<feature>-coverage.md`.

### PM Report location
```
qa-report/QA-REPORT.md     — full pass/fail report for PM sign-off
qa-report/*-coverage.md    — requirement traceability for tech lead review
playwright-report/         — HTML report with screenshots (run: npm run test:view)
```

### Drift check
If a `.claude/docs/<feature>-intended.md` exists, ask the user:
> "Tests complete. Run `/drift` to compare the full implementation against the intended spec?"

---

## Notes

- **Framework:** Yii2 — login at `/user/default/login`, not `/site/login`
- **Workers:** Always `workers: 1` (Yii2 sessions are stateful)
- **Session handling:** `clearCookies()` before login in `auth.setup.ts`; `ensureLoggedIn()` helper in each spec for session recovery
- **Screenshots:** `snap(page, testInfo, 'label')` at each assertion — visible in HTML report per test
- **No Codeception** — Playwright only for browser-level tests
- **Auth credentials:** Stored in `.env.test` (gitignored). Set via `npm run auth:setup`
