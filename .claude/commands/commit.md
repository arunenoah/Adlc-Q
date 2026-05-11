# /commit — Standardized Commit Workflow

Create a well-structured commit with automatic secret detection.

## Instructions

You MUST follow these steps in order:

### Step 1: Review current state

Run these commands in parallel to understand what's changed:

```bash
git status
```

```bash
git diff --cached
```

```bash
git diff
```

```bash
git log --oneline -5
```

### Step 2: Stage files if needed

- If nothing is staged but there are modified files, suggest which files to stage and ask the user.
- Never stage `.env` files, credentials, or secret files.
- Prefer staging specific files by name over `git add .`

### Step 3: Analyze and draft commit message

Review all staged changes (both previously staged and newly added) and draft a commit message:

- Use conventional commit format:
  - `feat:` new features
  - `fix:` bug fixes
  - `refactor:` code restructuring
  - `chore:` maintenance tasks
  - `docs:` documentation changes
  - `test:` test additions/changes
- Keep subject line under 72 characters
- Focus on the "why" not the "what"
- Add body with details if the change is complex
- Match the style of recent commits from git log

### Step 4: Create the commit

Run `git commit` with the drafted message.

**The secret-detection hook (`check-secrets.sh`) runs automatically** on every `git commit` and `git push` via Claude Code's PreToolUse hook. If secrets are detected, the commit will be blocked with details of which files contain secrets. Fix those files and retry.

If `$ARGUMENTS` is provided, use it as the commit message instead of drafting one.

### Step 5: Verify

Run `git status` after the commit to confirm success.

Do NOT push to remote unless the user explicitly asks.
