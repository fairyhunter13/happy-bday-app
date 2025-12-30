# Docker Deployment Guide

Production deployment guide for Birthday Message Scheduler using Docker and Docker Compose.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Production Deployment](#production-deployment)
- [Configuration](#configuration)
- [Scaling](#scaling)
- [Monitoring](#monitoring)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Performance Optimization](#performance-optimization)

## Overview

The production deployment consists of:
- **3 API replicas** behind Nginx load balancer
- **10 Worker replicas** for message processing
- **PostgreSQL** with primary-replica replication
- **RabbitMQ** 3-node cluster
- **Redis** for caching
- **Nginx** as reverse proxy and load balancer
- **Prometheus** for metrics collection
- **Grafana** for visualization

## Architecture

```
                                  ┌─────────────┐
                                  │   Nginx     │
                                  │Load Balancer│
                                  └──────┬──────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
              ┌─────▼─────┐        ┌─────▼─────┐       ┌─────▼─────┐
              │  API-1    │        │  API-2    │       │  API-3    │
              │  :3000    │        │  :3000    │       │  :3000    │
              └─────┬─────┘        └─────┬─────┘       └─────┬─────┘
                    │                    │                    │
                    └────────────────────┼────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
        ┌─────▼─────┐             ┌─────▼─────┐             ┌─────▼─────┐
        │PostgreSQL │             │ RabbitMQ  │             │   Redis   │
        │ Primary   │─────────────│ Cluster   │             │  Cache    │
        │  + Replica│             │ (3 nodes) │             └───────────┘
        └───────────┘             └─────┬─────┘
                                        │
                   ┌────────────────────┼────────────────────┐
                   │                    │                    │
             ┌─────▼─────┐        ┌─────▼─────┐       ┌─────▼─────┐
             │ Worker 1  │   ...  │ Worker 5  │  ...  │ Worker 10 │
             └───────────┘        └───────────┘       └───────────┘
```

## Prerequisites

- Docker 24.0+ and Docker Compose 2.0+
- 8GB+ RAM (16GB recommended)
- 4+ CPU cores (8 cores recommended)
- 50GB+ disk space
- Linux/macOS (Windows with WSL2)

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/your-org/birthday-message-scheduler.git
cd birthday-message-scheduler
```

### 2. Configure Environment

```bash
# Copy production environment template
cp .env.prod.example .env.prod

# Edit with your production values
nano .env.prod
```

**Critical: Change all passwords and secrets!**

```bash
# Generate secure passwords
openssl rand -base64 32  # For DATABASE_PASSWORD
openssl rand -base64 32  # For RABBITMQ_PASSWORD
openssl rand -base64 32  # For REDIS_PASSWORD
openssl rand -base64 64  # For API_SECRET_KEY
```

### 3. Generate SSL Certificates

```bash
# For development/testing (self-signed)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem

# For production: Use Let's Encrypt
# See: https://letsencrypt.org/getting-started/
```

### 4. Build and Start Services

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check service health
docker-compose -f docker-compose.prod.yml ps
```

### 5. Run Database Migrations

```bash
# Run migrations on primary database
docker-compose -f docker-compose.prod.yml exec api-1 npm run db:migrate
```

### 6. Verify Deployment

```bash
# Check API health
curl -k https://localhost/health

# Check RabbitMQ
open http://localhost:15672  # admin/your-password

# Check Grafana
open http://localhost:3001  # admin/your-password
```

## Production Deployment

### Step-by-Step Production Setup

#### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

#### 2. Security Hardening

```bash
# Configure firewall
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# Only allow internal access to services
# PostgreSQL: 5432 (internal only)
# RabbitMQ: 5672, 15672 (internal only)
# Redis: 6379 (internal only)
```

#### 3. Production Environment Configuration

```bash
# Set production environment
export NODE_ENV=production

# Configure production .env.prod
# Ensure all passwords are strong and unique
# Disable debug features
# Enable monitoring and alerting
```

#### 4. SSL/TLS Setup

```bash
# Install certbot for Let's Encrypt
sudo apt install certbot

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates to nginx directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem

# Set up auto-renewal
sudo crontab -e
# Add: 0 3 * * * certbot renew --quiet --deploy-hook "docker-compose -f /path/to/docker-compose.prod.yml restart nginx"
```

#### 5. Launch Production Stack

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Build custom images
docker-compose -f docker-compose.prod.yml build --no-cache

# Start with resource limits
docker-compose -f docker-compose.prod.yml up -d

# Verify all services are healthy
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

## Configuration

### Service Configuration

#### API Replicas

**Resource Limits:**
- CPU: 1.0 core limit, 0.5 reserved
- Memory: 512MB limit, 256MB reserved

**Scaling:**
```bash
# Scale API to 5 instances
docker-compose -f docker-compose.prod.yml up -d --scale api=5
```

#### Worker Replicas

**Resource Limits:**
- CPU: 0.5 core limit, 0.25 reserved
- Memory: 256MB limit, 128MB reserved

**Scaling:**
```bash
# Scale workers to 20 instances
docker-compose -f docker-compose.prod.yml up -d --scale worker=20
```

### Database Configuration

#### PostgreSQL Primary

**Performance Tuning:**
```sql
-- In scripts/init-db.sql or via ALTER SYSTEM
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET max_connections = 200;
```

#### PostgreSQL Replica Setup

The replica is configured automatically. To verify replication:

```bash
# Connect to primary
docker-compose -f docker-compose.prod.yml exec postgres-primary psql -U postgres

# Check replication status
SELECT * FROM pg_stat_replication;
```

### RabbitMQ Cluster

#### Cluster Formation

Verify cluster status:

```bash
# Access RabbitMQ node 1
docker-compose -f docker-compose.prod.yml exec rabbitmq-1 rabbitmqctl cluster_status

# Expected: 3 running nodes
```

#### Queue Configuration

Create quorum queues for high availability:

```bash
docker-compose -f docker-compose.prod.yml exec rabbitmq-1 rabbitmqadmin declare queue \
  name=birthday-messages \
  durable=true \
  arguments='{"x-queue-type": "quorum"}'
```

## Scaling

### Horizontal Scaling

#### Add More API Replicas

```bash
# Method 1: Using docker-compose scale
docker-compose -f docker-compose.prod.yml up -d --scale api=5

# Method 2: Add services in docker-compose.prod.yml
# Then:
docker-compose -f docker-compose.prod.yml up -d api-4 api-5
```

#### Add More Workers

```bash
# Scale to 20 workers
docker-compose -f docker-compose.prod.yml up -d --scale worker=20
```

### Vertical Scaling

Update resource limits in `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
```

Then restart:

```bash
docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

## Monitoring

### Access Monitoring Dashboards

1. **Prometheus**: http://localhost:9090
2. **Grafana**: http://localhost:3001 (admin/your-password)
3. **RabbitMQ Management**: http://localhost:15672

### Key Metrics to Monitor

#### Application Metrics
- Request rate (req/s)
- Response time (p50, p95, p99)
- Error rate (%)
- Active connections

#### Database Metrics
- Connection pool usage
- Query performance
- Replication lag
- Disk I/O

#### Queue Metrics
- Message rate (msg/s)
- Queue depth
- Consumer count
- Message age

#### System Metrics
- CPU usage (%)
- Memory usage (MB)
- Disk usage (%)
- Network I/O

### Alerts Configuration

Configure alerts in `prometheus/alert.rules.yml`:

```yaml
groups:
  - name: birthday_app_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
```

## Backup and Recovery

### Database Backup

#### Automated Backups

```bash
# Create backup script
cat > scripts/backup-database.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker-compose -f docker-compose.prod.yml exec -T postgres-primary \
  pg_dump -U postgres birthday_app | gzip > ${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz
# Keep only last 30 days
find ${BACKUP_DIR} -name "backup_*.sql.gz" -mtime +30 -delete
EOF

chmod +x scripts/backup-database.sh

# Schedule daily backups
crontab -e
# Add: 0 2 * * * /path/to/scripts/backup-database.sh
```

#### Restore from Backup

```bash
# Stop application
docker-compose -f docker-compose.prod.yml stop api-1 api-2 api-3 worker-*

# Restore database
gunzip < backup_20240101_020000.sql.gz | \
  docker-compose -f docker-compose.prod.yml exec -T postgres-primary \
  psql -U postgres birthday_app

# Restart application
docker-compose -f docker-compose.prod.yml start
```

### Volume Backup

```bash
# Backup all volumes
docker run --rm \
  -v birthday-prod-network:/data \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/volumes-backup.tar.gz /data
```

## Troubleshooting

### Common Issues

#### 1. Services Not Starting

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs -f [service-name]

# Check service health
docker-compose -f docker-compose.prod.yml ps

# Restart specific service
docker-compose -f docker-compose.prod.yml restart [service-name]
```

#### 2. Database Connection Issues

```bash
# Verify database is running
docker-compose -f docker-compose.prod.yml exec postgres-primary pg_isready

# Check connection from API
docker-compose -f docker-compose.prod.yml exec api-1 \
  node -e "require('pg').Client({connectionString: process.env.DATABASE_URL}).connect()"

# Check logs
docker-compose -f docker-compose.prod.yml logs postgres-primary
```

#### 3. RabbitMQ Connection Issues

```bash
# Check RabbitMQ status
docker-compose -f docker-compose.prod.yml exec rabbitmq-1 rabbitmqctl status

# Check queue status
docker-compose -f docker-compose.prod.yml exec rabbitmq-1 rabbitmqctl list_queues

# Reset connections
docker-compose -f docker-compose.prod.yml restart rabbitmq-1
```

#### 4. High Memory Usage

```bash
# Check container stats
docker stats

# Identify memory hogs
docker ps -q | xargs docker inspect --format='{{.Name}}: {{.HostConfig.Memory}}'

# Restart service to clear memory
docker-compose -f docker-compose.prod.yml restart [service-name]
```

#### 5. SSL Certificate Issues

```bash
# Verify certificate
openssl x509 -in nginx/ssl/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect localhost:443

# Check Nginx configuration
docker-compose -f docker-compose.prod.yml exec nginx nginx -t
```

### Health Checks

```bash
# API health
curl -k https://localhost/health

# Database health
docker-compose -f docker-compose.prod.yml exec postgres-primary \
  pg_isready -U postgres

# RabbitMQ health
docker-compose -f docker-compose.prod.yml exec rabbitmq-1 \
  rabbitmq-diagnostics -q ping

# Redis health
docker-compose -f docker-compose.prod.yml exec redis \
  redis-cli -a $REDIS_PASSWORD ping
```

## Performance Optimization

### Nginx Optimization

```nginx
# In nginx/nginx.conf
worker_processes auto;  # Use all CPU cores
worker_connections 4096;  # Increase connections

# Enable caching
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g;
```

### PostgreSQL Optimization

```sql
-- Increase connection pool
ALTER SYSTEM SET max_connections = 300;

-- Optimize for SSD
ALTER SYSTEM SET random_page_cost = 1.1;

-- Increase shared buffers
ALTER SYSTEM SET shared_buffers = '512MB';

-- Reload configuration
SELECT pg_reload_conf();
```

### RabbitMQ Optimization

```bash
# Increase prefetch count for workers
# In .env.prod
QUEUE_PREFETCH_COUNT=20

# Enable lazy queues for better memory management
docker-compose -f docker-compose.prod.yml exec rabbitmq-1 rabbitmqadmin declare queue \
  name=birthday-messages \
  durable=true \
  arguments='{"x-queue-mode": "lazy"}'
```

### Application Optimization

```bash
# Increase Node.js memory
# In .env.prod
NODE_OPTIONS=--max-old-space-size=1024

# Increase worker pool
QUEUE_CONCURRENCY=20

# Enable clustering (if needed)
UV_THREADPOOL_SIZE=16
```

## Performance Test Results

After deployment, run performance tests:

```bash
# Install k6
brew install k6  # macOS
# or
sudo apt install k6  # Ubuntu

# Run API load test
k6 run tests/performance/api-load.test.js

# Run end-to-end test
k6 run tests/performance/e2e-load.test.js

# Generate report
npm run perf:report
```

**Expected Performance:**
- API throughput: 1000+ req/s
- p95 latency: < 500ms
- p99 latency: < 1000ms
- Error rate: < 1%
- Worker throughput: 50+ msg/s per worker

## Maintenance

### Regular Maintenance Tasks

#### Daily
- Check logs for errors
- Monitor resource usage
- Verify backups completed

#### Weekly
- Review performance metrics
- Check disk space
- Update security patches

#### Monthly
- Review and rotate logs
- Optimize database (VACUUM, ANALYZE)
- Update dependencies
- Review backup retention

### Update Deployment

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose -f docker-compose.prod.yml build --no-cache

# Rolling update (zero downtime)
docker-compose -f docker-compose.prod.yml up -d --no-deps --build api-1
# Wait for health check
docker-compose -f docker-compose.prod.yml up -d --no-deps --build api-2
docker-compose -f docker-compose.prod.yml up -d --no-deps --build api-3

# Update workers
docker-compose -f docker-compose.prod.yml up -d --no-deps --build worker-1
# ... repeat for all workers
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/birthday-message-scheduler/issues
- Documentation: https://docs.example.com
- Email: support@example.com

## License

MIT License - see LICENSE file for details
