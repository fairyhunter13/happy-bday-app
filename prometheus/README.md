# Prometheus Monitoring Setup

This directory contains Prometheus and Alertmanager configurations for the Birthday Message Scheduler application.

## Directory Structure

```
prometheus/
├── prometheus.yml       # Prometheus main configuration
├── alertmanager.yml     # Alertmanager routing and notification config
├── rules/              # Alert rule files
│   ├── critical-alerts.yml   # P0 critical alerts
│   ├── warning-alerts.yml    # P1 warning alerts
│   ├── info-alerts.yml       # P2 informational alerts
│   └── slo-alerts.yml        # SLO-based alerts
└── README.md           # This file
```

## Components

### Prometheus
- **Port**: 9090
- **Web UI**: http://localhost:9090
- **Retention**: 30 days
- **Scrape Interval**: 15 seconds
- **Evaluation Interval**: 15 seconds

### Alertmanager
- **Port**: 9093
- **Web UI**: http://localhost:9093
- **Version**: v0.26.0

## Alert Rule Categories

### Critical Alerts (P0)
**Location**: `rules/critical-alerts.yml`

Immediate action required. These indicate service-impacting issues:
- ServiceDown - Service health check failures
- HighErrorRate - Error rate >5%
- DatabaseConnectionPoolExhausted - No DB connections available
- QueueDepthCritical - >10,000 messages queued
- CircuitBreakerOpen - External service protection triggered
- DLQDepthHigh - >100 messages in dead letter queue
- HTTP5xxSpike - >100 server errors in 5 minutes
- OutOfMemoryRisk - >95% memory usage
- MessageDeliveryFailureCritical - >10% delivery failure rate
- DatabaseReplicationLagCritical - >30s replication lag

**Notification**: Email + Webhook, 1-hour repeat interval

### Warning Alerts (P1)
**Location**: `rules/warning-alerts.yml`

Action required within hours. Degraded performance or approaching thresholds:
- HighLatency - P99 latency >5 seconds
- MemoryUsageHigh - >80% memory usage
- QueueDepthHigh - >5,000 messages queued
- HighCPUUsage - >80% CPU usage
- DiskSpaceLow - <20% disk space remaining
- MessageDeliveryDelayed - >5 minute processing delay
- DatabaseConnectionsHigh - >80% connections used

**Notification**: Email, 6-hour repeat interval

### Info Alerts (P2)
**Location**: `rules/info-alerts.yml`

Informational, no immediate action needed:
- HighRequestRate - Unusual traffic spike
- SlowDatabaseQueries - P95 query latency >1s
- CacheMissRateHigh - >20% cache misses
- WorkerUtilizationLow - <30% worker utilization

**Notification**: Webhook only, 24-hour repeat interval

### SLO Alerts
**Location**: `rules/slo-alerts.yml`

Service Level Objective monitoring and error budget tracking:
- MessageDeliveryRateLow - <99% delivery rate (1h window)
- AvailabilitySLOBreach - <99.9% availability (24h window)
- LatencySLOBreach - P95 latency >2s (15m window)
- ErrorBudgetBurnRateCritical - Fast error budget consumption

**Notification**: Email to SRE team, 12-hour repeat interval

## Configuration

### Prometheus Configuration
The `prometheus.yml` file configures:
1. **Scrape Targets**: Application, database, RabbitMQ, Redis
2. **Alert Rules**: Loads all `.yml` files from `rules/` directory
3. **Alertmanager Integration**: Routes alerts to Alertmanager service
4. **Storage**: 30-day retention, 50GB max size

### Alertmanager Configuration
The `alertmanager.yml` file configures:
1. **Routing**: Alert severity-based routing (critical, warning, info)
2. **Inhibition**: Suppress lower-severity alerts when higher-severity fires
3. **Receivers**: Email and webhook notification channels
4. **Grouping**: Group alerts by service and instance

## Alert Routing

```
Critical (P0) → Email + Webhook → 1h repeat
    ↓
Warning (P1) → Email → 6h repeat
    ↓
Info (P2) → Webhook → 24h repeat
    ↓
SLO → Email (SRE team) → 12h repeat
```

## Inhibition Rules

1. **Critical suppresses Warning**: When critical alert fires for a service, suppress warnings for the same service
2. **Warning/Critical suppress Info**: Higher-severity alerts suppress informational alerts
3. **ServiceDown suppresses HighLatency**: No need to alert on latency when service is down
4. **ServiceDown suppresses Queue alerts**: Queue issues expected when service is down

## Usage

### Start Monitoring Stack
```bash
docker-compose up -d prometheus alertmanager grafana
```

### Verify Alert Rules
```bash
# Check if Prometheus loaded the rules
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].name'

# Expected output:
# "critical-alerts"
# "warning-alerts"
# "info-alerts"
# "slo-alerts"
```

### Test Alertmanager
```bash
# Send a test alert
curl -X POST http://localhost:9093/api/v1/alerts -H "Content-Type: application/json" -d '[
  {
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning",
      "service": "test"
    },
    "annotations": {
      "summary": "This is a test alert",
      "description": "Testing Alertmanager configuration"
    }
  }
]'

# Check active alerts
curl http://localhost:9093/api/v1/alerts | jq
```

### Reload Configuration
```bash
# Reload Prometheus configuration (without restart)
curl -X POST http://localhost:9090/-/reload

# Reload Alertmanager configuration
curl -X POST http://localhost:9093/-/reload
```

### View Active Alerts
```bash
# Prometheus active alerts
curl http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alertname: .labels.alertname, state: .state}'

# Alertmanager active alerts
curl http://localhost:9093/api/v1/alerts | jq '.data[] | {alertname: .labels.alertname, status: .status.state}'
```

## Accessing UIs

- **Prometheus**: http://localhost:9090
  - Alerts: http://localhost:9090/alerts
  - Targets: http://localhost:9090/targets
  - Configuration: http://localhost:9090/config

- **Alertmanager**: http://localhost:9093
  - Alerts: http://localhost:9093/#/alerts
  - Silences: http://localhost:9093/#/silences

- **Grafana**: http://localhost:3001
  - Dashboards: http://localhost:3001/dashboards
  - Alerting: http://localhost:3001/alerting

## Customization

### Adding New Alert Rules

1. Create or edit a rule file in `prometheus/rules/`:
```yaml
groups:
  - name: custom-alerts
    rules:
      - alert: MyCustomAlert
        expr: my_metric > threshold
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Custom alert summary"
          description: "Detailed description"
```

2. Reload Prometheus configuration:
```bash
docker-compose restart prometheus
# OR
curl -X POST http://localhost:9090/-/reload
```

### Adding New Receivers

1. Edit `prometheus/alertmanager.yml`
2. Add receiver configuration under `receivers:`
3. Add routing rule under `route.routes:`
4. Reload Alertmanager:
```bash
docker-compose restart alertmanager
# OR
curl -X POST http://localhost:9093/-/reload
```

## Troubleshooting

### Alert Rules Not Loading
```bash
# Check Prometheus logs
docker logs birthday-app-prometheus

# Validate rule files
docker exec birthday-app-prometheus promtool check rules /etc/prometheus/rules/*.yml
```

### Alerts Not Firing
```bash
# Check alert evaluation
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.state == "pending" or .state == "firing")'

# Check Alertmanager is reachable
curl http://localhost:9093/-/healthy
```

### Notifications Not Sent
```bash
# Check Alertmanager logs
docker logs birthday-app-alertmanager

# Check Alertmanager configuration
curl http://localhost:9093/api/v1/status | jq
```

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Alert Rule Best Practices](https://prometheus.io/docs/practices/alerting/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)
