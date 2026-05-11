# /drift — Drift Analysis (Intended vs Actual)

Compare the original plan against actual implementation using the **tech-lead** agent.

## Instructions

You MUST follow these steps in order:

### Step 1: Verify intended.md exists

Read `.claude/docs/intended.md`. If it doesn't exist, tell the user:
"No intended.md found. Run `/plan` first to create a development spec."

Extract the **feature name** from the first heading in `intended.md` (e.g., `# Approve Recommend Task` → `approve-recommend-task`). This becomes the filename prefix: `{feature-name}-drift.md`.

### Step 2: Gather actual implementation state

Run these commands to understand what was actually built:

```bash
git status
```

```bash
git log --oneline -20
```

```bash
git diff main...HEAD --stat
```

Also read every file listed in the intended.md "Files to Create" and "Files to Modify" tables to check if they exist and what they contain.

### Step 3: Launch the tech-lead agent for drift analysis

Use the **Task tool** with `subagent_type: "tech-lead"` to launch the tech-lead agent.

Pass it a prompt that includes:
1. The full contents of `.claude/docs/intended.md` (the plan)
2. The git diff stat and file list (what actually changed)
3. The contents of all files mentioned in the plan
4. Instruct it to compare EVERY checklist item against reality:
   - Each REQ-n: Was it fulfilled? Which file/code proves it?
   - Each IMPL-n: Was it implemented? Where exactly?
   - Each TEST-n: Does the test exist?
   - Each SEC-n: Was the security measure implemented?
   - Each AC-n: Is the acceptance criteria met?
5. Instruct it to look for unplanned changes (files changed that weren't in the plan)
6. Instruct it to produce a `{feature-name}-drift.md` in the exact format below

### Step 4: Write {feature-name}-drift.md

Write the tech-lead's output to `.claude/docs/{feature-name}-drift.md`.

Example: feature "Approve Recommend Task" → `.claude/docs/approve-recommend-task-drift.md`

### Step 5: Present the drift report

Show the user:
- The **Drift Summary** table (planned vs actual counts)
- The **Drift Score** (percentage)
- Any **MISSING** or **DEVIATED** items highlighted
- **Recommendations** for closing gaps

If drift score is:
- 90-100%: "PASS — Implementation matches the plan"
- 70-89%: "REVIEW NEEDED — Some items need attention"
- Below 70%: "FAIL — Significant drift from the plan"

---

## {feature-name}-drift.md Output Format

The tech-lead agent MUST produce output in this exact structure:

```markdown
# Drift Report: [Feature Name]
Date: [YYYY-MM-DD]
Intended Date: [from intended.md]
Status: COMPLETED / INCOMPLETE / DEVIATED

## Drift Summary
| Metric | Count |
|--------|-------|
| Total planned items | X |
| Completed as planned | X |
| Missing (not done) | X |
| Deviated (done differently) | X |
| Unplanned additions | X |
| **Drift Score** | **X%** |

## Requirements
- [x] REQ-1: Description — **DONE** — [evidence: file:line]
- [ ] REQ-2: Description — **MISSING** — [what's missing]
- [~] REQ-3: Description — **DEVIATED** — [how it differs]

## Implementation
- [x] IMPL-1: Description — **DONE** — `file:line`
- [ ] IMPL-2: Description — **MISSING**

## Testing
- [x] TEST-1: Description — **DONE** — `test/file:line`
- [ ] TEST-2: Description — **MISSING**

## Security
- [x] SEC-1: Description — **DONE**

## Acceptance Criteria
- [x] AC-1: Description — **DONE**

## Files Analysis

### Planned Files
| File | Status | Notes |
|------|--------|-------|
| `path/file.php` | Created ✅ | As planned |
| `path/other.php` | Missing ❌ | Not implemented |

### Unplanned Files Changed
| File | Change | Reason |
|------|--------|--------|
| `path/extra.php` | Modified | [why] |

## Missing Items
1. **[ID]**: [Description] — Impact: [High/Medium/Low]

## Deviated Items
1. **[ID]**: Planned: [X]. Actual: [Y]. Reason: [if known]

## Recommendations
1. [Action item to close gap]
2. [Follow-up task]

## Sign-off
- Drift Score: X%
- Assessment: PASS / REVIEW NEEDED / FAIL
```
