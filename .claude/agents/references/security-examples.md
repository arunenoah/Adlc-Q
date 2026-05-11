# Security Audit Examples Reference

OWASP PHP/config code examples for the security-audit-skill. Use these to identify and explain vulnerabilities.

---

## Authentication

```php
// WRONG - plaintext password
$user->update(['password' => $request->password]);

// CORRECT - hashed (Yii2 uses Yii::$app->security->generatePasswordHash())
$user->password = Yii::$app->security->generatePasswordHash($request->password);
$user->save();
```

Session configuration checklist:
- `expire_on_close` set appropriately
- Session IDs regenerated on login
- No session data in cookies (use server-side storage)

---

## Authorization (IDOR / Broken Access Control)

```php
// WRONG - no check
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

## SQL Injection

```php
// WRONG - injection possible
$sql = "SELECT * FROM users WHERE name LIKE '$query'";
$results = Yii::$app->db->createCommand($sql)->queryAll();

// CORRECT - ActiveRecord (safe)
$results = User::find()->where(['like', 'name', $query])->all();

// CORRECT - parameterized raw query
$results = Yii::$app->db->createCommand('SELECT * FROM users WHERE name LIKE :q')
    ->bindValues([':q' => '%' . $query . '%'])
    ->queryAll();
```

---

## Rate Limiting

```php
// WRONG - no rate limit
public function behaviors(): array { return []; }

// CORRECT - Yii2 rate limiting behavior
public function behaviors(): array
{
    return [
        'rateLimiter' => [
            'class' => \yii\filters\RateLimiter::class,
        ],
    ];
}
// Model must implement RateLimitInterface: getRateLimit() and loadAllowance()
```

---

## Sensitive Data in Responses

```php
// WRONG - exposes password hash
return $this->asJson($user->toArray());

// CORRECT - fields() method controls output
class Users extends AppModel
{
    public function fields(): array
    {
        $fields = parent::fields();
        unset($fields['password'], $fields['auth_key']);
        return $fields;
    }
}
```

---

## XSS Prevention

```php
// In Yii2 views - always use Html::encode() or HtmlPurifier
// WRONG
echo $model->user_name;

// CORRECT
echo \yii\helpers\Html::encode($model->user_name);

// Models using TraitModel get XSS filtering automatically in beforeValidate()
// via SecurityService::modelXssFilter()
```

---

## Insecure Deserialization

```php
// WRONG - dangerous
$object = unserialize($_POST['data']);

// CORRECT - use JSON
$object = json_decode(Yii::$app->request->post('data'), true);
```

---

## Dependency Vulnerabilities

```bash
# Check for vulnerable dependencies
composer audit

# Update all packages
composer update

# Check for outdated packages
composer outdated
```

---

## Logging Security Events

```php
// CORRECT - log security events without sensitive data
Yii::warning('Unauthorized access attempt: resource=' . $resourceId
    . ' user=' . Yii::$app->user->id, __METHOD__);

Yii::warning('Failed login: email=' . $email
    . ' ip=' . Yii::$app->request->userIP, __METHOD__);

Yii::info('Application approved: id=' . $application->id
    . ' by=' . Yii::$app->user->id, __METHOD__);
```

---

## FLKitOver Credentials

```php
// WRONG - hardcoded
$response = Yii::$app->httpclient->post($url, [
    'auth' => ['dev@company.com', 'password123']
]);

// CORRECT - environment via params
$response = Yii::$app->httpclient->post($url, [
    'auth' => [
        Yii::$app->params['flk']['email'],
        Yii::$app->params['flk']['password'],
    ]
]);
```

---

## FLK Webhook Signature

```php
// CORRECT - validate webhook signature to prevent spoofing
public function actionFlkWebhook(): void
{
    $signature = Yii::$app->request->headers->get('X-FLK-Signature');
    $payload   = Yii::$app->request->rawBody;
    $secret    = Yii::$app->params['flk']['webhook_secret'];

    $expected = hash_hmac('sha256', $payload, $secret);

    if (!hash_equals($expected, $signature)) {
        Yii::warning('Invalid FLK webhook signature', __METHOD__);
        throw new \yii\web\UnauthorizedHttpException('Invalid signature');
    }

    $data = Yii::$app->request->post();
    // process webhook...
}
```

---

## FLK Error Handling

```php
// WRONG - exposes internal error
} catch (FLKApiException $e) {
    return $this->asJson(['error' => $e->getMessage()]);
}

// CORRECT - log details, return generic message
} catch (FLKApiException $e) {
    Yii::error('FLK error: ' . $e->getMessage() . ' code=' . $e->getCode(), __METHOD__);
    return $this->asJson(['error' => 'Failed to create document']);
}
```

---

## AWS S3 Security

```php
// WRONG - public access
Yii::$app->storage->put($path, $content, 'public');

// CORRECT - private with signed URLs
Yii::$app->storage->put($path, $content, 'private');

// Generate signed URL with expiry
$url = Yii::$app->storage->getTemporaryUrl($path, '+24 hours');
```

---

## Security Audit Checklist

- [ ] No hardcoded credentials in source
- [ ] All user input validated via model rules
- [ ] IDOR: ownership checked before any update/delete
- [ ] SQL injection: only ActiveRecord or parameterized queries
- [ ] Rate limiting on sensitive endpoints
- [ ] Sensitive data excluded from API responses and logs
- [ ] FLKitOver: credentials from env, webhook signature verified
- [ ] AWS S3: private visibility, signed URLs only
- [ ] Security events logged (login failures, unauthorized attempts)
- [ ] Dependencies audited (`composer audit`)
- [ ] HTTPS enforced
- [ ] XSS filtered (TraitModel or Html::encode in views)
- [ ] Error messages don't expose internal details
