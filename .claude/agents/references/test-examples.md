# Test Examples Reference

Codeception PHP test examples for the qa-testing-skill. This project uses Codeception (NOT PHPUnit/Pest/Playwright).

---

## Positive Test (Happy Path)

```php
<?php declare(strict_types=1);

namespace backend\tests\functional\possession;

use backend\tests\FunctionalTester;

class PossessionCest
{
    public function _fixtures(): array
    {
        return [
            'users'      => \backend\tests\fixtures\UsersFixture::class,
            'properties' => \backend\tests\fixtures\PropertyFixture::class,
        ];
    }

    /**
     * AC1: User can create a possession record successfully
     */
    public function createPossessionSuccess(FunctionalTester $I): void
    {
        $I->amLoggedInAs(1);
        $I->sendPOST('/possession/default/create', [
            'PropertyPossession' => [
                'property_id' => 'valid-property-uuid',
                'status'      => 'pending',
            ],
        ]);
        $I->seeResponseCodeIs(200);
        $I->seeResponseIsJson();
        $I->seeResponseContainsJson(['success' => true]);
        $I->seeInDatabase('property_possession', ['status' => 'pending']);
    }
}
```

---

## Negative Test (Validation Errors)

```php
public function createPossessionMissingRequiredFields(FunctionalTester $I): void
{
    $I->amLoggedInAs(1);
    $I->sendPOST('/possession/default/create', [
        'PropertyPossession' => [], // Missing required fields
    ]);
    $I->seeResponseCodeIs(200);
    $I->seeResponseContainsJson(['success' => false]);
}

public function createPossessionInvalidStatus(FunctionalTester $I): void
{
    $I->amLoggedInAs(1);
    $I->sendPOST('/possession/default/create', [
        'PropertyPossession' => [
            'property_id' => 'valid-uuid',
            'status'      => 'invalid-status',
        ],
    ]);
    $I->seeResponseContainsJson(['success' => false]);
}

public function createPossessionNonexistentProperty(FunctionalTester $I): void
{
    $I->amLoggedInAs(1);
    $I->sendPOST('/possession/default/create', [
        'PropertyPossession' => [
            'property_id' => 'f47ac10b-58cc-4372-a567-000000000000',
            'status'      => 'pending',
        ],
    ]);
    $I->seeResponseContainsJson(['success' => false]);
}
```

---

## Authorization Test

```php
public function cannotDeleteOtherUsersPossession(FunctionalTester $I): void
{
    // Logged in as user 2, trying to delete user 1's record
    $I->amLoggedInAs(2);
    $I->sendDELETE('/possession/default/delete?id=user-1-possession-uuid');
    $I->seeResponseCodeIs(403);
}

public function unauthenticatedUserCannotAccess(FunctionalTester $I): void
{
    $I->sendGET('/possession/default/list');
    $I->seeResponseCodeIs(401); // or redirect to login
}
```

---

## Unit Test (Codeception)

```php
<?php declare(strict_types=1);

namespace backend\tests\unit\possession;

use backend\modules\possession\models\PropertyPossession;
use Codeception\Test\Unit;

class PropertyPossessionTest extends Unit
{
    protected \UnitTester $tester;

    public function testValidationRequiresPropertyId(): void
    {
        $model = new PropertyPossession();
        $model->status = 'pending';
        expect($model->validate())->false();
        expect($model->errors)->hasKey('property_id');
    }

    public function testValidationPassesWithRequiredFields(): void
    {
        $model = new PropertyPossession();
        $model->property_id = 'valid-uuid';
        $model->status      = 'pending';
        expect($model->validate(['property_id', 'status']))->true();
    }

    public function testStatusMustBeInAllowedValues(): void
    {
        $model = new PropertyPossession();
        $model->property_id = 'valid-uuid';
        $model->status      = 'not-a-valid-status';
        $model->validate();
        expect($model->errors)->hasKey('status');
    }
}
```

---

## Performance Test (N+1 Detection)

```php
public function testNoNPlusOneQueriesOnList(FunctionalTester $I): void
{
    // Seed multiple records
    for ($i = 0; $i < 10; $i++) {
        $I->haveInDatabase('property_possession', [
            'id'          => \Ramsey\Uuid\Uuid::uuid4()->toString(),
            'property_id' => 'test-property-uuid',
            'status'      => 'pending',
        ]);
    }

    $I->amLoggedInAs(1);

    // Enable query logging before request
    \Yii::$app->db->enableProfiling = true;

    $I->sendGET('/possession/default/list');

    $I->seeResponseCodeIs(200);
    // Actual query count verification via profiling log
}
```

---

## Regression Test

```php
/**
 * Verify existing records still accessible after refactor
 */
public function existingPossessionsStillVisible(FunctionalTester $I): void
{
    // Record existed before this feature
    $I->haveInDatabase('property_possession', [
        'id'          => 'existing-uuid',
        'property_id' => 'test-property-uuid',
        'status'      => 'pending',
    ]);

    $I->amLoggedInAs(1);
    $I->sendGET('/possession/default/view?id=existing-uuid');
    $I->seeResponseCodeIs(200);
    $I->seeResponseContainsJson(['id' => 'existing-uuid']);
}
```

---

## Fixture Example

```php
<?php declare(strict_types=1);

namespace backend\tests\fixtures;

use yii\test\ActiveFixture;

class PropertyFixture extends ActiveFixture
{
    public $modelClass = \backend\modules\estate\models\Property::class;
    public $dataFile   = '@backend/tests/_data/property.php';
}
```

```php
// backend/tests/_data/property.php
return [
    'property1' => [
        'id'      => 'test-property-uuid',
        'address' => '123 Test Street',
        'status'  => 'active',
    ],
];
```

---

## Test Execution Commands

```bash
# Run all backend tests
cd backend && codecept run

# Unit tests only (fast, no DB)
codecept run unit

# Functional tests (with DB)
codecept run functional

# Single test file
codecept run unit modules/possession/PropertyPossessionTest

# Single test method
codecept run unit modules/possession/PropertyPossessionTest:testValidationRequiresPropertyId

# With verbose output
codecept run -v
```

---

## Bug Report Format

```markdown
## Bug Report: Validation Not Enforced

**Severity:** High (Security)
**Component:** PossessionController::actionCreate

**Steps to Reproduce:**
1. POST /possession/default/create with empty body
2. Observe response

**Expected:** success=false with validation errors
**Actual:** success=true, record created with empty fields

**Evidence:**
```
POST body: {}
Response: {"success": true, "data": {"id": "new-uuid"}}
```

**Suggested Fix:** Verify $model->validate() called before save()
```
