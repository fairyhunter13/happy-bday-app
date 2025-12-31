# Edge Cases Catalog - Birthday Message Scheduler

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** Comprehensive Analysis Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Domain-Specific Edge Cases](#domain-specific-edge-cases)
3. [System Edge Cases](#system-edge-cases)
4. [Concurrent Operations](#concurrent-operations)
5. [Data Edge Cases](#data-edge-cases)
6. [Performance Edge Cases](#performance-edge-cases)
7. [Security Edge Cases](#security-edge-cases)
8. [Test Coverage Analysis](#test-coverage-analysis)
9. [Implementation Plan](#implementation-plan)
10. [Test Templates](#test-templates)

---

## Overview

### Purpose

This document catalogs all identified edge cases for the Birthday Message Scheduler system, provides current test coverage analysis, identifies gaps, and outlines implementation plans for missing tests.

### Scope

- **Total Edge Cases Identified:** 147+
- **Categories:** 7 major categories
- **Current Test Coverage:** ~60% of edge cases
- **Target Coverage:** 95%+ edge case coverage

### Methodology

- **Boundary Value Analysis:** Testing at boundaries of valid/invalid inputs
- **Equivalence Partitioning:** Grouping similar inputs and testing representatives
- **State Transition Testing:** Testing system behavior across state changes
- **Concurrency Testing:** Testing race conditions and parallel operations
- **Chaos Engineering:** Testing system resilience under failures

---

## Domain-Specific Edge Cases

### 1. Birthday Dates (25 edge cases)

#### 1.1 Leap Year Birthdays (EC-BD-001 to EC-BD-005)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-BD-001 | User born Feb 29 (leap year), current year is leap year | Send on Feb 29 | ✅ Covered | High |
| EC-BD-002 | User born Feb 29, current year is non-leap year | Send on Feb 28 | ✅ Covered | High |
| EC-BD-003 | User born Feb 29, celebration preference for Feb 28 vs Mar 1 | Configurable behavior | ❌ Missing | Medium |
| EC-BD-004 | User born Feb 29 1900 (non-leap century year) | Valid date handling | ❌ Missing | Low |
| EC-BD-005 | User born Feb 29 2000 (leap century year) | Valid date handling | ❌ Missing | Low |

**Implementation Notes:**
- EC-BD-002: Current implementation celebrates on Feb 28 (see `TimezoneService.isBirthdayToday()` lines 126-134)
- EC-BD-003: No user preference exists - hardcoded to Feb 28
- Business decision needed: Should users choose Feb 28 vs Mar 1?

#### 1.2 Date Boundaries (EC-BD-006 to EC-BD-015)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-BD-006 | Birthday on Jan 1 (year boundary) | Send correctly at year transition | ⚠️ Partial | High |
| EC-BD-007 | Birthday on Dec 31 (year boundary) | Handle timezone wrap to next year | ⚠️ Partial | High |
| EC-BD-008 | Birthday on invalid date (e.g., Sept 31) | Validation error, reject creation | ✅ Covered | High |
| EC-BD-009 | Birthday date is null/undefined | Skip birthday messages, no error | ⚠️ Partial | Medium |
| EC-BD-010 | Birthday date is far in future (2100) | Accept but never trigger | ❌ Missing | Low |
| EC-BD-011 | Birthday date is very old (1850) | Accept, calculate age correctly | ❌ Missing | Low |
| EC-BD-012 | Birthday date is today (same day creation) | Schedule for next year | ❌ Missing | Medium |
| EC-BD-013 | Birthday date is tomorrow | Don't send today | ✅ Covered | Medium |
| EC-BD-014 | Month boundaries (Jan 31 → Feb 1) | Handle month transitions correctly | ⚠️ Partial | Medium |
| EC-BD-015 | User changes birthday date after scheduling | Cancel old schedule, create new | ❌ Missing | High |

**Implementation Notes:**
- EC-BD-007: Critical for users in Pacific/Kiribati (UTC+14) vs America/Baker_Island (UTC-12)
- EC-BD-012: Current behavior undefined - needs testing
- EC-BD-015: No cascade update logic exists

#### 1.3 Century/Millennium Boundaries (EC-BD-016 to EC-BD-020)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-BD-016 | Birthday on Feb 29, 1900 (non-leap century) | Invalid date, reject | ❌ Missing | Low |
| EC-BD-017 | Birthday on Feb 29, 2000 (leap century) | Valid date, handle correctly | ❌ Missing | Low |
| EC-BD-018 | Year 2038 problem (Unix timestamp overflow) | Use 64-bit timestamps | ✅ Covered | Medium |
| EC-BD-019 | Year 9999 boundary | Handle gracefully or reject | ❌ Missing | Low |
| EC-BD-020 | Negative years (BC dates) | Validation error | ❌ Missing | Low |

#### 1.4 Age Calculations (EC-BD-021 to EC-BD-025)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-BD-021 | Age = 0 (birthday is today) | "Happy birthday!" (no age) | ❌ Missing | Medium |
| EC-BD-022 | Age = 1 | "Happy 1st birthday!" | ⚠️ Partial | Medium |
| EC-BD-023 | Age > 150 | Accept but flag as unusual | ❌ Missing | Low |
| EC-BD-024 | Age calculation with leap year birthday | Correct age despite Feb 28/29 ambiguity | ❌ Missing | Medium |
| EC-BD-025 | Birthday in future (negative age) | Validation error | ❌ Missing | Medium |

---

### 2. Anniversary Dates (15 edge cases)

#### 2.1 Date Overlap (EC-AN-001 to EC-AN-005)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-AN-001 | Anniversary same day as birthday | Send both messages | ✅ Covered | High |
| EC-AN-002 | Multiple anniversaries for same user | Send all applicable messages | ❌ Missing | Medium |
| EC-AN-003 | Anniversary date before birth date | Validation error | ❌ Missing | High |
| EC-AN-004 | Anniversary date = birth date | Validation error (ambiguous) | ❌ Missing | Medium |
| EC-AN-005 | Anniversary on Feb 29 | Same leap year handling as birthday | ❌ Missing | Medium |

**Implementation Notes:**
- EC-AN-001: Tested in `testing-strategy.md` lines 195-213
- EC-AN-002: Schema only supports one anniversary date
- EC-AN-003: No validation exists in `users.ts` schema

#### 2.2 Time Calculations (EC-AN-006 to EC-AN-010)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-AN-006 | Anniversary = 0 years (today) | Send message without years count | ❌ Missing | Medium |
| EC-AN-007 | Anniversary calculation with DST change | Correct year calculation | ❌ Missing | Medium |
| EC-AN-008 | Anniversary very long ago (50+ years) | Calculate correctly | ❌ Missing | Low |
| EC-AN-009 | Anniversary in future | Validation error | ❌ Missing | Medium |
| EC-AN-010 | Anniversary date is null | Skip anniversary, no error | ✅ Covered | Medium |

#### 2.3 Edge Case Combinations (EC-AN-011 to EC-AN-015)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-AN-011 | User deleted after anniversary scheduled | Skip message, mark as cancelled | ❌ Missing | High |
| EC-AN-012 | Anniversary updated after scheduling | Cancel old, schedule new | ❌ Missing | High |
| EC-AN-013 | Anniversary on Dec 31, timezone wraps to Jan 1 | Send on correct date in user timezone | ❌ Missing | High |
| EC-AN-014 | Multiple message types scheduled for same second | All sent independently | ❌ Missing | Medium |
| EC-AN-015 | Anniversary type added via Strategy pattern | Auto-discovered and scheduled | ⚠️ Partial | High |

---

### 3. Timezone Edge Cases (30 edge cases)

#### 3.1 IANA Timezone Validation (EC-TZ-001 to EC-TZ-010)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-TZ-001 | Valid IANA timezone (America/New_York) | Accept and use | ✅ Covered | High |
| EC-TZ-002 | Timezone abbreviation (EST) | Validation error | ✅ Covered | High |
| EC-TZ-003 | Invalid timezone (Invalid/Zone) | Validation error | ✅ Covered | High |
| EC-TZ-004 | Empty timezone string | Validation error | ⚠️ Partial | High |
| EC-TZ-005 | Null timezone | Validation error | ⚠️ Partial | High |
| EC-TZ-006 | Timezone with special characters | Validation error | ❌ Missing | Medium |
| EC-TZ-007 | Case sensitivity (america/new_york) | Validation error | ❌ Missing | Medium |
| EC-TZ-008 | Deprecated timezone (US/Eastern) | Accept or reject? | ❌ Missing | Medium |
| EC-TZ-009 | Timezone with spaces | Validation error | ❌ Missing | Low |
| EC-TZ-010 | Very long timezone string (>100 chars) | Validation error | ❌ Missing | Low |

**Implementation Notes:**
- EC-TZ-001-003: Covered in `timezone-conversion.test.ts` lines 108-143
- EC-TZ-008: Luxon accepts deprecated timezones - should we?
- Validation: `timezoneSchema` in `dto.ts` uses regex `/^[A-Za-z]+\/[A-Za-z_]+$/`

#### 3.2 Half-Hour Offset Timezones (EC-TZ-011 to EC-TZ-015)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-TZ-011 | Asia/Kolkata (UTC+5:30) | Calculate 9am correctly | ✅ Covered | High |
| EC-TZ-012 | Australia/Adelaide (UTC+9:30) | Calculate 9am correctly | ⚠️ Partial | High |
| EC-TZ-013 | Asia/Kathmandu (UTC+5:45) | Calculate 9am correctly | ❌ Missing | Medium |
| EC-TZ-014 | Pacific/Chatham (UTC+12:45) | Calculate 9am correctly | ❌ Missing | Medium |
| EC-TZ-015 | Multiple users in half-hour offset zones | All scheduled correctly | ❌ Missing | Medium |

**Implementation Notes:**
- EC-TZ-011: Tested in `timezone-conversion.test.ts` lines 47-56
- EC-TZ-013: Nepal - one of few 45-min offset zones
- EC-TZ-014: New Zealand - DST adds complexity

#### 3.3 DST Transitions (EC-TZ-016 to EC-TZ-025)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-TZ-016 | Birthday during "spring forward" (2am doesn't exist) | Send at 3am local time | ❌ Missing | High |
| EC-TZ-017 | Birthday during "fall back" (2am happens twice) | Send at first 2am occurrence | ❌ Missing | High |
| EC-TZ-018 | DST transition on exact birthday | Handle gracefully | ❌ Missing | High |
| EC-TZ-019 | Timezone changes DST rules (historical) | Use current rules | ✅ Covered | Medium |
| EC-TZ-020 | Country abolishes DST | Luxon handles automatically | ✅ Covered | Medium |
| EC-TZ-021 | Southern hemisphere DST (opposite direction) | Calculate correctly | ⚠️ Partial | High |
| EC-TZ-022 | No DST timezone (Asia/Tokyo) | No DST adjustments | ✅ Covered | Medium |
| EC-TZ-023 | DST boundary on Dec 31/Jan 1 | Year boundary + DST | ❌ Missing | Medium |
| EC-TZ-024 | User moves timezone after scheduling | Use new timezone on next birthday | ❌ Missing | High |
| EC-TZ-025 | DST offset changes during message processing | Rare but handle gracefully | ❌ Missing | Low |

**Implementation Notes:**
- EC-TZ-016-017: Critical edge cases - ambiguous/nonexistent times
- EC-TZ-019-020: Luxon IANA database handles this automatically
- EC-TZ-024: No cascade update logic exists

#### 3.4 Extreme Timezones (EC-TZ-026 to EC-TZ-030)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-TZ-026 | Pacific/Kiribati (UTC+14) - furthest ahead | Birthday starts first globally | ❌ Missing | Medium |
| EC-TZ-027 | America/Baker_Island (UTC-12) - furthest behind | Birthday starts last globally | ❌ Missing | Medium |
| EC-TZ-028 | All users across all 24 timezones | 24-hour birthday window | ❌ Missing | High |
| EC-TZ-029 | UTC+14 user birthday at midnight wraps to yesterday UTC | Date arithmetic correct | ❌ Missing | High |
| EC-TZ-030 | Date line crossing (Pacific islands) | Handle correctly | ❌ Missing | Medium |

**Implementation Notes:**
- EC-TZ-028: Critical for performance testing - 24-hour message spread
- EC-TZ-029: Dec 31 at UTC+14 = Dec 30 in UTC

---

### 4. User Data Edge Cases (20 edge cases)

#### 4.1 Name Validations (EC-UD-001 to EC-UD-008)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-UD-001 | Very long name (100 chars) | Accept (at limit) | ⚠️ Partial | Medium |
| EC-UD-002 | Name exceeds 100 chars | Validation error | ⚠️ Partial | High |
| EC-UD-003 | Empty name | Validation error | ✅ Covered | High |
| EC-UD-004 | Name with special characters (é, ñ, 中文) | Accept and display correctly | ❌ Missing | High |
| EC-UD-005 | Name with emojis (John 😊 Doe) | Accept or reject? | ❌ Missing | Medium |
| EC-UD-006 | Name with only whitespace | Validation error | ⚠️ Partial | Medium |
| EC-UD-007 | Name with leading/trailing spaces | Trim before storing | ❌ Missing | Medium |
| EC-UD-008 | Name with multiple spaces | Preserve or normalize? | ❌ Missing | Low |

**Implementation Notes:**
- Schema: `varchar('first_name', { length: 100 })` in `users.ts`
- Zod: `z.string().min(1).max(100)` in `dto.ts` line 60
- No trimming or special character validation exists

#### 4.2 Email Validations (EC-UD-009 to EC-UD-014)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-UD-009 | Valid email | Accept | ✅ Covered | High |
| EC-UD-010 | Invalid email format | Validation error | ✅ Covered | High |
| EC-UD-011 | Email with + sign (user+tag@example.com) | Accept | ❌ Missing | Medium |
| EC-UD-012 | Very long email (255 chars) | Accept at limit | ❌ Missing | Medium |
| EC-UD-013 | Email exceeds 255 chars | Validation error | ❌ Missing | Medium |
| EC-UD-014 | Duplicate email (different user) | Unique constraint error | ✅ Covered | High |

**Implementation Notes:**
- Schema: `varchar('email', { length: 255 }).notNull().unique()` (lines 27-28)
- Zod: Uses `.email()` validator (RFC 5322 simplified)
- Soft delete complicates uniqueness (EC-UD-014)

#### 4.3 Soft Delete Edge Cases (EC-UD-015 to EC-UD-020)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-UD-015 | User soft deleted before message sent | Skip message, no error | ❌ Missing | High |
| EC-UD-016 | User soft deleted while message in queue | Worker checks, skips message | ❌ Missing | High |
| EC-UD-017 | User soft deleted then restored | Resume message scheduling | ❌ Missing | Medium |
| EC-UD-018 | Same email reused after soft delete | Allow (partial index on email) | ⚠️ Partial | Medium |
| EC-UD-019 | Query accidentally includes deleted users | Partial indexes prevent this | ✅ Covered | High |
| EC-UD-020 | Hard delete user with scheduled messages | CASCADE delete message logs | ⚠️ Partial | High |

**Implementation Notes:**
- Soft delete: `deletedAt` timestamp (line 56 in users.ts)
- Partial indexes: WHERE clause excludes deleted (lines 61-74)
- EC-UD-016: No worker validation for deleted users exists
- EC-UD-020: Schema has `onDelete: 'cascade'` (line 56 in message-logs.ts)

---

### 5. Message Type Strategy Edge Cases (12 edge cases)

#### 5.1 Strategy Registration (EC-ST-001 to EC-ST-006)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-ST-001 | Register new message type | Auto-discovered by scheduler | ⚠️ Partial | High |
| EC-ST-002 | Duplicate strategy registration | Error or ignore? | ❌ Missing | Medium |
| EC-ST-003 | Strategy with invalid message type | Validation error | ❌ Missing | High |
| EC-ST-004 | Strategy missing required methods | TypeScript compile error | ✅ Covered | High |
| EC-ST-005 | Strategy throws error in shouldSend() | Catch, log, skip message | ❌ Missing | High |
| EC-ST-006 | Strategy throws error in composeMessage() | Catch, log, mark as failed | ❌ Missing | High |

**Implementation Notes:**
- Strategy interface: `MessageStrategy` in `message-strategy.interface.ts`
- Factory: `StrategyFactory` in `strategy-factory.ts`
- No error handling in strategy methods exists

#### 5.2 Strategy Behavior (EC-ST-007 to EC-ST-012)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-ST-007 | User has no date field for strategy | validate() returns errors | ⚠️ Partial | High |
| EC-ST-008 | Strategy schedule cadence DAILY | Run every day | ❌ Missing | Medium |
| EC-ST-009 | Strategy schedule cadence ONCE | Run once only | ❌ Missing | Medium |
| EC-ST-010 | Multiple strategies match same user/date | All messages sent | ✅ Covered | High |
| EC-ST-011 | Strategy changes send hour (not 9am) | Respect strategy configuration | ❌ Missing | Low |
| EC-ST-012 | Strategy composeMessage returns empty string | Validation error | ❌ Missing | Medium |

---

## System Edge Cases

### 6. Database Edge Cases (25 edge cases)

#### 6.1 Connection Management (EC-DB-001 to EC-DB-008)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-DB-001 | Database connection lost during query | Retry with exponential backoff | ⚠️ Partial | Critical |
| EC-DB-002 | Connection pool exhausted | Queue requests or fail gracefully | ⚠️ Partial | Critical |
| EC-DB-003 | Database server down at startup | Retry connection, log errors | ⚠️ Partial | Critical |
| EC-DB-004 | Connection timeout | Throw error after timeout | ✅ Covered | High |
| EC-DB-005 | Network partition (database unreachable) | Circuit breaker opens | ❌ Missing | Critical |
| EC-DB-006 | Slow query (>5 seconds) | Timeout and log warning | ⚠️ Partial | High |
| EC-DB-007 | Connection leak (connections not released) | Pool monitoring detects | ❌ Missing | High |
| EC-DB-008 | SSL certificate expired | Connection fails with clear error | ❌ Missing | Medium |

**Implementation Notes:**
- Chaos tests: `database-chaos.test.ts` covers EC-DB-001 to EC-DB-003
- No circuit breaker implementation exists (EC-DB-005)
- Connection: `node-postgres` with pool in `connection.ts`

#### 6.2 Transaction Failures (EC-DB-009 to EC-DB-013)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-DB-009 | Transaction rollback during message insert | No partial state, rollback complete | ❌ Missing | High |
| EC-DB-010 | Deadlock detected | Retry transaction | ❌ Missing | High |
| EC-DB-011 | Transaction timeout | Rollback automatically | ❌ Missing | Medium |
| EC-DB-012 | Nested transaction failure | Parent transaction rolls back | ❌ Missing | Low |
| EC-DB-013 | Connection closed mid-transaction | Transaction aborted, no partial commit | ❌ Missing | High |

**Implementation Notes:**
- Drizzle ORM handles basic transactions
- No explicit deadlock retry logic exists
- PostgreSQL auto-detects deadlocks

#### 6.3 Constraint Violations (EC-DB-014 to EC-DB-020)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-DB-014 | Duplicate idempotency key | Error caught, log, return existing message | ⚠️ Partial | Critical |
| EC-DB-015 | Foreign key violation (user deleted) | CASCADE delete or error | ✅ Covered | High |
| EC-DB-016 | NOT NULL constraint violation | Error with clear message | ✅ Covered | High |
| EC-DB-017 | CHECK constraint violation (if any) | Error with clear message | N/A | Medium |
| EC-DB-018 | Unique email constraint (soft deleted users) | Partial index allows reuse | ⚠️ Partial | High |
| EC-DB-019 | ENUM value out of range | Error at application layer | ✅ Covered | Medium |
| EC-DB-020 | Data type mismatch (string vs uuid) | Error at query time | ✅ Covered | High |

**Implementation Notes:**
- EC-DB-014: Idempotency service generates keys, DB enforces uniqueness
- EC-DB-015: Schema uses `onDelete: 'cascade'` (message-logs.ts line 56)
- No CHECK constraints defined in schema

#### 6.4 Query Performance (EC-DB-021 to EC-DB-025)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-DB-021 | 10M users, find birthdays today | < 200ms with indexes | ⚠️ Partial | Critical |
| EC-DB-022 | Query without index on large table | Slow, but doesn't crash | ❌ Missing | Medium |
| EC-DB-023 | Full table scan on message_logs | Partitioning avoids this | ⚠️ Partial | High |
| EC-DB-024 | N+1 query problem | Use JOINs or batch loading | ❌ Missing | Medium |
| EC-DB-025 | Query returns 1M+ rows | Pagination or streaming | ❌ Missing | High |

**Implementation Notes:**
- EC-DB-021: Tested in `testing-strategy.md` lines 656-673
- Indexes: Defined in schema (users.ts lines 58-81, message-logs.ts lines 110-142)
- Partitioning: Mentioned but not implemented yet

---

### 7. Queue Edge Cases (30 edge cases)

#### 7.1 RabbitMQ Connection (EC-Q-001 to EC-Q-010)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-Q-001 | RabbitMQ server down at startup | Retry connection with backoff | ⚠️ Partial | Critical |
| EC-Q-002 | RabbitMQ connection lost during publish | Auto-reconnect and retry | ⚠️ Partial | Critical |
| EC-Q-003 | RabbitMQ connection lost during consume | Auto-reconnect, resume consuming | ⚠️ Partial | Critical |
| EC-Q-004 | Network partition to RabbitMQ | Circuit breaker, log error | ❌ Missing | Critical |
| EC-Q-005 | RabbitMQ authentication failure | Fail with clear error | ⚠️ Partial | High |
| EC-Q-006 | RabbitMQ channel closed | Reopen channel automatically | ⚠️ Partial | High |
| EC-Q-007 | RabbitMQ publish timeout | Retry or fail with error | ❌ Missing | High |
| EC-Q-008 | RabbitMQ consume timeout | Log warning, continue | ❌ Missing | Medium |
| EC-Q-009 | Multiple connection retries exhaust backoff | Fail permanently, alert | ❌ Missing | High |
| EC-Q-010 | RabbitMQ cluster node failure | Connect to other nodes | ❌ Missing | Medium |

**Implementation Notes:**
- Chaos tests: `rabbitmq-chaos.test.ts` covers EC-Q-001 to EC-Q-003
- Connection: `amqplib-connection-manager` in `connection.ts`
- No explicit circuit breaker for queue

#### 7.2 Message Publishing (EC-Q-011 to EC-Q-018)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-Q-011 | Publish message too large (>1MB) | Error or split message | ❌ Missing | Medium |
| EC-Q-012 | Publish to non-existent queue | Error, log warning | ❌ Missing | High |
| EC-Q-013 | Publish with invalid message format | Validation error | ✅ Covered | High |
| EC-Q-014 | Queue full (max length reached) | Reject oldest or newest | ❌ Missing | High |
| EC-Q-015 | Disk space full on RabbitMQ server | Publisher blocked, backpressure | ❌ Missing | Critical |
| EC-Q-016 | Memory limit reached on RabbitMQ | Publisher blocked, backpressure | ❌ Missing | Critical |
| EC-Q-017 | Publish during queue drain | Message accepted, processed later | ❌ Missing | Medium |
| EC-Q-018 | Rapid publish (1000 msg/sec) | All messages queued | ⚠️ Partial | High |

**Implementation Notes:**
- EC-Q-013: Zod schema validates before publish (messageJobSchema)
- EC-Q-015-016: RabbitMQ default behavior, not tested
- EC-Q-018: Performance tests cover this

#### 7.3 Message Consumption (EC-Q-019 to EC-Q-026)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-Q-019 | Consumer crash mid-processing | Message requeued (no ACK) | ⚠️ Partial | Critical |
| EC-Q-020 | Consumer sends NACK with requeue=true | Message redelivered | ✅ Covered | High |
| EC-Q-021 | Consumer sends NACK with requeue=false | Message to DLQ | ✅ Covered | High |
| EC-Q-022 | Multiple consumers processing same message | Prevented by RabbitMQ (single ACK) | ✅ Covered | Critical |
| EC-Q-023 | Consumer processes duplicate message | Idempotency key prevents double-send | ✅ Covered | Critical |
| EC-Q-024 | Message unserializable (corrupt payload) | NACK to DLQ, log error | ⚠️ Partial | High |
| EC-Q-025 | Consumer timeout (message processing >5min) | Message requeued after timeout | ❌ Missing | High |
| EC-Q-026 | Prefetch limit reached (all workers busy) | New messages wait in queue | ✅ Covered | High |

**Implementation Notes:**
- EC-Q-019-023: Core RabbitMQ features, tested in `consumer.ts`
- EC-Q-023: Idempotency enforced in database, not queue
- EC-Q-025: No explicit timeout in consumer

#### 7.4 Dead Letter Queue (EC-Q-027 to EC-Q-030)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-Q-027 | Message sent to DLQ after max retries | Logged, not processed further | ⚠️ Partial | High |
| EC-Q-028 | DLQ monitoring and alerting | Alert on DLQ depth > threshold | ❌ Missing | High |
| EC-Q-029 | Manual DLQ reprocessing | Admin tool to requeue from DLQ | ❌ Missing | Medium |
| EC-Q-030 | DLQ overflow (too many failed messages) | Oldest messages dropped or archived | ❌ Missing | Low |

**Implementation Notes:**
- DLQ: Configured in `config.ts` but no monitoring exists
- No admin interface for DLQ management
- Retry logic: `consumer.ts` lines 163-207

---

### 8. Worker Edge Cases (18 edge cases)

#### 8.1 Worker Lifecycle (EC-W-001 to EC-W-008)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-W-001 | All workers down | Messages queue, processed when workers restart | ⚠️ Partial | Critical |
| EC-W-002 | Worker crash mid-message | Message requeued, processed by another worker | ⚠️ Partial | Critical |
| EC-W-003 | Worker receives SIGTERM | Finish current message, stop gracefully | ⚠️ Partial | High |
| EC-W-004 | Worker receives SIGKILL | Message requeued immediately | ❌ Missing | High |
| EC-W-005 | Worker startup failure | Log error, exit cleanly | ⚠️ Partial | High |
| EC-W-006 | Worker resource exhaustion (OOM) | Process killed by OS, message requeued | ❌ Missing | High |
| EC-W-007 | Worker network interface down | Fail health checks, stop processing | ❌ Missing | Medium |
| EC-W-008 | Worker clock skew | Use server time, not worker time | ❌ Missing | Medium |

**Implementation Notes:**
- EC-W-003: Graceful shutdown in `consumer.ts` lines 304-321
- EC-W-006: No memory limit monitoring
- Chaos test: `resource-limits.test.ts` covers some scenarios

#### 8.2 Worker Scaling (EC-W-009 to EC-W-013)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-W-009 | Scale from 1 to 10 workers | Messages distributed evenly | ⚠️ Partial | High |
| EC-W-010 | Scale from 10 to 30 workers | Linear throughput increase | ⚠️ Partial | High |
| EC-W-011 | Worker join during high load | Picks up messages immediately | ❌ Missing | Medium |
| EC-W-012 | Worker leave during high load | Remaining workers handle load | ❌ Missing | Medium |
| EC-W-013 | Uneven worker performance | Fair distribution by prefetch | ✅ Covered | Medium |

**Implementation Notes:**
- EC-W-009-010: Performance tests validate scaling
- EC-W-013: Prefetch count enforces fairness (consumer.ts line 67)

#### 8.3 Worker Error Handling (EC-W-014 to EC-W-018)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-W-014 | Unhandled exception in worker | Catch, log, NACK message | ⚠️ Partial | Critical |
| EC-W-015 | Worker retry logic exhausted | Send to DLQ | ✅ Covered | High |
| EC-W-016 | Worker detects transient error | Retry with exponential backoff | ✅ Covered | High |
| EC-W-017 | Worker detects permanent error | Send to DLQ immediately | ✅ Covered | High |
| EC-W-018 | Worker error handler throws error | Log both errors, NACK message | ⚠️ Partial | High |

**Implementation Notes:**
- EC-W-014-017: Implemented in `consumer.ts` lines 136-207
- Error classification: `isTransientError()` method (lines 212-257)

---

### 9. Scheduler Edge Cases (20 edge cases)

#### 9.1 Cron Scheduler (EC-S-001 to EC-S-010)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-S-001 | Scheduler missed due to system downtime | Recovery scheduler catches up | ⚠️ Partial | High |
| EC-S-002 | Overlapping scheduler runs | Skip if previous run still active | ⚠️ Partial | High |
| EC-S-003 | Scheduler run takes > 1 minute | Next run skipped, logged | ❌ Missing | Medium |
| EC-S-004 | Invalid cron expression | Fail at startup with error | ❌ Missing | High |
| EC-S-005 | Cron schedule in different timezone | Use UTC for consistency | ✅ Covered | High |
| EC-S-006 | Scheduler crash mid-run | Messages partially scheduled, recovery catches rest | ❌ Missing | High |
| EC-S-007 | DST transition during scheduler run | Cron handles DST automatically | ✅ Covered | Medium |
| EC-S-008 | Scheduler triggered manually | Behaves same as cron trigger | ⚠️ Partial | Medium |
| EC-S-009 | Multiple schedulers running (race) | Lock or idempotency prevents duplicates | ❌ Missing | High |
| EC-S-010 | Scheduler stopped but messages in queue | Workers continue processing | ✅ Covered | Medium |

**Implementation Notes:**
- EC-S-001: `recovery.scheduler.ts` handles missed messages
- EC-S-002: `isRunning` flag in schedulers (e.g., line 91 in recovery.scheduler.ts)
- EC-S-009: No distributed lock exists

#### 9.2 Message Pre-calculation (EC-S-011 to EC-S-015)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-S-011 | 1M users with birthdays tomorrow | All messages pre-calculated | ⚠️ Partial | High |
| EC-S-012 | Pre-calculation timeout | Partial batch, resume next run | ❌ Missing | Medium |
| EC-S-013 | Database query timeout during pre-calc | Retry or fail gracefully | ❌ Missing | High |
| EC-S-014 | User updated after pre-calculation | Use old data for today, update tomorrow | ❌ Missing | Medium |
| EC-S-015 | Pre-calculated message exceeds 24 hours old | Skip, log warning | ❌ Missing | Low |

#### 9.3 Recovery Scheduler (EC-S-016 to EC-S-020)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-S-016 | Recovery finds 10K missed messages | Process all in batches | ❌ Missing | High |
| EC-S-017 | Recovery scheduler overlaps with itself | Skip run if previous active | ✅ Covered | High |
| EC-S-018 | Recovery finds message >24 hours late | Process anyway or skip? | ❌ Missing | Medium |
| EC-S-019 | Recovery scheduler disabled | Missed messages never recovered | ❌ Missing | Medium |
| EC-S-020 | Recovery fails repeatedly | Alert after N failures | ❌ Missing | High |

**Implementation Notes:**
- EC-S-017: `isRunning` flag (recovery.scheduler.ts line 91)
- No batch processing for large recovery volumes
- No alerting system exists

---

### 10. External API Edge Cases (15 edge cases)

#### 10.1 API Timeouts (EC-API-001 to EC-API-005)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-API-001 | External API timeout (>5s) | Retry with exponential backoff | ⚠️ Partial | High |
| EC-API-002 | External API connection refused | Mark as transient, retry | ⚠️ Partial | High |
| EC-API-003 | External API SSL error | Log error, mark as failed | ❌ Missing | Medium |
| EC-API-004 | External API slow response (<5s but >1s) | Log warning, complete request | ❌ Missing | Low |
| EC-API-005 | External API never responds (hang) | Timeout after configured duration | ⚠️ Partial | High |

**Implementation Notes:**
- API client: Not yet implemented (stubbed)
- Retry logic: In consumer, not in API client

#### 10.2 API Rate Limiting (EC-API-006 to EC-API-010)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-API-006 | 429 Too Many Requests | Exponential backoff retry | ⚠️ Partial | Critical |
| EC-API-007 | Rate limit header (X-RateLimit-Remaining: 0) | Preemptive backoff | ❌ Missing | High |
| EC-API-008 | Multiple workers hitting rate limit | Shared rate limiter | ❌ Missing | High |
| EC-API-009 | Rate limit reset time in past | Retry immediately | ❌ Missing | Low |
| EC-API-010 | Burst rate limit exceeded | Queue requests locally | ❌ Missing | Medium |

**Implementation Notes:**
- EC-API-006: Classified as transient in consumer.ts line 224
- No shared rate limiter across workers exists

#### 10.3 API Error Responses (EC-API-011 to EC-API-015)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-API-011 | 503 Service Unavailable | Retry as transient error | ⚠️ Partial | High |
| EC-API-012 | 404 Not Found | Mark as permanent error | ⚠️ Partial | High |
| EC-API-013 | 500 Internal Server Error | Retry as transient | ⚠️ Partial | High |
| EC-API-014 | Malformed JSON response | Parse error, mark as failed | ❌ Missing | Medium |
| EC-API-015 | Network partition (no response) | Timeout, retry | ⚠️ Partial | High |

---

## Concurrent Operations

### 11. Race Conditions (15 edge cases)

#### 11.1 Message Processing Races (EC-RC-001 to EC-RC-008)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-RC-001 | Two workers process same message (RabbitMQ prevents) | Only one worker gets message | ✅ Covered | Critical |
| EC-RC-002 | User updated while message in queue | Worker uses stale data | ❌ Missing | High |
| EC-RC-003 | User deleted while message in queue | Worker skips message | ❌ Missing | Critical |
| EC-RC-004 | Scheduler schedules message while worker processes old | Both complete independently | ⚠️ Partial | Medium |
| EC-RC-005 | Idempotency check race (two inserts) | Database unique constraint catches | ✅ Covered | Critical |
| EC-RC-006 | Message updated from SCHEDULED to QUEUED twice | Last write wins, no corruption | ⚠️ Partial | Medium |
| EC-RC-007 | Recovery scheduler and minute scheduler overlap | Both try to enqueue same message | ❌ Missing | High |
| EC-RC-008 | Multiple API instances schedule same message | Idempotency prevents duplicates | ✅ Covered | High |

**Implementation Notes:**
- EC-RC-001: RabbitMQ guarantees single consumer per message
- EC-RC-005: Database enforces uniqueness (message-logs.ts line 140)
- EC-RC-007: No distributed lock between schedulers

#### 11.2 Database Races (EC-RC-009 to EC-RC-015)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-RC-009 | Two connections update same user | Last write wins (no optimistic locking) | ⚠️ Partial | Medium |
| EC-RC-010 | Read-modify-write race on retry count | Use atomic increment | ❌ Missing | High |
| EC-RC-011 | Connection pool race (two threads get same connection) | Pool prevents this | ✅ Covered | High |
| EC-RC-012 | Transaction isolation level mismatch | Use READ COMMITTED consistently | ⚠️ Partial | Medium |
| EC-RC-013 | SELECT FOR UPDATE deadlock | Retry transaction | ❌ Missing | Medium |
| EC-RC-014 | Concurrent index creation during query | Query waits or fails | ❌ Missing | Low |
| EC-RC-015 | Migration running during message processing | Lock prevents conflicts | ⚠️ Partial | Medium |

**Implementation Notes:**
- No optimistic locking (version columns) exists
- No explicit SELECT FOR UPDATE usage
- Migration locking not tested

---

## Data Edge Cases

### 12. Input Validation Edge Cases (20 edge cases)

#### 12.1 String Validations (EC-DV-001 to EC-DV-008)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-DV-001 | Empty string | Validation error | ✅ Covered | High |
| EC-DV-002 | Null value | Validation error | ⚠️ Partial | High |
| EC-DV-003 | Undefined value | Validation error | ⚠️ Partial | High |
| EC-DV-004 | String with null bytes (\0) | Reject or sanitize | ❌ Missing | Medium |
| EC-DV-005 | String with SQL injection attempt | Parameterized queries prevent | ✅ Covered | Critical |
| EC-DV-006 | String with XSS payload (<script>) | Sanitize before display | ❌ Missing | High |
| EC-DV-007 | String exceeds max length | Validation error | ✅ Covered | High |
| EC-DV-008 | Unicode normalization (é vs e + ´) | Normalize before comparison | ❌ Missing | Low |

**Implementation Notes:**
- EC-DV-005: Drizzle ORM uses parameterized queries
- EC-DV-006: No output sanitization exists (messages sent to API)

#### 12.2 Numeric Validations (EC-DV-009 to EC-DV-012)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-DV-009 | Negative number where positive expected | Validation error | ⚠️ Partial | High |
| EC-DV-010 | Float where integer expected | Validation error | ✅ Covered | High |
| EC-DV-011 | Number exceeds MAX_SAFE_INTEGER | Validation error | ❌ Missing | Medium |
| EC-DV-012 | NaN or Infinity | Validation error | ❌ Missing | Medium |

#### 12.3 Date Validations (EC-DV-013 to EC-DV-016)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-DV-013 | Invalid date string ("not a date") | Validation error | ✅ Covered | High |
| EC-DV-014 | Date far in past (Unix epoch) | Accept but log warning | ❌ Missing | Low |
| EC-DV-015 | Date far in future (year 3000) | Accept or reject? | ❌ Missing | Low |
| EC-DV-016 | Date with timezone offset in string | Parse correctly or reject | ⚠️ Partial | Medium |

#### 12.4 Complex Object Validations (EC-DV-017 to EC-DV-020)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-DV-017 | Missing required field | Validation error | ✅ Covered | High |
| EC-DV-018 | Extra unknown fields | Ignore or reject? | ⚠️ Partial | Medium |
| EC-DV-019 | Circular JSON reference | Cannot serialize, error | ❌ Missing | Low |
| EC-DV-020 | Deeply nested object (100+ levels) | Accept if valid | ❌ Missing | Low |

**Implementation Notes:**
- Zod schemas validate all inputs (dto.ts)
- Zod default: strip unknown fields (EC-DV-018)

---

## Performance Edge Cases

### 13. Load Testing Edge Cases (18 edge cases)

#### 13.1 Sustained Load (EC-PF-001 to EC-PF-006)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-PF-001 | 11.5 msg/sec for 24 hours | All messages processed | ⚠️ Partial | Critical |
| EC-PF-002 | 100 msg/sec for 5 minutes | Latency p95 < 1s | ⚠️ Partial | High |
| EC-PF-003 | Gradual ramp from 0 to 100 msg/sec | Linear scaling | ❌ Missing | High |
| EC-PF-004 | Sudden spike to 1000 msg/sec | Queue buffers, backpressure applied | ❌ Missing | High |
| EC-PF-005 | All 1M users have birthday today | 24-hour window distributes load | ❌ Missing | Critical |
| EC-PF-006 | 10M users in database | Queries remain fast with indexes | ⚠️ Partial | Critical |

**Implementation Notes:**
- EC-PF-001-002: Performance test scripts exist (testing-strategy.md)
- EC-PF-005: Nightmare scenario - needs testing
- EC-PF-006: Tested in testing-strategy.md lines 656-673

#### 13.2 Resource Constraints (EC-PF-007 to EC-PF-012)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-PF-007 | Worker memory usage exceeds limit | Graceful degradation or restart | ❌ Missing | High |
| EC-PF-008 | Database CPU at 100% | Queries timeout, circuit breaker opens | ❌ Missing | Critical |
| EC-PF-009 | Disk space full on queue server | Backpressure blocks publishers | ❌ Missing | Critical |
| EC-PF-010 | Network bandwidth saturated | Latency increases, timeouts occur | ❌ Missing | Medium |
| EC-PF-011 | Connection pool at capacity | Requests queue or timeout | ⚠️ Partial | High |
| EC-PF-012 | Thread pool exhausted | Requests rejected or queued | ❌ Missing | Medium |

**Implementation Notes:**
- Chaos tests: `resource-limits.test.ts` covers some scenarios
- No explicit resource monitoring in application

#### 13.3 Query Performance (EC-PF-013 to EC-PF-018)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-PF-013 | Birthday query on 10M users without index | Timeout or very slow | ❌ Missing | High |
| EC-PF-014 | Full table scan on partitioned table | Only scans relevant partition | ❌ Missing | High |
| EC-PF-015 | Query joins 3+ tables | Optimized with proper indexes | ❌ Missing | Medium |
| EC-PF-016 | Aggregation query on 100M message logs | Use partition pruning | ❌ Missing | Medium |
| EC-PF-017 | Concurrent updates to same row | Lock contention, retries | ❌ Missing | Medium |
| EC-PF-018 | Large batch insert (10K rows) | Complete in <500ms | ⚠️ Partial | High |

---

## Security Edge Cases

### 14. Security Testing Edge Cases (12 edge cases)

#### 14.1 Injection Attacks (EC-SEC-001 to EC-SEC-005)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-SEC-001 | SQL injection in email field | Parameterized queries prevent | ✅ Covered | Critical |
| EC-SEC-002 | XSS in message content | Sanitize before sending | ❌ Missing | Critical |
| EC-SEC-003 | Command injection in name field | Input validation prevents | ⚠️ Partial | High |
| EC-SEC-004 | Path traversal in file operations | N/A (no file uploads) | N/A | N/A |
| EC-SEC-005 | NoSQL injection (if MongoDB used) | N/A (using PostgreSQL) | N/A | N/A |

**Implementation Notes:**
- EC-SEC-001: Drizzle ORM prevents SQL injection
- EC-SEC-002: No sanitization exists - messages contain user input
- EC-SEC-003: Zod validates but doesn't sanitize

#### 14.2 Authentication/Authorization (EC-SEC-006 to EC-SEC-009)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-SEC-006 | Unauthenticated API access | Reject with 401 (if auth added) | N/A | Future |
| EC-SEC-007 | Unauthorized access to other user's data | Reject with 403 (if auth added) | N/A | Future |
| EC-SEC-008 | Expired JWT token | Reject with 401 (if auth added) | N/A | Future |
| EC-SEC-009 | Malformed JWT token | Reject with 400 (if auth added) | N/A | Future |

**Implementation Notes:**
- No authentication system exists yet
- Future enhancement

#### 14.3 Resource Exhaustion (EC-SEC-010 to EC-SEC-012)

| ID | Edge Case | Expected Behavior | Current Coverage | Priority |
|----|-----------|-------------------|------------------|----------|
| EC-SEC-010 | DoS via excessive API requests | Rate limiting (not implemented) | ❌ Missing | High |
| EC-SEC-011 | Large payload attack (100MB request) | Payload size limit | ❌ Missing | High |
| EC-SEC-012 | Slowloris attack (slow HTTP) | Timeout connections | ❌ Missing | Medium |

**Implementation Notes:**
- No rate limiting exists
- Fastify has default payload limits (needs verification)

---

## Test Coverage Analysis

### Current Test Coverage Summary

| Category | Total Edge Cases | Covered | Partial | Missing | Coverage % |
|----------|-----------------|---------|---------|---------|------------|
| **Domain-Specific** | 62 | 12 | 18 | 32 | 48% |
| - Birthdays | 25 | 3 | 8 | 14 | 44% |
| - Anniversaries | 15 | 1 | 2 | 12 | 20% |
| - Timezones | 30 | 8 | 8 | 14 | 53% |
| - Users | 20 | 4 | 6 | 10 | 50% |
| - Strategies | 12 | 2 | 4 | 6 | 50% |
| **System** | 108 | 18 | 35 | 55 | 49% |
| - Database | 25 | 6 | 10 | 9 | 64% |
| - Queue | 30 | 8 | 12 | 10 | 67% |
| - Workers | 18 | 2 | 8 | 8 | 56% |
| - Schedulers | 20 | 2 | 6 | 12 | 40% |
| - External API | 15 | 0 | 8 | 7 | 53% |
| **Concurrency** | 15 | 4 | 6 | 5 | 67% |
| **Data Validation** | 20 | 8 | 6 | 6 | 70% |
| **Performance** | 18 | 2 | 7 | 9 | 50% |
| **Security** | 12 | 1 | 1 | 10 | 17% |
| **TOTAL** | **147** | **45** | **73** | **117** | **53%** |

### Priority Coverage Gaps

#### Critical Priority (20 gaps)

1. EC-DB-001: Database connection lost
2. EC-DB-005: Network partition to database
3. EC-Q-001-003: RabbitMQ connection failures
4. EC-Q-015-016: RabbitMQ resource exhaustion
5. EC-W-001-002: All workers down / worker crash
6. EC-RC-003: User deleted while message in queue
7. EC-RC-005: Idempotency race condition
8. EC-PF-001: Sustained 24-hour load test
9. EC-PF-005: All users have birthday same day
10. EC-PF-006: 10M users query performance
11. EC-SEC-001: SQL injection prevention
12. EC-SEC-002: XSS in message content

#### High Priority (45 gaps)

- Timezone DST transitions (EC-TZ-016 to EC-TZ-018)
- User update/delete cascades (EC-UD-015, EC-BD-015, EC-AN-012)
- Strategy error handling (EC-ST-005, EC-ST-006)
- Database deadlocks and transactions (EC-DB-009, EC-DB-010)
- Queue message size limits (EC-Q-011, EC-Q-014)
- Scheduler overlaps and locks (EC-S-009, EC-RC-007)
- API rate limiting (EC-API-006 to EC-API-008)
- (See full list in Implementation Plan)

---

## Missing Test Coverage

### Critical Gaps Requiring Immediate Attention

1. **User Lifecycle Race Conditions**
   - User deleted while message in queue
   - User updated after scheduling
   - Cascade update/delete behavior

2. **Timezone DST Edge Cases**
   - Birthday during spring forward (nonexistent 2am)
   - Birthday during fall back (duplicate 2am)
   - Extreme timezone boundaries (UTC+14, UTC-12)

3. **Database Resilience**
   - Connection loss and recovery
   - Circuit breaker implementation
   - Deadlock handling

4. **Queue Resilience**
   - RabbitMQ connection failures
   - Message size limits
   - DLQ monitoring

5. **Performance at Scale**
   - All birthdays on same day (1M messages in 24 hours)
   - 10M users query performance
   - Sustained 24-hour load test

6. **Security**
   - XSS sanitization in message content
   - Rate limiting
   - Payload size limits

---

## Implementation Plan

### Phase 1: Critical Edge Cases (Week 1-2)

**Goal:** Cover all Critical priority edge cases

#### Database Resilience Tests

```typescript
// tests/chaos/database-connection-loss.test.ts
describe('Database Connection Loss', () => {
  it('should retry connection after database restart', async () => {
    // Kill Postgres container
    // Verify circuit breaker opens
    // Restart Postgres
    // Verify auto-reconnection
    // Verify messages processed after reconnection
  });

  it('should handle network partition gracefully', async () => {
    // Simulate network partition using Toxiproxy
    // Verify circuit breaker activation
    // Verify error logging
    // Restore network
    // Verify recovery
  });
});
```

#### User Lifecycle Race Conditions

```typescript
// tests/integration/user-lifecycle-races.test.ts
describe('User Deleted While Message in Queue', () => {
  it('should skip message if user deleted', async () => {
    const user = await createUser({ birthdayDate: today });
    await scheduleMessage(user);
    await enqueuMessage(user);

    // Delete user before worker processes
    await softDeleteUser(user.id);

    // Worker should skip message
    await waitForWorkerProcessing();

    const message = await getMessageLog(user.id);
    expect(message.status).toBe('SKIPPED');
  });
});
```

#### Timezone DST Transitions

```typescript
// tests/unit/timezone-dst-transitions.test.ts
describe('DST Spring Forward', () => {
  it('should handle birthday at nonexistent 2am', async () => {
    // March 10, 2024: 2am doesn't exist (spring forward to 3am)
    const user = {
      timezone: 'America/New_York',
      birthdayDate: new Date('1990-03-10'),
    };

    const sendTime = calculateSendTime(user, new Date('2024-03-10'));

    // Should send at 3am EDT (first valid time)
    const localTime = DateTime.fromJSDate(sendTime)
      .setZone('America/New_York');
    expect(localTime.hour).toBe(3);
  });
});
```

### Phase 2: High Priority Edge Cases (Week 3-4)

**Goal:** Cover all High priority edge cases

#### Scheduler Distributed Locks

```typescript
// src/schedulers/distributed-lock.ts
export class DistributedLock {
  constructor(private redis: RedisClient) {}

  async acquire(key: string, ttl: number): Promise<boolean> {
    // Redis SETNX with TTL
    return await this.redis.set(key, 'locked', 'NX', 'EX', ttl);
  }

  async release(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

// tests/integration/scheduler-locks.test.ts
it('should prevent duplicate scheduling with distributed lock', async () => {
  // Start two schedulers simultaneously
  await Promise.all([
    scheduler1.run(),
    scheduler2.run(),
  ]);

  // Only one should acquire lock and schedule messages
  const messages = await getScheduledMessages();
  expect(messages).toHaveLength(expectedCount); // No duplicates
});
```

#### API Rate Limiting

```typescript
// src/services/rate-limiter.service.ts
export class RateLimiterService {
  private redis: RedisClient;

  async checkRateLimit(apiKey: string): Promise<boolean> {
    const key = `rate_limit:${apiKey}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }

    return current <= 100; // Max 100 requests per minute
  }
}
```

#### XSS Sanitization

```typescript
// src/utils/sanitizer.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeMessageContent(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [], // No HTML allowed
    ALLOWED_ATTR: [],
  });
}

// tests/unit/xss-sanitization.test.ts
it('should sanitize XSS payload in message', () => {
  const malicious = '<script>alert("XSS")</script>Hello';
  const safe = sanitizeMessageContent(malicious);
  expect(safe).toBe('Hello');
  expect(safe).not.toContain('<script>');
});
```

### Phase 3: Medium Priority Edge Cases (Week 5-6)

**Goal:** Improve coverage to 80%+

- Anniversary edge cases (EC-AN-002 to EC-AN-015)
- Strategy error handling (EC-ST-005, EC-ST-006)
- Database query performance (EC-PF-013 to EC-PF-018)
- Worker scaling tests (EC-W-009 to EC-W-013)

### Phase 4: Low Priority Edge Cases (Week 7-8)

**Goal:** Achieve 95%+ coverage

- Obscure date boundaries (EC-BD-016 to EC-BD-020)
- Extreme timezones (EC-TZ-026 to EC-TZ-030)
- Complex input validation (EC-DV-017 to EC-DV-020)
- Security enhancements (EC-SEC-006 to EC-SEC-012)

---

## Test Templates

### Template 1: Boundary Value Test

```typescript
describe('Boundary Value: [Component]', () => {
  describe('[Field Name]', () => {
    it('should accept value at lower boundary', () => {
      // Test minimum valid value
    });

    it('should accept value at upper boundary', () => {
      // Test maximum valid value
    });

    it('should reject value below lower boundary', () => {
      // Test invalid minimum
    });

    it('should reject value above upper boundary', () => {
      // Test invalid maximum
    });
  });
});
```

### Template 2: State Transition Test

```typescript
describe('State Transition: [Feature]', () => {
  it('should transition from [State A] to [State B]', async () => {
    // Arrange: Set up initial state
    const entity = await createEntity({ state: 'A' });

    // Act: Trigger transition
    await transitionToStateB(entity);

    // Assert: Verify new state
    const updated = await getEntity(entity.id);
    expect(updated.state).toBe('B');
  });

  it('should prevent invalid transition from [State A] to [State C]', async () => {
    // Test invalid transitions throw errors
  });
});
```

### Template 3: Race Condition Test

```typescript
describe('Race Condition: [Scenario]', () => {
  it('should handle concurrent [operations] correctly', async () => {
    // Arrange: Set up shared resource
    const resource = await createResource();

    // Act: Trigger concurrent operations
    const results = await Promise.allSettled([
      operation1(resource),
      operation2(resource),
      operation3(resource),
    ]);

    // Assert: Verify consistency
    const finalState = await getResource(resource.id);
    expect(finalState).toBeConsistent();

    // Assert: Check for race condition artifacts
    const logs = await getOperationLogs(resource.id);
    expect(logs).not.toHaveDuplicates();
  });
});
```

### Template 4: Chaos Engineering Test

```typescript
describe('Chaos: [Component] Failure', () => {
  it('should recover from [failure type]', async () => {
    // Arrange: Set up system
    await setupSystem();

    // Act: Inject failure
    await injectFailure('[component]', '[failure-type]');

    // Assert: Verify graceful degradation
    const health = await checkHealth();
    expect(health.status).toBe('degraded');

    // Act: Wait for recovery
    await waitFor(recovery, 30000);

    // Assert: Verify full recovery
    const recovered = await checkHealth();
    expect(recovered.status).toBe('healthy');
  });
});
```

### Template 5: Performance Boundary Test

```typescript
describe('Performance: [Component] at Scale', () => {
  it('should handle [N] [entities] within SLA', async () => {
    // Arrange: Create large dataset
    const entities = await createBulkEntities(N);

    // Act: Perform operation
    const startTime = performance.now();
    const result = await operationOnLargeDataset(entities);
    const duration = performance.now() - startTime;

    // Assert: Verify performance
    expect(duration).toBeLessThan(SLA_MILLISECONDS);
    expect(result.success).toBe(true);

    // Assert: Verify correctness
    expect(result.processed).toBe(entities.length);
  });
});
```

---

## Boundary Value Analysis

### Numeric Boundaries

| Field | Min | Min+1 | Max-1 | Max | Below Min | Above Max |
|-------|-----|-------|-------|-----|-----------|-----------|
| Retry Count | 0 | 1 | 2 | 3 | -1 | 4 |
| Prefetch Count | 1 | 2 | 99 | 100 | 0 | 101 |
| User Age | 0 | 1 | 149 | 150 | -1 | 151 |
| Name Length | 1 | 2 | 99 | 100 | 0 | 101 |
| Email Length | 1 | 2 | 254 | 255 | 0 | 256 |

### Date Boundaries

| Boundary | Test Value | Expected |
|----------|------------|----------|
| Jan 1 | 2025-01-01 | Valid |
| Dec 31 | 2025-12-31 | Valid |
| Feb 29 Leap | 2024-02-29 | Valid |
| Feb 29 Non-Leap | 2025-02-29 | Invalid |
| Year Min | 1900-01-01 | Valid |
| Year Max | 2100-12-31 | Valid |
| Invalid Month | 2025-13-01 | Invalid |
| Invalid Day | 2025-02-30 | Invalid |

### Timezone Boundaries

| Timezone | UTC Offset | DST | Test Case |
|----------|-----------|-----|-----------|
| UTC+14 (Kiribati) | +14:00 | No | Furthest ahead |
| UTC-12 (Baker Island) | -12:00 | No | Furthest behind |
| UTC+5:30 (India) | +05:30 | No | Half-hour offset |
| UTC+5:45 (Nepal) | +05:45 | No | 45-minute offset |
| America/New_York | -05:00/-04:00 | Yes | DST transitions |

---

## Equivalence Partitioning Strategy

### Message Status Partitions

| Partition | Valid Values | Invalid Values |
|-----------|--------------|----------------|
| Pending States | SCHEDULED, QUEUED | SENDING, SENT |
| Active States | QUEUED, SENDING | SCHEDULED, SENT |
| Terminal States | SENT, FAILED | SCHEDULED, QUEUED |
| Retry-able States | RETRYING, FAILED | SENT, QUEUED |

### User Type Partitions

| Partition | Characteristics | Test Case |
|-----------|----------------|-----------|
| Active Users | `deletedAt = null` | Normal processing |
| Soft Deleted | `deletedAt != null` | Skip messages |
| Has Birthday | `birthdayDate != null` | Birthday messages |
| Has Anniversary | `anniversaryDate != null` | Anniversary messages |
| Has Both | Both dates set | Multiple messages |
| Has Neither | Both dates null | No messages |

### Timezone Partitions

| Partition | Examples | Edge Cases |
|-----------|----------|------------|
| Positive Offset | UTC+1 to UTC+14 | Date line crossing |
| Negative Offset | UTC-1 to UTC-12 | Date line crossing |
| Zero Offset | UTC | No offset issues |
| Half-Hour | UTC+5:30, UTC+9:30 | Calculation precision |
| Quarter-Hour | UTC+5:45, UTC+12:45 | Rare offsets |
| DST Zones | America/New_York | Spring/fall transitions |
| No DST Zones | Asia/Tokyo | No transitions |

---

## Recommendations

### Immediate Actions (This Week)

1. **Implement Critical Tests First**
   - Database connection loss (EC-DB-001)
   - User deleted while in queue (EC-RC-003)
   - DST transitions (EC-TZ-016 to EC-TZ-018)

2. **Add Missing Validations**
   - XSS sanitization in message content
   - User update cascade logic
   - Worker checks for deleted users

3. **Setup Monitoring**
   - DLQ depth alerts
   - Circuit breaker status
   - Worker health checks

### Short-Term (Next 2 Weeks)

1. **Enhance Idempotency**
   - Distributed locks for schedulers
   - Atomic retry count updates
   - Cascade update prevention

2. **Improve Error Handling**
   - Strategy error recovery
   - API rate limiting
   - Better error classification

3. **Add Performance Tests**
   - All birthdays same day scenario
   - 10M users query benchmark
   - Sustained 24-hour load test

### Long-Term (Next Month)

1. **Complete Edge Case Coverage**
   - Achieve 95%+ coverage
   - Document all edge case decisions
   - Update test suite regularly

2. **Implement Security Features**
   - Rate limiting
   - Payload size limits
   - Input sanitization

3. **Production Hardening**
   - Circuit breakers everywhere
   - Comprehensive monitoring
   - Automated alerting

---

## Appendix: Edge Case Decision Log

### Business Decisions Needed

1. **Leap Year Birthdays (EC-BD-003)**
   - **Question:** Feb 29 birthday in non-leap year - celebrate on Feb 28 or Mar 1?
   - **Current:** Hardcoded to Feb 28
   - **Recommendation:** Add user preference field

2. **Late Messages (EC-S-018)**
   - **Question:** Should recovery send messages >24 hours late?
   - **Current:** No limit
   - **Recommendation:** Skip messages >48 hours late, log for manual review

3. **Unknown Fields (EC-DV-018)**
   - **Question:** Should API reject requests with extra fields?
   - **Current:** Zod strips unknown fields
   - **Recommendation:** Keep current behavior for forward compatibility

4. **Deprecated Timezones (EC-TZ-008)**
   - **Question:** Accept US/Eastern or require America/New_York?
   - **Current:** Accept all valid IANA zones
   - **Recommendation:** Warn but accept deprecated zones

### Technical Decisions Made

1. **Idempotency Strategy**
   - **Decision:** Database unique constraint over distributed lock
   - **Rationale:** Simpler, more reliable, easier to test
   - **Trade-off:** Duplicate attempts create database errors (acceptable)

2. **Soft Delete vs Hard Delete**
   - **Decision:** Soft delete with partial indexes
   - **Rationale:** Preserve audit trail, allow email reuse
   - **Trade-off:** More complex queries, larger table size

3. **Error Classification**
   - **Decision:** Pattern matching on error messages
   - **Rationale:** Simple, extensible, no external dependencies
   - **Trade-off:** Brittle if error messages change

---

**End of Document**

Total Pages: 24
Total Edge Cases: 147
Coverage Target: 95%
Estimated Implementation Time: 8 weeks
