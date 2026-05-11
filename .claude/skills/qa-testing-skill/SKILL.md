---
name: qa-testing-skill
description: Comprehensive QA testing strategy covering positive, negative, non-functional, and regression tests with Playwright automation
---

# QA Testing Skill

You create comprehensive test plans and execute thorough testing that catches bugs before production.

**Important:** This project uses **Codeception** (not PHPUnit, Pest, or Playwright for backend). Tests are in `backend/tests/`. Run with `codecept run`.

## Graph-First Protocol (MANDATORY — Run Before Writing Any Test)

Before writing tests, find existing test files and fixture patterns from the graph. No blind directory scanning.

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
1. Query by feature class (e.g., `find_related_files('Possession')`) — filter results to `tests/` paths
2. Run `find_related_files('Fixture')` to find existing fixtures and `_data/` files
3. Read existing tests in same module — understand naming and assertion patterns
4. Write tests that match established conventions, not generic templates

**Bash fallback** (if Python unavailable):
```bash
grep -r "source_file" /Users/arunkumar/Documents/Application/obsidian-vault/ps3-portfolio/ \
  | grep -i "TERM" | awk -F': ' '{print $2}' | sort -u
```

> For full Codeception test examples (positive, negative, unit, fixture): Read `.claude/agents/references/test-examples.md`

---

## Four Required Test Categories

Every feature requires ALL FOUR. Missing any means incomplete testing.

### 1. POSITIVE TESTS (Happy Path)
- Feature works when used correctly
- All acceptance criteria (AC1, AC2...) covered
- Structure: Arrange → Act → Assert
- Verify database state, response structure, and status code

### 2. NEGATIVE TESTS (Error Cases)
- Missing required fields → validation error (422 or success=false)
- Invalid data types/formats → specific error message
- Nonexistent UUID references → failure, not 500
- Too many items (array limits) → rejected
- Authorization failure → 403 or access denied
- SQL injection attempt → 422, not execution

### 3. NON-FUNCTIONAL TESTS
- **Performance:** Response time within spec (< 200ms typical), no N+1 queries
- **Security:** Passwords hashed, sensitive data not in logs, rate limiting enforced
- **Load:** Concurrent requests don't cause race conditions or data corruption

### 4. REGRESSION TESTS
- Existing features still work after changes
- Existing records still accessible and correct
- API v1 endpoints unbroken if v2 added

---

## Test Execution

```bash
cd backend

# All tests
codecept run

# Unit tests only (fast, no database)
codecept run unit

# Functional tests (with database)
codecept run functional

# Single test file
codecept run unit modules/possession/PropertyPossessionTest

# Single method
codecept run unit modules/possession/PropertyPossessionTest:testValidation

# Verbose output
codecept run -v
```

---

## Bug Report Format

```markdown
## Bug Report: [Issue Title]

**Severity:** Critical / High / Medium / Low
**Component:** [Controller/Service name]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]

**Expected:** [What should happen]
**Actual:** [What actually happens]

**Evidence:**
[HTTP response, log output, DB state]

**Suggested Fix:** [If known]
```

---

## Test Quality Checklist

- [ ] Positive tests: Happy path works for all ACs
- [ ] Negative tests: All error cases handled (validation, auth, edge cases)
- [ ] Security tests: No injection/bypass attacks succeed
- [ ] Performance tests: Response times within spec, no N+1
- [ ] Regression tests: Existing features still work
- [ ] All 4 categories covered for every feature
- [ ] Tests are repeatable (no flaky tests)
- [ ] Test data isolated via fixtures (no cross-test pollution)
- [ ] Bug reports are specific and reproducible

---

## Key Reminders

⚠️ **All 4 test categories required** — Don't skip regression or non-functional
⚠️ **Use Codeception patterns** — Cest format for functional, Unit class for unit tests
⚠️ **Fixtures for test data** — `_fixtures()` method, `ActiveFixture` class, `_data/` PHP files
⚠️ **Document failures clearly** — Must be reproducible by someone else
⚠️ **Test actual constraints** — Not just "code exists" — verify behavior enforced
