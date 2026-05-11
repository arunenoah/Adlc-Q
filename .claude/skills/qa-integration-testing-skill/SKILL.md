---
name: qa-integration-testing-skill
description: Use when testing external service integrations (FLKitOver, AWS S3, SES) end-to-end with real APIs and state verification
---

# QA Integration Testing Skill

You test interactions between application code and external services to verify data flows correctly across system boundaries.

**Important:** This project uses **Codeception** (not Pest/PHPUnit). Tests are in `backend/tests/`. Run with `codecept run functional`.

## Graph-First Protocol (MANDATORY — Run Before Writing Integration Tests)

Before writing integration tests, locate the exact service files and existing test patterns from the graph.

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
1. Run `find_related_files('FLK')` — find exact FLKitOver service file and existing integration tests
2. Run `find_related_files('S3')` — find S3 service and test files
3. Run `find_related_files('Integration')` — find existing integration test base classes or patterns
4. Filter all results to `tests/` paths for test files; use non-test paths to understand service method signatures
5. Write tests that call the exact methods found — no guessing at method names

**Bash fallback** (if Python unavailable):
```bash
grep -r "source_file" /Users/arunkumar/Documents/Application/obsidian-vault/ps3-portfolio/ \
  | grep -i "TERM" | awk -F': ' '{print $2}' | sort -u
```

> For full Codeception integration test examples (FLK, S3, SES, transactions, webhooks): Read `.claude/agents/references/integration-test-examples.md`

---

## Integration Testing Scope

**Cover:** FLKitOver, AWS S3, SES emails, database transactions, webhooks
**Goal:** Verify application correctly calls external APIs and handles responses
**Not here:** Unit tests (code-reviewer-quality-skill), basic validation (qa-testing-skill)

---

## FLKItOver Integration Checklist

- [ ] Document creation call includes all required fields
- [ ] FLK document ID stored in model metadata
- [ ] Webhook signature validated (`hash_hmac` + `hash_equals` — timing-safe)
- [ ] Webhook processing is idempotent (safe to replay same webhook)
- [ ] Retry logic fires on FLK API errors (503, 502, timeout)
- [ ] Max retries limit set (e.g., 3 attempts over 24 hours)
- [ ] Record marked "flk_error" if document creation fails permanently
- [ ] FLK credentials not hardcoded — from `Yii::$app->params`

---

## AWS S3 Integration Checklist

- [ ] Files uploaded to correct path (`{module}/{id}/documents/`)
- [ ] File permissions private (not public)
- [ ] Signed URLs include time-limited expiry
- [ ] Multiple uploads stored at independent paths (no overwrite)
- [ ] Upload failure doesn't create partial DB records
- [ ] File size and MIME type validated before upload
- [ ] S3 errors logged with context

---

## AWS SES Integration Checklist

- [ ] Confirmation email queued immediately on record creation
- [ ] Email includes record ID and status
- [ ] Admin notification included where required
- [ ] Email templates render without errors
- [ ] Delivery failures logged with reason
- [ ] Retry logic for failed sends (2 attempts minimum)

---

## Database Transaction Checklist

- [ ] Multi-step operations wrapped in `Yii::$app->db->beginTransaction()`
- [ ] Constraint violations trigger full rollback (not partial save)
- [ ] Foreign key constraints enforced
- [ ] Status transitions validated before commit
- [ ] Concurrent updates use pessimistic locking where needed

---

## Webhook Idempotency Checklist

- [ ] Webhook signature validated before processing
- [ ] Idempotency key prevents duplicate processing
- [ ] Webhook logged with timestamp and result
- [ ] Out-of-order webhooks handled deterministically

---

## Integration Test Execution

```bash
cd backend

# All functional tests (includes integration)
codecept run functional

# Integration tests only (if in separate directory)
codecept run functional integration

# Specific integration test file
codecept run functional integration/FLKDocumentIntegrationCest

# With verbose output
codecept run functional -v
```

---

## Common Integration Test Mistakes

- **Mocking external APIs** — integration tests should use staging credentials or a real mock server, not `Http::fake()`
- **No teardown** — S3 files and DB records left after test pollute next run
- **No timeout handling** — always set explicit timeouts on HTTP calls
- **Empty database assumptions** — seed data realistically, don't assume clean state
- **Production credentials** — always use staging/test credentials and endpoints

---

## Integration Test Approval Checklist

- [ ] All external services tested (FLK, S3, SES)
- [ ] Success paths covered
- [ ] Failure paths covered with retry logic verified
- [ ] Webhooks idempotent (duplicate processing safe)
- [ ] Database transactions atomic (full rollback on failure)
- [ ] Multi-service flows tested end-to-end
- [ ] Error messages specific and logged with context
- [ ] Staging credentials used (not production)
