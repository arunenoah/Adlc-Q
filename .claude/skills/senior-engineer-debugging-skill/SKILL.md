---
name: senior-engineer-debugging-skill
description: Use when tests fail, bugs reported, or unexpected behavior occurs in production or staging - follow systematic root-cause methodology before proposing fixes
---

# Senior Engineer Debugging Skill

You investigate failures systematically to find root causes, not just symptoms. Fix the cause, not the symptom.

## Graph-First Protocol (MANDATORY — Run Before Searching for the Bug Location)

Before using Grep/Glob to hunt for failing code, query the graph to find the exact file and its callers.

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
1. Query by the failing class/method name (e.g., `find_related_files('PossessionService')`)
2. Use depth=3 to expose all callers — the bug source may be upstream
3. Read only the returned `source_file` paths — no random directory scanning
4. Check god nodes: if bug is near `PossessionService`, `UserService`, or `DefaultController`, impact is broad

**Bash fallback** (if Python unavailable):
```bash
grep -r "source_file" /Users/arunkumar/Documents/Application/obsidian-vault/ps3-portfolio/ \
  | grep -i "TERM" | awk -F': ' '{print $2}' | sort -u
```

> For phase templates, hypothesis examples, post-mortem format: Read `.claude/agents/references/debugging-examples.md`

---

## Debugging Methodology

**Principle:** Hypothesis-driven investigation, not random changes.

---

## Phase 1: Reproduce & Isolate

**Reproduce consistently first:**
- If every time: note exact steps, environment, full error
- If intermittent: STOP — this is likely a race condition (skip to Phase 7)

**Isolate the component:**
- What changed between working and broken? (code, dependencies, infrastructure, data)
- Narrow from "feature is broken" to "fails specifically when X"

**Create minimal test case:**
- Strip all non-essential setup
- Reproduce with fewest lines possible
- See `debugging-examples.md` for before/after isolation example

---

## Phase 2: Gather Evidence

**Always collect before theorizing:**
1. Full stack trace (exception type, code, context)
2. Application logs: `tail -200 backend/runtime/logs/app.log | grep "ClassName"`
3. Database state: what was created/missing at time of failure?
4. External service logs: FLKitOver dashboard, AWS CloudWatch, SES delivery status
5. Exact request/response data (headers, status code, body)
6. Timing: when did it fail, how long between steps, any timeouts?

---

## Phase 3: Form Hypotheses

**Template:**
```
OBSERVED: [what happened]
EXPECTED: [what should happen]

HYPOTHESIS 1: [possible cause] → Test: [specific check] → Prediction: [expected result]
HYPOTHESIS 2: [possible cause] → Test: [specific check] → Prediction: [expected result]

RANK: [most likely first, based on recent changes]
```

**Common root causes by symptom:** See `debugging-examples.md` for full list.

---

## Phase 4: Test Each Hypothesis

- Write a focused test — not a change, a test
- One hypothesis at a time
- If prediction matches result → root cause confirmed
- If not → next hypothesis

---

## Phase 5: Confirm Root Cause

Checklist:
- [ ] Fixing this cause prevents the failure
- [ ] Failure occurs when cause still exists
- [ ] No other changes needed
- [ ] Fixed the cause, not a symptom

---

## Phase 6: Fix & Verify

- Implement fix at root cause level (not symptom)
- Write regression test that would have caught this bug
- Verify test passes with fix, fails without it

---

## Phase 7: Race Condition Investigation

Signs: intermittent failure, happens under load, hard to reproduce manually

**Approach:**
- Identify what shared state is accessed concurrently
- Look for missing `beginTransaction()` or unique constraints
- Check for out-of-order webhook processing
- Use pessimistic locking (`lockForUpdate()`) for concurrent updates
- Add unique DB constraint to prevent duplicate records

---

## Phase 8: Document Root Cause

Write RCA in this format (see `debugging-examples.md` for full template):
- Failure description (symptom, environment, frequency, impact)
- Investigation process (steps taken, evidence found)
- Root cause (location, issue, why)
- Solution implemented
- Verification checklist
- Prevention (regression test, monitoring alert)

---

## Escalation Triggers

Escalate to tech-lead if:
- Root cause not found after 2 hours investigation
- Requires infrastructure change (AWS config, database)
- Security vulnerability discovered
- Affects multiple features or production data

---

## Debugging Checklist

- [ ] Reproduced consistently (or documented as race condition)
- [ ] Specific component identified that fails
- [ ] Logs and evidence collected
- [ ] Specific hypothesis formed
- [ ] Hypothesis tested with focused experiment
- [ ] Root cause confirmed (not just symptom)
- [ ] Fix implemented at root cause level
- [ ] Test confirms fix prevents failure
- [ ] Regression test or monitoring added
- [ ] Root cause documented

---

## Common Debugging Mistakes (Never Do These)

- Changing code without a hypothesis — you're guessing
- Fixing symptom instead of cause (adding `@suppress` to hide errors)
- Not verifying fix prevents recurrence
- Assuming a single cause without testing alternatives
- Debugging without logs — read the evidence first
