# Test Writing Guide for New Contributors

**Last Updated:** 2026-01-04
**Status:** Comprehensive Guide
**Target Audience:** New contributors, developers writing tests

---

## Table of Contents

1. [Introduction](#introduction)
2. [Test Philosophy](#test-philosophy)
3. [Test Types & When to Use Them](#test-types--when-to-use-them)
4. [Getting Started](#getting-started)
5. [Writing Unit Tests](#writing-unit-tests)
6. [Writing Integration Tests](#writing-integration-tests)
7. [Writing E2E Tests](#writing-e2e-tests)
8. [Test Data Management](#test-data-management)
9. [Common Patterns & Best Practices](#common-patterns--best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Introduction

This guide helps new contributors write effective, maintainable tests for the Birthday Message Scheduler application. Our test suite ensures:
- **Zero data loss** guarantee
- **Production reliability** (1M+ messages/day capacity)
- **Fast CI/CD** (tests complete in < 15 minutes)
- **High code coverage** (80%+ with meaningful tests)

---

## Test Philosophy

### Our Testing Principles

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it
   - Tests should survive refactoring

2. **Fast Feedback**
   - Unit tests run in milliseconds
   - Integration tests complete in seconds
   - E2E tests finish in minutes

3. **Realistic Tests**
   - Use real databases (TestContainers)
   - Test actual RabbitMQ behavior
   - Verify production scenarios

4. **Maintainable Tests**
   - Clear test names describe what's being tested
   - Use helper functions to reduce duplication
   - Clean setup/teardown with proper lifecycle management

---

## Test Types & When to Use Them

### Unit Tests (`tests/unit/**/*.test.ts`)

**Purpose:** Test individual functions/classes in isolation

**Use When:**
- Testing business logic without external dependencies
- Verifying error handling
- Testing pure functions and utilities
- Validating edge cases

**Characteristics:**
- Fast (< 10ms per test)
- No database, no queue, no network
- Use mocks for dependencies
- High coverage threshold (80%)

**Example Scenarios:**
- Timezone calculations
- Message validation logic
- Strategy pattern implementations
- Error transformation

### Integration Tests (`tests/integration/**/*.test.ts`)

**Purpose:** Test components working together with real dependencies

**Use When:**
- Testing repository database operations
- Verifying queue publisher/consumer interactions
- Testing service layer with real dependencies
- Validating data persistence

**Characteristics:**
- Medium speed (100ms-1s per test)
- Real PostgreSQL (TestContainer)
- Real RabbitMQ
- Clean database between tests

**Example Scenarios:**
- User CRUD operations
- Message scheduling with database
- Queue message flow
- Transaction handling

### E2E Tests (`tests/e2e/**/*.test.ts`)

**Purpose:** Test complete user workflows from API to database

**Use When:**
- Testing full API request/response cycles
- Verifying end-to-end workflows
- Testing authentication/authorization
- Validating production scenarios

**Characteristics:**
- Slower (1-5s per test)
- Real HTTP server
- All dependencies running
- Complete system verification

**Example Scenarios:**
- POST /user → creates user → schedules birthday message
- GET /user/:id → retrieves user with correct data
- Complete message sending workflow

---

## Getting Started

### Setup Your Environment

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Test Databases**
   ```bash
   # Docker Compose will start PostgreSQL, RabbitMQ, Redis
   docker-compose -f docker-compose.test.yml up -d
   ```

3. **Run Migrations**
   ```bash
   npm run db:migrate
   ```

### Run Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npm run test:unit tests/unit/services/timezone.service.test.ts

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Watch mode for development
npm run test:watch
```

---

## Writing Unit Tests

### Basic Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MyService } from '../../../src/services/my.service.js';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    // Fresh instance for each test
    service = new MyService();
  });

  describe('methodName', () => {
    it('should handle expected input correctly', () => {
      // Arrange
      const input = 'test-input';

      // Act
      const result = service.methodName(input);

      // Assert
      expect(result).toBe('expected-output');
    });

    it('should throw error for invalid input', () => {
      // Arrange
      const invalidInput = null;

      // Act & Assert
      expect(() => service.methodName(invalidInput)).toThrow('Invalid input');
    });
  });
});
```

### Mocking Dependencies

```typescript
import { vi } from 'vitest';

describe('ServiceWithDependencies', () => {
  it('should use mocked dependency', () => {
    // Mock external service
    const mockEmailService = {
      send: vi.fn().mockResolvedValue({ success: true }),
    };

    const service = new MyService(mockEmailService);

    await service.sendNotification('user@example.com');

    // Verify mock was called
    expect(mockEmailService.send).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: expect.any(String),
    });
  });
});
```

### Testing Async Code

```typescript
it('should handle async operations', async () => {
  const result = await service.asyncMethod();
  expect(result).toBeDefined();
});

it('should handle promise rejections', async () => {
  await expect(service.failingMethod()).rejects.toThrow('Error message');
});
```

---

## Writing Integration Tests

### Using Database Test Setup Utilities

```typescript
import { setupDatabaseTest, uniqueEmail } from '../../helpers/database-test-setup.js';
import { UserRepository } from '../../../src/repositories/user.repository.js';

describe('UserRepository Integration Tests', () => {
  // Setup handles all lifecycle management!
  const dbTest = setupDatabaseTest((db) => new UserRepository(db));

  it('should create user in database', async () => {
    const user = await dbTest.repository.create({
      firstName: 'John',
      lastName: 'Doe',
      email: uniqueEmail('john'),
      timezone: 'America/New_York',
    });

    expect(user.id).toBeDefined();

    // Verify persisted to database
    const found = await dbTest.repository.findById(user.id);
    expect(found).not.toBeNull();
    expect(found?.email).toBe(user.email);
  });
});
```

### Testing Transactions

```typescript
it('should rollback transaction on error', async () => {
  // Start transaction
  const transaction = await dbTest.db.transaction(async (tx) => {
    // Create user in transaction
    await userRepo.create({ ...userData }, tx);

    // Simulate error
    throw new Error('Transaction failed');
  });

  // User should not exist (rolled back)
  const users = await dbTest.repository.findAll();
  expect(users).toHaveLength(0);
});
```

### Testing Queue Operations

```typescript
import { MessagePublisher } from '../../../src/queue/publisher.js';
import { MessageConsumer } from '../../../src/queue/consumer.js';

it('should publish and consume message', async () => {
  const processed = { count: 0 };

  // Start consumer
  await consumer.start(async (msg) => {
    expect(msg.userId).toBe('test-user');
    processed.count++;
  });

  // Publish message
  await publisher.publishBirthdayMessage({
    userId: 'test-user',
    messageType: 'BIRTHDAY',
    scheduledFor: new Date(),
  });

  // Wait for processing
  await waitFor(() => Promise.resolve(processed.count === 1), 5000);

  expect(processed.count).toBe(1);
});
```

---

## Writing E2E Tests

### Testing API Endpoints

```typescript
import { app } from '../../../src/app.js';

describe('POST /user', () => {
  it('should create user and return 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/user',
      payload: {
        firstName: 'John',
        lastName: 'Doe',
        email: uniqueEmail('john'),
        timezone: 'America/New_York',
        birthdayDate: '1990-01-15',
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body);
    expect(body.id).toBeDefined();
    expect(body.email).toContain('john');
  });

  it('should return 409 for duplicate email', async () => {
    const email = uniqueEmail('duplicate');

    // Create first user
    await app.inject({
      method: 'POST',
      url: '/user',
      payload: {
        firstName: 'First',
        lastName: 'User',
        email,
        timezone: 'America/New_York',
      },
    });

    // Attempt duplicate
    const response = await app.inject({
      method: 'POST',
      url: '/user',
      payload: {
        firstName: 'Second',
        lastName: 'User',
        email, // Same email
        timezone: 'America/Chicago',
      },
    });

    expect(response.statusCode).toBe(409);
  });
});
```

---

## Test Data Management

### Using Test Data Factories

```typescript
import { testDataFactory, uniqueEmail, batchCreate } from '../../helpers/database-test-setup.js';

// Create reusable factory
const createTestUser = testDataFactory({
  firstName: 'Test',
  lastName: 'User',
  email: uniqueEmail('default'),
  timezone: 'America/New_York',
});

// Use with defaults
const user1 = await repository.create(createTestUser());

// Override specific fields
const user2 = await repository.create(
  createTestUser({
    firstName: 'Custom',
    email: uniqueEmail('custom'),
  })
);

// Create multiple users
const users = await batchCreate(10, (i) =>
  repository.create(
    createTestUser({
      email: uniqueEmail(`user-${i}`),
    })
  )
);
```

### Generating Unique Test Data

```typescript
import { uniqueEmail, uniqueTestData } from '../../helpers/database-test-setup.js';

// Unique emails
const email = uniqueEmail('test'); // test-1641234567-123@test.com

// Unique strings
const username = uniqueTestData('testuser'); // testuser-1641234567-123

// Avoid collisions in parallel tests
const userId = uniqueTestData('user-id'); // user-id-1641234567-456
```

---

## Common Patterns & Best Practices

### 1. Clear Test Names

```typescript
// ✅ GOOD - Describes what and why
it('should return 404 when user not found', async () => {
  // ...
});

// ❌ BAD - Vague
it('should work', () => {
  // ...
});
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should calculate birthday correctly', () => {
  // Arrange - Setup test data
  const birthdate = new Date('1990-01-15');
  const today = new Date('2026-01-15');

  // Act - Perform operation
  const isBirthday = service.isBirthdayToday(birthdate, today);

  // Assert - Verify result
  expect(isBirthday).toBe(true);
});
```

### 3. Test One Thing Per Test

```typescript
// ✅ GOOD - Focused test
it('should validate email format', () => {
  expect(validator.isValidEmail('test@example.com')).toBe(true);
});

it('should reject invalid email', () => {
  expect(validator.isValidEmail('invalid')).toBe(false);
});

// ❌ BAD - Testing multiple things
it('should validate user data', () => {
  expect(validator.isValidEmail('test@example.com')).toBe(true);
  expect(validator.isValidName('John')).toBe(true);
  expect(validator.isValidTimezone('America/New_York')).toBe(true);
});
```

### 4. Cleanup Resources

```typescript
describe('ResourceTest', () => {
  let resource: SomeResource;

  beforeEach(() => {
    resource = new SomeResource();
  });

  afterEach(async () => {
    // Always cleanup!
    await resource.cleanup();
  });

  it('should use resource', () => {
    // Test uses resource
  });
});
```

### 5. Use Timeouts for Async Tests

```typescript
it(
  'should process message within timeout',
  async () => {
    await waitFor(() => Promise.resolve(condition), 5000);
  },
  10000
); // 10 second timeout
```

---

## Troubleshooting

### Common Issues

#### "Database connection timeout"
**Cause:** TestContainer not started or database not ready
**Solution:**
```typescript
// Increase connection timeout in CI
queryClient = postgres(connectionString, {
  connect_timeout: 30, // 30 seconds
});
```

#### "Queue message not received"
**Cause:** Consumer not started or queue not created
**Solution:**
```typescript
// Ensure queue is asserted before publishing
await channel.assertQueue(queueName);
await publisher.publishMessage(message);
```

#### "Test fails intermittently"
**Cause:** Race condition or timing issue
**Solution:**
```typescript
// Use waitFor instead of setTimeout
await waitFor(() => Promise.resolve(condition), timeout);
```

#### "Out of memory in CI"
**Cause:** Too many parallel tests
**Solution:**
```bash
# Reduce thread count
vitest --maxThreads=2
```

### Debug Mode

```bash
# Run tests with debug output
DEBUG=* npm run test:unit

# Run single test file
npm run test:unit -- tests/unit/specific.test.ts

# Run with --reporter=verbose
npm run test:unit -- --reporter=verbose
```

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [TestContainers Documentation](https://node.testcontainers.org/)
- [TESTING_QUICKSTART.md](./TESTING_QUICKSTART.md) - Quick reference
- [TEST_VALIDATION_RESULTS_COMPLETE.md](./TEST_VALIDATION_RESULTS_COMPLETE.md) - Test results
- [test-patterns/](./test-patterns/) - Advanced testing patterns

---

**Happy Testing! 🧪**

If you have questions, check existing tests for examples or ask the team.
