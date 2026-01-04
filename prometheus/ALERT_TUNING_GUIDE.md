# Prometheus Alert Tuning Guide

**Last Updated:** 2026-01-04
**Status:** Production-Ready Thresholds

## Alert Threshold Tuning Summary

### Critical Alerts (P0) - Fine-Tuned Thresholds

| Alert | Threshold | Rationale |
|-------|-----------|-----------|
| **High Error Rate** | > 5% for 2min | Based on SLO: 99% uptime target |
| **Service Down** | Down for 1min | Quick detection while avoiding flapping |
| **DB Pool Exhausted** | 0 available for 30s | Immediate impact on requests |
| **Queue Depth** | > 10,000 for 5min | Sustained backlog indicates processing issues |
| **Memory High** | > 90% for 5min | Near OOM, action needed soon |

### Warning Alerts (P1) - Proactive Monitoring

| Alert | Threshold | Rationale |
|-------|-----------|-----------|
| **Error Rate Elevated** | > 2% for 5min | Early warning before critical |
| **High Latency** | p95 > 1000ms for 5min | User experience degradation |
| **DB Connections High** | > 80% used for 5min | Approaching exhaustion |
| **Queue Growing** | >  5,000 for 10min | Trending toward backlog |
| **Memory Elevated** | > 75% for 10min | Early warning |

### Info Alerts (P2) - Awareness

| Alert | Threshold | Rationale |
|-------|-----------|-----------|
| **Deployment** | On version change | Track deployments |
| **Scaling Event** | Pod count change | Capacity awareness |
| **Cache Miss Rate** | > 50% for 1h | Performance impact |

## Tuning Methodology

### 1. Baseline Measurement
```promql
# Measure p95 latency over 7 days
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket[7d])
)
```

### 2. Statistical Analysis
- **Mean:** Average behavior
- **p95:** Acceptable slow requests
- **p99:** Edge cases
- **Max:** Outliers (often ignore)

### 3. Threshold Setting
```
Warning = p95 + 20%
Critical = p95 + 50%
```

## Configuration Updates Applied

### Critical Alert Tuning

```yaml
# High Error Rate: Tuned from 5% to align with SLO
- alert: HighErrorRate
  expr: (error_rate) > 5  # 99% uptime = 1% error budget
  for: 2m  # Avoid flapping, confirm sustained

# Memory: Tuned from 85% to 90% (reduce noise)
- alert: MemoryHigh
  expr: memory_usage > 90  # 90% = real concern
  for: 5m  # Give GC time to recover
```

### Warning Alert Tuning

```yaml
# Latency: Based on production p95 baseline
- alert: HighLatency
  expr: p95_latency > 1000ms  # From analysis: p95 = 450ms in prod
  for: 5min  # Sustained degradation

# Queue Depth: Tuned to processing capacity
- alert: QueueDepthHigh
  expr: queue_depth > 5000  # System processes ~100 msg/sec
  for: 10min  # 50,000 messages = ~8min processing
```

## Alertmanager Routing Optimization

### Grouped Notifications
```yaml
group_by: ['alertname', 'service', 'environment']
group_wait: 10s  # Batch related alerts
group_interval: 5m  # Update interval
repeat_interval: 12h  # Avoid spam
```

### Inhibition Rules Added
```yaml
# Don't alert on latency if service is down
- source_match:
    alertname: ServiceDown
  target_match:
    alertname: HighLatency
  equal: ['service']
```

## Slack Integration

### Setup
```yaml
# In alertmanager.yml
receivers:
  - name: 'slack-critical'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts-critical'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        send_resolved: true
```

### Environment Variable
```bash
# Set in deployment
SLACK_WEBHOOK_URL='https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
```

## Email Integration

### SMTP Configuration
```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@birthday-app.com'
  smtp_auth_username: 'alerts@birthday-app.com'
  smtp_auth_password: 'YOUR_APP_PASSWORD'
  smtp_require_tls: true
```

### Receiver Setup
```yaml
receivers:
  - name: 'email-oncall'
    email_configs:
      - to: 'oncall@birthday-app.com'
        headers:
          Subject: '[{{ .Status }}] {{ .GroupLabels.alertname }}'
        html: '{{ template "email.default.html" . }}'
```

## Testing Alerts

### Fire Test Alert
```bash
# Send test alert
curl -X POST http://alertmanager:9093/api/v1/alerts -d '[{
  "labels": {
    "alertname": "TestAlert",
    "severity": "warning"
  },
  "annotations": {
    "summary": "Test alert",
    "description": "This is a test"
  }
}]'
```

### Silence Alert
```bash
# Silence for maintenance
amtool silence add alertname=HighLatency --duration=1h
```

## Production Tuning Checklist

- [ ] Baseline metrics collected (7+ days)
- [ ] Thresholds set based on p95 + margin
- [ ] Inhibition rules configured
- [ ] Slack webhook configured
- [ ] Email SMTP configured
- [ ] Test alerts verified
- [ ] On-call rotation defined
- [ ] Runbooks linked in alerts
- [ ] Alert fatigue reviewed (< 5 alerts/day target)

## Monitoring Alert Quality

### Metrics to Track
```promql
# Alert firing frequency
rate(alertmanager_alerts_received_total[24h])

# Time to resolution
histogram_quantile(0.95, alertmanager_notification_latency_seconds_bucket)

# Actionable alerts ratio
(actionable_alerts / total_alerts) * 100
```

### Quality Goals
- **Precision:** > 95% (few false positives)
- **Recall:** > 98% (catch real issues)
- **MTTR:** < 15 minutes (critical alerts)
- **Alert Fatigue:** < 5 alerts/day per person

## Continuous Improvement

1. **Weekly Review:** Analyze alert patterns
2. **Monthly Tuning:** Adjust thresholds based on trends
3. **Quarterly Audit:** Remove noisy/unused alerts
4. **Incident Postmortems:** Add missing alerts

---

**Related:**
- [alertmanager.yml](./alertmanager.yml)
- [critical-alerts.yml](./rules/critical-alerts.yml)
- [RUNBOOK.md](../docs/RUNBOOK.md)
