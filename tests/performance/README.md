# Performance Testing Guide

Comprehensive k6 performance testing suite for Birthday Message Scheduler.

## Overview

This directory contains production-grade performance tests covering all critical system components:
- API endpoints (CRUD operations)
- Scheduler performance (daily and minute schedulers)
- Worker throughput and scaling
- End-to-end message flow

## Test Suite

### 1. API Load Test (`api-load.test.js`)

Tests all CRUD operations on `/api/v1/users` endpoint under realistic load.

**Load Profile:**
- Ramp up: 0 → 100 → 500 → 1000 concurrent users (10 min)
- Sustained: 1000 users for 30 minutes
- Ramp down: 5 minutes

**Operations Mix:**
- CREATE (40%): POST /api/v1/users
- READ (30%): GET /api/v1/users/:id
- UPDATE (20%): PUT /api/v1/users/:id
- DELETE (10%): DELETE /api/v1/users/:id

**Thresholds:**
- p95 < 500ms
- p99 < 1000ms
- Error rate < 1%

**Usage:**
```bash
npm run perf:k6:api
```

**Expected Results:**
- Total requests: ~100,000
- Throughput: 50-100 req/s
- Success rate: > 99%

### 2. Scheduler Load Test (`scheduler-load.test.js`)

Tests scheduler performance with production-scale data volumes.

**Scenarios:**
1. **Daily Scheduler** (10 min)
   - Pre-calculate 10,000 birthdays/day
   - Measure execution time
   - Verify enqueue performance

2. **Minute Scheduler** (15 min)
   - Enqueue 500 messages/minute
   - Measure enqueue rate
   - Track queue depth

3. **Database Queries** (10 min)
   - High concurrency read operations
   - Test query performance
   - Measure database latency

**Thresholds:**
- Scheduler execution < 30s (10k records)
- Enqueue rate > 100 msg/s
- DB queries p95 < 200ms

**Usage:**
```bash
npm run perf:k6:scheduler
```

**Expected Results:**
- 10,000 test users created
- Scheduler processes all records < 30s
- Enqueue rate > 100 msg/s

### 3. Worker Throughput Test (`worker-throughput.test.js`)

Tests worker pool performance and scaling efficiency.

**Scenarios:**
1. **Baseline** (5 min): 1 worker @ 100 msg/min
2. **Medium** (5 min): 5 workers @ 500 msg/min
3. **High** (10 min): 10 workers @ 1000 msg/min
4. **Peak** (5 min): 10 workers @ 2000 msg/min
5. **Failure** (5 min): Retry testing @ 200 msg/min

**Thresholds:**
- Throughput > 50 msg/s (10 workers)
- Processing time p95 < 1s
- Retry latency < 2s
- Scaling efficiency > 90%

**Usage:**
```bash
npm run perf:k6:worker-throughput
```

**Expected Results:**
- 10,000+ messages processed
- Linear scaling verified
- 10 workers ≈ 9x throughput of 1 worker

### 4. End-to-End Load Test (`e2e-load.test.js`)

Tests complete birthday message flow under load.

**Flow Steps:**
1. Create user via API
2. Scheduler pre-calculates birthday
3. Message enqueued to RabbitMQ
4. Worker processes message
5. Email sent and verified

**Load Profile:**
- Ramp up: 0 → 100 → 500 → 1000 concurrent flows (10 min)
- Sustained: 1000 flows for 20 minutes
- Ramp down: 7 minutes

**Thresholds:**
- E2E p95 < 5s
- E2E p99 < 8s
- Success rate > 99%

**Usage:**
```bash
npm run perf:k6:e2e
```

**Expected Results:**
- ~30,000 complete flows
- Average e2e latency: 2-4s
- Success rate: > 99%

## Running Tests

### Prerequisites

1. **Install k6:**
   ```bash
   # macOS
   brew install k6

   # Linux
   sudo apt install k6

   # Windows
   choco install k6
   ```

2. **Start Services:**
   ```bash
   # Development
   docker-compose up -d

   # Production test
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Verify Health:**
   ```bash
   curl http://localhost:3000/health
   ```

### Run Individual Tests

```bash
# API load test
npm run perf:k6:api

# Scheduler load test
npm run perf:k6:scheduler

# Worker throughput test
npm run perf:k6:worker-throughput

# End-to-end test
npm run perf:k6:e2e
```

### Run All Tests

```bash
npm run perf:all
```

### Generate Report

```bash
# Generate HTML report
npm run perf:report:html

# Open report
open perf-results/performance-report.html
```

## Custom Configuration

### Environment Variables

```bash
# Set custom API URL
export API_URL=https://staging.example.com

# Run test
npm run perf:k6:api
```

### k6 CLI Options

```bash
# Run with custom duration
k6 run --duration 10m tests/performance/api-load.test.js

# Run with custom VUs
k6 run --vus 500 tests/performance/api-load.test.js

# Save results to file
k6 run --out json=results.json tests/performance/api-load.test.js

# Run in cloud
k6 cloud tests/performance/api-load.test.js
```

## Understanding Results

### Metrics

**HTTP Metrics:**
- `http_req_duration`: Request latency (ms)
- `http_req_failed`: Failed request rate (0-1)
- `http_reqs`: Total request count

**Custom Metrics:**
- `*_latency`: Operation-specific latency
- `*_processed`: Success counters
- `*_failed`: Failure counters
- `*_throughput`: Messages/second

### Thresholds

Green (PASS): ✓
Red (FAIL): ✗

**Critical Thresholds:**
- p95 latency < 500ms
- p99 latency < 1000ms
- Error rate < 1%
- Success rate > 99%

### Interpreting Results

**Good Performance:**
```
✓ http_req_duration............: p(95)=324.5ms p(99)=876.2ms
✓ http_req_failed..............: 0.23%
✓ http_reqs....................: 95423
```

**Issues Detected:**
```
✗ http_req_duration............: p(95)=1234.5ms p(99)=3456.2ms
✗ http_req_failed..............: 5.67%
```

## Troubleshooting

### Test Failures

**Error: Connection refused**
```bash
# Check services are running
docker-compose ps

# Check API health
curl http://localhost:3000/health
```

**Error: Too many VUs**
```bash
# Reduce concurrent users in test file
# Or increase system resources

# Check resource usage
docker stats
```

**Error: Timeout**
```bash
# Increase timeouts in test file
# Or optimize application performance

# Check logs
docker-compose logs -f api
```

### Performance Issues

**High Latency:**
1. Check database queries
2. Review worker concurrency
3. Check RabbitMQ queue depth
4. Monitor CPU/memory usage

**High Error Rate:**
1. Check application logs
2. Verify database connections
3. Check RabbitMQ status
4. Review rate limiting

**Low Throughput:**
1. Scale workers
2. Increase database pool
3. Optimize queries
4. Review resource limits

## Best Practices

### Before Testing

1. **Clean Database:**
   ```bash
   docker-compose exec postgres psql -U postgres -c "TRUNCATE users, message_logs CASCADE;"
   ```

2. **Clear Queues:**
   ```bash
   docker-compose exec rabbitmq rabbitmqctl purge_queue birthday-messages
   ```

3. **Reset Metrics:**
   ```bash
   curl -X POST http://localhost:9090/api/v1/admin/tsdb/delete_series
   ```

### During Testing

1. Monitor resource usage:
   ```bash
   docker stats
   ```

2. Watch logs:
   ```bash
   docker-compose logs -f api worker
   ```

3. Check queue depth:
   ```bash
   docker-compose exec rabbitmq rabbitmqctl list_queues
   ```

### After Testing

1. Generate report
2. Review threshold failures
3. Analyze trends
4. Document findings
5. Clean up test data

## Performance Targets

### Development
- p95 < 1000ms
- Error rate < 5%
- Throughput > 10 req/s

### Staging
- p95 < 500ms
- Error rate < 2%
- Throughput > 50 req/s

### Production
- p95 < 500ms
- p99 < 1000ms
- Error rate < 1%
- Throughput > 100 req/s
- Uptime > 99.9%

## Load Test Matrix

| Test | Duration | VUs | Requests | Pass Rate |
|------|----------|-----|----------|-----------|
| API Load | 45m | 1000 | ~100k | > 99% |
| Scheduler | 35m | 100 | ~10k | > 99.5% |
| Worker | 30m | 250 | ~10k | > 99% |
| E2E | 37m | 1000 | ~30k | > 99% |

## Report Examples

### Success Example
```
=== API Load Test Complete ===
Duration: 45.23 minutes
Users Created: 39,847
Users Read: 29,885
Users Updated: 19,923
Users Deleted: 9,961
Operations Failed: 184
Success Rate: 99.82%
```

### Metrics Example
```
HTTP Request Duration:
  avg: 234.52ms
  p(95): 456.23ms
  p(99): 892.45ms

Throughput: 87.3 req/s
Error Rate: 0.18%
```

## Contributing

When adding new performance tests:

1. Follow existing test structure
2. Include comprehensive metrics
3. Set realistic thresholds
4. Document expected results
5. Update this README

## Support

- Documentation: `/DOCKER_DEPLOYMENT_GUIDE.md`
- Issues: GitHub Issues
- Performance questions: Create discussion

## License

MIT License - see LICENSE file for details
