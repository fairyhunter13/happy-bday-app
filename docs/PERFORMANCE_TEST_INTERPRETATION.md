# Performance Test Interpretation Guide

**Last Updated:** 2026-01-04
**Audience:** Developers, DevOps, Performance Engineers

## Overview

This guide helps you interpret performance test results, identify bottlenecks, and make data-driven optimization decisions.

## Test Types

### 1. Smoke Test (Quick Validation)
- **Duration:** 30 seconds
- **Purpose:** Verify system handles minimal load
- **Pass Criteria:** <1% error rate, p95 < 500ms

### 2. Load Test (Sustained Traffic)
- **Duration:** 5 minutes
- **Purpose:** Verify 1M+ messages/day capacity
- **Pass Criteria:** <1% error rate, p95 < 1000ms, throughput ≥ 50 RPS

### 3. Stress Test (Breaking Point)
- **Purpose:** Find system limits
- **Pass Criteria:** Graceful degradation, no crashes

## Key Metrics

### Response Time Percentiles
- **p50 (median):** Typical user experience
- **p95:** 95% of requests faster than this
- **p99:** Slowest 1% threshold
- **max:** Worst case scenario

**Good Targets:**
- p50: < 200ms
- p95: < 500ms
- p99: < 1000ms

### Throughput
- **RPS (Requests/sec):** System capacity
- **Target:** ≥ 50 RPS sustained

### Error Rate
- **Target:** < 1%
- **Critical:** > 5% indicates problems

## Reading Test Results

### Example: Good Performance
```
✓ http_req_duration...: avg=150ms p95=450ms p99=800ms
✓ http_reqs...........: 15000 total (50/s)
✗ http_req_failed.....: 0.2%
```
**Interpretation:** Excellent - meets all targets

### Example: Performance Issue
```
✗ http_req_duration...: avg=800ms p95=2500ms p99=5000ms
✗ http_reqs...........: 3000 total (10/s)
✗ http_req_failed.....: 15%
```
**Issues:**
- High latency → Database/network bottleneck
- Low throughput → CPU/connection pool exhaustion
- High errors → Resource limits hit

## Common Bottlenecks

### Database
**Symptoms:** High p95, slow queries
**Fix:** Add indexes, optimize queries, connection pooling

### Memory
**Symptoms:** Increasing latency over time
**Fix:** Fix memory leaks, tune GC, increase heap

### CPU
**Symptoms:** High CPU usage, low throughput
**Fix:** Optimize algorithms, add caching, scale horizontally

### Network
**Symptoms:** Inconsistent latency spikes
**Fix:** Check bandwidth, tune timeouts, use CDN

## Optimization Workflow

1. **Baseline:** Run test, record metrics
2. **Profile:** Identify bottleneck
3. **Fix:** Implement optimization
4. **Verify:** Re-run test, compare results
5. **Repeat:** Continue until targets met

## Tooling

- **K6:** Load testing
- **Grafana:** Metrics visualization
- **Prometheus:** Metrics collection
- **Node.js Profiler:** CPU/Memory analysis

---

**Related:**
- [PERFORMANCE_TEST_OPTIMIZATION.md](./PERFORMANCE_TEST_OPTIMIZATION.md)
- [METRICS.md](./METRICS.md)
