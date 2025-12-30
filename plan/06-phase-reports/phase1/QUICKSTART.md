# Quick Start Guide - Phase 1 Foundation

## Prerequisites

- Node.js 20+ installed
- npm 10+ installed
- Git installed

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env (set your configuration)
# Note: You'll need PostgreSQL and RabbitMQ for Phase 2+
```

## Development

```bash
# Start development server with hot reload
npm run dev

# Server will start on http://localhost:3000
```

## Test the Server

```bash
# In a new terminal, test the health endpoint
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2025-12-30T...",
#   "uptime": 5.123,
#   "version": "1.0.0",
#   "services": {
#     "database": "healthy",
#     "rabbitmq": "healthy"
#   }
# }
```

## View API Documentation

Open your browser to:
- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs/json

## Available Endpoints (Phase 1)

- `GET /health` - Application health status
- `GET /ready` - Readiness probe
- `GET /live` - Liveness probe

## Run Tests

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode (auto-run on changes)
npm run test:watch
```

## Code Quality

```bash
# Type check
npm run typecheck

# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Build for Production

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

## Git Workflow

The project has pre-configured git hooks:

- **Pre-commit**: Auto-formats and lints staged files
- **Pre-push**: Runs type checking and unit tests

```bash
# Make changes
git add .
git commit -m "your message"  # Triggers lint + format

# Push changes
git push  # Triggers typecheck + tests
```

## Project Structure

```
src/
├── app.ts                  # Fastify application setup
├── index.ts                # Entry point
├── config/                 # Configuration
│   ├── environment.ts      # Environment variables
│   └── logger.ts           # Logging setup
├── controllers/            # Request handlers
│   └── health.controller.ts
├── routes/                 # Route definitions
│   └── health.routes.ts
├── types/                  # TypeScript types
│   └── index.ts
└── utils/                  # Utilities
    ├── errors.ts           # Error classes
    └── response.ts         # Response helpers

tests/
├── setup.ts                # Test configuration
├── helpers/                # Test utilities
│   └── test-server.ts
└── unit/                   # Unit tests
    └── controllers/
        └── health.controller.test.ts
```

## Environment Variables

Key variables (see `.env.example` for full list):

```bash
# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database (for Phase 2)
DATABASE_URL=postgresql://...

# RabbitMQ (for Phase 2)
RABBITMQ_URL=amqp://...

# External API (for Phase 3)
EMAIL_SERVICE_URL=https://...
```

## Next Steps

Phase 1 (Foundation) is complete. Next phases:

1. **Phase 2**: Database setup & User APIs
   - PostgreSQL + Drizzle ORM
   - User entity and repository
   - POST/DELETE /user endpoints

2. **Phase 3**: Scheduler Infrastructure
   - RabbitMQ setup
   - Timezone conversion
   - CRON jobs

3. **Phase 4**: Message Delivery
   - External API integration
   - Retry logic
   - Circuit breaker

## Troubleshooting

### Port already in use
```bash
# Change PORT in .env file
PORT=3001
```

### Type errors
```bash
# Rebuild types
npm run typecheck
```

### Tests failing
```bash
# Clear cache
rm -rf coverage/
npm run test:unit
```

## Documentation

- **Master Plan**: `plan/05-implementation/master-plan.md`
- **Architecture**: `plan/02-architecture/`
- **Testing Strategy**: `plan/04-testing/testing-strategy.md`
- **Phase 1 Details**: `PHASE1_IMPLEMENTATION.md`

## Support

All documentation is in the `plan/` directory. Start with:
- `plan/README.md` - Overview
- `plan/05-implementation/master-plan.md` - Implementation roadmap

---

**Ready to code! Start with Phase 2 implementation.**
