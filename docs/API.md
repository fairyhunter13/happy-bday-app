# Birthday Message Scheduler API Documentation

**Version:** 1.0.0
**OpenAPI:** 3.1.0
**License:** MIT

## Overview

The Birthday Message Scheduler API is a timezone-aware service for scheduling and sending birthday and anniversary messages. It provides exactly-once delivery guarantees and supports multiple timezones using IANA timezone identifiers.

## Base URLs

- **Development:** `http://localhost:3000`
- **Staging:** `https://api-staging.example.com`
- **Production:** `https://api.example.com`

## Interactive Documentation

- **Swagger UI:** `http://localhost:3000/docs`
- **OpenAPI Spec (JSON):** `http://localhost:3000/docs/json`

## Features

- **Timezone-aware scheduling** - Messages are scheduled based on user's local timezone
- **Exactly-once delivery** - Idempotent message handling prevents duplicate sends
- **Soft delete support** - Users can be deleted without losing historical data
- **Comprehensive health checks** - Kubernetes-ready liveness and readiness probes
- **Prometheus metrics** - Production-ready observability
- **Rate limiting** - Configurable limits per endpoint

## Authentication

**Current Status:** All endpoints are currently public (no authentication required)

**Coming Soon:** API key and OAuth 2.0 authentication

## Rate Limits

Different rate limits apply to different endpoint categories:

| Endpoint Category | Rate Limit | Scope |
|------------------|------------|-------|
| User Create (POST) | 10 requests/minute | Per IP |
| User Update (PUT) | 20 requests/minute | Per IP |
| User Read (GET) | 100 requests/minute | Per IP |
| User Delete (DELETE) | 10 requests/minute | Per IP |
| Health Checks | Unlimited | - |
| Metrics | Unlimited | - |

### Rate Limit Headers

All rate-limited endpoints return the following headers:

- `X-RateLimit-Limit` - Maximum requests allowed in the time window
- `X-RateLimit-Remaining` - Requests remaining in current window
- `X-RateLimit-Reset` - Unix timestamp when the limit resets
- `Retry-After` - Seconds until rate limit resets (only on 429 responses)

## Error Handling

All errors follow [RFC 9457 Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) standard.

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context about the error"
    }
  },
  "timestamp": "2025-12-30T10:30:00.000Z",
  "path": "/api/v1/users"
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|-----------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request data |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `EMAIL_ALREADY_EXISTS` | Email address is already in use |
| 429 | `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

## API Endpoints

### User Management

#### Create User

**POST** `/api/v1/users`

Create a new user with birthday and anniversary tracking.

**Request Body:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "timezone": "America/New_York",
  "birthdayDate": "1990-01-15",
  "anniversaryDate": "2015-06-20",
  "locationCity": "New York",
  "locationCountry": "United States"
}
```

**Required Fields:**
- `firstName` - User's first name (1-100 characters)
- `lastName` - User's last name (1-100 characters)
- `email` - Valid email address (must be unique)
- `timezone` - IANA timezone identifier (e.g., "America/New_York")

**Optional Fields:**
- `birthdayDate` - Birthday in YYYY-MM-DD format
- `anniversaryDate` - Anniversary in YYYY-MM-DD format
- `locationCity` - City name (max 100 characters)
- `locationCountry` - Country name (max 100 characters)

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "timezone": "America/New_York",
    "birthdayDate": "1990-01-15",
    "anniversaryDate": "2015-06-20",
    "locationCity": "New York",
    "locationCountry": "United States",
    "createdAt": "2025-12-30T10:00:00.000Z",
    "updatedAt": "2025-12-30T10:00:00.000Z",
    "deletedAt": null
  },
  "timestamp": "2025-12-30T10:00:00.000Z"
}
```

**Errors:**
- `400` - Validation error (invalid email, timezone, or date format)
- `409` - Email already exists
- `429` - Rate limit exceeded (max 10 requests/minute)

---

#### Get User by ID

**GET** `/api/v1/users/:id`

Retrieve user information by UUID.

**URL Parameters:**
- `id` - User UUID (e.g., "550e8400-e29b-41d4-a716-446655440000")

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "timezone": "America/New_York",
    "birthdayDate": "1990-01-15",
    "anniversaryDate": "2015-06-20",
    "locationCity": "New York",
    "locationCountry": "United States",
    "createdAt": "2025-12-30T10:00:00.000Z",
    "updatedAt": "2025-12-30T10:00:00.000Z",
    "deletedAt": null
  },
  "timestamp": "2025-12-30T10:00:00.000Z"
}
```

**Errors:**
- `404` - User not found or deleted
- `429` - Rate limit exceeded (max 100 requests/minute)

---

#### Update User

**PUT** `/api/v1/users/:id`

Update user information. Supports partial updates (send only fields to change).

**URL Parameters:**
- `id` - User UUID

**Request Body (all fields optional):**

```json
{
  "email": "newemail@example.com",
  "timezone": "America/Los_Angeles",
  "locationCity": "San Francisco"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "John",
    "lastName": "Doe",
    "email": "newemail@example.com",
    "timezone": "America/Los_Angeles",
    "birthdayDate": "1990-01-15",
    "anniversaryDate": "2015-06-20",
    "locationCity": "San Francisco",
    "locationCountry": "United States",
    "createdAt": "2025-12-30T10:00:00.000Z",
    "updatedAt": "2025-12-30T10:30:00.000Z",
    "deletedAt": null
  },
  "timestamp": "2025-12-30T10:30:00.000Z"
}
```

**Errors:**
- `400` - Validation error
- `404` - User not found
- `409` - Email already exists
- `429` - Rate limit exceeded (max 20 requests/minute)

**Note:** Setting optional fields to `null` will remove them.

---

#### Delete User

**DELETE** `/api/v1/users/:id`

Soft delete a user. The user is marked as deleted but data is retained for audit purposes.

**URL Parameters:**
- `id` - User UUID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "User deleted successfully"
  },
  "timestamp": "2025-12-30T10:30:00.000Z"
}
```

**Errors:**
- `404` - User not found
- `429` - Rate limit exceeded (max 10 requests/minute)

**Note:** Email addresses can be reused after deletion.

---

### Health Checks

#### Application Health

**GET** `/health`

Comprehensive health check for monitoring application and dependencies.

**Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2025-12-30T10:30:00.000Z",
  "uptime": 3600.5,
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "rabbitmq": "healthy"
  }
}
```

**Status Values:**
- `ok` - All services operational
- `degraded` - Some services have issues
- `error` - Critical services are down

---

#### Liveness Probe

**GET** `/live`

Kubernetes liveness probe. Always returns 200 if server is running.

**Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2025-12-30T10:30:00.000Z"
}
```

**Kubernetes Configuration:**

```yaml
livenessProbe:
  httpGet:
    path: /live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
```

---

#### Readiness Probe

**GET** `/ready`

Kubernetes readiness probe. Returns 200 if ready to accept traffic.

**Response (200 OK):**

```json
{
  "status": "ready",
  "timestamp": "2025-12-30T10:30:00.000Z"
}
```

**Response (503 Service Unavailable):**

```json
{
  "status": "not_ready",
  "timestamp": "2025-12-30T10:30:00.000Z"
}
```

**Kubernetes Configuration:**

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 5
```

---

#### Scheduler Health

**GET** `/health/schedulers`

Detailed health information for background schedulers.

**Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2025-12-30T10:30:00.000Z",
  "uptime": 3600.5,
  "startTime": "2025-12-30T09:30:00.000Z",
  "schedulers": [
    {
      "name": "daily-birthday-scheduler",
      "healthy": true,
      "status": {
        "lastRun": "2025-12-30T10:00:00.000Z",
        "nextRun": "2025-12-31T10:00:00.000Z",
        "runCount": 100,
        "errorCount": 0
      }
    }
  ],
  "statistics": {
    "totalSchedulers": 4,
    "healthySchedulers": 4,
    "unhealthySchedulers": 0
  }
}
```

---

### Metrics

#### Prometheus Metrics

**GET** `/metrics`

Prometheus metrics endpoint in exposition format.

**Response (200 OK):**

```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/v1/users",status="200"} 1234

# HELP messages_sent_total Total messages sent
# TYPE messages_sent_total counter
messages_sent_total{type="birthday"} 1000
messages_sent_total{type="anniversary"} 500
```

**Content-Type:** `text/plain; version=0.0.4`

**Prometheus Configuration:**

```yaml
scrape_configs:
  - job_name: 'birthday-scheduler'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

---

#### Metrics Summary

**GET** `/metrics/summary`

Metrics in JSON format for debugging and dashboards.

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "http": {
      "totalRequests": 10000,
      "requestsByMethod": {
        "GET": 7000,
        "POST": 2000,
        "PUT": 800,
        "DELETE": 200
      },
      "averageResponseTime": 25.5
    },
    "messages": {
      "totalSent": 1500,
      "sentByType": {
        "birthday": 1000,
        "anniversary": 500
      },
      "failed": 50
    }
  },
  "timestamp": "2025-12-30T10:30:00.000Z"
}
```

---

## Message Scheduling

### How It Works

1. **User Creation:** When a user is created with a birthday or anniversary date, the system schedules messages
2. **Daily Check:** At 10:00 AM UTC daily, the system checks for upcoming birthdays/anniversaries
3. **Timezone Conversion:** Messages are scheduled for 9:00 AM in the user's local timezone
4. **Message Queue:** Messages are queued in RabbitMQ for reliable delivery
5. **External API:** Messages are sent via the vendor email service API

### Idempotency

All message sends use an idempotency key to prevent duplicate deliveries:
- Format: `{messageType}-{userId}-{date}`
- Example: `birthday-550e8400-e29b-41d4-a716-446655440000-2025-01-15`

### Retry Logic

Failed message deliveries are automatically retried:
- Maximum retries: 3
- Retry delay: Exponential backoff (1min, 5min, 15min)
- Recovery scheduler: Runs every hour to retry failed messages

---

## External Dependencies

### Vendor Email Service

The application integrates with an external email service for message delivery.

**Documentation:** [Email Service Integration](./vendor-specs/EMAIL_SERVICE_INTEGRATION.md)

**Key Features:**
- RESTful API
- Idempotency support
- Rate limiting: 100 requests/second
- Retry recommendations: Exponential backoff

---

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# View API documentation
open http://localhost:3000/docs
```

### Validating OpenAPI Spec

```bash
# Validate with Redocly
npm run openapi:validate

# Lint with Spectral
npm run openapi:lint

# Export spec to JSON
npm run openapi:export

# Run all validations
npm run openapi:all
```

### Testing

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

---

## Support

- **GitHub Issues:** https://github.com/fairyhunter13/happy-bday-app/issues
- **Email:** support@birthday-scheduler.example.com
- **Documentation:** https://github.com/fairyhunter13/happy-bday-app

---

## License

This project is licensed under the MIT License.
