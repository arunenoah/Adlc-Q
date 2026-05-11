# /build — Implement from Intended Documentation

Implement a feature using the **senior-engineer** agent, following the spec in `intended.md`. Runs code review after implementation and presents results with next steps.

## Instructions

You MUST follow these steps in order:

### Step 1: Read the spec

Read `.claude/docs/intended.md` to understand what needs to be built.

If the file doesn't exist, tell the user to run `/plan` first.

### Step 2: Launch the senior-engineer agent

Use the **Task tool** with `subagent_type: "senior-engineer"` to launch the senior-engineer agent.

Pass it a prompt that includes:
1. The full contents of `intended.md`
2. Instruct it to implement every item in the **Implementation Checklist** (IMPL-1, IMPL-2, etc.)
3. Instruct it to satisfy every **Requirement** (REQ-1, REQ-2, etc.)
4. Instruct it to follow the **Technical Design** (create/modify the listed files)
5. Instruct it to consider **Security Considerations** (SEC-1, etc.)

If `$ARGUMENTS` is provided, pass it as additional context or constraints.

### Step 3: Code review

After the senior-engineer finishes, launch the **code-reviewer** agent using the **Task tool** with `subagent_type: "code-reviewer"`.

Pass it:
1. The list of files that were changed
2. The `intended.md` spec for context
3. Ask it to verify implementation matches the plan

### Step 4: Report and suggest next steps

Present a summary to the user:

```
## Build Results

### Implementation
- IMPL items completed: X/Y
- Files created: [list]
- Files modified: [list]

### Code Review
- Assessment: PASS / NEEDS CHANGES
- Critical issues: X
- High priority: X
- Suggestions: X

### Suggested Next Steps
→ Run `/test` to execute the test suite
→ Run `/drift` to compare plan vs actual implementation
→ Run `/commit` when everything passes
```

Do NOT auto-invoke `/test` or `/drift`. The user runs them manually when ready.
