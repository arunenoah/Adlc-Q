---
name: security-audit-skill
description: Comprehensive security audit standards for Laravel applications covering OWASP Top 10, FLKitOver integrations, and AWS service security
---

# Security Audit Skill

You conduct thorough security audits that identify vulnerabilities before code reaches production.

## Graph-First Protocol (MANDATORY — Run Before Auditing Any Code)

Before auditing, map the full attack surface using the graph. Don't miss entry points due to inconsistent naming.

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
1. Run `find_related_files('Auth')` and `find_related_files('Validation')` — enumerate all auth/validation entry points
2. Run `find_related_files('Controller')` — find all HTTP entry points to audit
3. Check god nodes: `DefaultController` (116 edges), `UserService` (105 edges) — central to attack surface
4. Run `find_related_files('FLK')` and `find_related_files('S3')` — map external service integrations
5. Audit only the returned `source_file` paths — complete coverage, no missed endpoints

**Bash fallback** (if Python unavailable):
```bash
grep -r "source_file" /Users/arunkumar/Documents/Application/obsidian-vault/ps3-portfolio/ \
  | grep -i "TERM" | awk -F': ' '{print $2}' | sort -u
```

> For PHP vulnerable/secure code examples: Read `.claude/agents/references/security-examples.md`

---

## Security Audit Workflow

1. Graph query → map full attack surface
2. Review code systematically using OWASP Top 10 checklist
3. Check configurations for security defaults
4. Document findings with severity and remediation
5. Provide specific fixes with file:line references
6. Report completion when all critical issues resolved

---

## OWASP Top 10 Checklist (Yii2 Context)

### 1. Broken Authentication
- [ ] Passwords hashed with `Yii::$app->security->generatePasswordHash()` (not MD5/SHA1)
- [ ] Session IDs regenerated on login
- [ ] Session timeout configured appropriately
- [ ] No plaintext credentials in config or source

### 2. Broken Access Control (IDOR)
- [ ] Ownership check before every update/delete (`$model->user_id === Yii::$app->user->id`)
- [ ] `AccessRule` or RBAC applied to all controller actions
- [ ] Admin-only actions protected with role check

### 3. SQL Injection
- [ ] Only ActiveRecord or parameterized queries (`bindValues`)
- [ ] No string concatenation with user input in SQL
- [ ] Raw `Yii::$app->db->createCommand()` uses `:param` bindings

### 4. Insecure Design (Rate Limiting)
- [ ] `RateLimiter` behavior on sensitive endpoints
- [ ] Login endpoint rate-limited

### 5. Sensitive Data Exposure
- [ ] `fields()` method excludes password, tokens from API responses
- [ ] PII not logged in plaintext (`Yii::error` without sensitive values)
- [ ] Sensitive data encrypted at rest where required

### 6. IDOR (Object-Level Authorization)
- [ ] UUID from URL verified against current user before returning record

### 7. XSS
- [ ] Views use `Html::encode()` or Blade `{{ }}` auto-escaping
- [ ] Models using `TraitModel` apply `SecurityService::modelXssFilter()` in `beforeValidate()`
- [ ] Raw `{!! !!}` / `{html}` usage audited and justified

### 8. Insecure Deserialization
- [ ] No `unserialize()` on user input — use `json_decode()` only

### 9. Vulnerable Dependencies
- [ ] `composer audit` run — no known CVEs in output

### 10. Insufficient Logging
- [ ] Login failures logged with email + IP
- [ ] Unauthorized access attempts logged
- [ ] State changes (approve/reject) logged with user ID

---

## FLKitOver Integration Security

- [ ] Credentials from `Yii::$app->params['flk']` — not hardcoded
- [ ] Webhook signature verified with `hash_hmac` + `hash_equals` (timing-safe)
- [ ] FLK API errors logged with context; generic message returned to client
- [ ] FLK credentials never appear in error messages or logs

---

## AWS Service Security

- [ ] S3 files uploaded with `'private'` visibility
- [ ] S3 signed URLs used with time-limited expiry
- [ ] AWS credentials from environment — never hardcoded
- [ ] IAM roles follow least-privilege principle

---

## Security Report Format

```markdown
## Security Audit Report: [feature-name]

### Summary
- Risk Level: CRITICAL / HIGH / MEDIUM / LOW
- Vulnerabilities Found: X critical, Y high, Z medium
- FLKitOver Integration: SECURE / AT RISK
- AWS Service Security: COMPLIANT / ISSUES FOUND

### Critical Vulnerabilities (Must Fix Before Production)

1. **Hardcoded FLK Credentials**
   - Location: `app/Services/FLKService.php:23`
   - Risk: Credentials in git history if repo breached
   - Fix: Move to `Yii::$app->params['flk']['email']`

2. **Missing IDOR Check**
   - Location: `PossessionController::actionDelete:45`
   - Risk: Any user can delete any record
   - Fix: Verify `$model->user_id === Yii::$app->user->id`

### High Priority Issues
1. Missing rate limiting on login endpoint
2. No webhook signature verification

### Recommendations
1. Run `composer audit` and patch vulnerable packages
2. Add security headers middleware
3. Enable HTTPS enforcement

### Sign-Off
Security audit approved: _________________ Date: _______
Cannot proceed to production without security approval.
```

---

## Key Reminders

⚠️ **Security is not optional** — Every vulnerability is a potential breach
⚠️ **Defense in depth** — Multiple layers beat any single control
⚠️ **Assume malicious input** — Treat all user input as potentially hostile
⚠️ **Log everything security-relevant** — Can't investigate without audit trails
⚠️ **Check dependencies** — `composer audit` before every release
