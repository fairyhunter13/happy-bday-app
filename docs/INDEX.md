# Documentation Index

Complete documentation organized by topic and audience.

## Queue System Documentation (NEW)

Comprehensive documentation for the RabbitMQ-based asynchronous message queue system.

### Getting Started

1. **[QUEUE_README.md](./QUEUE_README.md)** (327 lines)
   - Overview of all queue documentation
   - Quick navigation guide
   - Architecture at a glance
   - Common tasks and troubleshooting

### For Everyone

2. **[QUEUE_ARCHITECTURE.md](./QUEUE_ARCHITECTURE.md)** (428 lines)
   - System design and components
   - RabbitMQ topology (exchanges, queues, bindings)
   - Message lifecycle and data flow
   - Configuration options
   - Performance characteristics
   - Design decisions and trade-offs

### For Users/Integrators

3. **[QUEUE_USAGE.md](./QUEUE_USAGE.md)** (595 lines)
   - Quick start examples
   - Publishing messages (single, batch, retry)
   - Consuming messages (handlers, errors, shutdown)
   - Configuration and customization
   - Common patterns
   - Monitoring and health checks
   - Testing strategies
   - Complete API reference

4. **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** (Included in QUEUE_USAGE.md)
   - Step-by-step integration guide
   - Environment setup
   - Scheduler integration
   - Migrating existing hooks
   - Database migration
   - Monitoring setup
   - Rollback plan
   - Common issues and solutions

### For Operators

5. **[QUEUE_OPS.md](./QUEUE_OPS.md)** (672 lines)
   - Starting the worker (dev, prod, K8s)
   - Monitoring queue status
   - Scaling workers
   - Stopping and shutdown
   - Comprehensive troubleshooting
   - Maintenance tasks
   - Performance optimization
   - Alerts and thresholds

### For Developers

6. **[QUEUE_DEVELOPER.md](./QUEUE_DEVELOPER.md)** (728 lines)
   - Code organization
   - Key classes and interfaces
   - Message flow diagrams
   - Extension points
   - Testing strategies
   - Debugging techniques
   - Performance profiling
   - Common patterns

## Supporting Documentation

### Queue Metrics & Implementation Details

7. **[QUEUE_METRICS_IMPLEMENTATION.md](./QUEUE_METRICS_IMPLEMENTATION.md)** (502 lines)
   - Prometheus metrics design
   - Instrumentation implementation
   - Metrics registry
   - Dashboard queries

8. **[QUEUE_OPTIMIZATION_REPORT.md](./QUEUE_OPTIMIZATION_REPORT.md)** (857 lines)
   - Performance optimization details
   - Throughput analysis
   - Latency optimization
   - Resource efficiency
   - Scaling recommendations

## Documentation Coverage

### Code Files with Inline Comments

All source files contain comprehensive inline documentation:

- **src/queue/connection.ts** - RabbitMQ connection management
- **src/queue/publisher.ts** - Message publishing logic
- **src/queue/consumer.ts** - Message consumption and error handling
- **src/queue/types.ts** - Message types and interfaces
- **src/queue/config.ts** - RabbitMQ topology configuration
- **src/queue/index.ts** - Public exports
- **src/services/queue/queue-metrics.ts** - Prometheus metrics
- **src/workers/message-worker.ts** - Message processing
- **src/schedulers/minute-enqueue.scheduler.ts** - Message enqueueing

### Test Files

All test files include usage examples:
- Integration tests demonstrate full message flow
- Unit tests show component usage
- Contract tests verify message schema

## Reading Paths by Role

### I'm a New Developer

1. Start: [QUEUE_README.md](./QUEUE_README.md) - Understand what the queue does
2. Read: [QUEUE_ARCHITECTURE.md](./QUEUE_ARCHITECTURE.md) - Learn the design
3. Code: [QUEUE_DEVELOPER.md](./QUEUE_DEVELOPER.md) - Understand implementation
4. Use: [QUEUE_USAGE.md](./QUEUE_USAGE.md) - Integrate in your code

### I'm an Operations Engineer

1. Start: [QUEUE_README.md](./QUEUE_README.md) - Overview
2. Setup: [QUEUE_OPS.md](./QUEUE_OPS.md) - Deploy and operate
3. Monitor: [QUEUE_METRICS_IMPLEMENTATION.md](./QUEUE_METRICS_IMPLEMENTATION.md) - Set up monitoring
4. Debug: [QUEUE_OPS.md](./QUEUE_OPS.md#troubleshooting) - Troubleshooting

### I'm a DevOps/SRE

1. Start: [QUEUE_ARCHITECTURE.md](./QUEUE_ARCHITECTURE.md) - Architecture overview
2. Deploy: [QUEUE_OPS.md](./QUEUE_OPS.md) - Deployment procedures
3. Scale: [QUEUE_OPS.md](./QUEUE_OPS.md#scaling-workers) - Scaling strategies
4. Optimize: [QUEUE_OPTIMIZATION_REPORT.md](./QUEUE_OPTIMIZATION_REPORT.md) - Performance tuning
5. Monitor: [QUEUE_METRICS_IMPLEMENTATION.md](./QUEUE_METRICS_IMPLEMENTATION.md) - Metrics setup

### I'm Integrating the Queue

1. Start: [QUEUE_README.md](./QUEUE_README.md) - Understand the queue
2. Setup: [QUEUE_USAGE.md](./QUEUE_USAGE.md#quick-start) - Get started
3. Integrate: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Step-by-step integration
4. Verify: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md#step-8-verification) - Verification steps
5. Test: [QUEUE_DEVELOPER.md](./QUEUE_DEVELOPER.md#testing-strategies) - Test strategies

### I'm Debugging an Issue

1. First: [QUEUE_OPS.md](./QUEUE_OPS.md#troubleshooting) - Check troubleshooting guide
2. Monitor: [QUEUE_README.md](./QUEUE_README.md#monitoring) - Check metrics
3. Code: [QUEUE_DEVELOPER.md](./QUEUE_DEVELOPER.md#debugging) - Debug techniques
4. Ops: [QUEUE_OPS.md](./QUEUE_OPS.md) - Operational procedures

## Statistics

```
Total Documentation:  4,109 lines
                     ~120 KB

Breakdown:
- Architecture       428 lines (10%)
- Developer Guide    728 lines (18%)
- Metrics            502 lines (12%)
- Operations         672 lines (16%)
- Optimization       857 lines (21%)
- README             327 lines (8%)
- Usage Guide        595 lines (15%)

Code Comments:       Comprehensive inline comments in all source files
Examples:            50+ code examples across all docs
Diagrams:            10+ ASCII diagrams and flows
```

## Quick Links

| Need | Link |
|------|------|
| System overview | [QUEUE_README.md](./QUEUE_README.md) |
| Architecture | [QUEUE_ARCHITECTURE.md](./QUEUE_ARCHITECTURE.md) |
| How to use | [QUEUE_USAGE.md](./QUEUE_USAGE.md) |
| Integrate code | [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) |
| Deploy & run | [QUEUE_OPS.md](./QUEUE_OPS.md) |
| Code details | [QUEUE_DEVELOPER.md](./QUEUE_DEVELOPER.md) |
| Troubleshooting | [QUEUE_OPS.md](./QUEUE_OPS.md#troubleshooting) |
| Performance | [QUEUE_OPTIMIZATION_REPORT.md](./QUEUE_OPTIMIZATION_REPORT.md) |
| Metrics | [QUEUE_METRICS_IMPLEMENTATION.md](./QUEUE_METRICS_IMPLEMENTATION.md) |

## Key Concepts

### Message
A unit of work containing birthday/anniversary message details.
```
MessageJob {
  messageId: UUID,
  userId: UUID,
  messageType: BIRTHDAY | ANNIVERSARY,
  scheduledSendTime: ISO datetime,
  retryCount: integer,
  timestamp: milliseconds
}
```

### Queue
RabbitMQ-based message queue with:
- Topic exchange for routing
- Quorum queue for reliability
- Dead letter exchange for failures

### Worker
Standalone process that:
- Consumes messages from queue
- Processes with configurable concurrency
- Sends via external API
- Handles retries automatically

### Retry Logic
- **Transient errors**: Requeue with exponential backoff
- **Permanent errors**: Send to dead letter queue
- **Max retries**: Configurable (default 5)

## Environment Configuration

```bash
# Core RabbitMQ
RABBITMQ_URL=amqp://user:pass@host:5672

# Concurrency & Retries
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=5
QUEUE_RETRY_DELAY=2000
QUEUE_RETRY_BACKOFF=exponential

# Scheduling
CRON_MINUTE_SCHEDULE="* * * * *"
```

## Verification Checklist

After reading documentation:

- [ ] Can explain queue architecture
- [ ] Can start the worker
- [ ] Can publish a message
- [ ] Can consume a message
- [ ] Can troubleshoot a common issue
- [ ] Know where to find API reference
- [ ] Know how to monitor the queue
- [ ] Know how to scale workers

## Support & Questions

Refer to documentation by question type:

| Question Type | Document |
|---|---|
| "How do I...?" | [QUEUE_USAGE.md](./QUEUE_USAGE.md) |
| "What if...?" | [QUEUE_ARCHITECTURE.md](./QUEUE_ARCHITECTURE.md) |
| "Why does...?" | [QUEUE_DEVELOPER.md](./QUEUE_DEVELOPER.md) |
| "How do I debug?" | [QUEUE_OPS.md](./QUEUE_OPS.md#troubleshooting) |
| "How do I operate?" | [QUEUE_OPS.md](./QUEUE_OPS.md) |
| "How do I integrate?" | [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) |

## Last Updated

- Documentation: 2026-01-02
- Implementation: Stable
- Queue System: Production-ready

## Related Files

- Source code: `/src/queue/`, `/src/workers/`, `/src/schedulers/`
- Tests: `/test/` (check for integration test examples)
- Configuration: Environment variables in `.env`
