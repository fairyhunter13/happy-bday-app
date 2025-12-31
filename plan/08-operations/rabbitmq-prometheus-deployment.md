# RabbitMQ Prometheus Plugin Deployment Guide

**Version:** 1.0
**Author:** DOCUMENTER Agent (Hive Mind)
**Date:** December 31, 2025
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Deployment Options](#deployment-options)
3. [Configuration](#configuration)
4. [Prometheus Integration](#prometheus-integration)
5. [Sample Queries](#sample-queries)
6. [Security Best Practices](#security-best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### What is rabbitmq_prometheus?

The `rabbitmq_prometheus` plugin is an official RabbitMQ plugin that exposes broker metrics in Prometheus format. It provides comprehensive visibility into queue health, message flow, and resource utilization.

**Official Documentation:** [RabbitMQ Prometheus Plugin](https://www.rabbitmq.com/docs/prometheus)

### Metrics Provided

The plugin provides **~60 critical RabbitMQ metrics** including:

**Queue Metrics:**
- `rabbitmq_queue_messages_ready` - Messages ready for delivery
- `rabbitmq_queue_messages_unacked` - Unacknowledged messages
- `rabbitmq_queue_messages` - Total messages in queue
- `rabbitmq_queue_consumers` - Active consumers per queue

**Message Flow:**
- `rabbitmq_queue_messages_published_total` - Total messages published
- `rabbitmq_queue_messages_delivered_total` - Total messages delivered
- `rabbitmq_queue_messages_acked_total` - Total messages acknowledged
- `rabbitmq_queue_messages_redelivered_total` - Total redelivered messages

**Connection Metrics:**
- `rabbitmq_connections` - Total connections
- `rabbitmq_channels` - Total channels
- `rabbitmq_connections_opened_total` - Connection open events
- `rabbitmq_channels_opened_total` - Channel open events

**Resource Utilization:**
- `rabbitmq_node_mem_used` - RabbitMQ memory usage
- `rabbitmq_node_fd_used` - File descriptors used
- `rabbitmq_node_sockets_used` - Network sockets used
- `rabbitmq_node_proc_used` - Erlang processes used

**Node Health:**
- `rabbitmq_node_uptime` - Node uptime in milliseconds
- `rabbitmq_node_disk_free` - Free disk space
- `rabbitmq_node_mem_alarm` - Memory alarm status
- `rabbitmq_node_disk_alarm` - Disk alarm status

### Why Deploy rabbitmq_prometheus?

While the application tracks **128+ custom metrics**, the RabbitMQ plugin provides:

1. **Broker-Level Visibility** - Internal RabbitMQ statistics not available via AMQP
2. **Zero Code Changes** - Enable via configuration only
3. **Standard Metrics** - Industry-standard naming conventions
4. **Real-Time Updates** - Sub-second metric updates
5. **Cluster Awareness** - Multi-node cluster metrics

**Metrics Expansion:** 148 (current) + 60 (rabbitmq_prometheus) = **~208 total metrics**

---

## Deployment Options

### Option A: Enable Plugin in Existing Container (RECOMMENDED)

Best for: All Docker Compose deployments (development, staging, production).

**Advantages:**
- No additional containers required
- Uses RabbitMQ's built-in plugin system
- Minimal configuration changes
- Low resource overhead

**Implementation:**

#### Step 1: Update RabbitMQ Configuration

Edit `scripts/rabbitmq.conf`:

```conf

# RabbitMQ Configuration
# Optimized for birthday message scheduler

# Clustering

cluster_formation.peer_discovery_backend = rabbit_peer_discovery_classic_config
cluster_formation.classic_config.nodes.1 = rabbit@localhost

# Memory and Disk

vm_memory_high_watermark.relative = 0.6
disk_free_limit.absolute = 2GB

# Persistence

queue_master_locator = min-masters

# Quorum Queues (default settings)
# Provides zero data loss via Raft consensus

raft.wal_max_size_bytes = 1048576

# Performance

channel_max = 2048
heartbeat = 60

# Management Plugin

management.tcp.port = 15672
management.load_definitions = /etc/rabbitmq/definitions.json

# ============================================
# Prometheus Plugin Configuration (NEW)
# ============================================
# Enable Prometheus metrics endpoint

prometheus.tcp.port = 15692
prometheus.path = /metrics

# Return per-object metrics (queues, exchanges, connections, channels)

prometheus.return_per_object_metrics = true

# Metric aggregation settings
# Possible values: basic, detailed, per_object

prometheus.aggregation.level = detailed

# Logging

log.console = true
log.console.level = info
log.file.level = info
```

#### Step 2: Update docker-compose.yml

```yaml
services:
  # RabbitMQ 3.13+ with Management and Prometheus Plugins
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    container_name: birthday-app-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: rabbitmq
      RABBITMQ_DEFAULT_PASS: rabbitmq_dev_password
      RABBITMQ_DEFAULT_VHOST: /
      # Enable Quorum Queues for zero data loss
      RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS: -rabbit quorum_cluster_size 1
    ports:
      - "5672:5672"   # AMQP port
      - "15672:15672" # Management UI
      - "15692:15692" # Prometheus metrics (NEW)
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
      - ./scripts/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - birthday-app-network
```

#### Step 3: Enable the Plugin

**Method 1: Using Dockerfile (Build-time)**

Create `Dockerfile.rabbitmq`:

```dockerfile
FROM rabbitmq:3.13-management-alpine

# Enable Prometheus plugin

RUN rabbitmq-plugins enable --offline rabbitmq_prometheus

# Copy custom configuration

COPY scripts/rabbitmq.conf /etc/rabbitmq/rabbitmq.conf
```

Update docker-compose.yml:

```yaml
rabbitmq:
  build:
    context: .
    dockerfile: Dockerfile.rabbitmq
  # ... rest of configuration ...
```

**Method 2: Using docker exec (Runtime)**

```bash

# Start RabbitMQ container

docker-compose up -d rabbitmq

# Enable Prometheus plugin

docker exec birthday-app-rabbitmq rabbitmq-plugins enable rabbitmq_prometheus

# Verify plugin is enabled

docker exec birthday-app-rabbitmq rabbitmq-plugins list

# Restart container to apply changes

docker-compose restart rabbitmq
```

**Method 3: Using enabled_plugins File**

Create `scripts/enabled_plugins`:

```erlang
[rabbitmq_management,rabbitmq_prometheus,rabbitmq_management_agent].
```

Mount in docker-compose.yml:

```yaml
volumes:
  - rabbitmq_data:/var/lib/rabbitmq
  - ./scripts/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
  - ./scripts/enabled_plugins:/etc/rabbitmq/enabled_plugins:ro
```

#### Step 4: Verify Installation

```bash

# Check plugin status

docker exec birthday-app-rabbitmq rabbitmq-plugins list | grep prometheus

# Expected output:
# [E*] rabbitmq_prometheus      3.13.0

# Test metrics endpoint

curl http://localhost:15692/metrics

# Expected output: Prometheus-formatted metrics
# # TYPE rabbitmq_queue_messages gauge
# rabbitmq_queue_messages{queue="birthday_notifications"} 42.0

```

---

### Option B: Production Cluster Configuration

Best for: Production deployments with RabbitMQ clustering.

**Implementation:**

Update `docker-compose.prod.yml`:

```yaml

# RabbitMQ node template with Prometheus

x-rabbitmq-node: &rabbitmq-node
  image: rabbitmq:3.13-management-alpine
  restart: unless-stopped
  environment:
    RABBITMQ_ERLANG_COOKIE: ${RABBITMQ_ERLANG_COOKIE:-birthday_cluster_secret}
    RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
    RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
  volumes:
    - ./scripts/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
    - ./scripts/enabled_plugins:/etc/rabbitmq/enabled_plugins:ro
  networks:
    - birthday-network
  healthcheck:
    test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
  logging:
    driver: "json-file"
    options:
      max-size: "50m"
      max-file: "5"
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 512M
      reservations:
        cpus: '0.5'
        memory: 256M

services:
  # RabbitMQ Cluster Node 1 (Primary)
  rabbitmq-1:
    <<: *rabbitmq-node
    container_name: birthday-rabbitmq-1
    hostname: rabbitmq-1
    environment:
      RABBITMQ_ERLANG_COOKIE: ${RABBITMQ_ERLANG_COOKIE:-birthday_cluster_secret}
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
      RABBITMQ_DEFAULT_VHOST: /
    ports:
      - "5672:5672"   # AMQP
      - "15672:15672" # Management UI
      - "15692:15692" # Prometheus metrics
    volumes:
      - rabbitmq_1_data:/var/lib/rabbitmq
      - ./scripts/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
      - ./scripts/enabled_plugins:/etc/rabbitmq/enabled_plugins:ro

  # RabbitMQ Cluster Node 2
  rabbitmq-2:
    <<: *rabbitmq-node
    container_name: birthday-rabbitmq-2
    hostname: rabbitmq-2
    ports:
      - "5673:5672"
      - "15673:15672"
      - "15693:15692" # Prometheus metrics
    volumes:
      - rabbitmq_2_data:/var/lib/rabbitmq
      - ./scripts/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
      - ./scripts/enabled_plugins:/etc/rabbitmq/enabled_plugins:ro
    depends_on:
      rabbitmq-1:
        condition: service_healthy

  # RabbitMQ Cluster Node 3
  rabbitmq-3:
    <<: *rabbitmq-node
    container_name: birthday-rabbitmq-3
    hostname: rabbitmq-3
    ports:
      - "5674:5672"
      - "15674:15672"
      - "15694:15692" # Prometheus metrics
    volumes:
      - rabbitmq_3_data:/var/lib/rabbitmq
      - ./scripts/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
      - ./scripts/enabled_plugins:/etc/rabbitmq/enabled_plugins:ro
    depends_on:
      rabbitmq-1:
        condition: service_healthy
```

---

## Configuration

### Plugin Configuration Options

Edit `scripts/rabbitmq.conf` to customize Prometheus metrics:

```conf

# ============================================
# Prometheus Plugin Configuration
# ============================================

# Prometheus HTTP endpoint settings

prometheus.tcp.port = 15692
prometheus.tcp.ip = 0.0.0.0
prometheus.path = /metrics

# Return per-object metrics (queues, exchanges, etc.)
# Setting to false reduces cardinality but loses per-queue visibility

prometheus.return_per_object_metrics = true

# Metric aggregation level
# Options: basic, detailed, per_object
# - basic: Only node-level aggregates
# - detailed: Include per-vhost aggregates
# - per_object: Full granularity (queues, exchanges, connections)

prometheus.aggregation.level = detailed

# Enable/disable specific metric families

prometheus.metrics.node.enabled = true
prometheus.metrics.queue.enabled = true
prometheus.metrics.exchange.enabled = true
prometheus.metrics.connection.enabled = true
prometheus.metrics.channel.enabled = true

# Metric prefix (default: rabbitmq_)

prometheus.prefix = rabbitmq_

# Labels to add to all metrics

prometheus.global_labels.environment = production
prometheus.global_labels.cluster = birthday-cluster
prometheus.global_labels.datacenter = us-east-1
```

### Metric Families

Control which metrics are exported:

```conf

# Node metrics (memory, disk, CPU)

prometheus.metrics.node.enabled = true

# Queue metrics (messages, consumers)

prometheus.metrics.queue.enabled = true

# Exchange metrics (publishes, routing)

prometheus.metrics.exchange.enabled = true

# Connection metrics (clients, channels)

prometheus.metrics.connection.enabled = true

# Channel metrics (publishes, deliveries)

prometheus.metrics.channel.enabled = true

# Erlang VM metrics (processes, memory)

prometheus.metrics.erlang_vm.enabled = true
```

### Advanced Configuration

**Reduce Cardinality:**

```conf

# Disable per-object metrics for high-volume deployments

prometheus.return_per_object_metrics = false

# Use basic aggregation (lowest cardinality)

prometheus.aggregation.level = basic

# Disable connection/channel metrics (highest cardinality)

prometheus.metrics.connection.enabled = false
prometheus.metrics.channel.enabled = false
```

**Security Configuration:**

```conf

# Bind to localhost only (requires reverse proxy)

prometheus.tcp.ip = 127.0.0.1

# Use custom port

prometheus.tcp.port = 9419

# Enable SSL/TLS

prometheus.ssl.port = 15691
prometheus.ssl.certfile = /etc/rabbitmq/ssl/cert.pem
prometheus.ssl.keyfile = /etc/rabbitmq/ssl/key.pem
prometheus.ssl.cacertfile = /etc/rabbitmq/ssl/ca.pem
```

### Authentication Setup

By default, the Prometheus endpoint is unauthenticated. To enable authentication:

**Option 1: Use RabbitMQ Management API Auth**

```conf

# Require management plugin authentication

prometheus.require_auth = true
```

Access with credentials:
```bash
curl -u rabbitmq:rabbitmq_password http://localhost:15692/metrics
```

**Option 2: Use Reverse Proxy (Nginx)**

```nginx

# /etc/nginx/sites-available/rabbitmq-metrics

server {
    listen 9419;
    server_name rabbitmq-metrics.internal;

    location /metrics {
        auth_basic "RabbitMQ Metrics";
        auth_basic_user_file /etc/nginx/.htpasswd;

        proxy_pass http://rabbitmq:15692/metrics;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Prometheus Integration

### Scrape Configuration

Add to `prometheus/prometheus.yml`:

```yaml
scrape_configs:
  # Birthday Scheduler Application
  - job_name: 'birthday-scheduler'
    static_configs:
      - targets: ['app:3000']
    scrape_interval: 15s

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 30s

  # RabbitMQ Prometheus Plugin (Development)
  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']
        labels:
          instance: 'rabbitmq-dev'
          environment: 'development'
          cluster: 'standalone'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: /metrics

  # RabbitMQ Cluster (Production)
  - job_name: 'rabbitmq-cluster'
    static_configs:
      - targets:
          - 'rabbitmq-1:15692'
          - 'rabbitmq-2:15692'
          - 'rabbitmq-3:15692'
        labels:
          environment: 'production'
          cluster: 'birthday-prod-cluster'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: /metrics
    # Optional: Add authentication
    # basic_auth:
    #   username: rabbitmq
    #   password: rabbitmq_password
```

### Service Discovery (Kubernetes)

For Kubernetes deployments:

```yaml
scrape_configs:
  - job_name: 'kubernetes-rabbitmq'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
            - birthday-app
    relabel_configs:
      # Only scrape pods with app=rabbitmq label
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: rabbitmq
      # Use pod IP and Prometheus port
      - source_labels: [__address__]
        action: replace
        regex: ([^:]+)(?::\d+)?
        replacement: $1:15692
        target_label: __address__
      # Set instance to pod name
      - source_labels: [__meta_kubernetes_pod_name]
        target_label: instance
      # Set cluster label
      - source_labels: [__meta_kubernetes_namespace]
        target_label: cluster
```

### Metric Relabeling

Filter or transform metrics during scraping:

```yaml
scrape_configs:
  - job_name: 'rabbitmq'
    static_configs:
      - targets: ['rabbitmq:15692']
    metric_relabel_configs:
      # Drop metrics with specific queue names
      - source_labels: [queue]
        regex: 'temp_.*'
        action: drop

      # Rename queue label to queue_name
      - source_labels: [queue]
        target_label: queue_name
        action: replace

      # Add application label
      - target_label: application
        replacement: birthday-scheduler
```

### Verification

```bash

# Check RabbitMQ metrics endpoint

curl http://localhost:15692/metrics

# Verify metrics format

curl http://localhost:15692/metrics | grep rabbitmq_queue_messages

# Check Prometheus targets

curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="rabbitmq")'

# Query a metric

curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=rabbitmq_queue_messages{queue="birthday_notifications"}'
```

---

## Sample Queries

### Queue Depth Monitoring

```promql

# Messages ready for delivery per queue

rabbitmq_queue_messages_ready{queue="birthday_notifications"}

# Total messages in queue (ready + unacked)

rabbitmq_queue_messages{queue="birthday_notifications"}

# Unacknowledged messages

rabbitmq_queue_messages_unacked{queue="birthday_notifications"}

# Dead letter queue depth

rabbitmq_queue_messages{queue="birthday_notifications_dlq"}

# Queue depth trend (last 5 minutes)

delta(rabbitmq_queue_messages{queue="birthday_notifications"}[5m])
```

### Message Rates

```promql

# Message publish rate (messages/second)

rate(rabbitmq_queue_messages_published_total{queue="birthday_notifications"}[5m])

# Message delivery rate (messages/second)

rate(rabbitmq_queue_messages_delivered_total{queue="birthday_notifications"}[5m])

# Message acknowledgment rate

rate(rabbitmq_queue_messages_acked_total{queue="birthday_notifications"}[5m])

# Message redelivery rate (indicates consumer failures)

rate(rabbitmq_queue_messages_redelivered_total{queue="birthday_notifications"}[5m])

# Message throughput (publish + deliver)

rate(rabbitmq_queue_messages_published_total{queue="birthday_notifications"}[5m])
+ rate(rabbitmq_queue_messages_delivered_total{queue="birthday_notifications"}[5m])
```

### Consumer Utilization

```promql

# Active consumers per queue

rabbitmq_queue_consumers{queue="birthday_notifications"}

# Consumer utilization (should be between 0.9 and 1.0)

rabbitmq_queue_consumer_utilisation{queue="birthday_notifications"}

# Queues with no consumers (alert condition)

rabbitmq_queue_consumers == 0

# Consumer capacity (messages not yet acknowledged)

rabbitmq_queue_messages_unacked{queue="birthday_notifications"}
/ rabbitmq_queue_consumers{queue="birthday_notifications"}
```

### Connection and Channel Metrics

```promql

# Total connections

rabbitmq_connections

# Connections per node

rabbitmq_connections{node="rabbit@rabbitmq-1"}

# Connection churn rate (high values indicate connection issues)

rate(rabbitmq_connections_opened_total[5m])
+ rate(rabbitmq_connections_closed_total[5m])

# Total channels

rabbitmq_channels

# Channels per connection (average)

rabbitmq_channels / rabbitmq_connections

# Channel errors

rate(rabbitmq_channel_errors_total[5m])
```

### Node Resource Utilization

```promql

# Memory usage in bytes

rabbitmq_node_mem_used

# Memory usage percentage

(rabbitmq_node_mem_used / rabbitmq_node_mem_limit) * 100

# Memory alarm status (1=alarm active, 0=normal)

rabbitmq_node_mem_alarm

# Disk free space

rabbitmq_node_disk_free

# Disk alarm status

rabbitmq_node_disk_alarm

# File descriptors used

rabbitmq_node_fd_used

# File descriptor utilization percentage

(rabbitmq_node_fd_used / rabbitmq_node_fd_total) * 100

# Erlang processes used

rabbitmq_node_proc_used

# Erlang process utilization

(rabbitmq_node_proc_used / rabbitmq_node_proc_total) * 100
```

### Queue Performance Metrics

```promql

# Average message processing time
# (Time between publish and ack)

(
  rate(rabbitmq_queue_messages_acked_total[5m])
  / rate(rabbitmq_queue_messages_published_total[5m] offset 5m)
) * 300

# Queue backlog (messages waiting)

rabbitmq_queue_messages_ready

# Queue saturation (ready messages / consumers)

rabbitmq_queue_messages_ready{queue="birthday_notifications"}
/ rabbitmq_queue_consumers{queue="birthday_notifications"}

# Message age (oldest message in queue, if available)

rabbitmq_queue_message_stats_age_seconds{queue="birthday_notifications"}
```

### Cluster Health

```promql

# Node uptime (milliseconds)

rabbitmq_node_uptime

# Running nodes count

count(rabbitmq_node_uptime > 0)

# Partitioned nodes (network split)

rabbitmq_node_partitions

# Quorum queue leader elections

rate(rabbitmq_queue_leader_changes_total[5m])
```

### Business Metrics

```promql

# Birthday notification delivery rate

rate(rabbitmq_queue_messages_delivered_total{queue="birthday_notifications"}[1h])

# Failed message rate (messages to DLQ)

rate(rabbitmq_queue_messages_published_total{queue="birthday_notifications_dlq"}[5m])

# Success rate percentage

(
  rate(rabbitmq_queue_messages_acked_total{queue="birthday_notifications"}[5m])
  /
  rate(rabbitmq_queue_messages_delivered_total{queue="birthday_notifications"}[5m])
) * 100

# Peak hour load (max messages in last 24 hours)

max_over_time(rabbitmq_queue_messages{queue="birthday_notifications"}[24h])
```

---

## Security Best Practices

### 1. Network Isolation

Restrict Prometheus endpoint access:

**Docker Network Isolation:**
```yaml
networks:
  monitoring:
    internal: true  # No external access

services:
  rabbitmq:
    networks:
      - birthday-app-network
      - monitoring  # Prometheus can access
```

**Firewall Rules:**
```bash

# Allow Prometheus server only

iptables -A INPUT -p tcp --dport 15692 -s 10.0.1.10 -j ACCEPT
iptables -A INPUT -p tcp --dport 15692 -j DROP
```

### 2. Enable Authentication

**Method 1: RabbitMQ Management Auth**
```conf

# scripts/rabbitmq.conf

prometheus.require_auth = true
```

Update Prometheus scrape config:
```yaml
scrape_configs:
  - job_name: 'rabbitmq'
    basic_auth:
      username: rabbitmq
      password: rabbitmq_password
    static_configs:
      - targets: ['rabbitmq:15692']
```

**Method 2: Reverse Proxy with TLS**
```nginx
server {
    listen 9419 ssl;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location /metrics {
        auth_basic "RabbitMQ Metrics";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://rabbitmq:15692/metrics;
    }
}
```

### 3. TLS Encryption

Enable SSL for metrics endpoint:

```conf

# scripts/rabbitmq.conf

prometheus.ssl.port = 15691
prometheus.ssl.certfile = /etc/rabbitmq/ssl/server_cert.pem
prometheus.ssl.keyfile = /etc/rabbitmq/ssl/server_key.pem
prometheus.ssl.cacertfile = /etc/rabbitmq/ssl/ca_cert.pem
prometheus.ssl.verify = verify_peer
prometheus.ssl.fail_if_no_peer_cert = true
```

Generate certificates:
```bash

# Using OpenSSL

openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout server_key.pem \
  -out server_cert.pem \
  -days 365 \
  -subj "/CN=rabbitmq.local"
```

### 4. Limit Metric Exposure

Reduce attack surface:

```conf

# Disable detailed metrics in production

prometheus.return_per_object_metrics = false
prometheus.aggregation.level = basic

# Disable connection/channel tracking

prometheus.metrics.connection.enabled = false
prometheus.metrics.channel.enabled = false
```

### 5. Regular Security Updates

```bash

# Update RabbitMQ image regularly

docker pull rabbitmq:3.13-management-alpine

# Check for security advisories

curl -s https://www.rabbitmq.com/news.html | grep -i security
```

### 6. Audit Logging

Enable audit logging for metric access:

```nginx

# Nginx access log for metrics endpoint

access_log /var/log/nginx/rabbitmq-metrics-access.log combined;
error_log /var/log/nginx/rabbitmq-metrics-error.log warn;
```

---

## Troubleshooting

### Plugin Not Enabled

**Symptom:** Port 15692 not accessible

**Solutions:**

```bash

# Check if plugin is enabled

docker exec birthday-app-rabbitmq rabbitmq-plugins list | grep prometheus

# Expected output:
# [E*] rabbitmq_prometheus

# If not enabled:

docker exec birthday-app-rabbitmq rabbitmq-plugins enable rabbitmq_prometheus

# Restart RabbitMQ

docker-compose restart rabbitmq

# Verify metrics endpoint

curl http://localhost:15692/metrics
```

### Port Conflict

**Symptom:** "Port already in use" error

**Solutions:**

```bash

# Check if port is in use

netstat -tulpn | grep 15692
lsof -i :15692

# Option 1: Use different port
# Edit rabbitmq.conf:

prometheus.tcp.port = 15693

# Option 2: Stop conflicting service

kill -9 <PID>
```

### No Metrics Returned

**Symptom:** Empty response from /metrics endpoint

**Solutions:**

```bash

# Check RabbitMQ logs

docker logs birthday-app-rabbitmq | grep -i prometheus

# Verify plugin is running

docker exec birthday-app-rabbitmq rabbitmq-diagnostics status | grep prometheus

# Check configuration syntax

docker exec birthday-app-rabbitmq rabbitmq-diagnostics check_config_schema

# Restart RabbitMQ

docker-compose restart rabbitmq
```

### High Cardinality Issues

**Symptom:** Prometheus running out of memory

**Solutions:**

```conf

# Reduce metric granularity

prometheus.return_per_object_metrics = false
prometheus.aggregation.level = basic

# Disable high-cardinality metrics

prometheus.metrics.connection.enabled = false
prometheus.metrics.channel.enabled = false

# Use metric relabeling in Prometheus

metric_relabel_configs:
  - source_labels: [queue]
    regex: 'temp_.*'
    action: drop
```

### Authentication Errors

**Symptom:** "401 Unauthorized" when scraping

**Solutions:**

```bash

# Test with credentials

curl -u rabbitmq:rabbitmq_password http://localhost:15692/metrics

# Check RabbitMQ users

docker exec birthday-app-rabbitmq rabbitmqctl list_users

# Verify Prometheus basic_auth configuration

cat prometheus/prometheus.yml | grep -A5 basic_auth

# Check RabbitMQ authentication

docker exec birthday-app-rabbitmq rabbitmqctl authenticate_user rabbitmq rabbitmq_password
```

### Memory Issues

**Symptom:** RabbitMQ memory alarm triggered

**Solutions:**

```conf

# Increase memory watermark

vm_memory_high_watermark.relative = 0.7

# Or use absolute value

vm_memory_high_watermark.absolute = 1GB

# Check current memory usage

docker exec birthday-app-rabbitmq rabbitmqctl status | grep memory
```

```bash

# Restart RabbitMQ after config change

docker-compose restart rabbitmq
```

### Cluster Metrics Missing

**Symptom:** Only seeing metrics from one node

**Solutions:**

```yaml

# Ensure all nodes are scraped

scrape_configs:
  - job_name: 'rabbitmq-cluster'
    static_configs:
      - targets:
          - 'rabbitmq-1:15692'
          - 'rabbitmq-2:15692'
          - 'rabbitmq-3:15692'

# Verify all nodes are running

docker exec birthday-rabbitmq-1 rabbitmqctl cluster_status

# Check network connectivity

docker exec birthday-rabbitmq-1 ping rabbitmq-2
```

### SSL/TLS Issues

**Symptom:** "SSL handshake failed" errors

**Solutions:**

```bash

# Verify certificate files exist

docker exec birthday-app-rabbitmq ls -la /etc/rabbitmq/ssl/

# Test SSL connection

openssl s_client -connect localhost:15691

# Check certificate validity

openssl x509 -in /etc/rabbitmq/ssl/cert.pem -noout -dates

# Verify certificate matches key

openssl x509 -noout -modulus -in cert.pem | openssl md5
openssl rsa -noout -modulus -in key.pem | openssl md5
```

### Performance Degradation

**Symptom:** RabbitMQ slow after enabling plugin

**Solutions:**

```conf

# Reduce scrape frequency

scrape_interval: 30s  # Instead of 15s

# Disable detailed aggregation

prometheus.aggregation.level = basic

# Limit metric families

prometheus.metrics.connection.enabled = false
prometheus.metrics.channel.enabled = false
```

---

## Next Steps

After successful deployment:

1. **Configure Prometheus Scraping** - See [Prometheus Integration](#prometheus-integration)
2. **Create Grafana Dashboards** - Import RabbitMQ dashboard templates
3. **Set Up Alerts** - Configure queue depth and consumer alerts
4. **Review Deployment Checklist** - Follow `exporter-deployment-checklist.md`
5. **Monitor Metrics** - Use sample queries to validate data

---

**Document Version:** 1.0
**Last Updated:** December 31, 2025
**Next Review:** March 31, 2026
**Maintained By:** Platform Engineering Team
