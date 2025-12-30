# Message Strategy Pattern Implementation

## Overview

This document describes the implementation of the Strategy Pattern for message types in the Birthday Message Scheduler application. This architecture enables adding new message types (Anniversary, Onboarding, etc.) without modifying core scheduler code.

**Implementation Date:** December 30, 2025
**Status:** ✅ Complete
**Test Coverage:** 90 unit tests, all passing

---

## Architecture

### Strategy Pattern Benefits

1. **Open/Closed Principle**: Open for extension (new strategies), closed for modification
2. **Single Responsibility**: Each strategy handles one message type independently
3. **Dependency Inversion**: Core code depends on interface, not concrete implementations
4. **Easy Testing**: Each strategy can be tested in isolation

### Component Overview

```
src/strategies/
├── message-strategy.interface.ts    # Strategy interface + types
├── birthday-message.strategy.ts     # Birthday implementation
├── anniversary-message.strategy.ts  # Anniversary implementation
├── strategy-factory.ts              # Factory + Singleton
└── index.ts                         # Exports

tests/unit/strategies/
├── birthday-message.strategy.test.ts
├── anniversary-message.strategy.test.ts
└── strategy-factory.test.ts

tests/integration/
└── scheduler-strategy.integration.test.ts
```

---

## Implementation Details

### 1. MessageStrategy Interface

**File:** `src/strategies/message-strategy.interface.ts`

Defines the contract for all message types:

```typescript
interface MessageStrategy {
  readonly messageType: string;
  shouldSend(user: User, date: Date): Promise<boolean>;
  calculateSendTime(user: User, date: Date): Date;
  composeMessage(user: User, context: MessageContext): Promise<string>;
  getSchedule(): Schedule;
  validate(user: User): ValidationResult;
}
```

**Key Methods:**

- `shouldSend()`: Determines if a message should be sent (timezone-aware date matching)
- `calculateSendTime()`: Calculates 9am local time in UTC
- `composeMessage()`: Generates personalized message content
- `getSchedule()`: Returns schedule configuration (cadence, trigger field)
- `validate()`: Validates user has required data

**Supporting Types:**

- `MessageContext`: Provides context for message composition (currentYear, currentDate, userTimezone)
- `Schedule`: Defines message scheduling (YEARLY, MONTHLY, WEEKLY, DAILY, ONCE)
- `ValidationResult`: Validation result with errors and warnings

---

### 2. BirthdayMessageStrategy

**File:** `src/strategies/birthday-message.strategy.ts`

Implements birthday message logic:

**Features:**
- Checks if today is user's birthday (month/day match) in their timezone
- Calculates 9am local time for sending
- Message format: `"Hey, {firstName} {lastName} it's your birthday"`
- Validates user has birthday_date, timezone, firstName, lastName
- Handles leap year birthdays (Feb 29 → Feb 28 in non-leap years)

**Schedule:**
- Cadence: YEARLY
- Trigger field: `birthdayDate`
- Send time: 9am local time

**Example:**
```typescript
const strategy = new BirthdayMessageStrategy();
const user = {
  firstName: 'John',
  lastName: 'Doe',
  birthdayDate: new Date('1990-12-30'),
  timezone: 'America/New_York'
};

// Check if should send
const shouldSend = await strategy.shouldSend(user, new Date());

// Calculate send time
const sendTime = strategy.calculateSendTime(user, new Date());
// Returns: 2025-12-30T14:00:00.000Z (9am EST = 2pm UTC)

// Compose message
const message = await strategy.composeMessage(user, context);
// Returns: "Hey, John Doe it's your birthday"
```

---

### 3. AnniversaryMessageStrategy

**File:** `src/strategies/anniversary-message.strategy.ts`

Implements work anniversary message logic:

**Features:**
- Checks if today is user's anniversary (month/day match) in their timezone
- Calculates 9am local time for sending
- Message format: `"Hey, {firstName} {lastName} it's your work anniversary! {years} years with us!"`
- Calculates years of service dynamically
- Validates user has anniversary_date, timezone, firstName, lastName
- Handles leap year anniversaries (Feb 29 → Feb 28 in non-leap years)

**Schedule:**
- Cadence: YEARLY
- Trigger field: `anniversaryDate`
- Send time: 9am local time

**Example:**
```typescript
const strategy = new AnniversaryMessageStrategy();
const user = {
  firstName: 'Jane',
  lastName: 'Smith',
  anniversaryDate: new Date('2020-03-15'),
  timezone: 'Europe/London'
};

const context = { currentYear: 2025, currentDate: new Date(), userTimezone: 'Europe/London' };
const message = await strategy.composeMessage(user, context);
// Returns: "Hey, Jane Smith it's your work anniversary! 5 years with us!"
```

---

### 4. MessageStrategyFactory

**File:** `src/strategies/strategy-factory.ts`

Factory for managing and retrieving message strategies using the Singleton pattern.

**Features:**
- Singleton instance (ensures single global factory)
- Automatically registers default strategies (Birthday, Anniversary)
- Case-insensitive strategy lookup
- Type-safe strategy retrieval with error handling

**Key Methods:**
- `getInstance()`: Get singleton instance
- `register(strategy)`: Register a new strategy
- `get(messageType)`: Retrieve strategy by type
- `has(messageType)`: Check if strategy exists
- `getAllTypes()`: Get all registered message types
- `getAllStrategies()`: Get all strategy instances
- `unregister(messageType)`: Remove a strategy
- `clear()`: Remove all strategies
- `resetInstance()`: Reset singleton (for testing)

**Example:**
```typescript
const factory = MessageStrategyFactory.getInstance();

// Get strategy
const birthdayStrategy = factory.get('BIRTHDAY');

// Register custom strategy
factory.register(new CustomMessageStrategy());

// Get all types
const types = factory.getAllTypes(); // ['BIRTHDAY', 'ANNIVERSARY', 'CUSTOM']

// Iterate through all strategies
for (const strategy of factory.getAllStrategies()) {
  console.log(strategy.messageType);
}
```

---

### 5. SchedulerService Integration

**File:** `src/services/scheduler.service.ts`

The SchedulerService was updated to use strategies dynamically:

**Changes:**
1. Added `strategyFactory` dependency injection
2. Updated `preCalculateTodaysBirthdays()` to iterate through all registered strategies
3. Replaced `processMessagesForType()` with `processMessagesForStrategy()`
4. Removed hardcoded `composeMessage()` method (now uses strategy)
5. Updated `scheduleUserBirthday()` to use strategy pattern

**Key Benefits:**
- Adding new message types requires ZERO changes to scheduler
- All message logic is encapsulated in strategies
- Easy to test individual strategies
- Dynamic strategy selection at runtime

**Example:**
```typescript
async preCalculateTodaysBirthdays(): Promise<PrecalculationStats> {
  // Dynamically iterate through all registered strategies
  const strategies = this.strategyFactory.getAllStrategies();

  for (const strategy of strategies) {
    const messageType = strategy.messageType;

    // Process messages for this strategy
    const typeStats = await this.processMessagesForStrategy(strategy);

    // Accumulate stats...
  }
}
```

---

## Testing

### Unit Tests

**Files:**
- `tests/unit/strategies/birthday-message.strategy.test.ts` (22 tests)
- `tests/unit/strategies/anniversary-message.strategy.test.ts` (25 tests)
- `tests/unit/strategies/strategy-factory.test.ts` (43 tests)

**Coverage:**
- Strategy interface implementation
- Message composition
- Send time calculation
- Validation logic
- Timezone handling
- Factory registration/retrieval
- Singleton pattern
- Error handling

**All 90 tests passing** ✅

### Integration Tests

**File:** `tests/integration/scheduler-strategy.integration.test.ts`

Tests the integration between SchedulerService and strategies:
- Strategy-based message scheduling
- Dynamic strategy selection
- Adding new message types without modifying scheduler
- Strategy validation integration
- Error handling with strategies

---

## Adding a New Message Type

To add a new message type (e.g., Onboarding), follow these steps:

### Step 1: Create Strategy Implementation

Create `src/strategies/onboarding-message.strategy.ts`:

```typescript
import type { MessageStrategy, MessageContext, Schedule, ValidationResult } from './message-strategy.interface.js';
import type { User } from '../db/schema/users.js';
import { timezoneService } from '../services/timezone.service.js';

export class OnboardingMessageStrategy implements MessageStrategy {
  readonly messageType = 'ONBOARDING';

  async shouldSend(user: User, date: Date): Promise<boolean> {
    if (!user.createdAt) return false;

    // Send 7 days after user creation
    const daysSinceCreation = Math.floor(
      (date.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceCreation === 7;
  }

  calculateSendTime(user: User, date: Date): Date {
    // 10am user's local time
    return timezoneService.calculateSendTime(
      new Date(date.setHours(10, 0, 0, 0)),
      user.timezone
    );
  }

  async composeMessage(user: User, context: MessageContext): Promise<string> {
    return `Hey ${user.firstName}, welcome to your first week!`;
  }

  getSchedule(): Schedule {
    return {
      cadence: 'ONCE',
      triggerField: 'createdAt'
    };
  }

  validate(user: User): ValidationResult {
    const errors: string[] = [];
    if (!user.firstName) errors.push('First name required');
    if (!user.createdAt) errors.push('Created at required');
    if (!user.timezone) errors.push('Timezone required');
    return { valid: errors.length === 0, errors };
  }
}
```

### Step 2: Register Strategy

Update `src/strategies/strategy-factory.ts`:

```typescript
private registerDefaultStrategies(): void {
  this.register(new BirthdayMessageStrategy());
  this.register(new AnniversaryMessageStrategy());
  this.register(new OnboardingMessageStrategy()); // Add this line
}
```

### Step 3: Add Database Field (if needed)

If the strategy needs a new date field, add it to the users schema:

```sql
ALTER TABLE users ADD COLUMN onboarding_date DATE;
```

### Step 4: Update Repository (if needed)

Add a method to find users for the new message type:

```typescript
async findOnboardingToday(): Promise<User[]> {
  // Implementation
}
```

### Step 5: Write Tests

Create `tests/unit/strategies/onboarding-message.strategy.test.ts`:

```typescript
describe('OnboardingMessageStrategy', () => {
  // Test shouldSend, calculateSendTime, composeMessage, validate
});
```

### Step 6: Export Strategy

Update `src/strategies/index.ts`:

```typescript
export { OnboardingMessageStrategy } from './onboarding-message.strategy.js';
```

**That's it!** No changes to SchedulerService required. The strategy will be automatically discovered and executed.

---

## Design Decisions

### Why Strategy Pattern?

1. **Extensibility**: Add new message types without touching core code
2. **Maintainability**: Each message type is self-contained
3. **Testability**: Test strategies independently
4. **Type Safety**: TypeScript enforces interface compliance
5. **Separation of Concerns**: Message logic separate from scheduling logic

### Why Singleton Factory?

1. **Global Registry**: Single source of truth for all strategies
2. **Easy Discovery**: `getAllStrategies()` for iteration
3. **Lifecycle Management**: Centralized registration/unregistration
4. **Testing Support**: `resetInstance()` for test isolation

### Why Async Methods?

- `shouldSend()` and `composeMessage()` are async to support:
  - Database queries for additional user data
  - External API calls for personalization
  - Future enhancement: ML-based message generation

### Why Validation?

- Fail fast: Catch missing data before attempting to send
- Better error messages: Tell user exactly what's missing
- Warnings: Alert about potential issues without failing

---

## Performance Considerations

### Factory Lookup

- O(1) lookup using Map (not array iteration)
- Case-insensitive lookup via `.toUpperCase()` normalization

### Strategy Iteration

- Strategies iterated sequentially (not in parallel)
- Each strategy fetches its own users (avoids N+1 queries)
- Consider caching for frequently accessed strategies

### Message Composition

- Message composed once and stored in database
- No runtime composition during delivery
- Pre-calculated send times reduce worker CPU usage

---

## Future Enhancements

### Planned Features

1. **Dynamic Message Templates**
   - Load message templates from database
   - Support placeholders: `{firstName}`, `{age}`, `{yearsOfService}`
   - A/B testing for message content

2. **Conditional Strategies**
   - Send based on user attributes (e.g., only to premium users)
   - Geographic targeting
   - Time-based conditions (weekdays only)

3. **Multi-Channel Strategies**
   - Email, SMS, Push notifications
   - Channel preference per user
   - Fallback channels

4. **AI-Powered Messages**
   - GPT-based message generation
   - Personalization based on user activity
   - Sentiment analysis

5. **Strategy Metrics**
   - Track open rates per strategy
   - A/B test different strategies
   - Auto-disable low-performing strategies

---

## Migration Guide

### From Hardcoded Types to Strategies

**Before (Hardcoded):**
```typescript
if (messageType === 'BIRTHDAY') {
  message = `Hey ${user.firstName}, happy birthday!`;
} else if (messageType === 'ANNIVERSARY') {
  message = `Hey ${user.firstName}, happy anniversary!`;
}
```

**After (Strategy Pattern):**
```typescript
const strategy = strategyFactory.get(messageType);
const message = await strategy.composeMessage(user, context);
```

**Benefits:**
- ✅ No if/else chains
- ✅ Type-safe
- ✅ Easy to add new types
- ✅ Testable independently

---

## Troubleshooting

### Strategy Not Found

**Error:** `No strategy registered for message type: CUSTOM`

**Solution:** Register the strategy in `strategy-factory.ts`:
```typescript
factory.register(new CustomMessageStrategy());
```

### Validation Errors

**Error:** `User validation failed for birthday message`

**Solution:** Ensure user has all required fields:
```typescript
const validation = strategy.validate(user);
if (!validation.valid) {
  console.error(validation.errors);
}
```

### Timezone Issues

**Error:** `Invalid timezone: Invalid/Timezone`

**Solution:** Use IANA timezone identifiers:
- ✅ `America/New_York`
- ✅ `Europe/London`
- ✅ `Asia/Tokyo`
- ❌ `EST` (abbreviation)
- ❌ `UTC-5` (offset)

---

## References

- [Strategy Pattern (Gang of Four)](https://refactoring.guru/design-patterns/strategy)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [IANA Timezone Database](https://www.iana.org/time-zones)
- [Luxon Documentation](https://moment.github.io/luxon/)

---

## Summary

The Strategy Pattern implementation provides a clean, extensible architecture for managing different message types in the Birthday Message Scheduler. With 90 passing tests and zero changes required to add new message types, this implementation follows SOLID principles and enables rapid feature development.

**Key Achievements:**
- ✅ Zero core code changes when adding message types
- ✅ 90 unit tests, all passing
- ✅ Full TypeScript type safety
- ✅ Comprehensive documentation
- ✅ Integration with existing SchedulerService
- ✅ Production-ready code quality

**Next Steps:**
- Add more message types (Onboarding, Milestone, etc.)
- Implement dynamic message templates
- Add multi-channel support
- Integrate AI-powered message generation
