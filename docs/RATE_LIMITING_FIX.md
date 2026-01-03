# Rate Limiting Fix for Performance Tests

## Problem Statement

Performance tests were failing because the API rate limiter was blocking k6 load testing requests. The tests needed to send 100+ messages/sec, but the default rate limit configuration was blocking them after reaching the limit.

### Root Cause

From workflow runs 20671094139 and 20671272479, all API requests were returning `INTERNAL_SERVER_ERROR` due to rate limiting:
- `x-ratelimit-limit: 100`
- `x-ratelimit-remaining: 0`
- `retry-after: 735` (seconds)

The global rate limiter in `src/app.ts` was applying to ALL routes, including the internal `/internal/process-message` endpoint used by k6 performance tests.

### Critical Bug: Boolean Environment Variable Parsing

**IMPORTANT**: The initial fix attempt failed because of a critical bug in Zod's `z.coerce.boolean()`.

**The Bug:**
- Docker Compose sets `RATE_LIMIT_ENABLED: false` as the **string** `"false"`
- Zod's `z.coerce.boolean()` uses JavaScript's `Boolean()` function
- `Boolean("false")` returns `true` because **any non-empty string is truthy**!
- Result: `RATE_LIMIT_ENABLED=false` was being parsed as `true`, keeping rate limiting active!

```typescript
// THE BUG:
Boolean("false") === true  // ❌ Wrong!
z.coerce.boolean().parse("false") === true  // ❌ BUG!

// What we needed:
booleanString.parse("false") === false  // ✅ Correct!
```

## Solution

Implemented a configurable rate limiting system that can be disabled for performance testing environments while remaining enabled for production and development.

### Changes Made

#### 1. Environment Configuration (`src/config/environment.ts`)

**Created custom boolean parser** to fix the Zod coercion bug:

```typescript
/**
 * Custom boolean coercion that properly handles string "false" and "0"
 * Standard z.coerce.boolean() treats "false" as truthy (non-empty string)
 */
const booleanString = z
  .string()
  .transform((val) => {
    const normalized = val.toLowerCase().trim();
    if (normalized === 'false' || normalized === '0' || normalized === '') {
      return false;
    }
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    // For any other value, convert to boolean
    return Boolean(val);
  })
  .pipe(z.boolean());
```

**Updated environment schema** to use the custom parser:
```typescript
RATE_LIMIT_ENABLED: booleanString.default('true')
DATABASE_SSL: booleanString.default('false')
ENABLE_METRICS: booleanString.default('true')
```

This correctly handles string-based boolean values from Docker Compose environment variables.

#### 2. Application Setup (`src/app.ts`)

**Enhanced logging** to debug boolean parsing issues:

```typescript
logger.info(
  {
    RATE_LIMIT_ENABLED: env.RATE_LIMIT_ENABLED,
    RATE_LIMIT_ENABLED_TYPE: typeof env.RATE_LIMIT_ENABLED,
    RATE_LIMIT_ENABLED_RAW: process.env.RATE_LIMIT_ENABLED,
    willRegister: env.RATE_LIMIT_ENABLED === true,
  },
  'Rate limiting configuration check'
);
```

**Modified rate limiting registration** to be conditional with strict comparison:

```typescript
if (env.RATE_LIMIT_ENABLED === true) {
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
    'Rate limiting ENABLED'
  );
} else {
  logger.warn(
    {
      RATE_LIMIT_ENABLED: env.RATE_LIMIT_ENABLED,
      reason: 'RATE_LIMIT_ENABLED is not true',
    },
    'Rate limiting is DISABLED - use only in performance testing environments'
  );
}
```

Benefits:
- **Diagnostic logging** shows parsed value, type, and raw environment variable
- **Strict comparison** (`=== true`) prevents truthy value bugs
- **Clear logging** indicates rate limiting status
- **Warning message** when disabled to prevent accidental production deployment

#### 3. Performance Test Environment (`docker-compose.perf.yml`)

**Fixed YAML anchor inheritance** - the problem was that individual API services were overriding the `environment` section, losing the anchor's `RATE_LIMIT_ENABLED: false`.

**Updated x-api-service anchor** with rate limiting disabled:
```yaml
x-api-service: &api-service
  environment:
    <<: *perf-env
    # Rate Limiting - DISABLED for performance testing
    RATE_LIMIT_ENABLED: false
    RATE_LIMIT_WINDOW_MS: 60000
    RATE_LIMIT_MAX_REQUESTS: 1000000
```

**Simplified API service definitions** to properly inherit from anchor:
```yaml
# BEFORE (broken - environment override lost anchor settings):
api-1:
  <<: *api-service
  container_name: perf-api-1
  environment:            # ❌ This replaces the anchor's environment
    <<: *perf-env
    PORT: 3000
    INSTANCE_ID: api-1
    RATE_LIMIT_ENABLED: false  # Had to repeat it (and still got bug!)

# AFTER (fixed - inherits all settings from anchor):
api-1:
  <<: *api-service
  container_name: perf-api-1
  # ✅ No environment override - inherits from anchor including RATE_LIMIT_ENABLED: false
```

**Key fix**: Removed redundant `environment` sections in individual API services (api-1 through api-5), allowing them to properly inherit `RATE_LIMIT_ENABLED: false` from the `x-api-service` anchor.

#### 4. Startup Logging (`src/config/logger.ts`)

**Added rate limiting status** to startup logs:

```typescript
export function logStartup() {
  logger.info(
    {
      env: env.NODE_ENV,
      port: env.PORT,
      host: env.HOST,
      rateLimitEnabled: env.RATE_LIMIT_ENABLED,
      rateLimitEnabledRaw: process.env.RATE_LIMIT_ENABLED,
    },
    'Application configuration loaded'
  );
}
```

This ensures rate limiting status is visible immediately on application startup.

#### 5. Unit Tests (`tests/unit/config/environment.test.ts`)

**Created comprehensive unit tests** to verify boolean parsing and prevent regression:

- Tests for parsing `"true"`, `"false"`, `"1"`, `"0"`, empty string
- Tests for case-insensitive parsing (`"TRUE"`, `"FALSE"`)
- Tests for whitespace handling
- Tests demonstrating the `z.coerce.boolean()` bug
- Tests verifying the custom `booleanString` parser works correctly

Run tests with:
```bash
npm run test:unit -- tests/unit/config/environment.test.ts
```

#### 6. Verification Script (`scripts/verify-rate-limit-disabled.sh`)

**Created automated verification script** to check running containers:

```bash
#!/bin/bash
# Checks container logs for rate limiting status
# Makes test request to verify no rate limit headers
./scripts/verify-rate-limit-disabled.sh
```

The script:
- Checks all perf-api containers for "Rate limiting is DISABLED" message
- Makes a test request to the API
- Verifies NO `x-ratelimit-*` headers are present
- Reports success or failure

#### 7. Environment Example (`.env.example`)

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

**IMPORTANT**: After making code changes, rebuild the Docker image with `--no-cache` to ensure the new code is included:

1. **Rebuild Docker image** (critical step):
```bash
docker-compose -f docker-compose.perf.yml build --no-cache
```

2. **Start performance environment**:
```bash
docker-compose -f docker-compose.perf.yml up -d
```

3. **Run the verification script**:
```bash
./scripts/verify-rate-limit-disabled.sh
```

Expected output:
```
✓ CONFIRMED: Rate limiting is DISABLED
✓ No x-ratelimit headers found (GOOD - rate limiting is disabled)
✓ SUCCESS: No rate limit headers in response
```

4. **Check API logs manually** (alternative verification):
```bash
docker logs perf-api-1 2>&1 | grep -i "rate limit"
```

Expected log entries:
```
Rate limiting configuration check {"RATE_LIMIT_ENABLED":false,"RATE_LIMIT_ENABLED_TYPE":"boolean","RATE_LIMIT_ENABLED_RAW":"false","willRegister":false}
Rate limiting is DISABLED - use only in performance testing environments {"RATE_LIMIT_ENABLED":false,"reason":"RATE_LIMIT_ENABLED is not true"}
```

5. **Run k6 peak load test**:
```bash
npm run test:performance
```

Expected result:
- ✅ No rate limiting errors
- ✅ No `RATE_LIMIT_EXCEEDED` errors
- ✅ All requests succeed or fail for legitimate reasons (not rate limiting)

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

## Summary of Changes

This fix involved **two critical issues**:

1. **Boolean Parsing Bug**: `z.coerce.boolean()` incorrectly parsed the string `"false"` as `true`
   - **Solution**: Created custom `booleanString` parser that correctly handles string booleans
   - **Impact**: Affects ALL boolean environment variables in Docker environments

2. **YAML Anchor Override**: Individual API services were overriding the environment section
   - **Solution**: Removed redundant environment overrides in docker-compose.perf.yml
   - **Impact**: Now properly inherits `RATE_LIMIT_ENABLED: false` from anchor

## Files Modified

### Core Application Code
1. **src/config/environment.ts**
   - Added custom `booleanString` parser (lines 3-20)
   - Updated `RATE_LIMIT_ENABLED`, `DATABASE_SSL`, `ENABLE_METRICS` to use `booleanString`

2. **src/app.ts**
   - Enhanced rate limiting configuration logging (lines 64-72)
   - Changed condition to strict comparison `=== true` (line 74)
   - Enhanced disabled warning with diagnostic info (lines 97-103)

3. **src/config/logger.ts**
   - Added `rateLimitEnabled` and `rateLimitEnabledRaw` to startup logs (lines 65-66)

### Configuration
4. **docker-compose.perf.yml**
   - Removed redundant `environment` sections in api-1 through api-5 (lines 162-180)
   - Now properly inherits from `x-api-service` anchor

### Testing & Verification
5. **tests/unit/config/environment.test.ts** (new file)
   - 17 unit tests for boolean parsing
   - Demonstrates the `z.coerce.boolean()` bug
   - Verifies the fix works correctly

6. **scripts/verify-rate-limit-disabled.sh** (new file)
   - Automated verification script (executable)
   - Checks container logs and API responses

### Documentation
7. **docs/RATE_LIMITING_FIX.md** (this file)
   - Updated with root cause analysis
   - Added testing procedures
   - Added verification steps

## Quick Reference

### For Developers
- **To disable rate limiting**: Set `RATE_LIMIT_ENABLED=false` in environment
- **To verify it's disabled**: Check logs for "Rate limiting is DISABLED"
- **Run unit tests**: `npm run test:unit -- tests/unit/config/environment.test.ts`
- **Run verification**: `./scripts/verify-rate-limit-disabled.sh`

### For DevOps
- **After code changes**: Rebuild with `docker-compose -f docker-compose.perf.yml build --no-cache`
- **Never disable in production**: Always keep `RATE_LIMIT_ENABLED=true` in production
- **Monitor logs**: Look for rate limiting status in startup logs

### For QA/Testing
- **Performance tests**: Rate limiting should be DISABLED
- **All other tests**: Rate limiting should be ENABLED
- **Verification**: NO `x-ratelimit-*` headers should appear when disabled

## Related Files

- `src/config/environment.ts` - Environment variable schema and validation
- `src/app.ts` - Application setup with conditional rate limiting
- `src/config/logger.ts` - Startup logging configuration
- `docker-compose.perf.yml` - Performance test environment configuration
- `tests/unit/config/environment.test.ts` - Unit tests for boolean parsing
- `scripts/verify-rate-limit-disabled.sh` - Verification script
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
