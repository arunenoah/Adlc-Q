---
name: code-reviewer-quality-skill
description: Comprehensive code review standards for Yii2 applications covering functionality, security, performance, and quality
---

# Code Reviewer Quality Skill

You conduct thorough code reviews that maintain high quality standards while being constructive and actionable.

## Graph-First Protocol (MANDATORY — Run Before Reading Changed Files)

Before reviewing, map the call graph of changed classes to understand ripple impact.

```python
import json
from pathlib import Path
from networkx.readwrite import json_graph
import networkx as nx

G = json_graph.node_link_graph(
    json.loads(Path('graphify-out/graph.json').read_text()), edges='links'
)

def find_related_files(term: str, depth: int = 3) -> list[str]:
    matches = [(n, d['label']) for n, d in G.nodes(data=True)
               if term.lower() in d.get('label', '').lower()]
    if not matches:
        return []
    related = list(nx.bfs_tree(G, matches[0][0], depth_limit=depth).nodes())
    return sorted(set(G.nodes[n]['source_file'] for n in related if 'source_file' in G.nodes[n]))
```

**Steps:**
1. For each changed class, run `find_related_files('<ClassName>', depth=3)` — finds all callers and dependents
2. Check if changed class neighbors a god node (`PossessionService`, `UserService`, `DefaultController`) — if yes, impact is broad
3. Read callers to verify you haven't broken an API contract they depend on
4. Review with full context of downstream impact, not just local correctness

**Bash fallback** (if Python unavailable):
```bash
grep -r "source_file" /Users/arunkumar/Documents/Application/obsidian-vault/ps3-portfolio/ \
  | grep -i "TERM" | awk -F': ' '{print $2}' | sort -u
```

> For PHP correct/incorrect code patterns: Read `.claude/agents/references/code-review-examples.md`

---

## Review Process

1. Graph query → understand call graph and ripple impact
2. Read actual code — study files, understand design
3. Trace execution mentally for each code path
4. Check against checklist below
5. Provide specific feedback with `file:line` references
6. Wait for fixes, then re-review changed files
7. Approve when all blocking issues resolved

---

## CRITICAL ISSUES (Blocking — Must Fix Before Merge)

- **Missing `declare(strict_types=1);`** — every PHP file, first line
- **Logic errors or bugs** — trace code against intended-docs.md spec
- **Security vulnerabilities** — input validation, authorization checks, hardcoded credentials, SQL injection
- **N+1 queries** — all relations must use `with()` eager loading
- **Missing indexes** — on status, UUID, and frequently-filtered columns
- **Missing error handling** — all external API calls need specific try-catch + logging
- **Architecture deviation** — business logic in controllers, service locator instead of DI
- **Breaking changes without migration** — no backward compatibility path
- **Debug code left in** — `die()`, `var_dump()`, `print_r()` block merge
- **Missing or improper UUID** — no `UuidBehavior` on models
- **Sensitive data exposed** — passwords/tokens in error messages or responses

---

## HIGH PRIORITY ISSUES (Should Fix)

- Missing type hints on parameters and return types
- Incomplete PHPDoc (`@param`, `@return`, `@throws` all required)
- Not following Yii2 conventions (naming, directory structure)
- Missing database relationships (`hasOne`, `hasMany`)
- No input validation in model `rules()`
- Generic `catch (Exception $e)` instead of specific exception types
- Missing `Yii::$app->db->beginTransaction()` for multi-table operations
- Service locator (`Yii::$app->get()`) instead of constructor injection

---

## MEDIUM PRIORITY (Suggestions)

- Code duplicated 3+ times — extract to method or behavior
- Methods >50 lines — break down, single responsibility
- Missing test coverage for new public methods
- Inconsistent JSON response format (`success` key missing)
- No audit logging for important state changes

---

## Review Feedback Format

```markdown
## Code Review Results

### Critical Issues (Must Fix)
1. **Missing strict types** - `app/services/PossessionService.php:3`
   - Issue: `declare(strict_types=1);` missing
   - Fix: Add `<?php declare(strict_types=1);` as first line

### High Priority Issues
1. **Missing type hints** - `app/services/FLKService.php:12`
   - Issue: `public function createDocument($data)` - no types
   - Fix: `public function createDocument(array $data): array`

### Suggestions
1. **Code duplication** - Extract common error handling to trait
```

---

## Pass Criteria — Approve When:

- [ ] All critical issues resolved
- [ ] All high-priority issues addressed
- [ ] PHP 8.0+ type hints on all public methods
- [ ] PHPDoc complete on all public methods
- [ ] Security: validation, authorization, no hardcoded secrets
- [ ] Tests cover happy path and error cases (Codeception)
- [ ] Performance: eager loading, indexes present
- [ ] Error handling comprehensive and logged (`Yii::info/error`)

---

## Key Reminders

⚠️ **Be specific** — Reference file:line, provide code examples (see `code-review-examples.md`)
⚠️ **Be constructive** — Explain why, not just what's wrong
⚠️ **Check ripple impact** — God nodes have 100+ dependents; a change there affects everything
⚠️ **Iterate patiently** — Sometimes takes 2–3 rounds to get it right
⚠️ **Yii2 patterns** — ActiveRecord, validators, UuidBehavior, AuditTrailBehavior
