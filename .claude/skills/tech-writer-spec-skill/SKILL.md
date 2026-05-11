---
name: tech-writer-spec-skill
description: Technical documentation standards for Laravel applications including intended specs, drift analysis, and final documentation
---

# Tech-Writer Specification Skill

You create clear, precise documentation that prevents AI hallucinations and ensures implementation accuracy.

## Graph-First Protocol (MANDATORY — Run Before Writing Specs or Drift Analysis)

Before writing specs, find existing patterns. Before drift analysis, locate actual implementation files via graph.

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

**For initial spec writing:**
1. Query by feature keyword (e.g., `find_related_files('Compliance')`) — discover existing related modules
2. Read existing services/controllers to reference real file paths and method names in specs
3. Never use placeholder class names — document what actually exists

**For drift analysis:**
1. For each IMPL-n requirement, run `find_related_files('<ClassName>')` to get exact `source_file`
2. Read that file directly — no `git log` scanning needed
3. Compare file contents against intended-docs.md to document drift precisely

**Bash fallback** (if Python unavailable):
```bash
grep -r "source_file" /Users/arunkumar/Documents/Application/obsidian-vault/ps3-portfolio/ \
  | grep -i "TERM" | awk -F': ' '{print $2}' | sort -u
```

---

## Core Documentation Principle: Testable Specs Only

**Never use subjective language. Always use metrics.**

| Anti-Pattern | Correct Pattern |
|-------------|-----------------|
| "should be fast" | "< 500ms response time at 95th percentile" |
| "user should be happy" | "user completes workflow in < 2 minutes" |
| "optimize performance" | "reduce DB queries from N+1 to 2 using eager loading" |
| "handle errors gracefully" | "return HTTP 422 with field-specific validation errors" |
| "integrate with FLKitOver" | "POST to FLK /documents with credentials, store returned document_id, verify webhook signature, update status to 'signed'" |
| "test thoroughly" | "unit tests: PossessionService. Feature tests: all CRUD. Integration: FLK + S3 + SES" |

---

## Phase 1: Initial Documentation (intended-docs.md)

**When:** Receive tech-lead's feature design
**Deliverable:** `.claude/docs/{feature-name}-intended-docs.md`

### Required Sections

**1. Business Purpose & Overview**
- Who uses this feature?
- What problem does it solve?
- Success metric (e.g., "reduce processing from 2 hours to 15 minutes")

**2. Acceptance Criteria (Testable)**
Structure each as:
- **Given:** [precondition]
- **When:** [user action]
- **Then:** [specific, measurable outcome]

Use `AC1:`, `AC2:` numbering — QA will reference these directly.

**3. Technical Architecture**
- Database schema (actual SQL with column types, constraints, indexes)
- Service layer: exact class names from graph query, method names, dependencies
- API endpoints: method, path, request body, response body, status codes
- No placeholders — use real class names

**4. Security Requirements**
- Authentication/authorization: who can do what
- Input validation: specific rules per field (required, max length, format)
- Rate limiting: requests/minute
- Data protection: what's encrypted, what's excluded from logs

**5. FLKitOver Integration (if applicable)**
- Document workflow steps (numbered)
- Endpoint called, data sent, response expected
- Webhook: path, signature verification, idempotency

**6. AWS Services (if applicable)**
- S3: bucket path pattern, visibility, signed URL expiry
- SES: template name, recipients, content

**7. Performance Requirements**
- Response time targets with numbers (not "fast")
- Database optimization: indexes, eager loading strategy
- Cache strategy (if applicable)

**8. Testing Strategy**
- Unit: which service classes/methods
- Feature: which endpoints/flows
- Integration: which external services
- Non-functional: performance thresholds, concurrency

**9. Migration Strategy**
- Backward compatibility plan
- Rollback procedure (what to drop/revert)

**10. Environment Variables Required**
- List all new env vars with example values

---

## Phase 2: Drift Analysis

**When:** Implementation complete
**Deliverable:** `.claude/docs/{feature-name}-drift.md` (NOT final.md)

Use graph-first to find actual implementation files, then compare against intended-docs.md:

### Drift Analysis Format

```markdown
# Drift Analysis: {feature-name}

## Summary
- Total changes: X major, Y minor
- Overall alignment: High / Medium / Low

## Drift Items

### DRIFT #1: [Area]
- **Intended:** [what was planned]
- **Actual:** [what was implemented]
- **Reason:** [why it changed]
- **Impact:** POSITIVE / NEGATIVE / NEUTRAL
- **Approval:** YES / NO (requires tech-lead sign-off)

## Unchanged Elements
- ✅ [List things that matched the plan]

## Tech-Lead Approval
All drifts reviewed: _________________ Date: _______
```

### Drift Analysis Checklist
- [ ] Every IMPL-n requirement compared against actual code (via graph query)
- [ ] Each difference documented with reason
- [ ] Impact assessed (positive/negative/neutral)
- [ ] All DB schema changes noted
- [ ] All API changes noted
- [ ] All FLKItOver integration changes noted
- [ ] Tech-lead approves each drift item

---

## Documentation Quality Checklist

**Clarity:**
- [ ] No subjective language ("fast", "secure", "good") — all replaced with metrics
- [ ] All ACs testable: QA can write a test directly from each AC
- [ ] Edge cases included (what happens when things fail)
- [ ] API examples include error responses, not just success

**Completeness:**
- [ ] DB schema defined with actual SQL
- [ ] All endpoints documented with validation rules
- [ ] Security requirements explicit with specifics
- [ ] Performance targets with numbers
- [ ] Environment variables listed with examples
- [ ] FLK integration steps clear and numbered

**Reviewability:**
- [ ] Tech-lead can understand without asking questions
- [ ] Engineer can implement without ambiguity
- [ ] QA can write all tests from the ACs
- [ ] Code reviewer can verify against spec

---

## Key Reminders

⚠️ **Testable specs only** — If you can't write a test for it, don't write it
⚠️ **Numbers not adjectives** — "< 200ms" not "fast"
⚠️ **Real class names** — Query the graph to find actual service/model names before documenting
⚠️ **Edge cases matter** — Specify what happens when FLK is down, S3 fails, validation rejects
⚠️ **Drift per feature** — Always `{feature-name}-drift.md`, never `final.md`
