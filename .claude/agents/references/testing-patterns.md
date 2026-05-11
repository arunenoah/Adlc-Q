# Testing Patterns Reference

This file contains test code examples and patterns for the qa-tester agent.
Read this file ONLY when you need a specific pattern during test creation.

## Test Commands

- `composer test` - Run all PHPUnit tests (configured in composer.json)
- `php artisan test` - Alternative test runner
- `php artisan test --filter PetApplicationTest` - Run specific test class
- `php artisan migrate:fresh --seed` - Fresh database with seeders
- `php artisan queue:work` - Test queue processing
- `php artisan schedule:run` - Test scheduled tasks

## Test Environment Setup

- Uses SQLite in-memory database for fast tests
- Separate testing database configuration
- Mail faker for email testing
- Storage faker for file uploads
- Queue sync for immediate processing in tests

## Test Structure

- Feature tests: `tests/Feature/` - API endpoint testing
- Unit tests: `tests/Unit/` - Service and business logic testing
- Test data: `database/factories/` - Model factories
- Seeders: `database/seeders/` - Test data setup

## Feature Test Pattern

```php
<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\PetApplication;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class PetApplicationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Additional setup if needed
    }

    public function test_can_submit_pet_application_successfully(): void
    {
        // Arrange
        $property = Property::factory()->create();
        $applicationData = [
            'property_id' => $property->id,
            'tenant_name' => 'John Doe',
            'tenant_email' => 'john@example.com',
            'tenant_phone' => '0412345678',
            'pets' => [
                [
                    'name' => 'Buddy',
                    'type' => 'dog',
                    'breed' => 'Labrador',
                    'age' => 3,
                    'weight' => 25.5
                ]
            ]
        ];

        // Act
        $response = $this->postJson('/api/pet-applications', $applicationData);

        // Assert
        $response->assertStatus(201)
                ->assertJsonStructure([
                    'success',
                    'data' => [
                        'id',
                        'tenant_name',
                        'tenant_email',
                        'status',
                        'created_at'
                    ],
                    'message'
                ])
                ->assertJson([
                    'success' => true,
                    'message' => 'Pet application submitted successfully'
                ]);

        $this->assertDatabaseHas('pet_applications', [
            'tenant_email' => 'john@example.com',
            'status' => 'pending'
        ]);

        $this->assertDatabaseHas('pets', [
            'name' => 'Buddy',
            'type' => 'dog'
        ]);
    }

    public function test_validation_fails_for_invalid_data(): void
    {
        // Act
        $response = $this->postJson('/api/pet-applications', []);

        // Assert
        $response->assertStatus(422)
                ->assertJsonValidationErrors([
                    'property_id',
                    'tenant_name',
                    'tenant_email',
                    'pets'
                ]);
    }
}
```

## Service Test Pattern

```php
namespace Tests\Unit;

use App\Services\PetApplicationService;
use App\Models\Property;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PetApplicationServiceTest extends TestCase
{
    use RefreshDatabase;

    private PetApplicationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(PetApplicationService::class);
    }

    public function test_creates_application_with_valid_data(): void
    {
        // Arrange
        $property = Property::factory()->create();
        $data = [
            'property_id' => $property->id,
            'tenant_name' => 'Jane Doe',
            'tenant_email' => 'jane@example.com',
            // ... other data
        ];

        // Act
        $application = $this->service->submitApplication($data);

        // Assert
        $this->assertInstanceOf(PetApplication::class, $application);
        $this->assertEquals('jane@example.com', $application->tenant_email);
        $this->assertEquals('pending', $application->status);
    }
}
```

## FLKitOver Integration Testing

```php
public function test_flk_document_creation_workflow(): void
{
    // Mock FLK service or use staging environment
    $this->mock(FLKService::class, function ($mock) {
        $mock->shouldReceive('createDocument')
             ->once()
             ->andReturn(['document_id' => 'test-doc-id']);
    });

    // Test the complete workflow
}
```

## Security Testing

```php
public function test_rate_limiting_enforced(): void
{
    // Test rate limiting on sensitive endpoints
    for ($i = 0; $i < 11; $i++) {
        $response = $this->postJson('/api/pet-applications', $this->validData());
    }

    $response->assertStatus(429); // Too Many Requests
}

public function test_domain_validation_blocks_unauthorized_requests(): void
{
    $response = $this->withHeaders(['Origin' => 'malicious.com'])
                    ->postJson('/api/pet-applications', $this->validData());

    $response->assertStatus(403);
}
```

## Integration Testing Areas

- **API Endpoints**: All CRUD operations with proper HTTP status codes
- **FLKitOver Integration**: Document creation, signing workflows, webhook processing
- **AWS S3**: File uploads, signed URLs, document storage
- **Email Services**: Template rendering, delivery, attachments
- **SMS Services**: Twilio integration, message delivery
- **Security**: Rate limiting, domain validation, authentication
- **Database**: Transactions, relationships, data integrity
- **Queue Processing**: Background jobs, error handling

## Performance Testing

- Database query optimization (check for N+1 problems)
- Response time benchmarks
- Memory usage monitoring
- File upload performance

## Bug Report Format

```markdown
## Bug Report: [Clear, descriptive title]

**Severity**: Critical/High/Medium/Low
**Environment**: Testing/Staging
**Component**: PetApplicationController

**Steps to Reproduce**:
1. Submit pet application with invalid UUID for property_id
2. Observe server response

**Expected Behavior**:
- Should return 422 validation error with proper message

**Actual Behavior**:
- Returns 500 server error with stack trace exposed

**Evidence**:
- Screenshot of error response
- Log entries showing the error

**Impact**:
- Security risk (internal details exposed)
- Poor user experience
```

## Test Data Management

- Use factories for consistent test data
- Clean up test data after each test
- Use transactions for test isolation
- Seed reference data (properties, agents) for tests
