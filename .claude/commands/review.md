# /review — Code Review with code-reviewer Agent

Perform a thorough code review using the **code-reviewer** agent on recent changes.

## Instructions

You MUST follow these steps in order:

### Step 1: Gather the changes to review

Run these commands to understand what needs reviewing:

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
git log --oneline -10
```

If on a feature branch (not `main` or `staging`), also get the full branch diff:
```bash
git diff main...HEAD
```

If `$ARGUMENTS` contains a file path, focus the review on that file.
If `$ARGUMENTS` contains a PR number, use `gh pr diff <number>` to get the diff.

### Step 2: Launch the code-reviewer agent

Use the **Task tool** with `subagent_type: "code-reviewer"` to launch the code-reviewer agent.

Pass it a prompt that includes:
1. The list of changed files
2. The full diff content
3. Ask it to review against the project's Laravel standards:
   - Business logic in Services, not Controllers
   - Form Requests for validation
   - Eager loading (no N+1 queries)
   - Proper error handling with logging
   - TextSanitizationHelper for FLK placeholder values
   - Authorization via Policies or middleware
   - No hardcoded credentials or secrets
   - Consistent API response format
   - Database transactions for multi-table operations
   - Security: SQL injection, XSS, mass assignment protection

### Step 3: Present results

After the code-reviewer agent returns, present the findings to the user in this format:

```
## Code Review Results

### Critical Issues (Must Fix)
- [file:line] Description of issue and fix

### High Priority
- [file:line] Description

### Suggestions
- [file:line] Description

### Summary
- Files reviewed: X
- Issues found: X critical, X high, X suggestions
- Overall assessment: PASS / NEEDS CHANGES
```

If the user asks to fix issues, apply the fixes directly.
