# Birthday Message Scheduler - Detailed System Flows
**ANALYST Agent - Supplementary Documentation**

## Table of Contents

1. [1. Complete Birthday Message Flow (Sequence Diagram)](#1-complete-birthday-message-flow-sequence-diagram)
2. [2. Race Condition Prevention](#2-race-condition-prevention)
3. [3. Timezone Conversion Examples](#3-timezone-conversion-examples)
4. [4. Idempotency Key Generation](#4-idempotency-key-generation)
5. [5. Performance Optimization Strategies](#5-performance-optimization-strategies)
6. [6. Monitoring & Alerting Points](#6-monitoring-alerting-points)
7. [7. Disaster Recovery Scenarios](#7-disaster-recovery-scenarios)

---
**Date:** 2025-12-30

---

## 1. Complete Birthday Message Flow (Sequence Diagram)

```
User Creation → Daily Scheduling → Minute-by-Minute Detection → Worker Processing → Message Delivery
```

### Flow 1: User Creation & Initial Setup

```
┌────────┐         ┌──────────────┐       ┌──────────────┐      ┌──────────────┐
│ Client │         │ API Server   │       │  UserService │      │  PostgreSQL  │
└───┬────┘         └──────┬───────┘       └──────┬───────┘      └──────┬───────┘
    │                     │                      │                     │
    │ POST /user          │                      │                     │
    ├────────────────────>│                      │                     │
    │                     │                      │                     │
    │                     │ createUser(dto)      │                     │
    │                     ├─────────────────────>│                     │
    │                     │                      │                     │
    │                     │                      │ Validate timezone   │
    │                     │                      │ (IANA format)       │
    │                     │                      │                     │
    │                     │                      │ INSERT INTO users   │
    │                     │                      ├────────────────────>│
    │                     │                      │                     │
    │                     │                      │ User created (id)   │
    │                     │                      │<────────────────────│
    │                     │                      │                     │
    │                     │                      │ Calculate next      │
    │                     │                      │ birthday send time  │
    │                     │                      │ (9am local time)    │
    │                     │                      │                     │
    │                     │                      │ If birthday is      │
    │                     │                      │ today, schedule     │
    │                     │                      │ immediately         │
    │                     │                      │                     │
    │                     │ User created         │                     │
    │                     │<─────────────────────│                     │
    │                     │                      │                     │
    │ 201 Created         │                      │                     │
    │<────────────────────│                      │                     │
    │ { id, firstName,    │                      │                     │
    │   lastName, ...}    │                      │                     │
    │                     │                      │                     │
```

---

### Flow 2: Daily Birthday Pre-Calculation (CRON Job)

```
Runs once daily at 00:00 UTC

┌──────────────┐     ┌────────────────┐     ┌──────────────┐     ┌──────────────┐
│ CRON Trigger │     │  Scheduler     │     │  PostgreSQL  │     │ Message Logs │
│ (00:00 UTC)  │     │  Service       │     │              │     │              │
└──────┬───────┘     └───────┬────────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                     │                     │
       │ Daily trigger       │                     │                     │
       ├────────────────────>│                     │                     │
       │                     │                     │                     │
       │                     │ Get today's date    │                     │
       │                     │ (month, day)        │                     │
       │                     │                     │                     │
       │                     │ SELECT * FROM users │                     │
       │                     │ WHERE               │                     │
       │                     │ MONTH(birthday) = M │                     │
       │                     │ AND DAY(birthday)=D │                     │
       │                     ├────────────────────>│                     │
       │                     │                     │                     │
       │                     │ List of users       │                     │
       │                     │ (1000 users)        │                     │
       │                     │<────────────────────│                     │
       │                     │                     │                     │
       │                     │ For each user:      │                     │
       │                     │ ┌─────────────────────────────────────┐  │
       │                     │ │ 1. Calculate 9am in user's timezone │  │
       │                     │ │ 2. Convert to UTC                   │  │
       │                     │ │ 3. Generate idempotency key         │  │
       │                     │ │    Format: {userId}:BIRTHDAY:{date} │  │
       │                     │ └─────────────────────────────────────┘  │
       │                     │                     │                     │
       │                     │ BATCH INSERT        │                     │
       │                     │ INTO message_logs   │                     │
       │                     │────────────────────────────────────────>│
       │                     │                     │                     │
       │                     │ 1000 messages       │                     │
       │                     │ scheduled           │                     │
       │                     │<────────────────────────────────────────│
       │                     │                     │                     │
       │                     │ Log: "Scheduled     │                     │
       │                     │ 1000 birthdays for  │                     │
       │                     │ 2025-12-30"         │                     │
       │                     │                     │                     │
```

---

### Flow 3: Minute-by-Minute Detection & Queue Enqueuing

```
Runs every 1 minute

┌──────────────┐     ┌────────────────┐     ┌──────────────┐     ┌─────────────┐
│ CRON Trigger │     │  Scheduler     │     │ Message Logs │     │ Bull Queue  │
│ (Every 1min) │     │  Service       │     │              │     │ (Redis)     │
└──────┬───────┘     └───────┬────────┘     └──────┬───────┘     └──────┬──────┘
       │                     │                     │                     │
       │ Minute trigger      │                     │                     │
       ├────────────────────>│                     │                     │
       │                     │                     │                     │
       │                     │ Get current time    │                     │
       │                     │ NOW = 2025-12-30    │                     │
       │                     │       14:00:00 UTC  │                     │
       │                     │                     │                     │
       │                     │ SELECT * FROM       │                     │
       │                     │ message_logs WHERE  │                     │
       │                     │ scheduled_send_time │                     │
       │                     │ BETWEEN NOW() AND   │                     │
       │                     │ NOW() + 1 hour      │                     │
       │                     │ AND status =        │                     │
       │                     │ 'SCHEDULED'         │                     │
       │                     ├────────────────────>│                     │
       │                     │                     │                     │
       │                     │ 50 messages ready   │                     │
       │                     │ to send in next hr  │                     │
       │                     │<────────────────────│                     │
       │                     │                     │                     │
       │                     │ For each message:   │                     │
       │                     │ ┌──────────────────────────────────────┐ │
       │                     │ │ Calculate delay:                     │ │
       │                     │ │ delay = scheduled_time - NOW()       │ │
       │                     │ │                                      │ │
       │                     │ │ If delay < 0: send immediately       │ │
       │                     │ │ If delay > 0: schedule with delay    │ │
       │                     │ └──────────────────────────────────────┘ │
       │                     │                     │                     │
       │                     │ BATCH ENQUEUE       │                     │
       │                     │ 50 jobs to queue    │                     │
       │                     ├────────────────────────────────────────>│
       │                     │                     │                     │
       │                     │ Jobs enqueued       │                     │
       │                     │<────────────────────────────────────────│
       │                     │                     │                     │
```

---

### Flow 4: Worker Processing & Message Delivery

```
┌─────────────┐     ┌────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Bull Queue  │     │ Worker     │     │ Message Logs │     │  Email API   │     │  PostgreSQL  │
│             │     │ Process    │     │              │     │              │     │              │
└──────┬──────┘     └─────┬──────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                  │                   │                     │                     │
       │ Job ready        │                   │                     │                     │
       ├─────────────────>│                   │                     │                     │
       │                  │                   │                     │                     │
       │                  │ Get job data      │                     │                     │
       │                  │ { messageId }     │                     │                     │
       │                  │                   │                     │                     │
       │                  │ Acquire lock      │                     │                     │
       │                  │ (Redis SETNX)     │                     │                     │
       │                  │                   │                     │                     │
       │                  │ SELECT * FROM     │                     │                     │
       │                  │ message_logs      │                     │                     │
       │                  │ WHERE id = ?      │                     │                     │
       │                  │ FOR UPDATE        │                     │                     │
       │                  ├──────────────────────────────────────────────────────────────>│
       │                  │                   │                     │                     │
       │                  │ Message details   │                     │                     │
       │                  │<──────────────────────────────────────────────────────────────│
       │                  │                   │                     │                     │
       │                  │ Check status      │                     │                     │
       │                  │ If SENT: skip     │                     │                     │
       │                  │                   │                     │                     │
       │                  │ UPDATE status     │                     │                     │
       │                  │ SET status =      │                     │                     │
       │                  │ 'SENDING'         │                     │                     │
       │                  ├──────────────────────────────────────────────────────────────>│
       │                  │                   │                     │                     │
       │                  │ Updated           │                     │                     │
       │                  │<──────────────────────────────────────────────────────────────│
       │                  │                   │                     │                     │
       │                  │ POST /send-email  │                     │                     │
       │                  │ {                 │                     │                     │
       │                  │   email: "...",   │                     │                     │
       │                  │   message: "Hey   │                     │                     │
       │                  │   John it's your  │                     │                     │
       │                  │   birthday"       │                     │                     │
       │                  │ }                 │                     │                     │
       │                  ├────────────────────────────────────────>│                     │
       │                  │                   │                     │                     │
       │                  │                   │                     │ Process email       │
       │                  │                   │                     │ (simulated)         │
       │                  │                   │                     │                     │
       │                  │ 200 OK            │                     │                     │
       │                  │<────────────────────────────────────────│                     │
       │                  │                   │                     │                     │
       │                  │ UPDATE message_logs                     │                     │
       │                  │ SET status = 'SENT',                    │                     │
       │                  │ actual_send_time = NOW(),               │                     │
       │                  │ api_response_code = 200                 │                     │
       │                  ├──────────────────────────────────────────────────────────────>│
       │                  │                   │                     │                     │
       │                  │ Updated           │                     │                     │
       │                  │<──────────────────────────────────────────────────────────────│
       │                  │                   │                     │                     │
       │                  │ Release lock      │                     │                     │
       │                  │                   │                     │                     │
       │                  │ Job complete      │                     │                     │
       │<─────────────────│                   │                     │                     │
       │                  │                   │                     │                     │
```

---

### Flow 5: Error Handling & Retry

```
When email API fails or times out

┌────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│ Worker     │     │  Email API   │     │  PostgreSQL  │     │ Bull Queue  │
│            │     │              │     │              │     │             │
└─────┬──────┘     └──────┬───────┘     └──────┬───────┘     └──────┬──────┘
      │                   │                     │                     │
      │ POST /send-email  │                     │                     │
      ├──────────────────>│                     │                     │
      │                   │                     │                     │
      │                   │ TIMEOUT             │                     │
      │                   │ (10 seconds)        │                     │
      │                   │                     │                     │
      │ Error: Timeout    │                     │                     │
      │<──────────────────│                     │                     │
      │                   │                     │                     │
      │ Catch error       │                     │                     │
      │                   │                     │                     │
      │ UPDATE message_logs                     │                     │
      │ SET status = 'RETRYING',                │                     │
      │ retry_count = retry_count + 1,          │                     │
      │ error_message = 'Timeout',              │                     │
      │ last_retry_at = NOW()                   │                     │
      ├────────────────────────────────────────>│                     │
      │                   │                     │                     │
      │ Updated           │                     │                     │
      │<────────────────────────────────────────│                     │
      │                   │                     │                     │
      │ Check retry_count │                     │                     │
      │ If < 5:           │                     │                     │
      │   Re-enqueue with │                     │                     │
      │   exponential     │                     │                     │
      │   backoff         │                     │                     │
      │   delay = 2^retry │                     │                     │
      │                   │                     │                     │
      │ ENQUEUE job       │                     │                     │
      │ delay = 4 seconds │                     │                     │
      ├────────────────────────────────────────────────────────────>│
      │                   │                     │                     │
      │ Job re-queued     │                     │                     │
      │<────────────────────────────────────────────────────────────│
      │                   │                     │                     │
      │                   │                     │                     │
      │ If retry_count >= 5:                    │                     │
      │   UPDATE status = 'FAILED'              │                     │
      │   Alert monitoring                      │                     │
      │   Move to DLQ                           │                     │
      │                   │                     │                     │
```

---

### Flow 6: Service Recovery After Downtime

```
Runs on startup and every 10 minutes

┌──────────────┐     ┌────────────────┐     ┌──────────────┐     ┌─────────────┐
│ Service      │     │ Recovery       │     │ Message Logs │     │ Bull Queue  │
│ Startup      │     │ Service        │     │              │     │             │
└──────┬───────┘     └───────┬────────┘     └──────┬───────┘     └──────┬──────┘
       │                     │                     │                     │
       │ Trigger recovery    │                     │                     │
       ├────────────────────>│                     │                     │
       │                     │                     │                     │
       │                     │ Calculate time      │                     │
       │                     │ range:              │                     │
       │                     │ start = NOW() - 24h │                     │
       │                     │ end = NOW()         │                     │
       │                     │                     │                     │
       │                     │ SELECT * FROM       │                     │
       │                     │ message_logs WHERE  │                     │
       │                     │ scheduled_send_time │                     │
       │                     │ BETWEEN ? AND ?     │                     │
       │                     │ AND status IN       │                     │
       │                     │ ('SCHEDULED',       │                     │
       │                     │  'RETRYING',        │                     │
       │                     │  'FAILED')          │                     │
       │                     ├────────────────────>│                     │
       │                     │                     │                     │
       │                     │ 250 missed messages │                     │
       │                     │<────────────────────│                     │
       │                     │                     │                     │
       │                     │ Batch enqueue       │                     │
       │                     │ (priority = HIGH)   │                     │
       │                     ├────────────────────────────────────────>│
       │                     │                     │                     │
       │                     │ 250 jobs enqueued   │                     │
       │                     │<────────────────────────────────────────│
       │                     │                     │                     │
       │                     │ Log: "Recovered     │                     │
       │                     │ 250 missed messages"│                     │
       │                     │                     │                     │
       │                     │ Alert: "Recovery    │                     │
       │                     │ completed"          │                     │
       │                     │                     │                     │
```

---

### Flow 7: User Update (Bonus Feature)

```
┌────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│ Client │     │ UserController│     │ UserService   │     │  PostgreSQL  │
└───┬────┘     └──────┬────────┘     └───────┬────────┘     └──────┬───────┘
    │                 │                      │                     │
    │ PUT /user/:id   │                      │                     │
    │ {               │                      │                     │
    │   timezone:     │                      │                     │
    │   "Europe/London"│                      │                     │
    │ }               │                      │                     │
    ├────────────────>│                      │                     │
    │                 │                      │                     │
    │                 │ updateUser(id, dto)  │                     │
    │                 ├─────────────────────>│                     │
    │                 │                      │                     │
    │                 │                      │ SELECT * FROM users │
    │                 │                      │ WHERE id = ?        │
    │                 │                      ├────────────────────>│
    │                 │                      │                     │
    │                 │                      │ User found          │
    │                 │                      │<────────────────────│
    │                 │                      │                     │
    │                 │                      │ Check if timezone   │
    │                 │                      │ or birthday changed │
    │                 │                      │                     │
    │                 │                      │ If changed:         │
    │                 │                      │ ┌────────────────────────────────┐
    │                 │                      │ │ 1. Find SCHEDULED messages     │
    │                 │                      │ │ 2. Recalculate send time       │
    │                 │                      │ │    (9am new timezone)          │
    │                 │                      │ │ 3. Update message_logs         │
    │                 │                      │ │ 4. Update queue job delays     │
    │                 │                      │ └────────────────────────────────┘
    │                 │                      │                     │
    │                 │                      │ UPDATE users        │
    │                 │                      │ SET timezone = ?,   │
    │                 │                      │ updated_at = NOW()  │
    │                 │                      ├────────────────────>│
    │                 │                      │                     │
    │                 │                      │ Updated             │
    │                 │                      │<────────────────────│
    │                 │                      │                     │
    │                 │ User updated         │                     │
    │                 │<─────────────────────│                     │
    │                 │                      │                     │
    │ 200 OK          │                      │                     │
    │<────────────────│                      │                     │
    │ { updated user }│                      │                     │
    │                 │                      │                     │
```

---

## 2. Race Condition Prevention

### Scenario: Two Workers Processing Same Message

```
┌─────────────┐           ┌─────────────┐           ┌──────────────┐
│  Worker 1   │           │  Worker 2   │           │  PostgreSQL  │
└──────┬──────┘           └──────┬──────┘           └──────┬───────┘
       │                         │                         │
       │ Get job (msg_123)       │                         │
       ├────────────────────────────────────────────────┐  │
       │                         │                      │  │
       │                         │ Get job (msg_123)    │  │
       │                         ├──────────────────────┼─>│
       │                         │                      │  │
       │                         │                      │  │
       │ SELECT * FROM message_logs WHERE id = ?        │  │
       │ FOR UPDATE (acquire row lock)                  │  │
       ├───────────────────────────────────────────────────>│
       │                         │                      │  │
       │ Row locked              │                      │  │
       │<───────────────────────────────────────────────────│
       │                         │                      │  │
       │ Check: status != 'SENT' │                      │  │
       │                         │                      │  │
       │ UPDATE status = 'SENDING'                      │  │
       ├───────────────────────────────────────────────────>│
       │                         │                      │  │
       │                         │ SELECT * FROM        │  │
       │                         │ message_logs         │  │
       │                         │ WHERE id = ?         │  │
       │                         │ FOR UPDATE           │  │
       │                         │ (WAITING for lock...)│  │
       │                         ├──────────────────────┼─>│
       │                         │                      │  │
       │ Send email...           │                      │  │
       │                         │                      │  │
       │ UPDATE status = 'SENT'  │                      │  │
       ├───────────────────────────────────────────────────>│
       │                         │                      │  │
       │ COMMIT (release lock)   │                      │  │
       ├───────────────────────────────────────────────────>│
       │                         │                      │  │
       │                         │ Lock acquired        │  │
       │                         │<─────────────────────┼──│
       │                         │                      │  │
       │                         │ Check: status = 'SENT'  │
       │                         │ → SKIP (already sent)   │
       │                         │                      │  │
       │                         │ Return early         │  │
       │                         │                      │  │
```

**Prevention Mechanisms:**
1. Row-level locking (SELECT FOR UPDATE)
2. Status check before sending
3. Idempotency key unique constraint
4. Distributed lock (Redis SETNX) for extra safety

---

## 3. Timezone Conversion Examples

### Example 1: User in New York (EST/EDT)

```
User Input:
- Birthday: 1990-12-30
- Timezone: America/New_York

Current Date: 2025-12-30
Current Time: 10:00:00 UTC

Calculation:
1. Construct local time: 2025-12-30 09:00:00 America/New_York
2. Convert to UTC:
   - Winter (EST = UTC-5): 2025-12-30 14:00:00 UTC
   - Summer (EDT = UTC-4): 2025-12-30 13:00:00 UTC

Stored in DB:
- scheduled_send_time: 2025-12-30 14:00:00+00 (winter)

Worker Processing:
- When UTC time reaches 14:00:00, message is sent
- User receives at exactly 9:00:00 AM EST
```

### Example 2: User in Melbourne (AEDT)

```
User Input:
- Birthday: 1990-12-30
- Timezone: Australia/Melbourne

Current Date: 2025-12-30
Current Time: 10:00:00 UTC

Calculation:
1. Construct local time: 2025-12-30 09:00:00 Australia/Melbourne
2. Convert to UTC:
   - Summer (AEDT = UTC+11): 2025-12-29 22:00:00 UTC
   - Winter (AEST = UTC+10): 2025-12-29 23:00:00 UTC

Stored in DB:
- scheduled_send_time: 2025-12-29 22:00:00+00 (summer)

Worker Processing:
- When UTC time reaches 22:00:00 on 2025-12-29, message is sent
- User receives at exactly 9:00:00 AM AEDT on 2025-12-30
```

### Example 3: Handling DST Transition

```
Scenario: User birthday on DST transition day

User Input:
- Birthday: 1990-03-10 (DST starts in US)
- Timezone: America/New_York

DST Transition:
- 2025-03-09 02:00:00 EST → 03:00:00 EDT (spring forward)

Calculation:
1. Construct local time: 2025-03-10 09:00:00 America/New_York
2. Check if DST is active on 2025-03-10: YES (after transition)
3. Convert to UTC: 2025-03-10 13:00:00 UTC (EDT = UTC-4)

Result:
- Message sent at 13:00:00 UTC
- User receives at 9:00:00 AM EDT
- No manual offset adjustment needed (library handles it)
```

---

## 4. Idempotency Key Generation

### Format

```json
{userId}:{messageType}:{date}

Examples:
- 123e4567-e89b-12d3-a456-426614174000:BIRTHDAY:2025-12-30
- 987fcdeb-51a2-43c7-9def-123456789abc:ANNIVERSARY:2025-06-15
```

### Code Implementation

```typescript
function generateIdempotencyKey(
    userId: string,
    messageType: string,
    date: Date
): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${userId}:${messageType}:${dateStr}`;
}

// Usage
const key = generateIdempotencyKey(
    user.id,
    'BIRTHDAY',
    new Date('2025-12-30')
);
// Result: "123e4567-e89b-12d3-a456-426614174000:BIRTHDAY:2025-12-30"
```

### Database Constraint

```sql
CREATE UNIQUE INDEX idx_message_logs_idempotency
ON message_logs(idempotency_key);
```

### Handling Duplicates

```typescript
async function createMessage(data: CreateMessageDto): Promise<MessageLog> {
    try {
        return await messageLogRepository.save(data);
    } catch (error) {
        if (error.code === '23505') { // PostgreSQL unique constraint violation
            console.log('Message already exists, skipping');
            return await messageLogRepository.findOne({
                where: { idempotencyKey: data.idempotencyKey }
            });
        }
        throw error;
    }
}
```

---

## 5. Performance Optimization Strategies

### Strategy 1: Batch Querying

```typescript
// Bad: N+1 query problem
for (const user of users) {
    const messages = await messageLogRepository.find({
        where: { userId: user.id }
    });
}

// Good: Batch query
const userIds = users.map(u => u.id);
const messages = await messageLogRepository.find({
    where: { userId: In(userIds) }
});

// Group by userId
const messagesByUser = messages.reduce((acc, msg) => {
    if (!acc[msg.userId]) acc[msg.userId] = [];
    acc[msg.userId].push(msg);
    return acc;
}, {});
```

### Strategy 2: Database Query Optimization

```typescript
// Use query builder for complex queries
const messages = await dataSource
    .getRepository(MessageLog)
    .createQueryBuilder('ml')
    .innerJoin('ml.user', 'u')
    .where('ml.scheduled_send_time BETWEEN :start AND :end', {
        start: new Date(),
        end: new Date(Date.now() + 3600000)
    })
    .andWhere('ml.status = :status', { status: 'SCHEDULED' })
    .select(['ml.id', 'ml.userId', 'u.firstName', 'u.lastName', 'u.email'])
    .getMany();
```

### Strategy 3: Caching Frequently Accessed Data

```typescript
import Redis from 'ioredis';

class UserCacheService {
    private redis: Redis;

    async getUser(userId: string): Promise<User | null> {
        // Check cache first
        const cached = await this.redis.get(`user:${userId}`);
        if (cached) {
            return JSON.parse(cached);
        }

        // Fetch from database
        const user = await userRepository.findOne(userId);
        if (user) {
            // Cache for 1 hour
            await this.redis.setex(
                `user:${userId}`,
                3600,
                JSON.stringify(user)
            );
        }

        return user;
    }

    async invalidateUser(userId: string): Promise<void> {
        await this.redis.del(`user:${userId}`);
    }
}
```

---

## 6. Monitoring & Alerting Points

### Critical Metrics to Monitor

```typescript
interface SystemMetrics {
    // Queue metrics
    queueLength: number;           // Current jobs in queue
    queueWaitTime: number;         // Average wait time (ms)
    queueThroughput: number;       // Jobs/second

    // Message delivery metrics
    messagesScheduled: number;     // Total scheduled today
    messagesSent: number;          // Total sent today
    messagesFailed: number;        // Total failed today
    deliverySuccessRate: number;   // Percentage

    // Database metrics
    dbConnectionsActive: number;   // Current connections
    dbConnectionsIdle: number;     // Idle connections
    dbQueryTime: number;           // Average query time (ms)

    // API metrics
    emailApiLatency: number;       // Average API latency (ms)
    emailApiErrorRate: number;     // Percentage
    circuitBreakerStatus: string;  // 'CLOSED' | 'OPEN' | 'HALF_OPEN'

    // System health
    uptime: number;                // Seconds
    memoryUsage: number;           // MB
    cpuUsage: number;              // Percentage
}
```

### Alert Thresholds

```typescript
const alertRules = {
    queueLength: {
        warning: 1000,  // Alert if > 1000 jobs
        critical: 5000  // Critical if > 5000 jobs
    },
    deliverySuccessRate: {
        warning: 95,    // Alert if < 95%
        critical: 90    // Critical if < 90%
    },
    emailApiErrorRate: {
        warning: 5,     // Alert if > 5%
        critical: 20    // Critical if > 20%
    },
    dbConnectionsActive: {
        warning: 15,    // Alert if > 15 (pool size = 20)
        critical: 19    // Critical if > 19
    }
};
```

---

## 7. Disaster Recovery Scenarios

### Scenario 1: Database Goes Down

```
Timeline:
00:00 - Database crashes
00:01 - Health check fails, alerts triggered
00:02 - Auto-failover to read replica (if configured)
00:05 - Database restored

Recovery Steps:
1. Worker queue pauses (connection errors)
2. Jobs remain in Redis queue (not lost)
3. Database restored
4. Workers resume processing
5. Recovery job runs to catch missed messages
6. All messages delivered (delayed but not lost)
```

### Scenario 2: Redis (Queue) Goes Down

```
Timeline:
00:00 - Redis crashes
00:01 - Workers cannot fetch jobs
00:02 - API still accepts user creation
00:05 - Redis restored

Recovery Steps:
1. Workers stop processing (cannot connect to queue)
2. CRON job continues to create scheduled messages in DB
3. Redis restored
4. CRON job re-enqueues all pending messages
5. Workers resume processing
6. Messages delivered (delayed)
```

### Scenario 3: Email API Complete Outage

```
Timeline:
00:00 - Email API down
00:01 - Circuit breaker opens after 50% error rate
00:05 - All workers report failures
01:00 - Email API restored

Recovery Steps:
1. Messages fail with timeout/error
2. Status set to 'RETRYING'
3. Retry with exponential backoff (up to 5 attempts)
4. After 5 failures, status = 'FAILED'
5. Recovery job runs every 10 minutes
6. When API restored, recovery job re-enqueues failed messages
7. All messages eventually delivered
```

---

**END OF FLOW DOCUMENTATION**
