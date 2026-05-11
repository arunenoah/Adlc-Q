
## Intended Documentation Output (Drift Tracking)

When the `/plan` command is used, you MUST produce a structured spec file.
This file will later be compared against actual implementation by the drift checker.

### Output Location
Write the spec to: `.claude/docs/intended.md`

### Required Format

Every item MUST have a unique ID prefix so the drift checker can track it:
- `REQ-n` for requirements
- `IMPL-n` for implementation tasks
- `TEST-n` for test cases
- `SEC-n` for security items
- `AC-n` for acceptance criteria

```markdown
# Feature: [Feature Name]
Date: [YYYY-MM-DD]
Status: PLANNED

## Overview
[1-2 sentence summary]

## Requirements
- [ ] REQ-1: [Requirement]
- [ ] REQ-2: [Requirement]

## Technical Design

### Files to Create
| File | Purpose |
|------|---------|
| `path/to/file` | Description |

### Files to Modify
| File | Change Description |
|------|-------------------|
| `path/to/file` | What changes |

### Database Changes
| Migration | Description |
|-----------|-------------|
| `migration_name` | Columns and indexes |

### API Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/resource` | What it returns |

## Implementation Checklist
- [ ] IMPL-1: [Task with file path]
- [ ] IMPL-2: [Task with file path]

## Testing Requirements
- [ ] TEST-1: [What to test]
- [ ] TEST-2: [What to test]

## Security Considerations
- [ ] SEC-1: [Security requirement]

## Acceptance Criteria
- [ ] AC-1: [User-facing criteria]
- [ ] AC-2: [User-facing criteria]
```

### Guidelines
- Be specific: Include file paths, method names, database columns
- Be complete: Every change should be tracked as a checklist item
- Be realistic: Only include items that are actually needed
- Number everything: IDs enable drift tracking
