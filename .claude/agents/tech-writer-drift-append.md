
## Drift Analysis Mode

When the `/drift` command is used, you perform drift analysis by comparing the
original plan (`intended.md`) against the actual implementation.

### Graph-First Protocol

Instead of brute-force git scanning and blind file reads, use the knowledge graph:
1. **Read the plan**: Read `.claude/docs/intended.md`
2. **Query graph for each IMPL-n**: For each implementation item (e.g., "ComplianceService class"), run `find_related_files('<ClassName>')` to locate the exact source_file
3. **Read targeted files**: Now read only the specific files returned by the graph query
4. **Compare implementation**: Check the file contents against the intended spec — is it there? Does it match?
5. **Check tests**: Query `find_related_files('<ClassName>')` filtered to `tests/` to find test coverage
6. **Document drift**: For each item, mark DONE / MISSING / DEVIATED with exact file:line references
7. **Calculate score**: Same as before

This replaces step 3 (`git log`/`git diff` scanning) with targeted graph queries.

### Process

1. **Read the plan**: Read `.claude/docs/intended.md`
2. **For each IMPL-n item**: Use graph-first approach above instead of blind git scanning
3. **Compare every item**: Check each REQ-n, IMPL-n, TEST-n, SEC-n, AC-n against reality
4. **Find unplanned work**: Check files changed beyond what was planned using git
5. **Calculate drift score**: `(completed_as_planned / total_planned) * 100`
6. **Write report**: Output to `.claude/docs/final.md`

### How to Verify Each Item Type

**REQ-n (Requirements)**:
- Search the codebase for evidence the requirement is satisfied
- Check if the feature described actually works as specified
- Mark DONE only if fully implemented, DEVIATED if partially or differently done

**IMPL-n (Implementation)**:
- Check if the specific file and code mentioned exists
- Verify the implementation matches what was planned
- Include `file:line` references as evidence

**TEST-n (Testing)**:
- Check if test files exist
- Verify test cases cover what was specified
- Check if tests pass

**SEC-n (Security)**:
- Verify security measures are in place (validation, auth, sanitization)
- Check for common vulnerabilities in the new code

**AC-n (Acceptance Criteria)**:
- Verify from a user perspective that the criteria is met
- Check UI/API responses match expected behavior

### Output Format: final.md

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
| `path/file` | Created ✅ | As planned |
| `path/other` | Missing ❌ | Not implemented |

### Unplanned Files Changed
| File | Change | Reason |
|------|--------|--------|
| `path/extra` | Modified | [why] |

## Missing Items
1. **[ID]**: [Description] — Impact: [High/Medium/Low]
   Recommendation: [What to do]

## Deviated Items
1. **[ID]**: Planned: [X]. Actual: [Y].
   Reason: [if apparent]

## Unplanned Additions
1. **EXTRA-1**: [Description] — [Why added]

## Recommendations
1. [Action items to close the gap]

## Sign-off
- Drift Score: X% (100% = perfect match)
- Assessment: PASS (>=90%) / REVIEW NEEDED (70-89%) / FAIL (<70%)
```

### Scoring Rules
- Each REQ, IMPL, TEST, SEC, AC counts as 1 planned item
- DONE = 1 point, DEVIATED = 0.5 points, MISSING = 0 points
- Drift Score = (total points / total items) * 100
- Unplanned additions don't reduce the score but are flagged for awareness
