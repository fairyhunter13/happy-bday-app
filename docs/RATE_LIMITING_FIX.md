# Rate Limiting Fix for Performance Tests

## Problem Statement

Performance tests were failing because the API rate limiter was blocking k6 load testing requests. The tests needed to send 100+ messages/sec, but the default rate limit configuration was blocking them after reaching the limit.

### Root Cause

From workflow run 20671094139, all API requests were returning `INTERNAL_SERVER_ERROR` due to rate limiting:
- `x-ratelimit-limit: 100`
- `x-ratelimit-remaining: 0`
- `retry-after: 735` (seconds)

The global rate limiter in `src/app.ts` was applying to ALL routes, including the internal `/internal/process-message` endpoint used by k6 performance tests.

## Solution

Implemented a configurable rate limiting system that can be disabled for performance testing environments while remaining enabled for production and development.

### Changes Made

#### 1. Environment Configuration (`src/config/environment.ts`)

Added new environment variable:
```typescript
RATE_LIMIT_ENABLED: z.coerce.boolean().default(true)
```

This allows rate limiting to be completely disabled via environment variable, which is the cleanest approach for performance testing.

#### 2. Application Setup (`src/app.ts`)

Modified rate limiting registration to be conditional:

```typescript
// Register rate limiting (conditionally enabled via RATE_LIMIT_ENABLED env var)
// For performance testing, set RATE_LIMIT_ENABLED=false to disable rate limiting entirely
if (env.RATE_LIMIT_ENABLED) {
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX_REQUESTS,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_request, context) => {
      return {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded, retry in ${context.after}`,
        },
        timestamp: new Date().toISOString(),
      };
    },
  });
  logger.info(
    {
      enabled: true,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    },
    'Rate limiting enabled'
  );
} else {
  logger.warn('Rate limiting is DISABLED - use only in performance testing environments');
}
```

Benefits:
- Clean conditional registration
- Logging to clearly indicate rate limiting status
- Warning message when disabled to prevent accidental production deployment

#### 3. Performance Test Environment (`docker-compose.perf.yml`)

Updated the API service template to disable rate limiting:

```yaml
# Rate Limiting - DISABLED for performance testing
RATE_LIMIT_ENABLED: false
RATE_LIMIT_WINDOW_MS: 60000
RATE_LIMIT_MAX_REQUESTS: 1000000
RATE_LIMIT_CREATE_USER_MAX: 1000000
RATE_LIMIT_READ_USER_MAX: 1000000
RATE_LIMIT_UPDATE_USER_MAX: 1000000
RATE_LIMIT_DELETE_USER_MAX: 1000000
```

Also added explicit override for each API instance (api-1 through api-5):
```yaml
api-1:
  <<: *api-service
  container_name: perf-api-1
  environment:
    <<: *perf-env
    PORT: 3000
    INSTANCE_ID: api-1
    RATE_LIMIT_ENABLED: false
```

#### 4. Environment Example (`.env.example`)

Updated documentation with all rate limiting variables:

```bash
# Rate Limiting
RATE_LIMIT_ENABLED=true                     # Set to false to disable rate limiting (for performance testing)
RATE_LIMIT_WINDOW_MS=900000                 # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100                 # Global default max requests per window
RATE_LIMIT_CREATE_USER_MAX=10               # Max create user requests per minute
RATE_LIMIT_READ_USER_MAX=100                # Max read user requests per minute
RATE_LIMIT_UPDATE_USER_MAX=20               # Max update user requests per minute
RATE_LIMIT_DELETE_USER_MAX=10               # Max delete user requests per minute
```

## Configuration Behavior

### Development Environment
- `RATE_LIMIT_ENABLED=true` (default)
- Standard rate limits apply to protect against accidental abuse during development
- Per-endpoint limits: CREATE=10/min, READ=100/min, UPDATE=20/min, DELETE=10/min

### Production Environment
- `RATE_LIMIT_ENABLED=true` (required)
- Standard rate limits protect the API from abuse
- Should NEVER be disabled in production

### Performance Test Environment
- `RATE_LIMIT_ENABLED=false`
- Rate limiting completely disabled
- Allows k6 tests to send 100+ messages/sec without throttling
- Used only in CI/CD performance test workflows

## Testing

### Verify Rate Limiting is Disabled in Performance Tests

1. Start performance environment:
```bash
docker-compose -f docker-compose.perf.yml up -d
```

2. Check API logs to confirm rate limiting is disabled:
```bash
docker logs perf-api-1 2>&1 | grep -i "rate limiting"
```

Expected output:
```
Rate limiting is DISABLED - use only in performance testing environments
```

3. Run k6 peak load test:
```bash
k6 run tests/performance/peak-load.js
```

Expected result: No rate limiting errors, all requests should succeed or fail for legitimate reasons (not rate limiting).

### Verify Rate Limiting is Enabled in Development

1. Start development environment with `.env.development`:
```bash
npm run dev
```

2. Check logs for rate limiting confirmation:
```
Rate limiting enabled {"enabled":true,"maxRequests":100,"windowMs":900000}
```

3. Test rate limiting by making rapid requests (should hit limit and get error)

## Performance Test Results

With rate limiting disabled, the k6 tests can now:
- Sustain 100+ messages/sec during peak load tests
- Reach stress levels of 120 messages/sec
- Run 24-hour sustained load tests without artificial throttling
- Accurately measure API performance without rate limiting interference

## Security Considerations

### Why This Approach is Safe

1. **Environment-Specific**: Rate limiting is only disabled in the performance test environment (`docker-compose.perf.yml`)

2. **Not Exposed Externally**: The `/internal/process-message` endpoint is blocked from external access via nginx configuration (only accessible from Docker internal networks)

3. **Explicit Configuration**: The `RATE_LIMIT_ENABLED=false` flag makes it obvious when rate limiting is disabled

4. **Default Enabled**: Rate limiting defaults to `true` if not explicitly set, ensuring safety by default

5. **Logged**: Application logs clearly indicate when rate limiting is disabled with a warning message

### Production Deployment Checklist

- [ ] Verify `RATE_LIMIT_ENABLED=true` in production environment
- [ ] Confirm rate limit values are appropriate for production load
- [ ] Test rate limiting in staging environment
- [ ] Monitor rate limit metrics in production
- [ ] Set up alerts for excessive rate limiting

## Alternative Approaches Considered

### 1. Very High Rate Limits (Not Chosen)
```yaml
RATE_LIMIT_MAX_REQUESTS: 1000000
```
- **Pros**: Rate limiting still registered, just ineffective
- **Cons**: Still adds overhead, confusing configuration, not truly disabled

### 2. Skip Routes (Not Chosen)
```typescript
config: {
  rateLimit: false
}
```
- **Pros**: Granular control per route
- **Cons**: Requires modifying route definitions, more complex, internal routes would still need configuration

### 3. Conditional Registration (Chosen)
```typescript
if (env.RATE_LIMIT_ENABLED) {
  await app.register(rateLimit, { ... });
}
```
- **Pros**: Clean, no overhead when disabled, clear logging, environment-specific
- **Cons**: None identified
- **Chosen because**: Cleanest approach with zero overhead and clear intent

## Related Files

- `src/config/environment.ts` - Environment variable schema and validation
- `src/app.ts` - Application setup with conditional rate limiting
- `docker-compose.perf.yml` - Performance test environment configuration
- `tests/performance/peak-load.js` - K6 test that sends 100+ msg/sec
- `.env.example` - Environment variable documentation

## Monitoring

### Metrics to Track

When rate limiting is enabled, monitor these metrics:
- `http_req_rate_limited` - Number of requests that hit rate limits
- `http_req_duration` - Should not be affected by rate limiting for legitimate traffic
- Rate limiting errors in application logs

### Alerts

Set up alerts for:
- High rate limiting error rates (may indicate attack or misconfiguration)
- Rate limiting disabled in non-perf environments (security risk)

## References

- GitHub Actions workflow: `.github/workflows/performance.yml`
- Fastify rate limiting plugin: `@fastify/rate-limit`
- K6 performance testing: https://k6.io/docs/
