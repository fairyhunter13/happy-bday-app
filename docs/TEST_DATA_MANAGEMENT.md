# Test Data Management Guide

**Last Updated:** 2026-01-04
**Purpose:** Best practices for managing test data

## Principles

1. **Isolated:** Tests don't interfere with each other
2. **Reproducible:** Same data produces same results
3. **Realistic:** Data resembles production
4. **Efficient:** Fast creation and cleanup

## Test Data Strategies

### 1. Factory Functions

```typescript
import { testDataFactory, uniqueEmail } from '../helpers/database-test-setup.js';

const createUser = testDataFactory({
  firstName: 'Test',
  lastName: 'User',
  email: uniqueEmail('default'),
  timezone: 'America/New_York',
});

// Use defaults
const user1 = await repo.create(createUser());

// Override specific fields
const user2 = await repo.create(
  createUser({ email: uniqueEmail('custom') })
);
```

### 2. Unique Data Generation

```typescript
// Unique emails
const email = uniqueEmail('test'); // test-1641234567-123@test.com

// Unique IDs
const userId = uniqueTestData('user'); // user-1641234567-456

// Batch creation
const users = await batchCreate(10, (i) =>
  repo.create({ email: uniqueEmail(`user-${i}`) })
);
```

### 3. Database Fixtures

```typescript
// Load pre-seeded data
const seedData = {
  users: [
    { id: 'user-1', email: 'alice@test.com' },
    { id: 'user-2', email: 'bob@test.com' },
  ],
};

beforeEach(async () => {
  await loadFixtures(seedData);
});
```

## Cleanup Strategies

### Automatic Cleanup (Recommended)

```typescript
import { setupDatabaseTest } from '../helpers/database-test-setup.js';

// Auto-cleanup between tests
const dbTest = setupDatabaseTest((db) => new UserRepository(db));

it('creates user', async () => {
  // Database cleaned before this test
  const user = await dbTest.repository.create({ ... });
  expect(user).toBeDefined();
  // Database will be cleaned before next test
});
```

### Manual Cleanup

```typescript
afterEach(async () => {
  await cleanDatabase(testContainer.getPool());
});
```

### Transaction Rollback

```typescript
beforeEach(async () => {
  transaction = await db.begin();
});

afterEach(async () => {
  await transaction.rollback(); // All changes reverted
});
```

## Avoiding Test Data Issues

### Problem: Flaky Tests (Non-Deterministic)

❌ **Bad:**
```typescript
it('finds users', async () => {
  const users = await repo.findAll();
  expect(users.length).toBe(5); // Breaks if other tests run first!
});
```

✅ **Good:**
```typescript
it('finds users created in this test', async () => {
  const user = await repo.create({ ... });
  const found = await repo.findById(user.id);
  expect(found).not.toBeNull();
});
```

### Problem: Data Collisions

❌ **Bad:**
```typescript
const user = await repo.create({
  email: 'test@example.com', // Duplicate in parallel tests!
});
```

✅ **Good:**
```typescript
const user = await repo.create({
  email: uniqueEmail('test'), // Always unique
});
```

### Problem: Slow Tests

❌ **Bad:**
```typescript
beforeEach(async () => {
  await seedDatabase(10000); // Creates 10k records!
});
```

✅ **Good:**
```typescript
beforeEach(async () => {
  // Only create what you need
  testUser = await repo.create({ ... });
});
```

## Production-Like Data

### Realistic Timezones

```typescript
const timezones = [
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const users = await batchCreate(100, (i) =>
  repo.create({
    timezone: timezones[i % timezones.length],
    birthdayDate: randomBirthday(),
  })
);
```

### Realistic Dates

```typescript
function randomBirthday() {
  const year = 1950 + Math.floor(Math.random() * 50);
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(`${year}-${month}-${day}`);
}
```

## Data Seeding for Performance Tests

```bash
# Seed 100k users for load testing
npm run db:seed:perf

# Seed realistic distribution
npm run db:seed -- --users=10000 --timezones=24
```

## Best Practices Summary

✅ Use factory functions for reusable data
✅ Generate unique identifiers
✅ Clean up after each test
✅ Create minimal data needed
✅ Use realistic test data
✅ Avoid hard-coded values

❌ Share data between tests
❌ Use production data in tests
❌ Create massive datasets
❌ Hard-code IDs or emails
❌ Skip cleanup

---

**Related:**
- [TEST_WRITING_GUIDE.md](./TEST_WRITING_GUIDE.md)
- [database-test-setup.ts](../tests/helpers/database-test-setup.ts)
