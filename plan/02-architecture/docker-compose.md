# Docker Compose Architecture Design
**Birthday Message Scheduler - Container Orchestration Strategy**

**Agent:** Coder/Architect (Hive Mind Collective)
**Date:** December 30, 2025
**Version:** 1.0
**Phase:** Architectural Design (No Implementation)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Service Definitions](#service-definitions)
4. [Network Topology](#network-topology)
5. [Volume Management](#volume-management)
6. [Environment Configuration](#environment-configuration)
7. [Service Dependencies](#service-dependencies)
8. [Scaling Strategies](#scaling-strategies)
9. [Multi-Environment Setup](#multi-environment-setup)
10. [Performance Testing Infrastructure](#performance-testing-infrastructure)
11. [Monitoring & Observability](#monitoring--observability)
12. [CI/CD Integration](#cicd-integration)
13. [Security Considerations](#security-considerations)
14. [Deployment Workflows](#deployment-workflows)

---

## Executive Summary

This document outlines the Docker Compose architecture for the Birthday Message Scheduler backend application. The design supports:

- **Local Development:** Fast iteration with hot-reload
- **Testing:** Isolated test environments with Testcontainers integration
- **Performance Testing:** Load testing with k6 and database stress tests
- **CI/CD:** GitHub Actions integration with service containers
- **Production-Ready:** Multi-stage builds, health checks, and resource limits

### Key Design Principles

1. **Separation of Concerns:** Each service runs in isolated containers
2. **Environment Parity:** Dev, test, and production use same container definitions
3. **Resource Efficiency:** Optimized image sizes and startup times
4. **Fault Tolerance:** Health checks, restart policies, and graceful shutdowns
5. **Scalability:** Horizontal scaling support for API and worker services

---

## Architecture Overview

### High-Level Container Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Docker Compose Network                       │
│                         (birthday-net)                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼─────┐ ┌──────▼──────┐ ┌─────▼──────┐
        │   Nginx     │ │  API Server │ │   Worker   │
        │ Load Balance│ │  (Fastify)  │ │    Pool    │
        │   :80       │ │    :3000    │ │ (RabbitMQ) │
        └───────┬─────┘ └──────┬──────┘ └─────┬──────┘
                │               │               │
                └───────────────┼───────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼─────┐ ┌──────▼──────┐ ┌─────▼──────┐
        │ PostgreSQL  │ │  RabbitMQ   │ │ Prometheus │
        │   :5432     │ │ :5672/15672 │ │   :9090    │
        └─────────────┘ └─────────────┘ └────────────┘
                │               │               │
        ┌───────▼─────┐ ┌──────▼──────┐ ┌─────▼──────┐
        │  pg_data    │ │rabbitmq_data│ │ prom_data  │
        │  (volume)   │ │  (volume)   │ │  (volume)  │
        └─────────────┘ └─────────────┘ └────────────┘
```

### Container Hierarchy

**Tier 1 - Infrastructure Services** (always running)
- PostgreSQL 15 (persistent database)
- RabbitMQ 3.12+ (message queue with quorum queues)

**Tier 2 - Application Services** (horizontally scalable)
- API Server (Fastify, 3+ replicas)
- Worker Pool (RabbitMQ consumers, 5+ replicas)

**Tier 3 - Gateway Services** (routing & load balancing)
- Nginx (reverse proxy, optional in dev)

**Tier 4 - Observability Services** (optional in dev, required in prod)
- Prometheus (metrics collection)
- Grafana (metrics visualization)
- Loki (log aggregation)

---

## Service Definitions

### 1. API Service (Fastify)

**Purpose:** HTTP API endpoints (POST /user, DELETE /user, PUT /user)

**Container Specification:**
```yaml
api:
  build:
    context: .
    dockerfile: Dockerfile
    target: production
    args:
      NODE_ENV: production
  image: birthday-app:latest
  container_name: birthday-api-1
  restart: unless-stopped

  # Ports
  ports:
    - "3000:3000"

  # Environment
  environment:
    NODE_ENV: production
    PORT: 3000
    DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/birthday_app
    RABBITMQ_URL: amqp://admin:${RABBITMQ_PASSWORD}@rabbitmq:5672
    EMAIL_API_URL: https://email-service.digitalenvision.com.au/send-email
    EMAIL_API_TIMEOUT: 10000
    LOG_LEVEL: info

  # Dependencies
  depends_on:
    postgres:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy

  # Health check
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 30s

  # Resources
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
      reservations:
        cpus: '0.25'
        memory: 256M

  # Networks
  networks:
    - birthday-net
```

**Key Features:**
- Multi-stage Dockerfile for optimized image size
- Health check endpoint for container orchestration
- Resource limits prevent memory leaks from crashing host
- Graceful shutdown handling (SIGTERM)

---

### 2. Worker Service (RabbitMQ Consumer)

**Purpose:** Background message processing (birthday message sending)

**Container Specification:**
```yaml
worker:
  build:
    context: .
    dockerfile: Dockerfile
    target: production
  image: birthday-app:latest
  container_name: birthday-worker-1
  restart: unless-stopped
  command: ["npm", "run", "worker"]

  # Environment
  environment:
    NODE_ENV: production
    DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/birthday_app
    RABBITMQ_URL: amqp://admin:${RABBITMQ_PASSWORD}@rabbitmq:5672
    EMAIL_API_URL: https://email-service.digitalenvision.com.au/send-email
    WORKER_CONCURRENCY: 5
    LOG_LEVEL: info

  # Dependencies
  depends_on:
    postgres:
      condition: service_healthy
    rabbitmq:
      condition: service_healthy

  # Resources
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
      reservations:
        cpus: '0.25'
        memory: 256M
    replicas: 3

  # Networks
  networks:
    - birthday-net
```

**Scaling Strategy:**
```bash
# Scale workers dynamically based on queue depth
docker-compose up --scale worker=5
```

---

### 3. PostgreSQL Service

**Purpose:** Primary database (users, message_logs)

**Container Specification:**
```yaml
postgres:
  image: postgres:15-alpine
  container_name: birthday-postgres
  restart: unless-stopped

  # Environment
  environment:
    POSTGRES_DB: birthday_app
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --locale=en_US.UTF-8"
    PGDATA: /var/lib/postgresql/data/pgdata

  # Ports (expose only in dev)
  ports:
    - "5432:5432"

  # Volumes
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./migrations:/docker-entrypoint-initdb.d:ro

  # Health check
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5

  # Resources
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M

  # Networks
  networks:
    - birthday-net
```

**Performance Tuning (postgresql.conf):**
```conf
# Optimized for 1GB RAM container
shared_buffers = 256MB
effective_cache_size = 768MB
work_mem = 16MB
maintenance_work_mem = 64MB
max_connections = 100
```

---

### 4. RabbitMQ Service

**Purpose:** Message queue with Quorum Queues for zero data loss

**Container Specification:**
```yaml
rabbitmq:
  image: rabbitmq:3.12-management-alpine
  container_name: birthday-rabbitmq
  restart: unless-stopped
  environment:
    RABBITMQ_DEFAULT_USER: admin
    RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS: '-rabbit quorum_queue_max_memory_bytes 536870912'

  # Ports
  ports:
    - "5672:5672"   # AMQP
    - "15672:15672" # Management UI
    - "15692:15692" # Prometheus metrics

  # Volumes
  volumes:
    - rabbitmq_data:/var/lib/rabbitmq

  # Health check
  healthcheck:
    test: ["CMD", "rabbitmq-diagnostics", "ping"]
    interval: 10s
    timeout: 3s
    retries: 3

  # Resources
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 512M
      reservations:
        cpus: '0.25'
        memory: 128M

  # Networks
  networks:
    - birthday-net
```

**Redis Configuration:**
- **Persistence:** AOF (append-only file) for job durability
- **Eviction Policy:** `allkeys-lru` (least recently used)
- **Max Memory:** 256MB (suitable for 10,000+ jobs)

---

### 5. Nginx (Optional - Load Balancer)

**Purpose:** Reverse proxy, load balancing, SSL termination

**Container Specification:**
```yaml
nginx:
  image: nginx:alpine
  container_name: birthday-nginx
  restart: unless-stopped

  # Ports
  ports:
    - "80:80"
    - "443:443"

  # Volumes
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/ssl:/etc/nginx/ssl:ro

  # Dependencies
  depends_on:
    - api

  # Health check
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost/health"]
    interval: 10s
    timeout: 3s
    retries: 3

  # Networks
  networks:
    - birthday-net
```

**Nginx Configuration (nginx.conf):**
```nginx
upstream api_backend {
    least_conn;
    server api-1:3000 max_fails=3 fail_timeout=30s;
    server api-2:3000 max_fails=3 fail_timeout=30s;
    server api-3:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;
    }

    location /health {
        access_log off;
        proxy_pass http://api_backend;
    }
}
```

---

### 6. Prometheus (Monitoring)

**Purpose:** Metrics collection and alerting

**Container Specification:**
```yaml
prometheus:
  image: prom/prometheus:latest
  container_name: birthday-prometheus
  restart: unless-stopped

  # Ports
  ports:
    - "9090:9090"

  # Volumes
  volumes:
    - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - prometheus_data:/prometheus

  # Command
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'
    - '--web.console.libraries=/usr/share/prometheus/console_libraries'
    - '--web.console.templates=/usr/share/prometheus/consoles'

  # Networks
  networks:
    - birthday-net
```

**Prometheus Configuration (prometheus.yml):**
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

---

## Network Topology

### Bridge Network Architecture

**Network Definition:**
```yaml
networks:
  birthday-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
          gateway: 172.28.0.1
```

**IP Address Allocation:**
```
172.28.0.2  - postgres
172.28.0.3  - redis
172.28.0.10 - api-1
172.28.0.11 - api-2
172.28.0.12 - api-3
172.28.0.20 - worker-1
172.28.0.21 - worker-2
172.28.0.22 - worker-3
172.28.0.30 - nginx
172.28.0.40 - prometheus
172.28.0.41 - grafana
```

**Network Isolation:**
- **Internal Network:** Services communicate via container names (DNS)
- **External Access:** Only nginx (80/443) and postgres (5432, dev only) exposed
- **Security:** No direct internet access for workers (egress only to email API)

---

## Volume Management

### Volume Definitions

```yaml
volumes:
  # PostgreSQL data persistence
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/postgres

  # Redis AOF persistence
  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/redis

  # Prometheus metrics storage
  prometheus_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./data/prometheus
```

### Backup Strategy

**Automated Database Backup Container:**
```yaml
backup:
  image: prodrigestivill/postgres-backup-local
  container_name: birthday-backup
  restart: unless-stopped
  environment:
    POSTGRES_HOST: postgres
    POSTGRES_DB: birthday_app
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    SCHEDULE: "@daily"
    BACKUP_KEEP_DAYS: 7
    BACKUP_KEEP_WEEKS: 4
    BACKUP_KEEP_MONTHS: 6
  volumes:
    - ./backups:/backups
  depends_on:
    - postgres
  networks:
    - birthday-net
```

**Manual Backup Commands:**
```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres birthday_app > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres birthday_app < backup.sql

# Backup Redis
docker-compose exec redis redis-cli BGSAVE
docker cp birthday-redis:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb
```

---

## Environment Configuration

### .env File Structure

```bash
# .env
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database
POSTGRES_PASSWORD=your_secure_password_here
DATABASE_URL=postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/birthday_app
DATABASE_POOL_SIZE=20
DATABASE_SSL=false

# Redis
REDIS_URL=redis://redis:6379
REDIS_DB=0

# Email Service
EMAIL_API_URL=https://email-service.digitalenvision.com.au/send-email
EMAIL_API_TIMEOUT=10000

# Queue Configuration
QUEUE_NAME=birthday-messages
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=5
QUEUE_BACKOFF_DELAY=2000

# CRON Schedules
CRON_DAILY_SCHEDULE=0 0 * * *          # Daily at midnight UTC
CRON_MINUTE_SCHEDULE=* * * * *         # Every minute
CRON_RECOVERY_SCHEDULE=*/10 * * * *    # Every 10 minutes

# Circuit Breaker
CIRCUIT_BREAKER_TIMEOUT=10000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

### Environment-Specific Overrides

**docker-compose.dev.yml:**
```yaml
version: '3.9'

services:
  api:
    build:
      target: development
    volumes:
      - ./src:/app/src:ro
      - ./package.json:/app/package.json:ro
    environment:
      NODE_ENV: development
      LOG_LEVEL: debug
    command: npm run dev

  postgres:
    ports:
      - "5432:5432"  # Expose for local tools

  redis:
    ports:
      - "6379:6379"  # Expose for Redis CLI
```

**docker-compose.test.yml:**
```yaml
version: '3.9'

services:
  postgres:
    environment:
      POSTGRES_DB: birthday_test
    tmpfs:
      - /var/lib/postgresql/data  # In-memory for speed

  redis:
    tmpfs:
      - /data  # In-memory for speed
```

**Usage:**
```bash
# Development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Testing
docker-compose -f docker-compose.yml -f docker-compose.test.yml up

# Production
docker-compose up -d
```

---

## Service Dependencies

### Dependency Graph

```
                    ┌──────────────┐
                    │   postgres   │
                    │    (tier 1)  │
                    └───────┬──────┘
                            │
                    ┌───────▼──────┐
                    │    redis     │
                    │   (tier 1)   │
                    └───────┬──────┘
                            │
            ┌───────────────┼───────────────┐
            │                               │
    ┌───────▼──────┐                ┌──────▼──────┐
    │      api     │                │    worker   │
    │   (tier 2)   │                │  (tier 2)   │
    └───────┬──────┘                └─────────────┘
            │
    ┌───────▼──────┐
    │    nginx     │
    │   (tier 3)   │
    └──────────────┘
```

### Startup Order

**Stage 1:** Infrastructure (30-60 seconds)
1. postgres (health check: pg_isready)
2. redis (health check: redis-cli ping)

**Stage 2:** Application (15-30 seconds)
3. api (depends_on: postgres + redis, health check: /health)
4. worker (depends_on: postgres + redis)

**Stage 3:** Gateway (5-10 seconds)
5. nginx (depends_on: api)

**Stage 4:** Observability (10-20 seconds)
6. prometheus
7. grafana

**Total Startup Time:** ~60-120 seconds (cold start)

---

## Scaling Strategies

### Horizontal Scaling Configuration

**API Server Scaling:**
```yaml
api:
  deploy:
    mode: replicated
    replicas: 3
    update_config:
      parallelism: 1
      delay: 10s
      order: start-first
    rollback_config:
      parallelism: 0
      order: stop-first
```

**Worker Scaling:**
```yaml
worker:
  deploy:
    mode: replicated
    replicas: 5
    update_config:
      parallelism: 2
      delay: 5s
```

**Scaling Commands:**
```bash
# Scale API servers
docker-compose up --scale api=5

# Scale workers
docker-compose up --scale worker=10

# Combined scaling
docker-compose up --scale api=5 --scale worker=10
```

### Auto-Scaling Strategy

**External Orchestrator (Kubernetes/Docker Swarm):**
```yaml
# Kubernetes HPA (Horizontal Pod Autoscaler)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: birthday-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: birthday-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: bullmq_queue_waiting_jobs
      target:
        type: AverageValue
        averageValue: "100"
```

**Trigger Conditions:**
- **API:** CPU > 70% or requests/sec > 1000
- **Worker:** Queue depth > 100 jobs per worker

---

## Multi-Environment Setup

### Development Environment

**File:** `docker-compose.dev.yml`

**Features:**
- Hot-reload with volume mounts
- Exposed database ports for debugging
- Debug logging enabled
- No resource limits (use all available)

**Usage:**
```bash
# Start development environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# With rebuild
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

---

### Testing Environment

**File:** `docker-compose.test.yml`

**Features:**
- In-memory databases (tmpfs) for speed
- Separate test database
- No data persistence
- Parallel test execution support

**Integration with Vitest:**
```typescript
// tests/setup/docker-test-env.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function setupTestEnvironment() {
  await execAsync('docker-compose -f docker-compose.test.yml up -d');

  // Wait for services to be healthy
  await execAsync('docker-compose -f docker-compose.test.yml exec -T postgres pg_isready');
  await execAsync('docker-compose -f docker-compose.test.yml exec -T redis redis-cli ping');
}

export async function teardownTestEnvironment() {
  await execAsync('docker-compose -f docker-compose.test.yml down -v');
}
```

**CI/CD Integration:**
```yaml
# .github/workflows/test.yml
- name: Start test environment
  run: docker-compose -f docker-compose.test.yml up -d

- name: Wait for services
  run: |
    timeout 60 bash -c 'until docker-compose -f docker-compose.test.yml exec -T postgres pg_isready; do sleep 2; done'
    timeout 60 bash -c 'until docker-compose -f docker-compose.test.yml exec -T redis redis-cli ping; do sleep 2; done'

- name: Run tests
  run: npm run test:integration

- name: Cleanup
  if: always()
  run: docker-compose -f docker-compose.test.yml down -v
```

---

### Staging Environment

**File:** `docker-compose.staging.yml`

**Features:**
- Production-like configuration
- Smaller resource limits
- Persistent volumes
- Monitoring enabled

**Configuration:**
```yaml
version: '3.9'

services:
  api:
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  worker:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

---

### Production Environment

**File:** `docker-compose.prod.yml`

**Features:**
- Full resource allocation
- SSL/TLS enabled
- Automated backups
- Health monitoring
- Log aggregation

**Configuration:**
```yaml
version: '3.9'

services:
  api:
    deploy:
      replicas: 5
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
      restart_policy:
        condition: on-failure
        max_attempts: 3
        delay: 5s

  nginx:
    volumes:
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot_data:/etc/letsencrypt

  backup:
    restart: unless-stopped
```

---

## Performance Testing Infrastructure

### Load Testing Setup

**k6 Container Configuration:**
```yaml
k6:
  image: grafana/k6:latest
  container_name: birthday-k6
  networks:
    - birthday-net
  volumes:
    - ./tests/performance:/scripts:ro
    - ./k6-results:/results
  command: run --out json=/results/load-test-$(date +%Y%m%d-%H%M%S).json /scripts/api-load.k6.ts
  environment:
    API_BASE_URL: http://nginx
  depends_on:
    - nginx
```

**Usage:**
```bash
# Run API load tests
docker-compose run --rm k6 run /scripts/api-load.k6.ts

# Run with custom parameters
docker-compose run --rm k6 run --vus 1000 --duration 5m /scripts/api-load.k6.ts

# Generate HTML report
docker-compose run --rm k6 run --out html=/results/report.html /scripts/api-load.k6.ts
```

---

### Database Stress Testing

**pgbench Container:**
```yaml
pgbench:
  image: postgres:15-alpine
  container_name: birthday-pgbench
  networks:
    - birthday-net
  entrypoint: /bin/sh
  command:
    - -c
    - |
      pgbench -i -s 50 -h postgres -U postgres birthday_app
      pgbench -c 10 -j 2 -t 10000 -h postgres -U postgres birthday_app
  environment:
    PGPASSWORD: ${POSTGRES_PASSWORD}
  depends_on:
    postgres:
      condition: service_healthy
```

**Usage:**
```bash
# Initialize test data
docker-compose run --rm pgbench pgbench -i -s 100 -h postgres -U postgres birthday_app

# Run benchmark
docker-compose run --rm pgbench pgbench -c 50 -j 4 -t 10000 -h postgres -U postgres birthday_app
```

---

## Monitoring & Observability

### Prometheus + Grafana Stack

**Grafana Configuration:**
```yaml
grafana:
  image: grafana/grafana:latest
  container_name: birthday-grafana
  restart: unless-stopped
  ports:
    - "3001:3000"
  environment:
    GF_SECURITY_ADMIN_USER: admin
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    GF_INSTALL_PLUGINS: grafana-clock-panel
  volumes:
    - grafana_data:/var/lib/grafana
    - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
    - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
  networks:
    - birthday-net
  depends_on:
    - prometheus
```

**Pre-configured Dashboards:**
1. **API Performance:** Request rate, latency, error rate
2. **Worker Metrics:** Queue depth, processing rate, job failures
3. **Database Metrics:** Connection pool, query performance, disk usage
4. **System Metrics:** CPU, memory, network I/O

---

### Logging with Loki

**Loki + Promtail Configuration:**
```yaml
loki:
  image: grafana/loki:latest
  container_name: birthday-loki
  restart: unless-stopped
  ports:
    - "3100:3100"
  volumes:
    - ./loki/loki-config.yml:/etc/loki/local-config.yaml:ro
    - loki_data:/loki
  networks:
    - birthday-net

promtail:
  image: grafana/promtail:latest
  container_name: birthday-promtail
  restart: unless-stopped
  volumes:
    - /var/log:/var/log:ro
    - ./promtail/promtail-config.yml:/etc/promtail/config.yml:ro
    - /var/lib/docker/containers:/var/lib/docker/containers:ro
  networks:
    - birthday-net
  depends_on:
    - loki
```

**Log Collection Strategy:**
- **Application Logs:** Structured JSON via Pino
- **Container Logs:** Promtail scrapes Docker logs
- **System Logs:** Promtail monitors /var/log

---

## CI/CD Integration

### GitHub Actions Service Containers

**Workflow Configuration:**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: birthday_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:all
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/birthday_test
          REDIS_URL: redis://localhost:6379
```

---

### Docker Build and Push

**Multi-platform Build:**
```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Login to Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}

    - name: Build and push
      uses: docker/build-push-action@v5
      with:
        context: .
        platforms: linux/amd64,linux/arm64
        push: true
        tags: |
          birthday-app:latest
          birthday-app:${{ github.sha }}
        cache-from: type=registry,ref=birthday-app:buildcache
        cache-to: type=registry,ref=birthday-app:buildcache,mode=max
```

---

## Security Considerations

### Secret Management

**Docker Secrets (Swarm):**
```yaml
secrets:
  postgres_password:
    external: true
  email_api_key:
    external: true

services:
  api:
    secrets:
      - postgres_password
      - email_api_key
```

**Environment Variable Security:**
```bash
# .env.example (commit to repo)
POSTGRES_PASSWORD=changeme
GRAFANA_PASSWORD=changeme

# .env (gitignored, local only)
POSTGRES_PASSWORD=actual_secure_password_here
GRAFANA_PASSWORD=actual_secure_password_here
```

### Network Security

**Firewall Rules:**
```bash
# Allow only essential ports
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw deny 5432/tcp   # PostgreSQL (block external)
ufw deny 6379/tcp   # Redis (block external)
```

**Container Network Isolation:**
```yaml
networks:
  birthday-net:
    driver: bridge
    internal: true  # No external internet access

  external-net:
    driver: bridge
```

### SSL/TLS Configuration

**Let's Encrypt with Certbot:**
```yaml
certbot:
  image: certbot/certbot
  container_name: birthday-certbot
  volumes:
    - certbot_data:/etc/letsencrypt
    - certbot_www:/var/www/certbot
  entrypoint: /bin/sh -c "trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;"
  networks:
    - birthday-net
```

---

## Deployment Workflows

### Local Development Workflow

```bash
# 1. Clone repository
git clone https://github.com/your-org/happy-bday-app.git
cd happy-bday-app

# 2. Copy environment file
cp .env.example .env
# Edit .env with your local settings

# 3. Start development environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# 4. Run database migrations
docker-compose exec api npm run migrate

# 5. Create test user
curl -X POST http://localhost:3000/user \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "birthday": "1990-01-15",
    "location": "America/New_York",
    "email": "test@example.com"
  }'

# 6. Watch logs
docker-compose logs -f api worker

# 7. Stop environment
docker-compose down
```

---

### Production Deployment Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# 3. Stop existing containers (zero-downtime with nginx)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# 4. Start new containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Run database migrations
docker-compose exec api npm run migrate

# 6. Health check
curl -f http://localhost/health

# 7. Monitor startup
docker-compose logs -f --tail=100

# 8. Rollback if needed
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

### Blue-Green Deployment

**Strategy:**
```bash
# Current: blue (live)
# Deploy: green (new version)

# 1. Start green environment
docker-compose -f docker-compose.green.yml up -d

# 2. Run smoke tests
curl -f http://localhost:3001/health

# 3. Switch nginx to green
docker-compose exec nginx nginx -s reload

# 4. Monitor for 5 minutes
docker-compose -f docker-compose.green.yml logs -f

# 5. If stable, stop blue
docker-compose -f docker-compose.blue.yml down

# 6. Rename green to blue for next deployment
mv docker-compose.green.yml docker-compose.blue.yml
```

---

## Complete docker-compose.yml

```yaml
version: '3.9'

services:
  # API Server (Fastify)
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    image: birthday-app:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/birthday_app
      REDIS_URL: redis://redis:6379
      EMAIL_API_URL: ${EMAIL_API_URL}
      LOG_LEVEL: info
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
      replicas: 3
    networks:
      - birthday-net

  # Worker Pool (BullMQ)
  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    image: birthday-app:latest
    restart: unless-stopped
    command: ["npm", "run", "worker"]
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@postgres:5432/birthday_app
      REDIS_URL: redis://redis:6379
      EMAIL_API_URL: ${EMAIL_API_URL}
      WORKER_CONCURRENCY: 5
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
      replicas: 5
    networks:
      - birthday-net

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: birthday_app
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    networks:
      - birthday-net

  # Redis (Queue + Cache)
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
    networks:
      - birthday-net

  # Nginx (Load Balancer)
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 10s
      timeout: 3s
      retries: 3
    networks:
      - birthday-net

  # Prometheus (Monitoring)
  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - birthday-net

  # Grafana (Visualization)
  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./grafana/datasources:/etc/grafana/provisioning/datasources:ro
    networks:
      - birthday-net
    depends_on:
      - prometheus

networks:
  birthday-net:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

---

## Conclusion

This Docker Compose architecture provides:

1. **Complete local development setup** with hot-reload and debugging
2. **Isolated testing environment** with Testcontainers integration
3. **Performance testing infrastructure** with k6 and pgbench
4. **Production-ready deployment** with monitoring and logging
5. **CI/CD integration** with GitHub Actions service containers
6. **Horizontal scaling** for API and worker services
7. **Data persistence** with volume management and automated backups
8. **Security** with network isolation and secret management

**Next Steps:**
1. Create Dockerfile (multi-stage build)
2. Implement nginx configuration
3. Set up Prometheus/Grafana dashboards
4. Write deployment automation scripts
5. Configure CI/CD pipeline

---

**Document Status:** Ready for Implementation Review
**Author:** Coder/Architect Agent (Hive Mind Collective)
**Version:** 1.0
**Date:** December 30, 2025
