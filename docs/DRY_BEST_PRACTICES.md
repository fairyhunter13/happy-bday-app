# DRY Principle Best Practices

**Last Updated:** 2026-01-04
**Purpose:** Lessons learned from eliminating 1000+ lines of code duplication

## What is DRY?

**Don't Repeat Yourself** - Every piece of knowledge should have a single, unambiguous, authoritative representation within a system.

## Major Improvements Implemented

### 1. Test Setup Utilities (1000+ lines saved)

**Before:**
```typescript
// Repeated in 40+ test files
let testContainer: PostgresTestContainer;
let queryClient: ReturnType<typeof postgres>;
let db: ReturnType<typeof drizzle>;
let repository: UserRepository;

beforeAll(async () => {
  testContainer = new PostgresTestContainer();
  // ... 30+ lines of setup
});

afterAll(async () => {
  // ... 10+ lines of cleanup
});
```

**After:**
```typescript
import { setupDatabaseTest } from '../helpers/database-test-setup.js';

const dbTest = setupDatabaseTest((db) => new UserRepository(db));
// Done! 2 lines instead of 40+
```

**Key Learning:** Identify repetitive patterns early and extract them into utilities.

### 2. Vitest Configuration (200+ lines saved)

**Before:**
```typescript
// Duplicated in 4 config files
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['node_modules', 'dist'],
    // ... 50+ identical lines
  }
});
```

**After:**
```typescript
// vitest.config.base.ts - Single source of truth
export default defineConfig({ /* base config */ });

// vitest.config.unit.ts - Extends base
import baseConfig from './vitest.config.base';
export default mergeConfig(baseConfig, defineConfig({ /* unit-specific */ }));
```

**Key Learning:** Use configuration inheritance patterns (extend, merge, compose).

### 3. GitHub Actions Composite Actions (500+ lines saved)

**Before:**
```yaml
# Repeated in 12 workflows
- name: Setup SOPS
  run: |
    curl -LO https://github.com/getsops/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64
    # ... 20+ lines
```

**After:**
```yaml
# .github/actions/setup-sops/action.yml - Reusable action
- uses: ./.github/actions/setup-sops

# Used in workflows with 1 line instead of 20+
```

**Key Learning:** Extract repeated workflow steps into composite actions.

### 4. Docker Compose YAML Anchors (200+ lines saved)

**Before:**
```yaml
# Duplicated in 4 files
postgres:
  image: postgres:15-alpine
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5
```

**After:**
```yaml
# Define once
x-healthcheck-postgres: &healthcheck-postgres
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 10s
  timeout: 5s
  retries: 5

# Reference everywhere
postgres:
  image: postgres:15-alpine
  healthcheck:
    <<: *healthcheck-postgres
```

**Key Learning:** Use YAML anchors for shared configuration blocks.

## DRY Principles Applied

### 1. Single Source of Truth

✅ **Do:**
- One configuration file
- One utility function
- One test helper

❌ **Don't:**
- Copy-paste code
- Duplicate constants
- Replicate logic

### 2. Abstraction Levels

```typescript
// ✅ GOOD: Appropriate abstraction
const createTestUser = testDataFactory({
  timezone: 'America/New_York',
});

// ❌ BAD: Over-abstraction
const createUserWithTimezoneAndEmailAndBirthdayAndPreferences = (/* 10 parameters */);
```

**Key Learning:** Abstract when you have 3+ duplications, not at 2.

### 3. Configuration Inheritance

```typescript
// Base configuration
const baseConfig = {
  timeout: 30000,
  retries: 3,
};

// Specific configurations extend base
const integrationConfig = {
  ...baseConfig,
  timeout: 60000, // Override specific values
};
```

### 4. Factory Functions

```typescript
// Reusable data creation
const createUser = testDataFactory({
  firstName: 'Test',
  lastName: 'User',
  timezone: 'America/New_York',
});

// Use with defaults
const user1 = createUser();

// Override specific fields
const user2 = createUser({ firstName: 'Jane' });
```

## When NOT to DRY

### 1. Coincidental Duplication

```typescript
// DON'T extract this - different purposes
function calculateUserAge(birthdate: Date) { /* ... */ }
function calculateMessageDelay(scheduledTime: Date) { /* ... */ }
```

### 2. Premature Abstraction

Wait for 3+ occurrences before abstracting:
- 1 occurrence: Write it
- 2 occurrences: Note it
- 3+ occurrences: Abstract it

### 3. Different Change Rates

```typescript
// DON'T combine - these change for different reasons
const USER_VALIDATION_RULES = { /* user-specific */ };
const MESSAGE_VALIDATION_RULES = { /* message-specific */ };
```

## DRY Detection Tools

### 1. Manual Code Review
```bash
# Find duplicated code
grep -r "similar pattern" src/
```

### 2. JSCPD (JavaScript Copy-Paste Detector)
```bash
npm run jscpd
# Reports: 47 duplications found, 12.5% duplication
```

### 3. SonarQube
- Detects code smells
- Measures code duplication
- Suggests refactoring

## Refactoring Workflow

1. **Identify:** Find duplicated code (>3 occurrences)
2. **Extract:** Create utility/helper function
3. **Replace:** Update all occurrences
4. **Test:** Verify functionality unchanged
5. **Document:** Add examples and docs

## Measurable Impact

### Before DRY Refactoring
- **Code duplication:** 12.5%
- **Test setup:** 40+ lines per test file
- **CI/CD config:** 500+ duplicated lines
- **Maintainability:** Low (change requires 10+ file updates)

### After DRY Refactoring
- **Code duplication:** < 5%
- **Test setup:** 2 lines per test file
- **CI/CD config:** Reusable actions
- **Maintainability:** High (change in one place)

## Benefits Realized

✅ **Faster development:** Less code to write
✅ **Easier maintenance:** Single source of truth
✅ **Fewer bugs:** Fix once, fixed everywhere
✅ **Better testability:** Shared utilities well-tested
✅ **Improved readability:** Less noise in test files

## Anti-Patterns to Avoid

❌ **Copy-Paste Programming**
```typescript
// DON'T copy-paste with minor tweaks
function createBirthdayMessage() { /* ... */ }
function createAnniversaryMessage() { /* almost identical */ }

// DO extract common logic
function createMessage(type: 'BIRTHDAY' | 'ANNIVERSARY') { /* shared logic */ }
```

❌ **Magic Numbers/Strings**
```typescript
// DON'T use literals
setTimeout(callback, 30000);

// DO use named constants
const TIMEOUT_MS = 30_000;
setTimeout(callback, TIMEOUT_MS);
```

❌ **God Functions**
```typescript
// DON'T create one function that does everything
function doEverything() { /* 500 lines */ }

// DO compose smaller functions
function validateInput() { /* ... */ }
function processData() { /* ... */ }
function sendNotification() { /* ... */ }
```

## Tools and Resources

- **JSCPD:** Duplication detection
- **SonarQube:** Code quality analysis
- **ESLint:** Enforce coding standards
- **Prettier:** Consistent formatting

## Conclusion

DRY is not about eliminating every line of similar code—it's about reducing meaningful duplication that makes maintenance harder. Focus on:

1. Extract when you see 3+ duplications
2. Create appropriate abstractions
3. Use inheritance and composition
4. Maintain single sources of truth
5. Measure and track duplication metrics

**Result:** More maintainable, testable, and reliable code.

---

**Related:**
- [dry-principle-audit.md](../plan/03-research/dry-principle-audit.md)
- [database-test-setup.ts](../tests/helpers/database-test-setup.ts)
- [GitHub Actions](./.github/actions/)
