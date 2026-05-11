# /pr-reviewer — PR Review with Human Approval + Auto-Post

Review a GitHub or Bitbucket PR using the code-reviewer agent, present findings in Plannotator for human approval, then post all approved comments and apply the PR decision via a background subagent.

**Usage:** `/pr-reviewer <PR_URL>`

---

## Instructions

You MUST follow these steps in order.

### Step 1 — Parse URL & Fetch Diff

Extract platform and identifiers from `$ARGUMENTS`:

| URL pattern | Platform | WORKSPACE/OWNER | REPO | PR_ID |
|---|---|---|---|---|
| `bitbucket.org/{w}/{r}/pull-requests/{id}` | Bitbucket | workspace | repo | id |
| `github.com/{o}/{r}/pull/{id}` | GitHub | owner | repo | id |

**Bitbucket — fetch metadata + diff:**
```bash
source ~/.bitbucket_env
curl -sL --user "$BITBUCKET_USERNAME:$BITBUCKET_APP_PASSWORD" \
  "https://api.bitbucket.org/2.0/repositories/{WORKSPACE}/{REPO}/pullrequests/{PR_ID}" \
  | jq '{title, state, author: .author.display_name, source: .source.branch.name, destination: .destination.branch.name}'

curl -sL --user "$BITBUCKET_USERNAME:$BITBUCKET_APP_PASSWORD" \
  "https://api.bitbucket.org/2.0/repositories/{WORKSPACE}/{REPO}/pullrequests/{PR_ID}/diff" \
  > /tmp/pr_{PR_ID}.diff

wc -l /tmp/pr_{PR_ID}.diff
```

**GitHub — fetch metadata + diff:**
```bash
gh pr view {PR_ID} --repo {OWNER}/{REPO} --json title,author,headRefName,baseRefName
gh pr diff {PR_ID} --repo {OWNER}/{REPO} > /tmp/pr_{PR_ID}.diff
```

If the diff is over 50,000 lines, warn the user and ask if they want to scope to specific directories.

---

### Step 2 — Spawn code-reviewer Subagent

Launch a `code-reviewer` subagent with this prompt:

```
Review the diff at /tmp/pr_{PR_ID}.diff.
PR: {TITLE} | {SOURCE} → {DEST} | Platform: {PLATFORM}
Stack: Yii2, PHP 7+, MySQL (detect from diff if different)

For EACH issue output exactly this format — no extra text:

FILE: <path or "General">
LINE: <line number or —>
SEVERITY: critical | warning | suggestion | nitpick
COMMENT: <max 3 sentences, specific and actionable>

Focus on:
- Dev tooling files committed (.continue/, .cursor/, .idea/, .vscode/)
- Do not commit MCP server configs or AI assistant configs
- Duplicate keys in PHP arrays (silently dead routes)
- Routes removed without module-level coverage → 404 regression
- save(false) bypassing validation on sensitive model fields
- Bare scheduler loops with no error handling or logging
- Session hacks / temp-fix comments shipped to production
- Wildcard composer version constraints (*)
- Duplicate constants in arrays
- Missing safeUp()/safeDown() in migrations
- Business logic in controllers instead of Services
- N+1 queries — missing ->with() eager loading
- Permission checks missing on bypass flags

Produce 6–12 focused, actionable comments. No filler or praise.
```

Collect the subagent output.

---

### Step 3 — Ask Decision (Buttons)

Use `AskUserQuestion` to show decision options as clickable buttons:

```
Question: "What decision do you want to apply to PR #{PR_ID}: {TITLE}?"
Header: "PR Decision"
Options:
  - "Request Changes" — Post comments and mark PR as Needs Work
  - "Approve"         — Post comments and approve PR for merge
  - "Decline"         — Post comments and close/reject the PR
  - "Comment Only"    — Post comments only, no status change
```

Store the chosen decision.

---

### Step 4 — Write Review File

Save to `.claude/pr-reviews/PR-{PR_ID}-review.md`:

```markdown
# PR Review: {TITLE}
**Platform:** {PLATFORM} | **PR:** #{PR_ID} | **{SOURCE} → {DEST}**
**Author:** {AUTHOR} | **Decision:** {DECISION} | **Reviewed:** {DATE}

---

## Proposed Comments

### Comment 1
**FILE:** `path/to/file`
**LINE:** 42
**SEVERITY:** critical
**COMMENT:**
> Comment text here

---

### Comment 2
...

---
```

No instructions section. No decision block. No template footer.

---

### Step 5 — Open Plannotator (BLOCKING)

```
Invoke: plannotator-annotate on .claude/pr-reviews/PR-{PR_ID}-review.md
```

Wait for Plannotator to return. Human deletes rejected blocks, edits comment text, adds new blocks.

---

### Step 6 — Parse Approved Comments

Re-read `.claude/pr-reviews/PR-{PR_ID}-review.md`. Extract all remaining `### Comment N` blocks. Build a structured list:

```
[
  { n: 1, file: "path/to/file", line: 42, severity: "critical", comment: "..." },
  { n: 2, file: "General", line: null, severity: "suggestion", comment: "..." },
  ...
]
```

---

### Step 7 — Spawn Posting Subagent (Background)

Launch a `general-purpose` subagent with ALL posting work. Pass it:
- The full approved comment list (file, line, comment text for each)
- Platform, WORKSPACE/OWNER, REPO, PR_ID
- Decision chosen
- Auth method (Bitbucket: `source ~/.bitbucket_env` / GitHub: `gh`)

The subagent must:

**For each comment — Bitbucket:**
```bash
source ~/.bitbucket_env
BASE="https://api.bitbucket.org/2.0/repositories/{WORKSPACE}/{REPO}/pullrequests/{PR_ID}/comments"

# Inline (has file + line number)
curl -s -o /tmp/bb_r.json -w "%{http_code}" -X POST \
  --user "$BITBUCKET_USERNAME:$BITBUCKET_APP_PASSWORD" \
  -H "Content-Type: application/json" "$BASE" \
  -d "$(jq -n --arg b "$COMMENT" --arg f "$FILE" --argjson l $LINE \
      '{"content":{"raw":$b},"inline":{"path":$f,"to":$l}}')"

# General (no file/line)
curl -s -o /tmp/bb_r.json -w "%{http_code}" -X POST \
  --user "$BITBUCKET_USERNAME:$BITBUCKET_APP_PASSWORD" \
  -H "Content-Type: application/json" "$BASE" \
  -d "$(jq -n --arg b "$COMMENT" '{"content":{"raw":$b}}')"
```

**For each comment — GitHub:**
```bash
# General
gh pr comment {PR_ID} --repo {OWNER}/{REPO} --body "$COMMENT"

# Inline
COMMIT=$(gh pr view {PR_ID} --repo {OWNER}/{REPO} --json headRefOid -q .headRefOid)
gh api repos/{OWNER}/{REPO}/pulls/{PR_ID}/comments \
  -f body="$COMMENT" -f commit_id="$COMMIT" \
  -f path="$FILE" -F line=$LINE -f side="RIGHT"
```

**Apply decision — Bitbucket:**
```bash
source ~/.bitbucket_env
BASE="https://api.bitbucket.org/2.0/repositories/{WORKSPACE}/{REPO}/pullrequests/{PR_ID}"

# Request Changes
curl -s -X POST --user "$BITBUCKET_USERNAME:$BITBUCKET_APP_PASSWORD" "$BASE/request-changes"

# Approve
curl -s -X POST --user "$BITBUCKET_USERNAME:$BITBUCKET_APP_PASSWORD" "$BASE/approve"

# Decline
curl -s -X POST --user "$BITBUCKET_USERNAME:$BITBUCKET_APP_PASSWORD" "$BASE/decline"
```

**Apply decision — GitHub:**
```bash
gh pr review {PR_ID} --repo {OWNER}/{REPO} --request-changes  # Request Changes
gh pr review {PR_ID} --repo {OWNER}/{REPO} --approve           # Approve
gh pr close {PR_ID} --repo {OWNER}/{REPO}                      # Decline
```

The subagent returns a result list: each comment with `✓ Posted` or `✗ Failed (HTTP code)`.

---

### Step 8 — Show Summary Table

After the posting subagent returns, display the final result to the user:

```
| # | File | Line | Severity | Status |
|---|------|------|----------|--------|
| 1 | routes.php | 91 | critical | ✓ Posted |
| 2 | General | — | suggestion | ✗ Failed (403) |

PR Decision: REQUEST CHANGES ✓
```

That is all the user sees — no raw curl commands in the conversation.
