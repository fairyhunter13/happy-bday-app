# Local Development & CI/CD Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [CI/CD Testing](#cicd-testing)
5. [Docker Environments](#docker-environments)
6. [Database Migrations](#database-migrations)
7. [Troubleshooting](#troubleshooting)

---

## Overview

**IMPORTANT: This project is designed for LOCAL DEVELOPMENT and CI/CD TESTING ONLY.**

This guide covers:
- Local development setup with Docker Compose
- Running tests in CI/CD environments (GitHub Actions)
- No production deployment is included or supported

---

## Prerequisites

### Required Software

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥20.0.0 | Runtime environment |
| npm | ≥10.0.0 | Package manager |
| Docker | ≥24.0 | Container runtime |
| Docker Compose | ≥2.0 | Multi-container orchestration |
| git | Latest | Version control |

### Local Setup Checklist

- [ ] Node.js and npm installed
- [ ] Docker and Docker Compose installed
- [ ] Git repository cloned
- [ ] SOPS age key configured (for encrypted secrets)

See [`docs/DEVELOPER_SETUP.md`](./DEVELOPER_SETUP.md) for detailed setup instructions.

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/fairyhunter13/happy-bday-app.git
cd happy-bday-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Secrets

```bash
# Decrypt development secrets (requires SOPS age key)
npm run secrets:decrypt:dev

# This creates .env.development from .env.development.enc
```

**First time setup**: See [`docs/DEVELOPER_SETUP.md`](./DEVELOPER_SETUP.md) for age key configuration.

### 4. Start Local Services

```bash
# Start PostgreSQL, RabbitMQ, Redis, pgAdmin via Docker Compose
docker-compose up -d

# Verify services are healthy
docker-compose ps
```

This starts:
- **PostgreSQL** on port 5432
- **RabbitMQ** on ports 5672 (AMQP) and 15672 (Management UI)
- **Redis** on port 6379
- **pgAdmin** on port 5050 (optional database UI)

### 5. Run Database Migrations

```bash
# Apply database schema
npm run db:migrate

# Verify migrations
npm run db:status
```

### 6. Start Application

```bash
# Terminal 1: Start API server
npm run dev

# Terminal 2: Start worker
npm run worker

# Terminal 3: Start scheduler (optional)
npm run scheduler
```

### 7. Verify Setup

```bash
# Check API health
curl http://localhost:3000/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2025-12-31T...",
#   "database": "ok",
#   "queue": "ok"
# }

# Access API documentation
open http://localhost:3000/docs

# Access RabbitMQ Management UI
open http://localhost:15672
# Username: rabbitmq, Password: rabbitmq_dev_password

# Access pgAdmin (optional)
open http://localhost:5050
# Email: admin@birthday-app.local, Password: pgadmin_dev_password
```

---

## CI/CD Testing

### GitHub Actions Workflows

All testing runs automatically via GitHub Actions:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **ci.yml** | Every push/PR | Unit, integration, E2E tests |
| **code-quality.yml** | Every push/PR | Linting, type checking |
| **security.yml** | Daily, push/PR | Security scanning |
| **performance.yml** | Weekly | Load testing with k6 |
| **docker-build.yml** | Push to main | Docker image build verification |
| **docs.yml** | Push to main | GitHub Pages documentation |

### Running Tests Locally (Same as CI)

```bash
# Unit tests (fast)
npm run test:unit

# Integration tests (requires services)
docker-compose up -d
npm run test:integration

# E2E tests (full stack)
docker-compose -f docker-compose.test.yml up -d
npm run test:e2e

# Performance tests (load testing)
docker-compose -f docker-compose.perf.yml up -d
npm run test:performance

# All tests with coverage
npm run test:coverage
```

### Manual Workflow Trigger

```bash
# Trigger any workflow manually
gh workflow run ci.yml
gh workflow run performance.yml
```

---

## Docker Environments

### Environment Files

| File | Purpose | Containers | When to Use |
|------|---------|------------|-------------|
| `docker-compose.yml` | Local development | 4 | Daily development |
| `docker-compose.test.yml` | CI/CD E2E tests | 4 | CI/CD, quick testing |
| `docker-compose.perf.yml` | Performance testing | 24 | Weekly load tests |

### docker-compose.yml (Local Development)

**Services:**
- postgres (PostgreSQL 15)
- rabbitmq (RabbitMQ 3.13 with management UI)
- redis (Redis 7, optional caching)
- pgadmin (Database UI, optional)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services (keep data)
docker-compose stop

# Stop and remove containers (keep data)
docker-compose down

# Stop and remove everything (including volumes)
docker-compose down -v
```

### docker-compose.test.yml (CI/CD Testing)

Minimal environment for E2E testing in GitHub Actions:

```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run E2E tests
npm run test:e2e

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### docker-compose.perf.yml (Performance Testing)

Simulates production-scale infrastructure (24 containers):
- 5 API replicas
- 10 worker replicas
- PostgreSQL primary + replica
- RabbitMQ
- Redis
- Prometheus + Grafana
- k6 load tester

```bash
# Start performance environment
docker-compose -f docker-compose.perf.yml up -d

# Wait for services to be ready
sleep 30

# Run load tests
npm run test:performance

# View metrics
open http://localhost:3001  # Grafana
open http://localhost:9090  # Prometheus

# Cleanup
docker-compose -f docker-compose.perf.yml down -v
```

---

## Database Migrations

### Creating Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# This creates: src/db/migrations/0001_*.sql
```

### Applying Migrations

```bash
# Apply pending migrations
npm run db:migrate

# Check migration status
npm run db:status
```

### Rolling Back Migrations

```bash
# Rollback last migration
npm run db:migrate:rollback

# Or restore from backup
docker-compose exec postgres \
  psql -U postgres -d birthday_app < backups/backup_20251231.sql
```

### Backup & Restore

```bash
# Create backup
docker-compose exec postgres \
  pg_dump -U postgres birthday_app > backups/backup_$(date +%Y%m%d).sql

# Restore from backup
docker-compose exec -T postgres \
  psql -U postgres -d birthday_app < backups/backup_20251231.sql
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check Docker daemon is running
docker ps

# Check for port conflicts
lsof -i :5432  # PostgreSQL
lsof -i :5672  # RabbitMQ
lsof -i :6379  # Redis

# Remove old containers
docker-compose down -v
docker-compose up -d
```

### Database Connection Errors

```bash
# Check database is running
docker-compose ps postgres

# Check connection
docker-compose exec postgres psql -U postgres -d birthday_app -c "SELECT 1"

# Reset database (WARNING: deletes data)
docker-compose down -v
docker-compose up -d postgres
npm run db:migrate
```

### Queue Not Processing

```bash
# Check RabbitMQ is running
docker-compose ps rabbitmq

# Check queue status
docker-compose exec rabbitmq rabbitmqadmin list queues

# Check worker is running
# Should see worker logs if started with: npm run worker

# Restart RabbitMQ
docker-compose restart rabbitmq
```

### SOPS Decryption Errors

```bash
# Verify age key is set
echo $SOPS_AGE_KEY

# If missing, configure age key (see DEVELOPER_SETUP.md)
export SOPS_AGE_KEY="AGE-SECRET-KEY-..."

# Retry decryption
npm run secrets:decrypt:dev
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

### Docker Volume Issues

```bash
# List volumes
docker volume ls

# Remove all volumes (WARNING: deletes data)
docker-compose down -v

# Remove specific volume
docker volume rm happy-bday-app_postgres_data

# Recreate containers with fresh volumes
docker-compose up -d
npm run db:migrate
```

---

## Quick Commands Reference

```bash
# Development
npm install                          # Install dependencies
npm run dev                          # Start API server
npm run worker                       # Start worker
npm run scheduler                    # Start scheduler

# Database
npm run db:migrate                   # Apply migrations
npm run db:status                    # Check migration status
npm run db:generate                  # Generate new migration

# Testing
npm test                             # All tests
npm run test:unit                    # Unit tests only
npm run test:integration             # Integration tests only
npm run test:e2e                     # E2E tests
npm run test:performance             # Performance tests (k6)
npm run test:coverage                # Coverage report

# Code Quality
npm run lint                         # ESLint
npm run typecheck                    # TypeScript type checking
npm run lint:duplicates              # Check code duplication

# Docker
docker-compose up -d                 # Start local services
docker-compose ps                    # Check service status
docker-compose logs -f               # View logs
docker-compose down                  # Stop services

# CI/CD
gh workflow run ci.yml               # Trigger CI workflow
gh workflow list                     # List workflows
gh run list                          # List recent runs
```

---

## Additional Resources

- **Developer Setup:** [`docs/DEVELOPER_SETUP.md`](./DEVELOPER_SETUP.md)
- **Local Troubleshooting:** [`docs/RUNBOOK.md`](./RUNBOOK.md)
- **Architecture:** [`plan/02-architecture/architecture-overview.md`](../plan/02-architecture/architecture-overview.md)
- **Testing Strategy:** [`plan/04-testing/testing-strategy.md`](../plan/04-testing/testing-strategy.md)
- **API Documentation:** http://localhost:3000/docs (when running locally)

---

**Last Updated:** 2025-12-31
**Version:** 2.0.0 (Local + CI/CD Scope)
**Environment:** Local Development + CI/CD Testing Only
