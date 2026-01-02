# Test Patterns Documentation

Resilient API testing patterns and architectures for external service integration.

## Overview

This directory contains documentation for resilient testing patterns designed to handle external API integrations with proper error handling, retries, timeouts, and circuit breakers.

## Files

### 1. RESILIENT-API-TESTING-ARCHITECTURE.md

**Purpose:** Comprehensive architecture for resilient API testing

**Contents:**
- Resilient HTTP client implementation
- Retry strategies with exponential backoff
- Circuit breaker patterns
- Timeout handling
- Error classification (transient vs permanent)
- Test utilities and helpers
- Integration with external email service API

**Use this when:**
- Setting up new external API integrations
- Implementing retry logic for flaky services
- Designing fault-tolerant test suites
- Understanding circuit breaker patterns

### 2. RESILIENT-API-TESTING-SUMMARY.md

**Purpose:** Summary of resilient API testing implementation and results

**Contents:**
- Implementation summary
- Test coverage and validation results
- Performance characteristics
- Known issues and limitations
- Best practices and recommendations

**Use this when:**
- Quick reference for testing patterns
- Understanding test results and metrics
- Learning from implementation lessons
- Planning similar testing infrastructure

## Related Documentation

- **[../TESTING_QUICKSTART.md](../TESTING_QUICKSTART.md)** - Quick guide to running tests
- **[../TEST_PLAN.md](../TEST_PLAN.md)** - Comprehensive test plan and strategy
- **[../TEST_VALIDATION_RESULTS_COMPLETE.md](../TEST_VALIDATION_RESULTS_COMPLETE.md)** - Complete test validation results
- **[../vendor-specs/EMAIL_SERVICE_INTEGRATION.md](../vendor-specs/EMAIL_SERVICE_INTEGRATION.md)** - Email service integration specifications

## Quick Navigation

| Need | Document |
|------|----------|
| Understand resilient architecture | [RESILIENT-API-TESTING-ARCHITECTURE.md](./RESILIENT-API-TESTING-ARCHITECTURE.md) |
| See implementation results | [RESILIENT-API-TESTING-SUMMARY.md](./RESILIENT-API-TESTING-SUMMARY.md) |
| Learn retry strategies | RESILIENT-API-TESTING-ARCHITECTURE.md (Retry section) |
| Implement circuit breakers | RESILIENT-API-TESTING-ARCHITECTURE.md (Circuit Breaker section) |

## Key Concepts

### Resilient HTTP Client

HTTP client with built-in resilience features:
- Automatic retries for transient failures
- Exponential backoff with jitter
- Circuit breaker to prevent cascade failures
- Configurable timeouts
- Request/response logging

### Retry Strategies

- **Immediate retry:** For quick transient failures (network blips)
- **Exponential backoff:** For rate limiting and server overload
- **Jitter:** Prevents thundering herd problem
- **Max retries:** Configurable limit to prevent infinite loops

### Circuit Breaker

Protection mechanism that:
- Monitors failure rate
- Opens circuit after threshold exceeded
- Allows occasional test requests
- Closes circuit when service recovers
- Prevents wasted requests to failing services

### Error Classification

- **Transient errors:** Network timeouts, 5xx errors, rate limits (retry)
- **Permanent errors:** 4xx client errors, invalid requests (fail fast)
- **Authentication errors:** 401/403 (fail and alert)

## Testing Best Practices

1. **Use retry logic for external APIs** - Network failures are inevitable
2. **Implement circuit breakers** - Prevent cascade failures
3. **Set appropriate timeouts** - Don't wait forever for responses
4. **Classify errors properly** - Retry transient, fail fast on permanent
5. **Add logging and metrics** - Monitor external service health
6. **Test failure scenarios** - Chaos testing for resilience validation
7. **Mock external services** - Fast, reliable unit tests

## Environment Variables

```bash
# External API Configuration
EMAIL_SERVICE_URL=https://email-service.digitalenvision.com.au
EMAIL_SERVICE_TIMEOUT=5000  # milliseconds

# Retry Configuration
RETRY_MAX_ATTEMPTS=3
RETRY_INITIAL_DELAY=1000   # milliseconds
RETRY_MAX_DELAY=10000      # milliseconds
RETRY_BACKOFF_FACTOR=2

# Circuit Breaker Configuration
CIRCUIT_BREAKER_THRESHOLD=5        # failures before opening
CIRCUIT_BREAKER_TIMEOUT=60000      # milliseconds in open state
CIRCUIT_BREAKER_RESET_TIMEOUT=30000 # milliseconds for half-open
```

## Common Issues

### Issue: Tests fail intermittently

**Solution:** Increase retry attempts or timeout values

### Issue: Circuit breaker constantly open

**Solution:** Check external service health, increase failure threshold

### Issue: Tests too slow

**Solution:** Reduce timeout values, use mocks for unit tests

### Issue: Rate limiting from external API

**Solution:** Implement exponential backoff with jitter, reduce request rate

## Last Updated

- Documentation: 2026-01-02
- Test Patterns: Stable and production-ready

## Verification Checklist

After reading this documentation:

- [ ] Understand retry strategies and exponential backoff
- [ ] Know how circuit breakers work
- [ ] Can classify errors (transient vs permanent)
- [ ] Know when to use resilient patterns vs mocks
- [ ] Can configure retry and circuit breaker settings
- [ ] Understand timeout handling

## Back to Main Documentation

- **[Main Documentation Index](../INDEX.md)**
- **[Testing Section](../INDEX.md#testing)**
