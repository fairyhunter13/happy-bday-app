# OpenAPI 3.1 Implementation Guide

## Overview

This project implements comprehensive OpenAPI 3.1 documentation for all API endpoints with:

- **OpenAPI 3.1.0 specification** - Latest version with enhanced features
- **RFC 9457 compliant error responses** - Standardized problem details
- **Comprehensive examples** - Request/response examples for all endpoints
- **Reusable components** - Organized schema structure
- **CI/CD validation** - Automated linting and validation
- **Enhanced Swagger UI** - Custom styling and better UX

## Quick Start

### View Documentation

```bash
# Start the server
npm run dev

# Open Swagger UI
open http://localhost:3000/docs
```

### Validate OpenAPI Spec

```bash
# Validate with Redocly
npm run openapi:validate

# Lint with Spectral
npm run openapi:lint

# Export to JSON
npm run openapi:export

# Run all checks
npm run openapi:all
```

## Implementation Structure

### Schema Organization

All OpenAPI schemas are organized in `src/schemas/`:

```
src/schemas/
├── index.ts              # Central export point
├── common.schemas.ts     # Reusable components (UUID, Date, Timezone, etc.)
├── error.schemas.ts      # RFC 9457 error responses
├── user.schemas.ts       # User endpoint schemas with examples
├── health.schemas.ts     # Health check schemas
└── metrics.schemas.ts    # Metrics endpoint schemas
```

### Benefits of This Structure

1. **Reusability** - Common schemas defined once, used everywhere
2. **Maintainability** - Changes in one place propagate automatically
3. **Type Safety** - TypeScript types inferred from schemas
4. **Validation** - Consistent validation across all endpoints
5. **Documentation** - Comprehensive examples and descriptions

## OpenAPI 3.1 Features

### Enhanced Type Support

OpenAPI 3.1 aligns with JSON Schema 2020-12:

```typescript
// Nullable fields (OpenAPI 3.1 syntax)
{
  type: 'string',
  nullable: true,  // Native JSON Schema nullable
  example: null
}

// Multiple examples
{
  type: 'string',
  examples: [
    'America/New_York',
    'Europe/London',
    'Asia/Tokyo'
  ]
}
```

### Rich Descriptions

All endpoints include markdown-formatted descriptions:

```typescript
{
  description: `Create a new user with birthday tracking.

**Features:**
- Email must be unique
- Timezone-aware scheduling
- Soft delete support

**Rate Limit:** 10 requests/minute`
}
```

## Error Documentation (RFC 9457)

All error responses follow [RFC 9457 Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "fields": {
        "email": "Invalid email format"
      }
    }
  },
  "timestamp": "2025-12-30T10:30:00.000Z",
  "path": "/api/v1/users"
}
```

### Standard Error Codes

| HTTP Status | Error Code | Usage |
|-------------|-----------|-------|
| 400 | `VALIDATION_ERROR` | Invalid input data |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 409 | `EMAIL_ALREADY_EXISTS` | Duplicate email |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_SERVER_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Service down |

## Comprehensive Examples

Every endpoint includes multiple examples:

### User Creation Examples

```typescript
examples: [
  {
    summary: 'Minimal user (required fields only)',
    value: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      timezone: 'America/New_York'
    }
  },
  {
    summary: 'User with birthday',
    value: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      timezone: 'Europe/London',
      birthdayDate: '1985-03-22'
    }
  },
  {
    summary: 'Complete user profile',
    value: {
      // ... all fields
    }
  }
]
```

## CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/openapi-validation.yml` workflow:

1. **Starts test environment** - PostgreSQL + RabbitMQ
2. **Builds application** - Compiles TypeScript
3. **Validates with Redocly** - Checks OpenAPI compliance
4. **Lints with Spectral** - Enforces best practices
5. **Exports specification** - Saves to artifacts
6. **Security scanning** - OWASP ZAP API scan
7. **Comments on PRs** - Validation results

### Triggering Validation

Validation runs automatically on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Changes to schema files or routes

### Local Pre-commit Validation

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Start server in background
npm start &
SERVER_PID=$!

# Wait for server to be ready
sleep 5

# Validate OpenAPI
npm run openapi:validate
VALIDATION_EXIT=$?

# Kill server
kill $SERVER_PID

exit $VALIDATION_EXIT
```

## Spectral Linting Rules

The `.spectral.yml` configuration enforces:

### Required Elements
- ✅ Operation IDs for all endpoints
- ✅ Descriptions for all operations
- ✅ Summaries for all operations
- ✅ Tags for all operations
- ✅ Contact information in API info
- ✅ License information
- ✅ Success responses (200/201)

### Best Practices
- ⚠️ Examples in responses
- ⚠️ Examples in request bodies
- ⚠️ Schema descriptions
- ⚠️ Line length limits (200 chars)

### Error Prevention
- ❌ Duplicate operation IDs
- ❌ Invalid HTTP methods
- ❌ Missing error responses

## Swagger UI Customization

### Custom CSS

The `/public/swagger-ui-custom.css` provides:

- **Modern color scheme** - Primary brand colors
- **Dark mode support** - Respects system preferences
- **Enhanced readability** - Better typography and spacing
- **Improved UX** - Better buttons, hover states, and transitions
- **Responsive design** - Mobile-friendly layouts

### Features

```css
/* Custom branding */
.swagger-ui .topbar {
  background-color: var(--primary-color);
}

/* Better operation blocks */
.swagger-ui .opblock {
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Enhanced code blocks */
.swagger-ui .highlight-code {
  border-radius: 6px;
  background: var(--code-background);
}
```

## NPM Scripts

### Validation Scripts

```bash
# Validate OpenAPI spec with Redocly
npm run openapi:validate

# Lint with Spectral rules
npm run openapi:lint

# Export spec to docs/openapi.json
npm run openapi:export

# Bundle spec into single file
npm run openapi:bundle

# Preview documentation
npm run openapi:preview

# Run all validations
npm run openapi:all
```

## Exporting OpenAPI Spec

### Manual Export

```bash
# Start server
npm run dev

# Export spec (in another terminal)
npm run openapi:export

# Result: docs/openapi.json
```

### Programmatic Export

```typescript
import { app } from './app.js';

const server = await app.listen({ port: 3000 });

// Get OpenAPI JSON
const spec = await fetch('http://localhost:3000/docs/json');
const openapi = await spec.json();

// Save to file
await fs.writeFile('openapi.json', JSON.stringify(openapi, null, 2));
```

## Best Practices

### 1. Comprehensive Descriptions

Every schema field should have a description:

```typescript
{
  timezone: {
    type: 'string',
    description: "User's IANA timezone for scheduling messages at 9 AM local time",
    example: 'America/New_York'
  }
}
```

### 2. Multiple Examples

Provide examples for different scenarios:

```typescript
examples: [
  { summary: 'Minimal', value: { /* ... */ } },
  { summary: 'Complete', value: { /* ... */ } },
  { summary: 'Edge case', value: { /* ... */ } }
]
```

### 3. Error Documentation

Document all possible error responses:

```typescript
response: {
  200: { /* success */ },
  400: { /* validation */ },
  404: { /* not found */ },
  409: { /* conflict */ },
  429: { /* rate limit */ },
  500: { /* server error */ }
}
```

### 4. Operation IDs

Use consistent, descriptive operation IDs:

```typescript
{
  operationId: 'createUser',  // ✅ Good
  operationId: 'post_user',   // ❌ Avoid
}
```

### 5. Reusable Components

Extract common schemas to avoid duplication:

```typescript
// common.schemas.ts
export const EmailSchema = {
  type: 'string',
  format: 'email',
  maxLength: 255
};

// user.schemas.ts
import { EmailSchema } from './common.schemas.js';

email: EmailSchema  // Reuse
```

## Troubleshooting

### Validation Errors

**Problem:** Spectral reports missing descriptions

```bash
✖ operation-description  Operation must have a description
```

**Solution:** Add description to route schema:

```typescript
{
  description: 'Create a new user with birthday tracking',
  // ...
}
```

---

**Problem:** Redocly reports invalid schema

```bash
✖ Schema is not valid OpenAPI 3.1
```

**Solution:** Check OpenAPI version in app.ts:

```typescript
openapi: '3.1.0',  // Must be exactly this
```

### Server Issues

**Problem:** Can't connect to localhost:3000

**Solution:** Ensure server is running:

```bash
# Check if server is running
lsof -i :3000

# Start server if not running
npm run dev
```

### Export Issues

**Problem:** openapi.json is empty or malformed

**Solution:** Check server health and retry:

```bash
# Verify server is healthy
curl http://localhost:3000/health

# Retry export
npm run openapi:export
```

## Migration from 3.0 to 3.1

### Key Changes

1. **OpenAPI version**
   ```typescript
   // Before (3.0)
   openapi: {
     openapi: '3.0.0'  // or omitted
   }

   // After (3.1)
   openapi: {
     openapi: '3.1.0'
   }
   ```

2. **Nullable fields**
   ```typescript
   // Before (3.0)
   {
     type: 'string',
     nullable: true
   }

   // After (3.1) - same syntax, but native JSON Schema
   {
     type: 'string',
     nullable: true
   }
   ```

3. **Multiple examples**
   ```typescript
   // Before (3.0)
   {
     example: 'single example'
   }

   // After (3.1)
   {
     examples: [
       'example 1',
       'example 2',
       'example 3'
     ]
   }
   ```

## Resources

### Documentation
- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Swagger UI Documentation](https://swagger.io/docs/open-source-tools/swagger-ui/)

### Tools
- [Redocly CLI](https://redocly.com/docs/cli/)
- [Spectral Linter](https://stoplight.io/open-source/spectral)
- [Swagger Editor](https://editor.swagger.io/)

### Internal Docs
- [API Reference](./API.md)
- [Email Service Integration](./vendor-specs/EMAIL_SERVICE_INTEGRATION.md)
- [Implementation Plan](../plan/05-implementation/openapi-implementation-plan.md)

## Contributing

When adding new endpoints:

1. Create schema in appropriate `src/schemas/*.ts` file
2. Add comprehensive examples
3. Document all error responses
4. Include operation ID and description
5. Run `npm run openapi:all` to validate
6. Update `docs/API.md` with usage examples

## Support

For questions or issues:
- GitHub Issues: https://github.com/fairyhunter13/happy-bday-app/issues
- API Docs: http://localhost:3000/docs
- Email: support@birthday-scheduler.example.com
