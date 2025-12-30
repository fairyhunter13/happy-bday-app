# Email Service Vendor Documentation

This directory contains comprehensive documentation for the Digital Envision Email Service API integration.

---

## 📁 Files Overview

### 1. `email-service-api.json`
**OpenAPI 3.0 Specification**

Complete API specification in OpenAPI 3.0.3 format including:
- Endpoint definitions
- Request/response schemas
- Error responses
- Code examples
- Service characteristics

**Usage:**
- Import into Postman, Insomnia, or other API clients
- Generate client SDKs
- Reference for API contracts

### 2. `EMAIL_SERVICE_INTEGRATION.md`
**Integration Guide**

Comprehensive guide for integrating with the email service:
- API endpoint documentation
- Authentication requirements
- Error handling strategies
- Retry logic implementation
- Circuit breaker pattern
- Code examples (TypeScript, Node.js, Python)
- Monitoring and observability
- Testing strategies
- Production considerations

**Target Audience:** Developers implementing the integration

### 3. `API_ANALYSIS.md`
**Technical Analysis**

In-depth analysis of the API:
- Service characteristics and limitations
- Endpoint analysis
- Performance benchmarks
- Reliability patterns
- Risk assessment
- Migration planning
- Configuration reference

**Target Audience:** Technical architects, DevOps engineers

---

## 🚀 Quick Start

### Basic Email Send

```bash
curl -X POST https://email-service.digitalenvision.com.au/send-email \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "message": "Hey, John Doe it'\''s your birthday"
  }'
```

### Response

```json
{
  "success": true,
  "messageId": "msg-1704024000000"
}
```

---

## 📊 Key Specifications

| Specification | Value |
|---------------|-------|
| **Base URL** | `https://email-service.digitalenvision.com.au` |
| **Endpoint** | `POST /send-email` |
| **Authentication** | None (currently) |
| **Timeout** | 10 seconds recommended |
| **Max Retries** | 5 |
| **Rate Limit** | ~50 requests/second (estimated) |
| **Expected Failure Rate** | ~10% |
| **Average Latency** | 50-200ms |

---

## ⚙️ Implementation Checklist

Essential patterns to implement:

- [ ] **Exponential Backoff Retry**
  - Max 5 retries
  - Initial delay: 2 seconds
  - Backoff multiplier: 2x

- [ ] **Circuit Breaker**
  - Error threshold: 50%
  - Reset timeout: 30 seconds
  - Volume threshold: 10 requests

- [ ] **Queue-Based Processing**
  - Concurrency: 5 workers
  - Rate limit: 50 req/sec
  - Dead letter queue for failures

- [ ] **Idempotency**
  - Prevent duplicate sends
  - Key format: `{userId}:{messageType}:{date}`

- [ ] **Monitoring**
  - Success/failure metrics
  - Latency tracking
  - Circuit breaker state
  - Alert on >20% failure rate

---

## 🔧 Configuration

### Environment Variables

```bash
# Email Service
EMAIL_SERVICE_URL=https://email-service.digitalenvision.com.au/send-email
EMAIL_SERVICE_TIMEOUT=10000

# Circuit Breaker
CIRCUIT_BREAKER_TIMEOUT=10000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Queue
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=5
QUEUE_BACKOFF_DELAY=2000
```

### TypeScript Example

```typescript
import axios from 'axios';
import CircuitBreaker from 'opossum';

const httpClient = axios.create({
  baseURL: process.env.EMAIL_SERVICE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

const breaker = new CircuitBreaker(sendEmailRequest, {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

async function sendBirthdayMessage(user: User) {
  const message = `Hey, ${user.firstName} ${user.lastName} it's your birthday`;
  return await breaker.fire(user.email, message);
}
```

---

## 📈 Performance Expectations

### Latency

| Percentile | Expected Time |
|------------|---------------|
| p50 | ~125ms |
| p95 | ~200ms |
| p99 | ~250ms |
| p99.9 | ~500ms |

### Throughput

- **Theoretical Maximum:** 100 requests/second
- **Recommended Limit:** 50 requests/second
- **Daily Capacity:** ~4.3 million emails

### Reliability

- **Availability:** ~99.5%
- **Failure Rate:** ~10%
- **Success Rate (with retries):** ~99.9%

---

## 🧪 Testing

### Unit Test Example

```typescript
describe('Email Service', () => {
  it('should send email successfully', async () => {
    mockAxios.onPost('/send-email').reply(200, {
      success: true,
      messageId: 'msg-123'
    });

    const result = await emailService.send('test@example.com', 'Test');
    expect(result.success).toBe(true);
  });

  it('should retry on 500 error', async () => {
    mockAxios
      .onPost('/send-email')
      .replyOnce(500)
      .onPost('/send-email')
      .reply(200, { success: true, messageId: 'msg-123' });

    const result = await emailService.send('test@example.com', 'Test');
    expect(result.success).toBe(true);
    expect(mockAxios.history.post.length).toBe(2);
  });
});
```

### Load Test

```bash
# Using Artillery
artillery run artillery-config.yml

# Expected results:
# - p95 latency: < 500ms
# - Error rate: < 12%
# - Throughput: 45-50 req/sec
```

---

## 🚨 Error Handling

### Retryable Errors

- `429 Too Many Requests` → Retry with backoff
- `500 Internal Server Error` → Retry with backoff
- `503 Service Unavailable` → Retry with backoff
- Network timeouts → Retry with backoff

### Non-Retryable Errors

- `400 Bad Request` → Log and mark as failed
- `401 Unauthorized` → Check authentication
- `403 Forbidden` → Check permissions
- `404 Not Found` → Check endpoint URL

### Error Response Format

```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred. Please retry later",
  "retryAfter": 60
}
```

---

## 📞 Support

### Vendor Information

- **Vendor:** Digital Envision
- **API URL:** https://email-service.digitalenvision.com.au
- **Documentation:** https://email-service.digitalenvision.com.au/api-docs/

### Internal Contacts

- **Technical Owner:** Backend Engineering Team
- **Escalation:** DevOps Team
- **Business Owner:** Product Team

---

## 📝 Document Status

| Document | Version | Last Updated | Next Review |
|----------|---------|--------------|-------------|
| OpenAPI Spec | 1.0 | 2025-12-30 | 2026-01-30 |
| Integration Guide | 1.0 | 2025-12-30 | 2026-01-30 |
| API Analysis | 1.0 | 2025-12-30 | 2026-01-30 |

---

## 🔄 Changelog

### 2025-12-30 - Initial Release
- Created OpenAPI 3.0 specification
- Documented integration patterns
- Analyzed service characteristics
- Defined reliability patterns
- Established monitoring strategy

---

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Opossum Circuit Breaker](https://nodeshift.dev/opossum/)
- [Axios Documentation](https://axios-http.com/)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.0.3)

---

**Last Updated:** 2025-12-30
**Maintained By:** Backend Engineering Team
