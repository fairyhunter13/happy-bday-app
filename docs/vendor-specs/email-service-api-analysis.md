# Email Service Vendor API Analysis

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Status:** Analysis Complete

---

## Executive Summary

This document provides analysis and integration planning for the Digital Envision Email Service API (`https://email-service.digitalenvision.com.au`).

### Current Status

**Vendor API Access:** Unable to retrieve OpenAPI specification
- **URL Attempted:** `https://email-service.digitalenvision.com.au/api-docs/`
- **Status:** Returns only Swagger UI styling (CSS/HTML), not the actual API specification
- **Alternative URLs Tested:**
  - `https://email-service.digitalenvision.com.au/api-docs/openapi.json` - Not accessible
  - `https://email-service.digitalenvision.com.au/api-docs/swagger.json` - Not accessible

### Recommended Actions

1. **Contact Vendor** - Request official OpenAPI 3.1 specification file
2. **Request Documentation Access** - Obtain credentials or IP whitelist if required
3. **Fallback Strategy** - Use standard email service integration patterns (detailed below)

---

## Standard Email Service Integration Pattern

Based on industry standards for email service APIs, the integration typically follows this pattern:

### Expected Endpoint Structure

```yaml
POST /v1/messages/send
Content-Type: application/json
Authorization: Bearer {API_KEY}

Request Body:
{
  "to": "recipient@example.com",
  "from": "sender@yourcompany.com",
  "subject": "Happy Birthday!",
  "body": "Message content here",
  "bodyType": "text" | "html",
  "metadata": {
    "userId": "uuid",
    "messageType": "birthday"
  }
}

Response (200 OK):
{
  "messageId": "msg_abc123",
  "status": "queued" | "sent",
  "timestamp": "2025-01-15T09:00:00Z"
}

Response (4xx/5xx Error):
{
  "error": {
    "code": "INVALID_EMAIL" | "RATE_LIMIT_EXCEEDED",
    "message": "Human readable error"
  }
}
```

### Common Authentication Methods

1. **API Key (Bearer Token)** - Most common
   ```
   Authorization: Bearer sk_live_abc123def456
   ```

2. **OAuth 2.0** - Enterprise tier
   ```
   Authorization: Bearer {access_token}
   ```

3. **API Key in Headers**
   ```
   X-API-Key: abc123def456
   ```

### Rate Limiting (Typical)

```yaml
Headers:
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 950
  X-RateLimit-Reset: 1704110400

429 Response:
  Retry-After: 60
```

### Webhook Integration (Optional)

Vendors typically provide webhooks for delivery status:

```yaml
POST {your_webhook_url}
Content-Type: application/json
X-Signature: sha256=...

{
  "event": "message.delivered" | "message.failed",
  "messageId": "msg_abc123",
  "timestamp": "2025-01-15T09:05:00Z",
  "metadata": {
    "userId": "uuid",
    "messageType": "birthday"
  }
}
```

---

## Integration Architecture

### Circuit Breaker Pattern (Already Implemented)

Our application uses `opossum` for circuit breaker:

```typescript
// src/services/message-sender.service.ts
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(sendEmailAPI, {
  timeout: 5000,        // 5 second timeout
  errorThresholdPercentage: 50,
  resetTimeout: 30000,  // 30 second cooldown
});
```

### Retry Strategy

```typescript
interface RetryConfig {
  maxRetries: 3;
  retryDelays: [60, 300, 900]; // 1min, 5min, 15min
  retryableErrors: [
    'RATE_LIMIT_EXCEEDED',
    'TIMEOUT',
    'SERVICE_UNAVAILABLE'
  ];
}
```

### Idempotency

Use our existing `idempotency_key` from message_logs:

```typescript
// Pattern: {userId}_{messageType}_{date}
// Example: "550e8400-e29b-41d4-a716-446655440000_birthday_2025-01-15"

headers: {
  'Idempotency-Key': messageLog.idempotencyKey
}
```

---

## Error Mapping

Map vendor errors to our internal status:

| Vendor Error Code | Our Status | Retry? | Action |
|-------------------|------------|--------|--------|
| `INVALID_EMAIL` | `FAILED` | No | Mark as failed, notify |
| `RATE_LIMIT_EXCEEDED` | `RETRYING` | Yes | Exponential backoff |
| `TIMEOUT` | `RETRYING` | Yes | Retry with circuit breaker |
| `SERVICE_UNAVAILABLE` | `RETRYING` | Yes | Retry after cooldown |
| `AUTHENTICATION_FAILED` | `FAILED` | No | Alert operations team |
| `QUOTA_EXCEEDED` | `FAILED` | No | Alert billing/ops team |

---

## Configuration Management

### Environment Variables

```bash
# Vendor API Configuration
EMAIL_SERVICE_BASE_URL=https://email-service.digitalenvision.com.au
EMAIL_SERVICE_API_KEY=sk_live_abc123def456
EMAIL_SERVICE_TIMEOUT_MS=5000
EMAIL_SERVICE_MAX_RETRIES=3

# Circuit Breaker
EMAIL_SERVICE_BREAKER_THRESHOLD=50
EMAIL_SERVICE_BREAKER_RESET_MS=30000

# Rate Limiting
EMAIL_SERVICE_RATE_LIMIT=1000
EMAIL_SERVICE_RATE_WINDOW_MS=60000
```

### TypeScript Interface

```typescript
// src/types/vendor.ts
export interface VendorEmailRequest {
  to: string;
  from: string;
  subject: string;
  body: string;
  bodyType: 'text' | 'html';
  metadata?: {
    userId: string;
    messageType: string;
    [key: string]: unknown;
  };
}

export interface VendorEmailResponse {
  messageId: string;
  status: 'queued' | 'sent' | 'failed';
  timestamp: string;
}

export interface VendorErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

---

## Monitoring & Observability

### Prometheus Metrics (To Add)

```typescript
// src/services/metrics.service.ts
const vendorApiMetrics = {
  // Request metrics
  vendorApiRequestsTotal: new Counter({
    name: 'vendor_api_requests_total',
    help: 'Total vendor API requests',
    labelNames: ['endpoint', 'status_code', 'result']
  }),

  // Latency histogram
  vendorApiDurationSeconds: new Histogram({
    name: 'vendor_api_duration_seconds',
    help: 'Vendor API request duration',
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  }),

  // Circuit breaker state
  vendorCircuitBreakerState: new Gauge({
    name: 'vendor_circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)'
  }),

  // Rate limit tracking
  vendorRateLimitRemaining: new Gauge({
    name: 'vendor_rate_limit_remaining',
    help: 'Remaining vendor API rate limit'
  })
};
```

---

## Testing Strategy

### Mock Vendor Responses

```typescript
// tests/mocks/vendor-api.mock.ts
export const mockVendorResponses = {
  success: {
    messageId: 'msg_test_123',
    status: 'queued',
    timestamp: '2025-01-15T09:00:00Z'
  },

  rateLimitExceeded: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded, retry after 60 seconds'
    }
  },

  invalidEmail: {
    error: {
      code: 'INVALID_EMAIL',
      message: 'Invalid recipient email address'
    }
  }
};
```

### Integration Test Cases

```typescript
describe('Vendor Email Service Integration', () => {
  test('should send email successfully', async () => {
    // Arrange
    const request = createEmailRequest();

    // Act
    const response = await vendorService.sendEmail(request);

    // Assert
    expect(response.status).toBe('queued');
    expect(response.messageId).toBeDefined();
  });

  test('should handle rate limiting with retry', async () => {
    // Simulate rate limit response
    // Verify exponential backoff
    // Verify eventual success
  });

  test('should open circuit breaker after threshold', async () => {
    // Simulate multiple failures
    // Verify circuit opens
    // Verify fast-fail behavior
  });
});
```

---

## Next Steps

### Immediate Actions

1. **Contact Vendor Support**
   - Email: support@digitalenvision.com.au (typical)
   - Request: Official OpenAPI 3.1 specification
   - Request: API documentation and authentication details
   - Request: Sandbox/test environment credentials

2. **Document Real API**
   - Once spec is obtained, update this document
   - Generate TypeScript types from OpenAPI spec
   - Update integration tests with real endpoints

3. **Implement Integration**
   - Create vendor service class
   - Add error mapping
   - Implement monitoring
   - Add integration tests

### Future Enhancements

1. **Webhook Handler** (if vendor supports)
   ```typescript
   // src/routes/webhook.routes.ts
   POST /webhooks/email-vendor
   - Verify webhook signature
   - Update message_logs status
   - Emit metrics
   ```

2. **Vendor Failover** (if using multiple providers)
   ```typescript
   // Primary: Digital Envision
   // Fallback: SendGrid / AWS SES
   ```

3. **Performance Optimization**
   - Connection pooling
   - Request batching (if supported)
   - Compression (gzip/brotli)

---

## Security Considerations

### API Key Management

```typescript
// src/config/vendor.ts
import { env } from './environment.js';

export const vendorConfig = {
  // NEVER commit API keys
  apiKey: env.EMAIL_SERVICE_API_KEY,

  // Use different keys per environment
  baseUrl: env.EMAIL_SERVICE_BASE_URL,

  // Rotate keys quarterly
  keyRotationDate: '2025-04-01'
};
```

### Request Signing (if supported)

```typescript
import crypto from 'node:crypto';

function signRequest(body: string, timestamp: number): string {
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}
```

---

## Appendix: Common Email Service Providers

For reference, if vendor spec is unavailable:

| Provider | OpenAPI Spec | Auth Method | Rate Limit |
|----------|--------------|-------------|------------|
| SendGrid | Yes (v3.0) | Bearer Token | 600/min |
| Mailgun | Yes (v3.0) | Basic Auth | 100/hour (free) |
| AWS SES | Yes (v3.0) | AWS Signature v4 | 1/sec (sandbox) |
| Postmark | Yes (v3.1) | Bearer Token | 10,000/min |
| SparkPost | Yes (v3.0) | Bearer Token | 50/sec |

All provide:
- REST API with JSON
- Delivery status webhooks
- Idempotency support
- Comprehensive error codes

---

## Document Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-12-30 | 1.0 | Initial analysis and integration patterns | System |

---

## References

- **Circuit Breaker Pattern**: [Martin Fowler - CircuitBreaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- **Retry Strategies**: [AWS Architecture Blog - Exponential Backoff](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- **Idempotency**: [Stripe API - Idempotent Requests](https://stripe.com/docs/api/idempotent_requests)
- **OpenAPI 3.1**: [OpenAPI Specification](https://spec.openapis.org/oas/v3.1.0)
