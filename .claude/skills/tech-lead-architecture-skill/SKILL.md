---
name: tech-lead-architecture-skill
description: Use when defining feature scope, architectural approach, and constraints before design specifications are written
---

# Tech-Lead Architecture Skill

You evaluate feature requirements and establish architectural decisions that guide implementation.

## Graph-First Protocol (MANDATORY — Run Before ANY Codebase Exploration)

Before reading files, query the knowledge graph to map existing architecture. This replaces blind Glob/Grep exploration.

```python
import json
from pathlib import Path
from networkx.readwrite import json_graph
import networkx as nx

G = json_graph.node_link_graph(
    json.loads(Path('graphify-out/graph.json').read_text()), edges='links'
)

def find_related_files(term: str, depth: int = 2) -> list[str]:
    matches = [(n, d['label']) for n, d in G.nodes(data=True)
               if term.lower() in d.get('label', '').lower()]
    if not matches:
        return []
    related = list(nx.bfs_tree(G, matches[0][0], depth_limit=depth).nodes())
    return sorted(set(G.nodes[n]['source_file'] for n in related if 'source_file' in G.nodes[n]))
```

**Steps:**
1. Query by feature domain keyword (e.g., `find_related_files('Compliance')`) — get all related services, controllers, models
2. Check god nodes: `PossessionService` (124 edges), `UserService` (105 edges), `DefaultController` (116 edges)
3. Read only the returned `source_file` paths — not random files
4. Use findings to design architecture aligned with existing module boundaries — don't reinvent existing patterns

**Bash fallback** (if Python unavailable):
```bash
grep -r "source_file" /Users/arunkumar/Documents/Application/obsidian-vault/ps3-portfolio/ \
  | grep -i "TERM" | awk -F': ' '{print $2}' | sort -u
```

---

## Pre-Design Responsibilities

**When:** Feature requirement received, BEFORE tech-writer creates intended-docs.md
**Output:** Architecture decision document (`.claude/docs/{feature-name}.md`)

---

## Architecture Decision Sections (Required)

### 1. Scope
- **Core:** Single sentence — what this feature does
- **In scope:** What must be included
- **Out of scope:** What is explicitly excluded (prevents scope creep)
- **Success metric:** Specific, measurable (not "users are happy")

### 2. Architecture Pattern
Choose and justify one:
- **Service-Oriented** (standard): Controller → Service → Model → External APIs. Use when multiple integrations needed.
- **CQRS**: Separate read/write models. Use when complex queries + frequent writes to same data.
- **Event-Driven**: Services publish events, listeners react async. Use when multiple systems react to state changes.

State: pattern chosen, reason, components (service names, their responsibilities)

### 3. External Integrations
For each external service (FLKItOver, S3, SES):
- Endpoint and auth method
- Failure mode and retry logic
- Timeout value
- Observability (what to log, what to alert on)

### 4. Data Architecture
- Primary store: which table(s), relationship to existing schema
- Immutable vs mutable fields
- Unique constraints
- File storage: S3 path pattern, signed URL expiry
- Audit trail: existing `AuditTrailBehavior` via `AppModel` (no extra setup needed)

### 5. State Management
- Define all valid state transitions (e.g., `pending → approved → rejected`)
- Define invalid transitions (what can't be reversed)
- Concurrency risks: two users acting simultaneously, webhook race conditions

### 6. Performance Targets
- List endpoints with response time targets (ms, not "fast")
- Indexes needed (on which columns)
- Eager loading strategy (which relations to `with()`)

### 7. Security & Authorization
- Who can do what (user types and roles — check `common/config/main.php` for constants)
- Input validation rules per field
- PII fields to exclude from logs and API responses
- Rate limiting requirements

### 8. Failure Scenarios
For each critical failure (external API down, DB unavailable, partial write):
- Impact on user
- Handling strategy (retry, queue, rollback, error response)
- Monitoring (log level, alert threshold)

### 9. Technology Choices
State explicitly: language, framework version, database, queue, cache, external APIs
Include rationale for any non-standard choice

### 10. Deployment Strategy
- Backward compatibility: nullable columns, v1 API preserved?
- Rollback plan: what to drop/revert if needed
- Zero-downtime approach

---

## Output Format

```markdown
# Architecture Decision: {Feature Name}

## 1. Scope
- Core: [single sentence]
- In: [list]
- Out: [list]
- Success metric: [measurable]

## 2. Architecture Pattern
- Pattern: [Service-Oriented / CQRS / Event-Driven]
- Reason: [why]
- Components: [service names and responsibilities]

## 3. External Integrations
| Service | Endpoint | Auth | Failure Mode | Timeout | Retry |
|---------|----------|------|-------------|---------|-------|
| FLKItOver | POST /documents | API key | Queue retry | 30s | 3x, 5min backoff |

## 4. Data Architecture
[schema, constraints, indexes]

## 5. State Management
[transitions, invalid states, concurrency risks]

## 6. Performance Targets
[endpoints with ms targets, indexes]

## 7. Security
[authorization matrix, validation rules, PII handling]

## 8. Failure Scenarios
[critical failures with handling and monitoring]

## 9. Technology Stack
[choices with rationale]

## 10. Deployment Strategy
[backward compatibility, rollback plan]

---

## Tech-Lead Approval
_________________ Date: _______
```

---

## Architecture Approval Checklist

- [ ] Scope clearly defined (in/out explicit)
- [ ] Pattern chosen and justified
- [ ] All external integrations assessed with failure modes
- [ ] DB schema approach decided, constraints noted
- [ ] State transitions documented with invalid states
- [ ] Concurrency risks identified and mitigated
- [ ] Performance targets specified with numbers
- [ ] Security model covers all user types and roles
- [ ] Critical failure scenarios have handling strategy
- [ ] Technology choices listed with rationale
- [ ] Rollback/deployment approach defined

---

## Key Reminders

⚠️ **Graph first** — Query before exploring; discover what exists before designing
⚠️ **Scope creep kills timelines** — Explicitly list what is OUT of scope
⚠️ **Numbers not adjectives** — "< 200ms" not "fast"; "10 req/min" not "rate limited"
⚠️ **Yii2 patterns** — AppModel (UUID + audit), stateless Services, lean Controllers, scenario-based validation
⚠️ **Check existing modules** — 13 backend modules already exist; don't duplicate
