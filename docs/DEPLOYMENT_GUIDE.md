# Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Configuration Checklist](#configuration-checklist)
4. [Database Migration](#database-migration)
5. [Deployment Strategies](#deployment-strategies)
6. [Health Check Verification](#health-check-verification)
7. [Post-Deployment Testing](#post-deployment-testing)
8. [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Software

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥20.0.0 | Runtime environment |
| npm | ≥10.0.0 | Package manager |
| PostgreSQL | ≥14.0 | Database |
| RabbitMQ | ≥3.12 | Message queue |
| Docker | ≥24.0 (optional) | Containerization |
| Kubernetes | ≥1.28 (optional) | Orchestration |

### Access Requirements

- [ ] SSH access to production servers
- [ ] kubectl configured for production cluster
- [ ] Database credentials (in secret manager)
- [ ] RabbitMQ credentials (in secret manager)
- [ ] Docker registry access
- [ ] AWS CLI configured (if using AWS)
- [ ] PagerDuty/Slack webhook URLs

### Pre-Deployment Verification

```bash
# Check all tests pass
npm test

# Verify test coverage
npm run test:coverage
# Coverage should be >80%

# Run linting
npm run lint

# Type checking
npm run typecheck

# Security audit
npm audit
```

---

## Environment Setup

### 1. Production Environment Variables

Create production environment configuration:

```bash
# Production .env (stored in secret manager, not git)
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@prod-db.example.com:5432/birthday_scheduler
DATABASE_POOL_MAX=20
DATABASE_POOL_MIN=5
DATABASE_TIMEOUT_MS=2000

# RabbitMQ
RABBITMQ_URL=amqp://user:password@prod-rabbitmq.example.com:5672
RABBITMQ_PREFETCH=10
RABBITMQ_HEARTBEAT=60

# External Services
MESSAGE_SERVICE_URL=https://api.message-service.com
MESSAGE_SERVICE_API_KEY=<from_secret_manager>

# Circuit Breaker
CIRCUIT_BREAKER_TIMEOUT=3000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_TIME_WINDOW=60000

# Monitoring
METRICS_ENABLED=true
TRACING_ENABLED=true
```

### 2. Infrastructure Setup

**Docker Deployment:**

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    image: birthday-scheduler:${VERSION}
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - rabbitmq
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  worker:
    image: birthday-scheduler:${VERSION}
    command: node dist/worker.js
    environment:
      NODE_ENV: production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - rabbitmq
    restart: always
    deploy:
      replicas: 3

  scheduler:
    image: birthday-scheduler:${VERSION}
    command: node dist/scheduler.js
    environment:
      NODE_ENV: production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - rabbitmq
    restart: always

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: birthday_scheduler
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    ports:
      - "15672:15672"
    restart: always

volumes:
  postgres_data:
  rabbitmq_data:
```

**Kubernetes Deployment:**

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: birthday-scheduler-api
  labels:
    app: birthday-scheduler
    component: api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: birthday-scheduler
      component: api
  template:
    metadata:
      labels:
        app: birthday-scheduler
        component: api
    spec:
      containers:
      - name: api
        image: birthday-scheduler:VERSION
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: birthday-scheduler-secrets
              key: database-url
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: birthday-scheduler-secrets
              key: rabbitmq-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: birthday-scheduler-api
spec:
  selector:
    app: birthday-scheduler
    component: api
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

---

## Configuration Checklist

### Pre-Deployment

- [ ] Environment variables configured in secret manager
- [ ] Database connection string updated
- [ ] RabbitMQ credentials rotated (if scheduled)
- [ ] External API keys validated
- [ ] SSL/TLS certificates valid
- [ ] DNS records updated
- [ ] Load balancer configured
- [ ] Firewall rules configured
- [ ] Monitoring dashboards created
- [ ] Alert rules configured
- [ ] Backup procedures tested
- [ ] Rollback plan documented

### Security

- [ ] All secrets in secret manager (not in code)
- [ ] SSL/TLS enabled for all connections
- [ ] Rate limiting configured
- [ ] Helmet.js security headers enabled
- [ ] CORS properly configured
- [ ] Database uses SSL connection
- [ ] RabbitMQ uses TLS (production)
- [ ] API authentication enabled (if applicable)
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified

### Performance

- [ ] Database indexes created
- [ ] Connection pool sized appropriately
- [ ] Worker count optimized
- [ ] Circuit breaker configured
- [ ] Caching strategy implemented
- [ ] CDN configured (if applicable)

---

## Database Migration

### Pre-Migration Checks

```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup_pre_migration_$(date +%Y%m%d).sql

# 2. Verify connection
psql $DATABASE_URL -c "SELECT version();"

# 3. Check current migration status
npm run db:status

# 4. Review pending migrations
ls -la src/db/migrations/
```

### Migration Execution

**Development/Staging:**

```bash
# Generate migration
npm run db:generate

# Review generated SQL
cat src/db/migrations/0001_*.sql

# Apply migration
npm run db:migrate

# Verify
psql $DATABASE_URL -c "SELECT * FROM drizzle.__drizzle_migrations;"
```

**Production (Zero-Downtime):**

```bash
# 1. Deploy backward-compatible schema changes first
# Example: Add new column (nullable)
npm run db:migrate

# 2. Deploy application code (new version can use new column)
kubectl rollout restart deployment/birthday-scheduler-api

# 3. Wait for rollout completion
kubectl rollout status deployment/birthday-scheduler-api

# 4. Deploy non-compatible changes (if any)
# Example: Make column NOT NULL, drop old columns
npm run db:migrate:phase2

# 5. Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE new_column IS NULL;"
```

### Migration Rollback

```bash
# If migration fails
npm run db:migrate:rollback

# Restore from backup
psql $DATABASE_URL < backup_pre_migration_20250130.sql

# Verify rollback
psql $DATABASE_URL -c "SELECT * FROM drizzle.__drizzle_migrations;"
```

---

## Deployment Strategies

### 1. Blue-Green Deployment

**Concept:** Run two identical production environments, switch traffic instantly.

```bash
# Step 1: Deploy to Green environment (inactive)
kubectl apply -f k8s/deployment-green.yaml

# Step 2: Verify Green environment
kubectl exec -it deployment/birthday-scheduler-green -- curl http://localhost:3000/health

# Step 3: Run smoke tests
./scripts/smoke-test.sh https://green.example.com

# Step 4: Switch traffic (update load balancer)
kubectl patch service birthday-scheduler -p '{"spec":{"selector":{"version":"green"}}}'

# Step 5: Monitor Blue environment
# Keep Blue running for quick rollback

# Step 6: After 24 hours, decommission Blue
kubectl delete deployment birthday-scheduler-blue
```

### 2. Rolling Update (Default)

**Kubernetes automatically handles rolling updates:**

```bash
# Update image
kubectl set image deployment/birthday-scheduler-api \
  api=birthday-scheduler:v1.2.0

# Monitor rollout
kubectl rollout status deployment/birthday-scheduler-api

# Pause rollout (if issues detected)
kubectl rollout pause deployment/birthday-scheduler-api

# Resume rollout
kubectl rollout resume deployment/birthday-scheduler-api
```

### 3. Canary Deployment

**Deploy to small subset of traffic first:**

```bash
# Step 1: Deploy canary with 10% traffic
kubectl apply -f k8s/deployment-canary.yaml

# Step 2: Configure traffic split
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: birthday-scheduler
spec:
  hosts:
  - birthday-scheduler
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: birthday-scheduler-canary
      weight: 10
  - route:
    - destination:
        host: birthday-scheduler-stable
      weight: 90

# Step 3: Monitor canary metrics
# Watch error rates, response times for canary vs stable

# Step 4: Gradually increase canary traffic
# 10% -> 25% -> 50% -> 100%

# Step 5: Promote canary to stable
kubectl apply -f k8s/deployment-stable.yaml
```

---

## Zero-Downtime Deployment

### Strategy

1. **Database migrations** - Backward compatible changes first
2. **Rolling update** - Replace pods gradually
3. **Health checks** - Ensure new pods healthy before routing traffic
4. **Connection draining** - Wait for active connections to finish

### Implementation

```yaml
# deployment.yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Create 1 extra pod during update
      maxUnavailable: 0   # Don't terminate old pods until new ones ready

  template:
    spec:
      containers:
      - name: api
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 3

        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
```

### Deployment Process

```bash
# 1. Update deployment
kubectl set image deployment/birthday-scheduler-api api=birthday-scheduler:v1.2.0

# 2. Kubernetes automatically:
#    - Creates 1 new pod (maxSurge: 1)
#    - Waits for readiness probe to pass
#    - Routes traffic to new pod
#    - Terminates 1 old pod
#    - Repeats until all pods updated

# 3. Monitor rollout
kubectl rollout status deployment/birthday-scheduler-api
# Waiting for deployment "birthday-scheduler-api" rollout to finish: 1 out of 3 new replicas have been updated...
# Waiting for deployment "birthday-scheduler-api" rollout to finish: 2 out of 3 new replicas have been updated...
# deployment "birthday-scheduler-api" successfully rolled out

# 4. Verify all pods running new version
kubectl get pods -l app=birthday-scheduler -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'
```

---

## Health Check Verification

### Post-Deployment Checks

```bash
# 1. Health endpoint
curl -f https://api.example.com/health || echo "Health check failed!"

# 2. Detailed health
curl https://api.example.com/health | jq '.'
# Expected output:
# {
#   "status": "ok",
#   "timestamp": "2025-01-30T10:00:00Z",
#   "version": "1.2.0",
#   "database": "ok",
#   "queue": "ok",
#   "uptime": 123
# }

# 3. Database connectivity
curl https://api.example.com/health/db | jq '.connected'
# true

# 4. Queue connectivity
curl https://api.example.com/health/queue | jq '.connected'
# true

# 5. Metrics endpoint
curl https://api.example.com/metrics | grep 'http_requests_total'

# 6. API functionality test
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "dateOfBirth": "1990-01-01T00:00:00Z",
    "timezoneOffset": 0
  }' | jq '.'

# 7. Check all pods healthy
kubectl get pods -l app=birthday-scheduler
# All should be Running with 1/1 Ready
```

---

## Post-Deployment Testing

### Smoke Tests

```bash
#!/bin/bash
# scripts/smoke-test.sh

BASE_URL="${1:-https://api.example.com}"

echo "Running smoke tests against $BASE_URL..."

# Test 1: Health check
echo "Test 1: Health check..."
if curl -f "$BASE_URL/health" > /dev/null 2>&1; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed"
  exit 1
fi

# Test 2: Create user
echo "Test 2: Create user..."
USER_ID=$(curl -s -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Smoke",
    "lastName": "Test",
    "email": "smoke-test-'$(date +%s)'@example.com",
    "dateOfBirth": "1990-01-01T00:00:00Z",
    "timezoneOffset": 0
  }' | jq -r '.id')

if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
  echo "✅ Create user passed (ID: $USER_ID)"
else
  echo "❌ Create user failed"
  exit 1
fi

# Test 3: Get user
echo "Test 3: Get user..."
if curl -f "$BASE_URL/users/$USER_ID" > /dev/null 2>&1; then
  echo "✅ Get user passed"
else
  echo "❌ Get user failed"
  exit 1
fi

# Test 4: Delete user
echo "Test 4: Delete user..."
if curl -f -X DELETE "$BASE_URL/users/$USER_ID" > /dev/null 2>&1; then
  echo "✅ Delete user passed"
else
  echo "❌ Delete user failed"
  exit 1
fi

echo "All smoke tests passed! ✅"
```

### Load Testing

```bash
# Quick load test with k6
k6 run --vus 10 --duration 30s tests/performance/smoke-load.js

# Expected output:
# checks.........................: 100.00% ✓ 3000  ✗ 0
# http_req_duration..............: avg=50ms    p(95)=100ms  p(99)=200ms
# http_reqs......................: 3000    100/s
```

---

## Rollback Procedures

### When to Rollback

- Critical bugs discovered in production
- Error rate >10%
- Performance degradation >50%
- Health checks failing
- Customer-impacting issues

### Kubernetes Rollback

```bash
# 1. Immediate rollback to previous version
kubectl rollout undo deployment/birthday-scheduler-api

# 2. Rollback to specific revision
kubectl rollout history deployment/birthday-scheduler-api
kubectl rollout undo deployment/birthday-scheduler-api --to-revision=5

# 3. Monitor rollback
kubectl rollout status deployment/birthday-scheduler-api

# 4. Verify health
curl https://api.example.com/health
```

### Docker Rollback

```bash
# 1. Stop current containers
docker-compose down

# 2. Checkout previous version
git checkout v1.1.0

# 3. Rebuild and deploy
docker-compose build
docker-compose up -d

# 4. Verify
curl http://localhost:3000/health
```

### Database Rollback

```bash
# If migration needs rollback
npm run db:migrate:rollback

# If data needs restore
psql $DATABASE_URL < backup_pre_deployment.sql
```

---

## Deployment Automation

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test

    - name: Build
      run: npm run build

    - name: Build Docker image
      run: docker build -t birthday-scheduler:${{ github.ref_name }} .

    - name: Push to registry
      run: |
        echo ${{ secrets.REGISTRY_PASSWORD }} | docker login -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin
        docker push birthday-scheduler:${{ github.ref_name }}

    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/birthday-scheduler-api \
          api=birthday-scheduler:${{ github.ref_name }}

    - name: Wait for rollout
      run: kubectl rollout status deployment/birthday-scheduler-api

    - name: Run smoke tests
      run: ./scripts/smoke-test.sh https://api.example.com

    - name: Notify team
      run: |
        curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
          -H 'Content-Type: application/json' \
          -d '{"text":"✅ Deployed ${{ github.ref_name }} to production"}'
```

---

**Last Updated:** 2025-12-30
**Version:** 1.0.0
**Owner:** DevOps Team
