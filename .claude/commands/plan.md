# /plan — Create Intended Documentation

Design a feature spec using the **tech-lead** agent and produce a structured `intended.md`. After user approval, automatically chains to `/build` to start implementation.

## Instructions

You MUST follow these steps in order:

### Step 1: Understand the requirement

The user's feature request is: `$ARGUMENTS`

If `$ARGUMENTS` is empty, ask the user what feature they want to plan.

### Step 2: Launch the tech-lead agent

Use the **Task tool** with `subagent_type: "tech-lead"` to launch the tech-lead agent.

Pass it a prompt that includes:
1. The feature requirement from `$ARGUMENTS`
2. Ask it to explore the existing codebase to understand architecture and patterns
3. Ask it to produce a structured plan following the **Intended Documentation Format** below

### Step 3: Tech-writer validation

Launch the **tech-writer** agent using the **Task tool** with `subagent_type: "tech-lead"` (tech-writer agent).

Pass it:
1. The tech-lead's planned output/specification
2. Instruct it to validate:
   - All requirements (REQ-*) are clear and unambiguous
   - Technical design section is complete and detailed
   - Implementation checklist is specific and actionable
   - Testing requirements are comprehensive
   - Security considerations are adequate
   - Acceptance criteria are verifiable
   - No gaps or unclear language
   - Documentation follows standards and best practices

Wait for tech-writer to provide:
- Validation report (PASS/NEEDS REVISION)
- Any clarifications or improvements needed
- Suggestions for documentation enhancement

If NEEDS REVISION: Request tech-lead make updates, then re-validate with tech-writer.

### Step 4: Create intended.md

After tech-writer validates the plan, write the structured output to `.claude/docs/intended.md`.

### Step 5: Present for approval with plannotator-annotate

Automatically invoke plannotator-annotate to open the intended.md file for interactive review:

```
Skill(skill: "plannotator-annotate", args: ".claude/docs/intended.md")
```

This provides an interactive browser-based review interface where the user can:
- View the full specification
- Add annotations and comments
- Approve without changes
- Request modifications inline

Wait for user to complete their review in plannotator before proceeding.

### Step 6: Handle plannotator feedback and chain to /build

After the user completes their review in plannotator:

1. **If user approves without changes** (plannotator shows "Resolved: no feedback"):
   - Immediately invoke `Skill(skill: "build")` to start the full implementation pipeline
   - This will automatically chain through: implementation → code review → testing → drift analysis → combined report

2. **If user requests modifications** (plannotator shows annotations/comments):
   - Read and apply all requested changes to `.claude/docs/intended.md`
   - Re-invoke plannotator-annotate with the updated file: `Skill(skill: "plannotator-annotate", args: ".claude/docs/intended.md")`
   - Wait for user to review changes again
   - Only chain to `/build` after user approves the revised plan

3. **If user declines auto-build** (user explicitly states in plannotator or follow-up message):
   - Respect the instruction and do NOT chain to `/build`
   - End the workflow after saving `intended.md`
   - Remind the user they can run `/build` later when ready

---

## Intended Documentation Format

The tech-lead agent MUST produce output in this exact structure:

```markdown
# Feature: [Feature Name]
Date: [YYYY-MM-DD]
Status: PLANNED

## Overview
[1-2 sentence summary of what this feature does and why]

## Requirements
- [ ] REQ-1: [Clear requirement description]
- [ ] REQ-2: [Clear requirement description]
- [ ] REQ-3: [Clear requirement description]

## Technical Design

### Files to Create
| File | Purpose |
|------|---------|
| `path/to/file.php` | Description |

### Files to Modify
| File | Change Description |
|------|-------------------|
| `path/to/existing.php` | What changes and why |

### Database Changes (if applicable)
| Migration | Description |
|-----------|-------------|
| `create_xyz_table` | Columns, types, indexes |

### API Endpoints (if applicable)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/resource` | What it returns |

## Implementation Checklist
- [ ] IMPL-1: [Specific implementation task with file path]
- [ ] IMPL-2: [Specific implementation task with file path]
- [ ] IMPL-3: [Specific implementation task with file path]

## Testing Requirements
- [ ] TEST-1: [Test case — what to test and expected result]
- [ ] TEST-2: [Test case — what to test and expected result]

## Security Considerations
- [ ] SEC-1: [Security requirement — validation, auth, etc.]

## Acceptance Criteria
- [ ] AC-1: [User-facing acceptance criteria]
- [ ] AC-2: [User-facing acceptance criteria]
```

Every item MUST have a unique ID prefix (REQ-1, IMPL-1, TEST-1, SEC-1, AC-1) so the drift checker can track each one individually.
