# Monitoring Stack - Quick Start Guide

This document provides a quick reference for starting and using the Birthday Scheduler monitoring stack.

## Stack Overview

The monitoring stack consists of:

- **Prometheus** (Port 9090) - Metrics collection and storage
- **Alertmanager** (Port 9093) - Alert routing and notification
- **Grafana** (Port 3001) - Metrics visualization and dashboards

## Quick Start

### 1. Start the Monitoring Stack

```bash
# Start all services (includes Prometheus, Alertmanager, and Grafana)
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 2. Access the Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana** | http://localhost:3001 | admin / grafana_dev_password |
| **Prometheus** | http://localhost:9090 | None required |
| **Alertmanager** | http://localhost:9093 | None required |

### 3. View Dashboards

1. Open http://localhost:3001
2. Login (or use anonymous access for read-only)
3. Navigate to "Dashboards" → "Birthday Scheduler" folder
4. Available dashboards:
   - **Overview Dashboard** (default home) - System-wide health
   - **API Performance** - HTTP API metrics
   - **Message Processing** - Queue and message metrics
   - **Database Performance** - PostgreSQL metrics
   - **Infrastructure Health** - Node.js process metrics
   - **Security** - Security events and authentication

## Service Details

### Prometheus

**Purpose**: Scrapes and stores metrics from the Birthday Scheduler application

**Configuration**: `/prometheus/prometheus.yml`

**Key Features**:
- 15-second scrape interval
- 30-day data retention
- Alert rule evaluation
- Integration with Alertmanager

**Useful URLs**:
- Targets: http://localhost:9090/targets
- Alerts: http://localhost:9090/alerts
- Config: http://localhost:9090/config

### Alertmanager

**Purpose**: Routes alerts to notification channels (email, webhook, etc.)

**Configuration**: `/prometheus/alertmanager.yml`

**Alert Routing**:
- **Critical (P0)**: Immediate notification, 1-hour repeat
- **Warning (P1)**: Standard notification, 6-hour repeat
- **Info (P2)**: Batched notification, 24-hour repeat
- **SLO Alerts**: Dedicated receiver, 12-hour repeat

**Alert Rules**: `/prometheus/rules/`
- `critical-alerts.yml` - P0 alerts (service down, DB connection pool exhausted)
- `warning-alerts.yml` - P1 alerts (high CPU, slow queries)
- `slo-alerts.yml` - SLO/SLI violations
- `info-alerts.yml` - P2 informational alerts

### Grafana

**Purpose**: Visualize metrics with pre-configured dashboards

**Configuration**: `/grafana/provisioning/`

**Features**:
- Auto-loaded dashboards from `/grafana/dashboards/`
- Pre-configured Prometheus datasource
- Anonymous read-only access enabled
- Default home dashboard: Overview

**Environment**:
- Admin user: `admin`
- Admin password: `grafana_dev_password`
- Root URL: http://localhost:3001

## Dashboard Provisioning

Grafana automatically loads dashboards on startup:

```
grafana/provisioning/
├── dashboards/
│   └── dashboards.yml          # Dashboard provider config
├── datasources/
│   └── datasources.yml         # Prometheus datasource config
└── README.md                   # Detailed provisioning guide

grafana/dashboards/             # Auto-loaded dashboard JSON files
├── overview-dashboard.json     # ✅ Loaded
├── api-performance.json        # ✅ Loaded
├── message-processing.json     # ✅ Loaded
├── database.json               # ✅ Loaded
├── infrastructure.json         # ✅ Loaded
└── security.json               # ✅ Loaded
```

**How it works**:
1. Grafana reads `/etc/grafana/provisioning/dashboards/dashboards.yml`
2. Scans `/var/lib/grafana/dashboards/` for `.json` files
3. Imports all dashboards into "Birthday Scheduler" folder
4. Updates dashboards every 10 seconds if files change

## Common Tasks

### Viewing Metrics in Prometheus

```bash
# Open Prometheus UI
open http://localhost:9090

# Example queries:
# - API request rate: rate(birthday_scheduler_api_requests_total[5m])
# - Error rate: rate(birthday_scheduler_api_requests_total{status=~"5.."}[5m])
# - Queue depth: birthday_scheduler_queue_depth
```

### Checking Alert Status

```bash
# View active alerts in Prometheus
open http://localhost:9090/alerts

# View alerts in Alertmanager
open http://localhost:9093/#/alerts

# Check alert rules
docker-compose exec prometheus promtool check rules /etc/prometheus/rules/*.yml
```

### Adding a Custom Dashboard

**Option 1: Via File (Recommended)**

1. Create dashboard JSON:
   ```bash
   cp grafana/dashboards/overview-dashboard.json grafana/dashboards/my-dashboard.json
   ```

2. Edit the JSON file

3. Wait 10 seconds - Grafana auto-loads it

**Option 2: Via UI**

1. Create dashboard in Grafana UI
2. Export JSON: Dashboard Settings → JSON Model
3. Save to `grafana/dashboards/my-dashboard.json`
4. Commit to version control

### Updating Alert Rules

1. Edit alert rule file:
   ```bash
   vim prometheus/rules/critical-alerts.yml
   ```

2. Validate syntax:
   ```bash
   docker-compose exec prometheus promtool check rules /etc/prometheus/rules/critical-alerts.yml
   ```

3. Reload Prometheus:
   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```

### Restarting Services

```bash
# Restart individual service
docker-compose restart grafana
docker-compose restart prometheus
docker-compose restart alertmanager

# Restart all monitoring services
docker-compose restart grafana prometheus alertmanager

# View logs
docker-compose logs -f grafana
docker-compose logs -f prometheus
docker-compose logs -f alertmanager
```

## Health Checks

### Verify All Services Healthy

```bash
# Check container status
docker-compose ps

# Should show:
# birthday-app-grafana        Up (healthy)
# birthday-app-prometheus     Up (healthy)
# birthday-app-alertmanager   Up (healthy)
```

### Individual Health Checks

```bash
# Prometheus
curl http://localhost:9090/-/healthy
# Response: Prometheus is Healthy.

# Alertmanager
curl http://localhost:9093/-/healthy
# Response: OK

# Grafana
curl http://localhost:3001/api/health
# Response: {"commit":"...","database":"ok","version":"10.2.2"}
```

### Check Prometheus Targets

```bash
# Open targets page
open http://localhost:9090/targets

# Verify targets are UP:
# - prometheus (localhost:9090)
# - birthday-scheduler-api (host.docker.internal:3000)
# - birthday-scheduler-workers (host.docker.internal:3001)
```

## Troubleshooting

### Dashboard Not Loading

**Problem**: Grafana shows empty "Birthday Scheduler" folder

**Solution**:
```bash
# Check volume mounts
docker-compose exec grafana ls -la /var/lib/grafana/dashboards

# Check provisioning config
docker-compose exec grafana cat /etc/grafana/provisioning/dashboards/dashboards.yml

# Check logs
docker-compose logs grafana | grep -i provision

# Restart Grafana
docker-compose restart grafana
```

### Prometheus Not Scraping Metrics

**Problem**: No data in Grafana or Prometheus shows targets as DOWN

**Solution**:
```bash
# Check Prometheus targets
open http://localhost:9090/targets

# Verify application exposes /metrics endpoint
curl http://localhost:3000/metrics

# Check Prometheus logs
docker-compose logs prometheus | grep -i error

# Verify network connectivity
docker-compose exec prometheus ping host.docker.internal
```

### Alerts Not Firing

**Problem**: Alert rule should fire but doesn't

**Solution**:
```bash
# Check alert rules are loaded
docker-compose exec prometheus promtool check rules /etc/prometheus/rules/*.yml

# View alert status in Prometheus
open http://localhost:9090/alerts

# Check Alertmanager connectivity
curl http://localhost:9093/api/v2/status

# Verify alert expression
# Go to Prometheus → Graph → Enter alert expression
```

### Grafana Datasource Not Working

**Problem**: Grafana shows "Data source not found"

**Solution**:
```bash
# Check Prometheus is running
docker-compose ps prometheus

# Test connectivity from Grafana
docker-compose exec grafana wget -O- http://prometheus:9090/api/v1/status/config

# Check datasource config
docker-compose exec grafana cat /etc/grafana/provisioning/datasources/datasources.yml

# Test datasource in Grafana UI
# Configuration → Data Sources → Prometheus → Test
```

## Data Persistence

### Volumes

The monitoring stack uses Docker volumes for persistence:

```yaml
volumes:
  prometheus_data:     # Prometheus TSDB (30 days retention)
  alertmanager_data:   # Alertmanager silences and state
  grafana_data:        # Grafana database and plugins
```

### Backup

```bash
# Backup Prometheus data
docker run --rm -v birthday-app_prometheus_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/prometheus-backup.tar.gz /data

# Backup Grafana data
docker run --rm -v birthday-app_grafana_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/grafana-backup.tar.gz /data

# Backup alert rules and configs
tar czf monitoring-configs.tar.gz prometheus/ grafana/
```

### Restore

```bash
# Restore Prometheus data
docker run --rm -v birthday-app_prometheus_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/prometheus-backup.tar.gz -C /

# Restore Grafana data
docker run --rm -v birthday-app_grafana_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/grafana-backup.tar.gz -C /

# Restart services
docker-compose restart prometheus grafana
```

## Production Checklist

Before deploying to production:

- [ ] Change Grafana admin password
- [ ] Disable anonymous access in Grafana
- [ ] Configure SMTP for alert notifications
- [ ] Set up proper alert receivers (PagerDuty, Slack, etc.)
- [ ] Enable HTTPS for Grafana
- [ ] Configure external authentication (OAuth, LDAP)
- [ ] Set up external database for Grafana (PostgreSQL)
- [ ] Configure remote storage for Prometheus (Thanos, Cortex)
- [ ] Review and adjust alert thresholds
- [ ] Set up backup automation
- [ ] Configure log aggregation
- [ ] Enable audit logging
- [ ] Set up monitoring for the monitoring stack

## Additional Resources

- **Grafana Provisioning Guide**: `/grafana/provisioning/README.md`
- **Dashboard Documentation**: `/grafana/dashboards/README.md`
- **Prometheus Configuration**: `/prometheus/prometheus.yml`
- **Alert Rules**: `/prometheus/rules/`
- **Grafana Docs**: https://grafana.com/docs/grafana/latest/
- **Prometheus Docs**: https://prometheus.io/docs/
- **Alertmanager Docs**: https://prometheus.io/docs/alerting/latest/alertmanager/

## Support

For help with:
- **Dashboards**: See `/grafana/dashboards/README.md`
- **Provisioning**: See `/grafana/provisioning/README.md`
- **Metrics**: See `/src/services/metrics.service.ts`
- **Application Monitoring**: See `/docs/RUNBOOK.md`

---

**Last Updated**: January 1, 2026
**Grafana Version**: 10.2.2
**Prometheus Version**: 2.48.0
**Alertmanager Version**: 0.26.0
