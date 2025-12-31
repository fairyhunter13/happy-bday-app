# 08. Operations & Deployment

This directory contains operational guides, deployment procedures, and infrastructure management documentation.

## Overview

Operational documentation covering GitHub secrets, exporter deployments, CI/CD maintenance, and production operations.

---

## Quick Navigation

### Start Here
- **GitHub Secrets:** [`github-secrets-verification.md`](./github-secrets-verification.md)
- **Exporter Deployment:** [`exporter-deployment-checklist.md`](./exporter-deployment-checklist.md)
- **Production Ops:** All deployment guides below

---

## Document Index

### GitHub Secrets & CI/CD

| Document | Description | Status |
|----------|-------------|--------|
| [`github-secrets-verification.md`](./github-secrets-verification.md) | GitHub secrets setup and verification guide | Final |

### Exporter Deployments

| Document | Description | Status |
|----------|-------------|--------|
| [`exporter-deployment-checklist.md`](./exporter-deployment-checklist.md) | Complete deployment checklist for all exporters | Final |
| [`postgres-exporter-deployment.md`](./postgres-exporter-deployment.md) | PostgreSQL exporter deployment guide | Final |
| [`rabbitmq-prometheus-deployment.md`](./rabbitmq-prometheus-deployment.md) | RabbitMQ exporter deployment guide | Final |

---

## Key Operations

### GitHub Secrets Management

**Required Secrets:**
- `DOCKERHUB_USERNAME` - Docker Hub authentication
- `DOCKERHUB_TOKEN` - Docker Hub token
- `CODECOV_TOKEN` - Code coverage reporting
- `SOPS_AGE_KEY` - Secret encryption key
- `ANTHROPIC_API_KEY` - AI service key (optional)

**Verification:**
```bash
# Run verification script
./scripts/verify-github-secrets.sh

# Check secrets via GitHub CLI
gh secret list
```

### Exporter Deployments

**Postgres Exporter:**
```bash
# Deploy to docker-compose
docker-compose -f docker-compose.prod.yml up -d postgres-exporter

# Verify metrics
curl http://localhost:9187/metrics
```

**RabbitMQ Exporter:**
```bash
# Deploy to docker-compose
docker-compose -f docker-compose.prod.yml up -d rabbitmq-exporter

# Verify metrics
curl http://localhost:9419/metrics
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Verify GitHub secrets configured
- [ ] Review environment variables
- [ ] Check Docker images built
- [ ] Validate configurations
- [ ] Run local tests

### Deployment
- [ ] Deploy exporters
- [ ] Verify metric collection
- [ ] Configure Grafana dashboards
- [ ] Set up alert rules
- [ ] Test end-to-end monitoring

### Post-Deployment
- [ ] Monitor system health
- [ ] Verify metrics accuracy
- [ ] Check alert notifications
- [ ] Update documentation
- [ ] Create runbook entries

---

## Production Operations

### Daily Operations
1. **Health Checks:** Monitor system health dashboards
2. **Log Review:** Check for errors and warnings
3. **Metric Validation:** Verify metrics collection
4. **Alert Management:** Respond to alerts

### Weekly Operations
1. **Performance Review:** Analyze performance trends
2. **Capacity Planning:** Review resource usage
3. **Security Audit:** Check security metrics
4. **Backup Verification:** Validate backup processes

### Monthly Operations
1. **Cost Analysis:** Review infrastructure costs
2. **Documentation Update:** Keep docs current
3. **Security Patches:** Apply updates
4. **Disaster Recovery Test:** Test recovery procedures

---

## Monitoring Integration

### Prometheus Targets
- **Postgres Exporter:** `:9187/metrics`
- **RabbitMQ Exporter:** `:9419/metrics`
- **Node Exporter:** `:9100/metrics`
- **Application:** `:3000/metrics`

### Grafana Dashboards
- Database Performance
- Message Queue Status
- Infrastructure Overview
- API Performance

---

## Troubleshooting

### Common Issues

**Exporter Not Running:**
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs postgres-exporter
docker-compose logs rabbitmq-exporter
```

**Metrics Not Appearing:**
```bash
# Test exporter endpoint
curl http://localhost:9187/metrics
curl http://localhost:9419/metrics

# Check Prometheus targets
open http://localhost:9090/targets
```

**GitHub Secrets Not Working:**
```bash
# Verify secrets exist
gh secret list

# Re-run verification
./scripts/verify-github-secrets.sh
```

---

## Security

### Secret Management
- All secrets stored in GitHub Secrets
- Encrypted with SOPS (AES-256)
- Rotated quarterly
- Never committed to git

### Access Control
- Secrets accessible only to CI/CD
- Production access limited
- Audit logs enabled
- Regular access reviews

---

## Related Documentation

### Architecture
- [`../02-architecture/docker-compose.md`](../02-architecture/docker-compose.md)
- [`../02-architecture/cicd-pipeline.md`](../02-architecture/cicd-pipeline.md)
- [`../02-architecture/monitoring.md`](../02-architecture/monitoring.md)

### Monitoring
- [`../07-monitoring/metrics-implementation-plan.md`](../07-monitoring/metrics-implementation-plan.md)
- [`../07-monitoring/grafana-dashboards-research.md`](../07-monitoring/grafana-dashboards-research.md)

### Core Documentation
- Runbook: [`/docs/RUNBOOK.md`](/docs/RUNBOOK.md)
- Deployment Guide: [`/docs/DEPLOYMENT_GUIDE.md`](/docs/DEPLOYMENT_GUIDE.md)
- Troubleshooting: [`/docs/TROUBLESHOOTING.md`](/docs/TROUBLESHOOTING.md)

---

## Emergency Procedures

### Service Outage
1. Check service health: `docker-compose ps`
2. Review logs: `docker-compose logs --tail=100`
3. Check metrics: Grafana dashboards
4. Escalate if needed

### Data Loss Prevention
1. Verify backups running
2. Check RabbitMQ persistence
3. Confirm database replication
4. Test restore procedures

### Security Incident
1. Rotate compromised secrets
2. Review access logs
3. Apply security patches
4. Document incident

---

## Automation

### CI/CD Workflows
- **Code Quality:** Linting, formatting, type checking
- **Testing:** Unit, integration, E2E tests
- **Security:** Dependency scanning, secret scanning
- **Deployment:** Docker build and push
- **Monitoring:** Metric validation

### Scheduled Tasks
- Daily health checks
- Weekly backups
- Monthly reports
- Quarterly reviews

---

## Support

### Documentation
- GitHub Secrets: [`github-secrets-verification.md`](./github-secrets-verification.md)
- Exporters: [`exporter-deployment-checklist.md`](./exporter-deployment-checklist.md)
- CI/CD: [`../02-architecture/cicd-pipeline.md`](../02-architecture/cicd-pipeline.md)

### External Resources
- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [SOPS Documentation](https://github.com/mozilla/sops)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Prometheus Exporters](https://prometheus.io/docs/instrumenting/exporters/)

---

**Last Updated:** 2025-12-31

**Status:** Production Ready
