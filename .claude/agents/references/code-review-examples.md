# Code Review Examples Reference

PHP correct/incorrect patterns for the code-reviewer-quality-skill. Use these to identify and explain issues.

---

## Strict Types

```php
// WRONG
<?php
namespace app\services;

// CORRECT
<?php declare(strict_types=1);
namespace app\services;
```

---

## Null Safety

```php
// WRONG - potential null exception
$application = PetApplication::findOne(['id' => $id]);
$application->updateStatus('approved');

// CORRECT
$application = PetApplication::findOne(['id' => $id]);
if (!$application) {
    throw new \yii\web\NotFoundHttpException('Application not found');
}
$application->updateStatus('approved');
```

---

## Input Validation

```php
// WRONG
public function rules(): array { return []; }

// CORRECT
public function rules(): array
{
    return [
        [['property_id', 'tenant_name', 'tenant_email'], 'required'],
        [['tenant_email'], 'email'],
        [['property_id'], 'exist', 'targetClass' => Property::class, 'targetAttribute' => ['property_id' => 'id']],
        [['tenant_name'], 'string', 'max' => 255],
    ];
}
```

---

## Authorization

```php
// WRONG - no ownership check
public function actionDelete(string $id): void
{
    PetApplication::findOne(['id' => $id])->delete();
}

// CORRECT
public function actionDelete(string $id): void
{
    $application = PetApplication::findOne(['id' => $id]);
    if (!$application || $application->user_id !== Yii::$app->user->id) {
        throw new \yii\web\ForbiddenHttpException('Unauthorized');
    }
    $application->delete();
}
```

---

## Hardcoded Credentials

```php
// WRONG - CRITICAL
$response = Yii::$app->httpclient->post($url, [
    'auth' => ['dev@company.com', 'Test@12345']
]);

// CORRECT
$response = Yii::$app->httpclient->post($url, [
    'auth' => [Yii::$app->params['flk']['email'], Yii::$app->params['flk']['password']]
]);
```

---

## SQL Injection Prevention

```php
// WRONG - vulnerable
$apps = Yii::$app->db->createCommand("SELECT * FROM applications WHERE id = '$id'")->queryAll();

// CORRECT - ActiveRecord
$apps = PetApplication::find()->where(['id' => $id])->all();

// CORRECT - parameterized if raw needed
$apps = Yii::$app->db->createCommand('SELECT * FROM applications WHERE id = :id')
    ->bindValues([':id' => $id])
    ->queryAll();
```

---

## N+1 Queries

```php
// WRONG - N+1
$applications = PetApplication::find()->all();
foreach ($applications as $app) {
    echo $app->property->name; // Extra query per row
}

// CORRECT - 2 queries total
$applications = PetApplication::find()->with('property')->all();
foreach ($applications as $app) {
    echo $app->property->name; // No extra query
}
```

---

## Missing Indexes

```php
// WRONG
$this->createTable('pet_applications', [
    'status' => $this->string(50),
]);

// CORRECT
$this->createTable('pet_applications', [
    'status' => $this->string(50),
]);
$this->createIndex('idx_status', 'pet_applications', 'status');
```

---

## Error Handling

```php
// WRONG
public function submitApplication(array $data): PetApplication
{
    return $this->flkService->createDocument($data); // unhandled
}

// CORRECT
public function submitApplication(array $data): PetApplication
{
    try {
        return $this->flkService->createDocument($data);
    } catch (FLKApiException $e) {
        Yii::error('FLK API error: ' . $e->getMessage(), __METHOD__);
        throw new PetApplicationException('Failed to create document', 0, $e);
    }
}
```

---

## Debug Code

```php
// WRONG - never in production
var_dump($data);
die('Debug');

// CORRECT
Yii::debug('Submitting application', __METHOD__);
```

---

## UUID Behavior

```php
// WRONG - no UUID
class PetApplication extends ActiveRecord {}

// CORRECT
class PetApplication extends ActiveRecord
{
    public function behaviors(): array
    {
        return [['class' => UuidBehavior::class, 'attributes' => ['id']]];
    }
}
```

---

## PHPDoc

```php
// WRONG
/** Submit application */
public function submitApplication(array $data): PetApplication {}

// CORRECT
/**
 * Submit a new pet application.
 *
 * @param array $data Application data
 * @return PetApplication The created application
 * @throws PetApplicationException If submission fails
 */
public function submitApplication(array $data): PetApplication {}
```

---

## Type Hints

```php
// WRONG
public function submitApplication($data) {}

// CORRECT
public function submitApplication(array $data): PetApplication {}
```

---

## Dependency Injection

```php
// WRONG - service locator
public function submitApplication(array $data): void
{
    $service = Yii::$app->get('flkService');
}

// CORRECT - constructor injection
private FLKService $flkService;

public function __construct(FLKService $flkService)
{
    $this->flkService = $flkService;
}
```

---

## Database Transactions

```php
// WRONG - partial save possible
$application = new PetApplication();
$application->save();
foreach ($data['pets'] as $petData) {
    $pet = new Pet();
    $pet->save(); // Fails = app saved but no pets
}

// CORRECT
$transaction = Yii::$app->db->beginTransaction();
try {
    $application = new PetApplication();
    $application->save();
    foreach ($data['pets'] as $petData) {
        $pet = new Pet();
        $pet->save();
    }
    $transaction->commit();
} catch (\Exception $e) {
    $transaction->rollBack();
    throw $e;
}
```

---

## Exception Specificity

```php
// WRONG - too broad
try {
} catch (Exception $e) {}

// CORRECT - specific types
try {
} catch (FLKApiException $e) {
    Yii::error('FLK error: ' . $e->getMessage(), __METHOD__);
} catch (\yii\db\Exception $e) {
    Yii::error('DB error: ' . $e->getMessage(), __METHOD__);
}
```

---

## Consistent Error Responses

```php
// WRONG - inconsistent
return ['error' => 'Validation failed'];
return ['message' => 'Not found'];

// CORRECT
return ['success' => false, 'message' => 'Validation failed'];
```

---

## Relationships

```php
// WRONG - no relations defined
class PetApplication extends ActiveRecord {}

// CORRECT
class PetApplication extends ActiveRecord
{
    public function getProperty(): ActiveQuery
    {
        return $this->hasOne(Property::class, ['id' => 'property_id']);
    }

    public function getPets(): ActiveQuery
    {
        return $this->hasMany(Pet::class, ['application_id' => 'id']);
    }
}
```
