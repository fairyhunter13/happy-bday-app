# Prometheus & Alertmanager Quick Start Guide

This guide will help you get Prometheus and Alertmanager up and running quickly.

## Prerequisites

- Docker and Docker Compose installed
- Birthday Message Scheduler application configured

## Quick Start

### 1. Start the Monitoring Stack

```bash
# Start Prometheus, Alertmanager, and Grafana
docker-compose up -d prometheus alertmanager grafana

# Verify services are running
docker-compose ps prometheus alertmanager grafana
```

Expected output:
```
NAME                          STATUS    PORTS
birthday-app-prometheus       Up        0.0.0.0:9090->9090/tcp
birthday-app-alertmanager     Up        0.0.0.0:9093->9093/tcp
birthday-app-grafana          Up        0.0.0.0:3001->3000/tcp
```

### 2. Verify Alert Rules Loaded

```bash
# Check Prometheus loaded the alert rules
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].name'
```

Expected output:
```
"critical-alerts"
"warning-alerts"
"info-alerts"
"slo-alerts"
```

### 3. Access the UIs

Open in your browser:

- **Prometheus**: http://localhost:9090
  - View alerts: http://localhost:9090/alerts
  - View targets: http://localhost:9090/targets

- **Alertmanager**: http://localhost:9093
  - View alerts: http://localhost:9093/#/alerts

- **Grafana**: http://localhost:3001
  - Username: `admin`
  - Password: `grafana_dev_password`

### 4. Test Alert Rules

You can test alerts by sending a test notification to Alertmanager:

```bash
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[
    {
      "labels": {
        "alertname": "TestAlert",
        "severity": "warning",
        "service": "test-service"
      },
      "annotations": {
        "summary": "This is a test alert",
        "description": "Testing Alertmanager notification routing"
      },
      "startsAt": "2024-01-01T00:00:00Z"
    }
  ]'
```

Then check if the alert appears in Alertmanager:
```bash
curl http://localhost:9093/api/v1/alerts | jq '.data[] | {alertname: .labels.alertname, status: .status.state}'
```

## Validation Results

All configurations have been validated:

### Prometheus Configuration
```
✓ prometheus.yml is valid
✓ Alert rules loaded successfully:
  - 10 critical alerts (P0)
  - 12 warning alerts (P1)
  - 13 info alerts (P2)
  - 11 SLO alerts
```

### Alertmanager Configuration
```
✓ alertmanager.yml is valid
✓ 6 receivers configured
✓ 4 inhibition rules active
✓ Route tree configured
```

## Alert Categories

### Critical Alerts (P0) - Immediate Action
These fire when:
- Service is down (>1 minute)
- Error rate >5%
- Database connection pool exhausted
- Queue depth >10,000 messages
- Memory usage >95%
- Message delivery failure >10%

**Action**: Immediate investigation required
**Notification**: Email + Webhook, repeat every 1 hour

### Warning Alerts (P1) - Action Within Hours
These fire when:
- P99 latency >5 seconds
- Memory usage >80%
- Queue depth >5,000 messages
- CPU usage >80%
- Disk space <20%

**Action**: Investigation within business hours
**Notification**: Email, repeat every 6 hours

### Info Alerts (P2) - Informational
These fire when:
- High request rate (traffic spike)
- Slow database queries (P95 >1s)
- Cache miss rate >20%
- Low worker utilization

**Action**: Monitor, no immediate action
**Notification**: Webhook only, repeat every 24 hours

### SLO Alerts - Error Budget Tracking
These fire when:
- Message delivery rate <99% (1h window)
- Availability <99.9% (24h window)
- P95 latency >2s (15m window)
- Fast error budget consumption

**Action**: SRE review and optimization
**Notification**: Email to SRE team, repeat every 12 hours

## Common Tasks

### View Active Alerts
```bash
# Prometheus perspective
curl http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {name: .labels.alertname, state: .state}'

# Alertmanager perspective
curl http://localhost:9093/api/v1/alerts | jq '.data[] | {name: .labels.alertname, status: .status.state}'
```

### Silence an Alert
```bash
# Create a silence (4 hours)
curl -X POST http://localhost:9093/api/v1/silences \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [
      {
        "name": "alertname",
        "value": "HighLatency",
        "isRegex": false
      }
    ],
    "startsAt": "2024-01-01T00:00:00Z",
    "endsAt": "2024-01-01T04:00:00Z",
    "createdBy": "admin",
    "comment": "Maintenance window"
  }'
```

### Reload Configuration (Without Restart)
```bash
# Reload Prometheus
curl -X POST http://localhost:9090/-/reload

# Reload Alertmanager
curl -X POST http://localhost:9093/-/reload
```

### Check Health
```bash
# Prometheus health
curl http://localhost:9090/-/healthy

# Alertmanager health
curl http://localhost:9093/-/healthy

# Prometheus readiness
curl http://localhost:9090/-/ready
```

## Troubleshooting

### Prometheus Not Starting
```bash
# Check logs
docker logs birthday-app-prometheus

# Validate configuration
docker run --rm -v /Users/hafizputraludyanto/git/github.com/fairyhunter13/happy-bday-app/prometheus:/config \
  --entrypoint=/bin/promtool prom/prometheus:v2.48.0 \
  check config /config/prometheus.yml
```

### Alert Rules Not Loading
```bash
# Check if rules directory is mounted
docker exec birthday-app-prometheus ls -la /etc/prometheus/rules

# Validate rule files
docker run --rm -v /Users/hafizputraludyanto/git/github.com/fairyhunter13/happy-bday-app/prometheus:/config \
  --entrypoint=/bin/promtool prom/prometheus:v2.48.0 \
  check rules /config/rules/critical-alerts.yml
```

### Alerts Not Firing
```bash
# Check alert evaluation status
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.state != "inactive")'

# Test PromQL expression
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=up{job="birthday-scheduler"}'
```

### Notifications Not Sent
```bash
# Check Alertmanager is receiving alerts
curl http://localhost:9093/api/v1/alerts

# Check Alertmanager configuration
docker exec birthday-app-alertmanager cat /etc/alertmanager/alertmanager.yml

# Check Alertmanager logs
docker logs birthday-app-alertmanager
```

## Next Steps

1. **Configure Application Metrics**
   - Ensure your application exposes metrics at `/metrics` endpoint
   - Update `prometheus.yml` with correct service endpoints

2. **Set Up Grafana Dashboards**
   - Import pre-built dashboards from `grafana/dashboards/`
   - Create custom dashboards for your specific metrics

3. **Configure Real Notifications**
   - Update `alertmanager.yml` with real email SMTP settings
   - Add PagerDuty, Slack, or other webhook integrations

4. **Customize Alert Rules**
   - Adjust thresholds based on your SLOs
   - Add application-specific alerts
   - Fine-tune alert sensitivity

## File Structure

```
prometheus/
├── prometheus.yml           # Main Prometheus config
├── alertmanager.yml         # Alertmanager config
├── rules/                   # Alert rule files
│   ├── critical-alerts.yml  # P0 alerts
│   ├── warning-alerts.yml   # P1 alerts
│   ├── info-alerts.yml      # P2 alerts
│   └── slo-alerts.yml       # SLO alerts
├── README.md                # Detailed documentation
└── QUICKSTART.md            # This file
```

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Alert Rule Best Practices](https://prometheus.io/docs/practices/alerting/)
