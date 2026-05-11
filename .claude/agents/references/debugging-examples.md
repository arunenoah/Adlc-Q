# Debugging Examples Reference

Phase templates, hypothesis examples, and post-mortem format for the senior-engineer-debugging-skill.

---

## Isolation: Minimal Reproduction

```php
// WRONG - bloated, hard to debug
public function testApplicationSubmission(): void
{
    // 30 lines setup, 50 lines action, 40 lines assertions
}

// CORRECT - minimal, fast
public function testPetTypeUnknownValidation(): void
{
    $response = $this->sendPOST('/possession/default/create', [
        'PropertyPossession' => ['status' => 'invalid_status'],
    ]);
    $this->seeResponseContainsJson(['success' => false]);
}
```

---

## Evidence Gathering

```bash
# Application logs (Yii2)
tail -200 backend/runtime/logs/app.log | grep "PossessionService"

# Real-time monitoring
tail -f backend/runtime/logs/app.log | grep -E "error|warning"

# Database inspection (Yii2 tinker equivalent)
php yii shell
>>> PropertyPossession::find()->orderBy('created_at DESC')->limit(5)->all()

# Check queue status
php yii queue/info

# Monitor all DB queries (add to controller for debugging)
Yii::$app->db->on(\yii\db\Connection::EVENT_AFTER_OPEN, function() {
    Yii::$app->db->enableProfiling = true;
});
```

---

## Hypothesis Template

```
OBSERVED: POST /possession/default/create returns success=false
EXPECTED: success=true with possession ID

HYPOTHESIS 1:
  Possible Cause: Validation fails (missing required field)
  Test: Send request with full valid data
  Prediction: 200 success — confirms validation issue

HYPOTHESIS 2:
  Possible Cause: FLK API returning 503
  Test: Check runtime/logs/app.log for "FLK API error"
  Prediction: Log entry exists — confirms FLK is down

HYPOTHESIS 3:
  Possible Cause: Database constraint violation
  Test: Check logs for SQLSTATE error
  Prediction: SQLSTATE[23000] Integrity constraint violation

RANK BY LIKELIHOOD:
  1. FLK API (recent change)
  2. Validation (most common)
  3. Database constraint (least likely)
```

---

## Common Root Causes by Symptom (Yii2 Context)

```
IF ERROR: "Call to undefined method"
  → Check: Was method renamed in service? Is service instantiated?
  → FIX: Update method call, verify service class and namespace

IF ERROR: "SQLSTATE[HY000]: General error"
  → Check: UUID format correct? Foreign key violation?
  → FIX: Check migration column types, ensure related records exist

IF ERROR: "SQLSTATE[23000]: Integrity constraint"
  → Check: Duplicate unique key? Non-null column missing?
  → FIX: Check uniqueness, verify all required fields sent

IF ERROR: "Active record not found"
  → Check: UUID exists in DB? Correct table?
  → FIX: Check fixture data, verify UUID matches query

IF ERROR: "Memory exhausted"
  → Check: Query returning all rows without limit?
  → FIX: Add limit/offset, eager load instead of lazy

IF ERROR: "FLK API 503"
  → Check: Is FLK staging down? Rate limited?
  → FIX: Check FLK status, add retry logic with backoff

IF ERROR: "Permission denied / 403"
  → Check: AccessRule configured? User has correct role?
  → FIX: Check AccessRule `roles`, verify user_type assignment
```

---

## Hypothesis Fix Verification

```php
// BEFORE (broken) - missing error handling
public function submitPossession(array $data): PropertyPossession
{
    $possession = $this->createPossession($data);
    $flkDoc = $this->flkService->createDocument($possession);
    // No catch - exception bubbles as 500
    return $possession;
}

// AFTER (fixed)
public function submitPossession(array $data): PropertyPossession
{
    try {
        $possession = $this->createPossession($data);
        $flkDoc = $this->flkService->createDocument($possession);
        return $possession;
    } catch (FLKApiException $e) {
        Yii::error('FLK API failed: ' . $e->getMessage(), __METHOD__);
        // Queue retry job
        throw new PossessionException('Failed to create document', 0, $e);
    }
}

// VERIFY: Write focused test for the fix
public function testFLKApiErrorHandledGracefully(): void
{
    // Configure FLK to return 503 in test environment
    $this->sendPOST('/possession/default/submit', ['possession_id' => 'uuid']);
    // Should NOT be 500 anymore
    $this->seeResponseContainsJson(['success' => false]);
    $this->dontSeeResponseCodeIs(500);
}
```

---

## Race Condition Investigation

Signs of race condition:
- Failure happens intermittently (sometimes passes, sometimes fails)
- Happens more under load
- Hard to reproduce manually

```php
// ROOT CAUSE EXAMPLE: Concurrent saves violating unique constraint

// TEST: Simulate concurrent submissions
public function testConcurrentCreationSameUUID(): void
{
    // Two requests with same data - only one should succeed
    $data = ['property_id' => 'test-uuid', 'status' => 'pending'];

    $response1 = $this->sendPOST('/possession/default/create', ['PropertyPossession' => $data]);
    $response2 = $this->sendPOST('/possession/default/create', ['PropertyPossession' => $data]);

    // One should fail if unique constraint exists
    $codes = [json_decode($response1, true)['success'], json_decode($response2, true)['success']];
    sort($codes);
    // One true (success), one false (duplicate)
    $this->assertEquals([false, true], $codes);
}

// FIX: Add unique index in migration
$this->createIndex('idx_unique_property_status', 'property_possession', ['property_id'], true);

// FIX: Use pessimistic locking for updates
$possession = PropertyPossession::find()
    ->where(['id' => $id])
    ->andWhere(['status' => 'pending'])
    ->one();
```

---

## Root Cause Report Template

```markdown
# Root Cause Analysis: Possession Creation 500 Error

## Failure Description
- **Symptom:** POST /possession/default/create returns 500
- **Environment:** Staging
- **Frequency:** 100% when FLK API is down
- **Impact:** Users cannot complete possession submission

## Investigation Process
1. Reproduced locally with FLK_API_URL pointing to dead endpoint
2. Checked backend/runtime/logs/app.log → No error logged
3. Added Yii::error() temporarily → Confirmed FLKApiException thrown
4. Found no try-catch in PossessionService::submitPossession()

## Root Cause
**Location:** `backend/modules/possession/services/PossessionService.php:85`
**Issue:** `$this->flkService->createDocument()` throws uncaught FLKApiException
**Why:** Missing error handling for external service failures

## Impact
- User sees 500 (not a helpful message)
- Possession created in DB but FLK doc failed (inconsistent state)
- No retry mechanism, document lost

## Solution
- Add try-catch with FLKApiException specifically
- Queue retry job on failure
- Return structured error response (not 500)

## Verification Checklist
- [ ] FLK 503 test passes (no more 500)
- [ ] Possession marked "flk_pending" on FLK failure
- [ ] Retry job queued in queue table
- [ ] Graceful user response confirmed

## Prevention
- Code review checklist: all external calls need try-catch
- Integration test for FLK API down scenario
```

---

## Post-Mortem Template

```markdown
# Incident Post-Mortem: Possession 500 on FLK Down

## Timeline
- 14:32: Bug reported
- 14:35: Reproduced locally
- 14:50: Root cause found (missing try-catch)
- 15:10: Fix implemented
- 15:15: Deployed to staging and verified

## Root Cause
FLKService::createDocument() threw FLKApiException uncaught in PossessionService.

## Contributing Factors
- No integration test for FLK API failure scenario
- No try-catch in service method

## What We Fixed
- Added try-catch with FLKApiException
- Queue retry job on failure
- Graceful error response to user

## Action Items
- [ ] Deploy fix to production
- [ ] Add FLK error integration test
- [ ] Review other external API calls for same pattern
- [ ] Add monitoring alert if FLK retry queue grows > 5 jobs
```

---

## Escalation Triggers

```
ESCALATE to Tech-Lead if:
- Root cause not found after 2 hours investigation
- Requires infrastructure change (AWS config, DB)
- Security vulnerability discovered
- Affects multiple features

ESCALATE to DevOps if:
- AWS/infrastructure changes needed
- S3 bucket policy changes required
- Database connection issues

ESCALATE to Product if:
- Data loss or user impact decisions needed
```
