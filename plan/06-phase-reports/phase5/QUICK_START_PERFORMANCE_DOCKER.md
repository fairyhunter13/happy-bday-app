# Quick Start: Performance Testing & Docker Deployment

Fast-track guide for running performance tests and deploying to production.

## Prerequisites

- Docker 24.0+ and Docker Compose 2.0+
- k6 installed (`brew install k6` on macOS)
- 8GB+ RAM available
- Node.js 20+ for report generation

## Performance Testing (5 minutes)

### 1. Start Services

```bash
# Start development stack
docker-compose up -d

# Wait for services to be healthy (30 seconds)
docker-compose ps
```

### 2. Run Quick Performance Test

```bash
# Quick API test (shorter version)
k6 run --duration 2m --vus 100 tests/performance/api-load.test.js

# View summary
cat perf-results/api-load-summary.json
```

### 3. Run Full Test Suite

```bash
# All performance tests (~2 hours)
npm run perf:all

# Generate HTML report
npm run perf:report:html

# Open report
open perf-results/performance-report.html
```

## Production Deployment (10 minutes)

### 1. Quick Deploy

```bash
# Generate self-signed SSL certificate (testing only)
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/CN=localhost"

# Copy production env template
cp .env.prod.example .env.prod

# Edit passwords (IMPORTANT!)
nano .env.prod
# Change: DATABASE_PASSWORD, RABBITMQ_PASSWORD, REDIS_PASSWORD

# Build and start
npm run docker:prod:build
npm run docker:prod:up
```

### 2. Verify Deployment

```bash
# Check all services
npm run docker:prod:ps

# Test API
curl -k https://localhost/health

# View logs
npm run docker:prod:logs
```

### 3. Run Database Migrations

```bash
docker-compose -f docker-compose.prod.yml exec api-1 npm run db:migrate
```

## Performance Test Commands

| Command | Description | Duration |
|---------|-------------|----------|
| `npm run perf:k6:api` | API CRUD load test | 45 min |
| `npm run perf:k6:scheduler` | Scheduler performance | 35 min |
| `npm run perf:k6:worker-throughput` | Worker scaling | 30 min |
| `npm run perf:k6:e2e` | End-to-end flow | 37 min |
| `npm run perf:all` | All tests | ~2 hours |
| `npm run perf:report:html` | Generate report | 10 sec |

## Docker Commands

| Command | Description |
|---------|-------------|
| `npm run docker:prod:build` | Build production images |
| `npm run docker:prod:up` | Start all services |
| `npm run docker:prod:down` | Stop all services |
| `npm run docker:prod:logs` | View logs |
| `npm run docker:prod:ps` | List containers |

## Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| API | https://localhost | - |
| Swagger | https://localhost/docs | - |
| RabbitMQ | http://localhost:15672 | rabbitmq/your-password |
| Grafana | http://localhost:3001 | admin/your-password |
| Prometheus | http://localhost:9090 | - |

## Scaling

```bash
# Scale API to 5 replicas
docker-compose -f docker-compose.prod.yml up -d --scale api=5

# Scale workers to 20 replicas
docker-compose -f docker-compose.prod.yml up -d --scale worker=20
```

## Monitoring

```bash
# View container stats
docker stats

# Check specific service logs
docker-compose -f docker-compose.prod.yml logs -f api-1

# Check queue depth
docker-compose -f docker-compose.prod.yml exec rabbitmq-1 rabbitmqctl list_queues
```

## Troubleshooting

### Services won't start
```bash
# Check logs
npm run docker:prod:logs

# Restart specific service
docker-compose -f docker-compose.prod.yml restart api-1

# Clean restart
npm run docker:prod:down
docker system prune -f
npm run docker:prod:up
```

### Performance test fails
```bash
# Verify API is healthy
curl http://localhost:3000/health

# Check if services are running
docker-compose ps

# View API logs
docker-compose logs api
```

### High memory usage
```bash
# Check usage
docker stats

# Restart services
npm run docker:prod:down
npm run docker:prod:up
```

## Expected Performance Results

### API Load Test
- Throughput: 50-100 req/s
- p95 latency: < 500ms
- Success rate: > 99%

### Scheduler Load Test
- Execution time: < 30s (10k records)
- Enqueue rate: > 100 msg/s

### Worker Throughput Test
- 10 workers: > 500 msg/s
- Scaling efficiency: > 90%

### End-to-End Test
- p95 latency: < 5s
- Success rate: > 99%

## Next Steps

1. **Read Full Guides:**
   - Performance: `/tests/performance/README.md`
   - Docker: `/DOCKER_DEPLOYMENT_GUIDE.md`

2. **Configure Production:**
   - Set up SSL certificates (Let's Encrypt)
   - Configure monitoring alerts
   - Set up automated backups

3. **Run Tests:**
   - Execute full test suite
   - Review HTML report
   - Document baseline performance

4. **Deploy Production:**
   - Update production environment variables
   - Deploy to production server
   - Monitor metrics
   - Set up alerts

## Support

- Full Documentation: `/PHASE_5-6_PERFORMANCE_AND_DOCKER.md`
- Performance Guide: `/tests/performance/README.md`
- Deployment Guide: `/DOCKER_DEPLOYMENT_GUIDE.md`

## Tips

**Performance Testing:**
- Run tests during off-peak hours
- Monitor resource usage during tests
- Clean database before tests
- Save test results for comparison

**Production Deployment:**
- Always use strong passwords
- Enable monitoring from day 1
- Set up automated backups
- Test disaster recovery
- Monitor logs and metrics

**Optimization:**
- Start with baseline configuration
- Scale based on actual metrics
- Monitor and adjust thresholds
- Regular performance testing
