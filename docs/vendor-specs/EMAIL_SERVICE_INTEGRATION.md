# Email Service Integration Guide

**Vendor:** Digital Envision
**Service URL:** https://email-service.digitalenvision.com.au
**API Version:** 1.0
**Last Updated:** 2025-12-30

---

## Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Authentication](#authentication)
4. [Request/Response Formats](#requestresponse-formats)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Retry Strategy](#retry-strategy)
8. [Circuit Breaker Pattern](#circuit-breaker-pattern)
9. [Integration Examples](#integration-examples)
10. [Monitoring & Observability](#monitoring--observability)
11. [Testing Strategies](#testing-strategies)
12. [Production Considerations](#production-considerations)

---

## Overview

The Digital Envision Email Service is a third-party API used for sending transactional emails, specifically birthday messages in our application. The service provides a simple HTTP POST endpoint for email delivery.

### Key Characteristics

- **Base URL:** `https://email-service.digitalenvision.com.au`
- **Protocol:** HTTPS only
- **Content Type:** `application/json`
- **Expected Availability:** ~99.5% (10% failure rate observed)
- **Average Latency:** 50-200ms
- **Recommended Timeout:** 10 seconds

### Service Limitations

⚠️ **Important Notes:**
- The service exhibits a ~10% random failure rate requiring robust retry logic
- Response times vary (50-200ms) requiring appropriate timeout configuration
- Rate limits are not explicitly documented but should be assumed to exist
- Circuit breaker pattern is essential to prevent cascading failures

---

## API Endpoints

### 1. Send Email

**Endpoint:** `POST /send-email`

**Purpose:** Send a transactional email message to a single recipient.

**Request Format:**
```json
{
  "email": "john.doe@example.com",
  "message": "Hey, John Doe it's your birthday"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "messageId": "msg-1704024000000"
}
```

**Field Specifications:**

| Field | Type | Required | Max Length | Description |
|-------|------|----------|------------|-------------|
| `email` | string (email) | Yes | 255 | Valid email address |
| `message` | string | Yes | 10,000 | Plain text message content |

### 2. API Documentation

**Endpoint:** `GET /api-docs/`

**Purpose:** Access Swagger UI documentation interface.

**Note:** The actual OpenAPI specification endpoint could not be directly accessed. This integration guide is based on implementation requirements and observed behavior.

---

## Authentication

### Current Implementation

**Authentication Method:** None (currently)

The service does not currently require authentication based on the implementation specifications. All requests are sent without authentication headers.

### Future Considerations

If authentication is required in the future, common patterns might include:

```http
X-API-Key: your-api-key-here
Authorization: Bearer your-token-here
```

**Action Item:** Confirm with Digital Envision whether API keys will be required for production use.

---

## Request/Response Formats

### Request Headers

```http
POST /send-email HTTP/1.1
Host: email-service.digitalenvision.com.au
Content-Type: application/json
Content-Length: [calculated]
```

### Request Body Schema

```typescript
interface SendEmailRequest {
  email: string;      // Valid email address (RFC 5322)
  message: string;    // Plain text content
}
```

### Success Response Schema

```typescript
interface SendEmailResponse {
  success: boolean;   // Always true for 200 responses
  messageId: string;  // Format: "msg-{timestamp}"
}
```

### Example Birthday Message

```json
{
  "email": "john.doe@example.com",
  "message": "Hey, John Doe it's your birthday"
}
```

---

## Error Handling

### HTTP Status Codes

| Status Code | Error Type | Description | Action Required |
|-------------|------------|-------------|-----------------|
| 200 | Success | Email sent successfully | Log success, update message status to SENT |
| 400 | Bad Request | Invalid request format or parameters | Log error, do NOT retry, mark as FAILED |
| 429 | Too Many Requests | Rate limit exceeded | Implement exponential backoff, retry after delay |
| 500 | Internal Server Error | Temporary service failure | Retry with exponential backoff (up to 5 attempts) |
| 503 | Service Unavailable | Service under maintenance | Retry with longer backoff, alert operations team |

### Error Response Format

```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred. Please retry later"
}
```

For rate limiting (429):
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please retry after 60 seconds",
  "retryAfter": 60
}
```

### Error Classification

**Retryable Errors (5xx, 429):**
- 429 Too Many Requests
- 500 Internal Server Error
- 503 Service Unavailable
- Network timeouts
- Connection errors

**Non-Retryable Errors (4xx except 429):**
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found

---

## Rate Limiting

### Expected Behavior

While specific rate limits are not documented, the following assumptions should guide implementation:

**Recommended Limits:**
- **Per-second:** 50 requests/sec
- **Burst capacity:** 100 requests
- **Daily quota:** Unlimited (but subject to fair use)

### Rate Limit Headers (If Provided)

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1704024000
Retry-After: 60
```

### Implementation Strategy

```typescript
// Queue-based rate limiting with Bull
const queueConfig = {
  limiter: {
    max: 50,           // Max 50 requests
    duration: 1000     // Per 1 second
  }
};
```

---

## Retry Strategy

### Recommended Configuration

Based on the service's ~10% failure rate and variable latency:

```typescript
const retryConfig = {
  maxRetries: 5,
  backoffType: 'exponential',
  initialDelay: 2000,        // 2 seconds
  maxDelay: 60000,           // 60 seconds
  multiplier: 2
};
```

### Retry Delays

| Attempt | Delay | Cumulative Time |
|---------|-------|-----------------|
| 1 (initial) | 0ms | 0ms |
| 2 (1st retry) | 2,000ms | 2s |
| 3 (2nd retry) | 4,000ms | 6s |
| 4 (3rd retry) | 8,000ms | 14s |
| 5 (4th retry) | 16,000ms | 30s |
| 6 (5th retry) | 32,000ms | 62s |

### Implementation Example

```typescript
async function sendEmailWithRetry(
  email: string,
  message: string,
  attempt: number = 1
): Promise<MessageResult> {
  try {
    const response = await axios.post(
      'https://email-service.digitalenvision.com.au/send-email',
      { email, message },
      { timeout: 10000 }
    );

    return {
      success: true,
      apiResponseCode: response.status,
      apiResponseBody: response.data
    };
  } catch (error) {
    // Check if error is retryable
    const isRetryable = isRetryableError(error);
    const shouldRetry = attempt < 6 && isRetryable;

    if (shouldRetry) {
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 60000);
      await sleep(delay);
      return sendEmailWithRetry(email, message, attempt + 1);
    }

    return {
      success: false,
      apiResponseCode: error.response?.status,
      errorMessage: error.message
    };
  }
}

function isRetryableError(error: any): boolean {
  // Network errors
  if (!error.response) return true;

  // HTTP status codes
  const status = error.response.status;
  return status === 429 || status >= 500;
}
```

---

## Circuit Breaker Pattern

### Why Circuit Breaker?

With a 10% failure rate, the circuit breaker prevents:
- Cascading failures during service degradation
- Resource exhaustion from repeated failed requests
- Unnecessary load on the failing service

### Configuration

Using the `opossum` library:

```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(sendEmailRequest, {
  timeout: 10000,              // 10 seconds
  errorThresholdPercentage: 50, // Open at 50% failure rate
  resetTimeout: 30000,          // Try to close after 30 seconds
  volumeThreshold: 10           // Minimum 10 requests before opening
});

// Event listeners
breaker.on('open', () => {
  logger.warn('Circuit breaker OPEN - email service degraded');
});

breaker.on('halfOpen', () => {
  logger.info('Circuit breaker HALF-OPEN - testing email service');
});

breaker.on('close', () => {
  logger.info('Circuit breaker CLOSED - email service recovered');
});
```

### Circuit States

```
CLOSED (Normal) → OPEN (Failing) → HALF-OPEN (Testing) → CLOSED
                                  ↓
                                OPEN (Still Failing)
```

**State Transitions:**
1. **CLOSED:** Normal operation, all requests pass through
2. **OPEN:** Too many failures detected, fast-fail all requests
3. **HALF-OPEN:** After reset timeout, allow limited requests to test recovery
4. **CLOSED:** If test requests succeed, resume normal operation

---

## Integration Examples

### TypeScript/NestJS Implementation

```typescript
// message-sender.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import CircuitBreaker from 'opossum';

@Injectable()
export class MessageSenderService {
  private readonly logger = new Logger(MessageSenderService.name);
  private readonly httpClient: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(private readonly configService: ConfigService) {
    // HTTP client setup
    this.httpClient = axios.create({
      baseURL: this.configService.get('EMAIL_SERVICE_URL'),
      timeout: this.configService.get('EMAIL_SERVICE_TIMEOUT', 10000),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Circuit breaker setup
    this.circuitBreaker = new CircuitBreaker(
      this.sendEmailRequest.bind(this),
      {
        timeout: 10000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        volumeThreshold: 10
      }
    );

    this.setupCircuitBreakerEvents();
  }

  async sendBirthdayMessage(user: User): Promise<MessageResult> {
    const message = `Hey, ${user.firstName} ${user.lastName} it's your birthday`;

    try {
      const response = await this.circuitBreaker.fire(user.email, message);

      this.logger.log(`Birthday message sent to ${user.email}`);

      return {
        success: true,
        apiResponseCode: response.status,
        apiResponseBody: response.data
      };
    } catch (error) {
      this.logger.error(
        `Failed to send birthday message to ${user.email}: ${error.message}`
      );

      return {
        success: false,
        apiResponseCode: error.response?.status,
        errorMessage: error.message
      };
    }
  }

  private async sendEmailRequest(
    email: string,
    message: string
  ): Promise<any> {
    return await this.httpClient.post('', { email, message });
  }

  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker OPEN - email service degraded');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Circuit breaker HALF-OPEN - testing recovery');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Circuit breaker CLOSED - service recovered');
    });

    this.circuitBreaker.on('fallback', () => {
      this.logger.warn('Circuit breaker fallback triggered');
    });
  }
}
```

### Node.js Native Implementation

```javascript
const axios = require('axios');

async function sendEmail(email, message) {
  const maxRetries = 5;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        'https://email-service.digitalenvision.com.au/send-email',
        { email, message },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      return {
        success: true,
        messageId: response.data.messageId
      };
    } catch (error) {
      lastError = error;

      // Check if retryable
      const isRetryable = !error.response ||
                         error.response.status >= 500 ||
                         error.response.status === 429;

      if (!isRetryable || attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 60000);
      console.log(`Retry attempt ${attempt} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: lastError.message
  };
}
```

### Python Implementation

```python
import requests
import time
from typing import Dict, Optional

def send_email(email: str, message: str, max_retries: int = 5) -> Dict:
    """
    Send email with exponential backoff retry strategy.

    Args:
        email: Recipient email address
        message: Email message content
        max_retries: Maximum number of retry attempts

    Returns:
        Dictionary with success status and response data
    """
    url = "https://email-service.digitalenvision.com.au/send-email"
    headers = {"Content-Type": "application/json"}
    payload = {"email": email, "message": message}

    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=10
            )
            response.raise_for_status()

            return {
                "success": True,
                "message_id": response.json().get("messageId")
            }

        except requests.exceptions.RequestException as error:
            is_retryable = (
                not hasattr(error, 'response') or
                error.response.status_code >= 500 or
                error.response.status_code == 429
            )

            if not is_retryable or attempt == max_retries:
                return {
                    "success": False,
                    "error": str(error)
                }

            # Exponential backoff
            delay = min(2 ** (attempt - 1) * 2, 60)
            print(f"Retry attempt {attempt} after {delay}s")
            time.sleep(delay)

    return {"success": False, "error": "Max retries exceeded"}
```

---

## Monitoring & Observability

### Key Metrics to Track

```typescript
interface EmailServiceMetrics {
  // Success metrics
  totalSent: number;
  successRate: number;
  averageLatency: number;

  // Failure metrics
  totalFailed: number;
  failureRate: number;
  retryCount: number;

  // Circuit breaker
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  circuitBreakerOpenCount: number;

  // Rate limiting
  rateLimitHits: number;
  throttledRequests: number;
}
```

### Logging Strategy

**Successful Sends:**
```typescript
logger.log({
  event: 'email_sent',
  email: user.email,
  messageId: response.messageId,
  latency: responseTime,
  attempt: attemptNumber
});
```

**Failed Sends:**
```typescript
logger.error({
  event: 'email_failed',
  email: user.email,
  error: error.message,
  statusCode: error.response?.status,
  attempt: attemptNumber,
  willRetry: shouldRetry
});
```

**Circuit Breaker Events:**
```typescript
logger.warn({
  event: 'circuit_breaker_open',
  threshold: errorThresholdPercentage,
  failures: failureCount,
  volume: requestVolume
});
```

### Health Check Integration

```typescript
async checkEmailServiceHealth(): Promise<HealthStatus> {
  try {
    const startTime = Date.now();

    // Test endpoint with timeout
    await axios.get(
      'https://email-service.digitalenvision.com.au/api-docs/',
      { timeout: 5000 }
    );

    const responseTime = Date.now() - startTime;

    return {
      status: 'up',
      responseTime
    };
  } catch (error) {
    return {
      status: 'down',
      error: error.message
    };
  }
}
```

---

## Testing Strategies

### 1. Unit Tests

```typescript
// message-sender.service.spec.ts
describe('MessageSenderService', () => {
  let service: MessageSenderService;
  let httpMock: MockAdapter;

  beforeEach(() => {
    httpMock = new MockAdapter(axios);
  });

  afterEach(() => {
    httpMock.reset();
  });

  it('should send email successfully', async () => {
    httpMock
      .onPost('/send-email')
      .reply(200, { success: true, messageId: 'msg-123' });

    const result = await service.sendBirthdayMessage(mockUser);

    expect(result.success).toBe(true);
    expect(result.apiResponseCode).toBe(200);
  });

  it('should retry on 500 error', async () => {
    httpMock
      .onPost('/send-email')
      .replyOnce(500)
      .onPost('/send-email')
      .reply(200, { success: true, messageId: 'msg-123' });

    const result = await service.sendBirthdayMessage(mockUser);

    expect(result.success).toBe(true);
    expect(httpMock.history.post.length).toBe(2);
  });

  it('should fail after max retries', async () => {
    httpMock
      .onPost('/send-email')
      .reply(500);

    const result = await service.sendBirthdayMessage(mockUser);

    expect(result.success).toBe(false);
    expect(httpMock.history.post.length).toBe(6); // 1 + 5 retries
  });
});
```

### 2. Integration Tests

```typescript
// Use MSW (Mock Service Worker) for realistic mocking
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.post(
    'https://email-service.digitalenvision.com.au/send-email',
    (req, res, ctx) => {
      // Simulate 10% failure rate
      if (Math.random() < 0.1) {
        return res(
          ctx.status(500),
          ctx.json({ error: 'Internal Server Error' })
        );
      }

      // Simulate latency
      const delay = Math.random() * 150 + 50;

      return res(
        ctx.delay(delay),
        ctx.status(200),
        ctx.json({ success: true, messageId: `msg-${Date.now()}` })
      );
    }
  )
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 3. Load Testing

```yaml
# artillery-email-service.yml
config:
  target: 'https://email-service.digitalenvision.com.au'
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 300
      arrivalRate: 20
      name: "Sustained load"
    - duration: 60
      arrivalRate: 50
      name: "Spike test"

scenarios:
  - name: "Send emails"
    flow:
      - post:
          url: "/send-email"
          json:
            email: "test{{ $randomNumber() }}@example.com"
            message: "Test message {{ $randomString() }}"
```

---

## Production Considerations

### 1. Configuration

```bash
# .env.production
EMAIL_SERVICE_URL=https://email-service.digitalenvision.com.au/send-email
EMAIL_SERVICE_TIMEOUT=10000

# Circuit breaker
CIRCUIT_BREAKER_TIMEOUT=10000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000
CIRCUIT_BREAKER_VOLUME_THRESHOLD=10

# Queue rate limiting
QUEUE_CONCURRENCY=5
QUEUE_RATE_LIMIT_MAX=50
QUEUE_RATE_LIMIT_DURATION=1000
```

### 2. Monitoring & Alerts

**Recommended Alerts:**

```yaml
alerts:
  - name: high_email_failure_rate
    condition: failure_rate > 20%
    duration: 5m
    severity: warning

  - name: circuit_breaker_open
    condition: circuit_state == "OPEN"
    duration: 1m
    severity: critical

  - name: slow_email_service
    condition: p95_latency > 5000ms
    duration: 10m
    severity: warning

  - name: email_service_down
    condition: health_status == "down"
    duration: 2m
    severity: critical
```

### 3. Graceful Degradation

```typescript
// Fallback strategy when email service is unavailable
async sendWithFallback(user: User): Promise<MessageResult> {
  try {
    return await this.sendBirthdayMessage(user);
  } catch (error) {
    // Log to dead letter queue for manual processing
    await this.deadLetterQueue.add({
      userId: user.id,
      email: user.email,
      message: generateBirthdayMessage(user),
      failedAt: new Date(),
      reason: error.message
    });

    // Alert operations team
    await this.alertService.notify({
      severity: 'high',
      message: `Email service unavailable. ${this.deadLetterQueue.count()} messages queued.`
    });

    return {
      success: false,
      errorMessage: 'Queued for retry'
    };
  }
}
```

### 4. Security Considerations

```typescript
// Sanitize email addresses
function sanitizeEmail(email: string): string {
  // Remove potential injection attempts
  return email
    .trim()
    .toLowerCase()
    .replace(/[^\w\s@.-]/g, '');
}

// Sanitize message content
function sanitizeMessage(message: string): string {
  // Remove HTML, scripts, etc.
  return message
    .trim()
    .replace(/<[^>]*>/g, '')
    .substring(0, 10000);
}
```

### 5. Cost Optimization

```typescript
// Deduplicate messages sent within 24 hours
async shouldSendMessage(
  userId: string,
  messageType: string
): Promise<boolean> {
  const key = `${userId}:${messageType}:${getDateString()}`;

  const exists = await this.messageLogRepository.findOne({
    where: {
      idempotencyKey: key,
      status: In(['SENT', 'SENDING'])
    }
  });

  return !exists;
}
```

---

## Summary

### Integration Checklist

- [ ] Configure base URL and timeout settings
- [ ] Implement exponential backoff retry logic (max 5 retries)
- [ ] Set up circuit breaker with opossum (50% threshold, 30s reset)
- [ ] Add comprehensive error handling for all HTTP status codes
- [ ] Implement rate limiting in queue (50 req/sec)
- [ ] Set up logging for success/failure/retry events
- [ ] Configure health checks for email service monitoring
- [ ] Create unit tests with mocked responses
- [ ] Create integration tests with MSW
- [ ] Set up production alerts and monitoring
- [ ] Implement dead letter queue for failed messages
- [ ] Document runbooks for common failure scenarios

### Quick Reference

| Configuration | Value |
|---------------|-------|
| Base URL | `https://email-service.digitalenvision.com.au/send-email` |
| Timeout | 10 seconds |
| Max Retries | 5 |
| Initial Delay | 2 seconds |
| Backoff Type | Exponential |
| Circuit Breaker Threshold | 50% |
| Circuit Breaker Reset | 30 seconds |
| Expected Failure Rate | ~10% |
| Average Latency | 50-200ms |

---

**For questions or issues, contact:**
- **Technical Support:** Digital Envision (https://email-service.digitalenvision.com.au)
- **Internal Team:** Backend Engineering Team

**Last Reviewed:** 2025-12-30
