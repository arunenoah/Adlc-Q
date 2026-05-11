# Integration Test Examples Reference

FLK/S3/SES PHP integration test examples for the qa-integration-testing-skill. Uses Codeception (NOT Pest/PHPUnit).

---

## FLKitOver Integration Test

```php
<?php declare(strict_types=1);

namespace backend\tests\functional\integration;

use backend\tests\FunctionalTester;

class FLKDocumentIntegrationCest
{
    public function _fixtures(): array
    {
        return [
            'possessions' => \backend\tests\fixtures\PossessionFixture::class,
        ];
    }

    /**
     * AC: FLK document created when possession submitted, document ID stored
     */
    public function possessionSubmissionCreatesFLKDocument(FunctionalTester $I): void
    {
        // Arrange: Mock FLK API (staging) using Yii HttpClient mock
        // or set FLK_API_URL in test config to a local mock server

        $I->amLoggedInAs(1);
        $I->sendPOST('/possession/default/submit', [
            'possession_id' => 'test-possession-uuid',
        ]);

        $I->seeResponseCodeIs(200);
        $I->seeResponseContainsJson(['success' => true]);

        // Verify FLK document ID stored in metadata
        $I->seeInDatabase('property_possession', [
            'id'     => 'test-possession-uuid',
            'status' => 'pending_signature',
        ]);
    }

    /**
     * AC: FLK webhook updates possession status
     */
    public function flkWebhookUpdatesPossessionStatus(FunctionalTester $I): void
    {
        // Seed possession in FLK-pending state
        $I->haveInDatabase('property_possession', [
            'id'       => 'pending-uuid',
            'status'   => 'pending_signature',
            'metadata' => json_encode(['flk_document_id' => 'flk_doc_123']),
        ]);

        // Simulate FLK webhook
        $webhookSecret = \Yii::$app->params['flk']['webhook_secret'];
        $payload = json_encode([
            'document_id' => 'flk_doc_123',
            'event'       => 'signature_completed',
            'signed_at'   => date('Y-m-d H:i:s'),
        ]);
        $signature = hash_hmac('sha256', $payload, $webhookSecret);

        $I->haveHttpHeader('X-FLK-Signature', $signature);
        $I->haveHttpHeader('Content-Type', 'application/json');
        $I->sendPOST('/possession/default/flk-webhook', json_decode($payload, true));

        $I->seeResponseCodeIs(200);
        $I->seeInDatabase('property_possession', [
            'id'     => 'pending-uuid',
            'status' => 'approved',
        ]);
    }

    /**
     * AC: FLK API error queues retry job
     */
    public function flkApiErrorQueuesRetry(FunctionalTester $I): void
    {
        // Point FLK URL to unavailable endpoint in test config
        // Then verify job created in queue table

        $I->amLoggedInAs(1);
        $I->sendPOST('/possession/default/submit', [
            'possession_id' => 'test-possession-uuid',
        ]);

        // Should get a graceful response (202 or specific error)
        $I->seeResponseContainsJson(['success' => false]);

        // Verify retry job queued
        $I->seeInDatabase('jobs', ['queue' => 'flk-retry']);
    }
}
```

### FLK Checklist

- [ ] Document creation call includes all required fields
- [ ] FLK document ID stored in possession metadata
- [ ] Webhook signature validated (`hash_hmac` + `hash_equals`)
- [ ] Webhook processing is idempotent (safe to replay)
- [ ] Retry logic fires on FLK API errors (503, 502, timeout)
- [ ] Max retries limit set (e.g., 3 attempts over 24 hours)
- [ ] Possession marked "flk_error" if document creation fails permanently

---

## AWS S3 Integration Test

```php
<?php declare(strict_types=1);

namespace backend\tests\functional\integration;

use backend\tests\FunctionalTester;

class S3FileUploadCest
{
    /**
     * AC: File uploaded to S3 private, signed URL returned
     */
    public function petPhotoUploadedToS3(FunctionalTester $I): void
    {
        // Use S3 fake disk (configured in test params)
        $I->amLoggedInAs(1);

        $I->sendPOST('/possession/default/upload-photo', [
            'possession_id' => 'test-possession-uuid',
            'photo'         => \Codeception\Util\Fixtures::get('test_image'),
        ]);

        $I->seeResponseCodeIs(200);

        // Signed URL returned (contains expiry signature)
        $responseData = json_decode($I->grabResponse(), true);
        $I->assertStringContainsString('X-Amz-Signature', $responseData['data']['photo_url']);

        // File stored in correct path
        // (verify against S3 fake disk or staging bucket)
    }

    /**
     * AC: S3 upload failure returns error, no partial DB state
     */
    public function s3UploadFailureCleanup(FunctionalTester $I): void
    {
        // Configure test to use broken S3 endpoint
        $I->amLoggedInAs(1);
        $I->sendPOST('/possession/default/upload-photo', [
            'possession_id' => 'test-possession-uuid',
            'photo'         => \Codeception\Util\Fixtures::get('test_image'),
        ]);

        $I->seeResponseContainsJson(['success' => false]);

        // Verify no orphaned DB record
        $I->dontSeeInDatabase('possession_documents', [
            'possession_id' => 'test-possession-uuid',
            'status'        => 'pending',
        ]);
    }
}
```

### S3 Checklist

- [ ] Files uploaded to correct path (`{module}/{id}/documents/`)
- [ ] File permissions private (not public)
- [ ] Signed URLs include time-limited expiry
- [ ] Multiple uploads stored at independent paths (no overwrite)
- [ ] Upload failure doesn't create partial DB records
- [ ] File size and MIME type validated before upload
- [ ] S3 errors logged with context (path, size, error code)

---

## SES Email Integration Test

```php
<?php declare(strict_types=1);

namespace backend\tests\functional\integration;

use backend\tests\FunctionalTester;

class SESEmailDeliveryCest
{
    /**
     * AC: Confirmation email queued on possession creation
     */
    public function possessionCreationQueuesConfirmationEmail(FunctionalTester $I): void
    {
        $I->amLoggedInAs(1);
        $I->sendPOST('/possession/default/create', [
            'PropertyPossession' => [
                'property_id' => 'test-property-uuid',
                'status'      => 'pending',
            ],
        ]);

        $I->seeResponseContainsJson(['success' => true]);

        // Verify email job queued (Yii queue table)
        $I->seeInDatabase('queue', [
            'channel' => 'email',
        ]);
    }

    /**
     * AC: Email delivery failure logged
     */
    public function emailDeliveryFailureLogged(FunctionalTester $I): void
    {
        // Test requires SES to fail (configured in test env)
        // Verify error logged in email_delivery_logs or application log
        $I->amLoggedInAs(1);
        $I->sendPOST('/possession/default/send-notification', [
            'possession_id' => 'test-possession-uuid',
        ]);

        // Should get graceful error response
        // Check log file for error entry
        // $I->seeInLog('SES error'); — depends on test helper setup
    }
}
```

### SES Checklist

- [ ] Confirmation email queued immediately on creation
- [ ] Email includes record ID and status
- [ ] Admin notification BCC'd where required
- [ ] Email templates render without errors
- [ ] Delivery failures logged with reason
- [ ] Retry logic for failed sends

---

## Database Transaction Integration Test

```php
<?php declare(strict_types=1);

namespace backend\tests\functional\integration;

use backend\tests\FunctionalTester;

class TransactionIntegrityCest
{
    /**
     * AC: If child record fails, parent rolled back too
     */
    public function possessionCreationRollsBackOnChildFailure(FunctionalTester $I): void
    {
        $I->amLoggedInAs(1);
        $I->sendPOST('/possession/default/create', [
            'PropertyPossession' => [
                'property_id' => 'valid-uuid',
                'status'      => 'pending',
            ],
            'PossessionTask' => [
                ['type' => 'invalid-type'], // Forces child validation failure
            ],
        ]);

        $I->seeResponseContainsJson(['success' => false]);

        // Neither parent nor child should exist
        $I->dontSeeInDatabase('property_possession', ['property_id' => 'valid-uuid']);
        $I->dontSeeInDatabase('possession_tasks', ['type' => 'invalid-type']);
    }
}
```

### Transaction Checklist

- [ ] Multi-step operations wrapped in `Yii::$app->db->beginTransaction()`
- [ ] Constraint violations trigger full rollback
- [ ] Foreign key constraints enforced
- [ ] Status transitions validated before commit

---

## Webhook Idempotency Test

```php
public function duplicateWebhookProcessedOnce(FunctionalTester $I): void
{
    $payload = [
        'idempotency_key' => 'webhook-abc-001',
        'document_id'     => 'flk_doc_123',
        'event'           => 'signature_completed',
    ];

    $webhookSecret = \Yii::$app->params['flk']['webhook_secret'];
    $signature = hash_hmac('sha256', json_encode($payload), $webhookSecret);
    $I->haveHttpHeader('X-FLK-Signature', $signature);

    // Send same webhook twice
    $I->sendPOST('/possession/default/flk-webhook', $payload);
    $I->sendPOST('/possession/default/flk-webhook', $payload);

    // Verify only processed once
    $I->seeNumRecords(1, 'webhook_logs', [
        'idempotency_key' => 'webhook-abc-001',
    ]);
}
```

---

## Integration Test Execution

```bash
# Run integration suite
cd backend && codecept run functional integration

# Specific integration test file
codecept run functional integration/FLKDocumentIntegrationCest

# With verbose output
codecept run functional -v

# Run against staging env
APP_ENV=staging codecept run functional integration
```

### Common Integration Test Mistakes

- **Mocking external APIs in integration tests** — use staging credentials, not fakes
- **No teardown** — S3 files and DB records must be cleaned up (use `RefreshDatabase` equivalent)
- **No timeout handling** — set explicit timeouts (`Http::timeout(30)`)
- **Assuming empty DB** — seed data realistically before assertions
