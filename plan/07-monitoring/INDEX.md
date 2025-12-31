# 07. Monitoring & Observability

This directory contains all monitoring, metrics, and observability documentation for the Happy Birthday App.

## Overview

Comprehensive monitoring strategy including Prometheus metrics, Grafana dashboards, alert rules, and performance tracking.

---

## Quick Navigation

### Start Here
- **Metrics Strategy:** [`metrics-strategy-research.md`](./metrics-strategy-research.md)
- **Implementation Plan:** [`metrics-implementation-plan.md`](./metrics-implementation-plan.md)
- **Grafana Dashboards:** [`grafana-dashboards-research.md`](./grafana-dashboards-research.md)

---

## Document Index

### Metrics Strategy

| Document | Description | Status |
|----------|-------------|--------|
| [`metrics-strategy-research.md`](./metrics-strategy-research.md) | 100% observability blueprint (100+ metrics) | Final |
| [`metrics-implementation-plan.md`](./metrics-implementation-plan.md) | Implementation roadmap and plan | Final |
| [`metrics-expansion-plan.md`](./metrics-expansion-plan.md) | Future metrics expansion strategy | Final |

### Grafana Dashboards

| Document | Description | Status |
|----------|-------------|--------|
| [`grafana-dashboards-research.md`](./grafana-dashboards-research.md) | Dashboard research and specifications | Final |
| [`grafana-dashboard-specifications.md`](./grafana-dashboard-specifications.md) | Detailed dashboard specifications | Final |

**Note:** Dashboard JSON files are located in `/grafana/dashboards/` directory:
- `api-performance.json` - API performance dashboard
- `database.json` - Database monitoring dashboard
- `infrastructure.json` - Infrastructure overview dashboard
- `message-processing.json` - Message queue processing dashboard
- `security.json` - Security monitoring dashboard

### Alert Rules

| Document | Description | Status |
|----------|-------------|--------|
| [`alert-rules-enhancements.md`](./alert-rules-enhancements.md) | Alert rules and SLO definitions | Final |

**Note:** Alert rule YAML files are located in `/grafana/alerts/` directory.

---

## Key Features

### Metrics Coverage
- **100+ Prometheus metrics** across all system components
- Real-time performance tracking
- Business metrics (messages sent, birthdays processed)
- Technical metrics (latency, throughput, errors)

### Grafana Dashboards
- **6 comprehensive dashboards:**
  1. API Performance
  2. Database Monitoring
  3. Infrastructure Overview
  4. Message Processing
  5. Security Dashboard
  6. Business Metrics

### Alert Rules
- **4 severity levels:** Critical, Warning, Info, SLO
- Coverage: API, Database, Queue, Workers, Infrastructure
- Integration with Prometheus Alertmanager

---

## Quick Start

### View Metrics
```bash
# Access Prometheus
open http://localhost:9090

# Access Grafana
open http://localhost:3000
```

### Key Metrics to Monitor

**API Performance:**
- `http_request_duration_ms` - Request latency
- `http_requests_total` - Total requests
- `http_request_errors_total` - Error count

**Message Queue:**
- `rabbitmq_queue_messages` - Queue depth
- `message_processing_duration_ms` - Processing time
- `message_delivery_success_total` - Success count

**Database:**
- `db_query_duration_ms` - Query performance
- `db_connection_pool_size` - Connection pool usage
- `db_active_connections` - Active connections

---

## Monitoring Stack

### Components
- **Prometheus:** Metrics collection and storage
- **Grafana:** Visualization and dashboards
- **Node Exporter:** System metrics
- **Postgres Exporter:** Database metrics
- **RabbitMQ Exporter:** Queue metrics
- **Custom Exporters:** Application metrics

### Architecture
```
Application → Prometheus → Grafana
     ↓           ↓
  Exporters   Alertmanager
```

---

## Related Documentation

### Architecture
- [`../02-architecture/monitoring.md`](../02-architecture/monitoring.md)

### Operations
- [`../08-operations/postgres-exporter-deployment.md`](../08-operations/postgres-exporter-deployment.md)
- [`../08-operations/rabbitmq-prometheus-deployment.md`](../08-operations/rabbitmq-prometheus-deployment.md)

### Testing
- [`../04-testing/performance-testing-guide.md`](../04-testing/performance-testing-guide.md)

---

## Maintenance

### Regular Tasks
- Review dashboard accuracy weekly
- Update alert thresholds monthly
- Archive old metrics data quarterly
- Update documentation as system evolves

### Performance Tuning
- Monitor Prometheus storage usage
- Optimize query performance
- Adjust scrape intervals as needed
- Review retention policies

---

## Support

### Documentation
- Metrics Strategy: [`metrics-strategy-research.md`](./metrics-strategy-research.md)
- Implementation: [`metrics-implementation-plan.md`](./metrics-implementation-plan.md)
- Dashboards: [`grafana-dashboards-research.md`](./grafana-dashboards-research.md)

### External Resources
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Node Exporter](https://github.com/prometheus/node_exporter)
- [Postgres Exporter](https://github.com/prometheus-community/postgres_exporter)

---

**Last Updated:** 2025-12-31

**Status:** Production Ready
