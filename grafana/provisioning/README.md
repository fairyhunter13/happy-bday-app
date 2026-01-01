# Grafana Provisioning Configuration

This directory contains Grafana provisioning configurations that automatically load dashboards and datasources when Grafana starts.

## Directory Structure

```
grafana/provisioning/
├── dashboards/
│   └── dashboards.yml       # Dashboard provider configuration
├── datasources/
│   └── datasources.yml      # Prometheus datasource configuration
└── README.md                # This file

grafana/dashboards/          # Dashboard JSON files (auto-loaded)
├── overview-dashboard.json
├── api-performance.json
├── message-processing.json
├── database.json
├── infrastructure.json
└── security.json

grafana/alerts/              # Alert rule definitions
├── critical-alerts.yml
├── warning-alerts.yml
├── slo-alerts.yml
└── info-alerts.yml
```

## Configuration Files

### 1. dashboards.yml

Configures Grafana to automatically load all dashboard JSON files from `/var/lib/grafana/dashboards`.

**Key Settings:**
- **folder**: 'Birthday Scheduler' - Dashboards appear in this folder
- **updateIntervalSeconds**: 10 - Checks for changes every 10 seconds
- **allowUiUpdates**: true - Allows editing dashboards via UI
- **disableDeletion**: false - Allows deleting dashboards

### 2. datasources.yml

Pre-configures Prometheus as the default datasource for Grafana.

**Key Settings:**
- **URL**: http://prometheus:9090
- **isDefault**: true - Set as the default datasource
- **httpMethod**: POST - Use POST for better query handling
- **manageAlerts**: true - Enable alert management
- **queryTimeout**: 60s - Query timeout
- **timeInterval**: 15s - Default scrape interval

## How Provisioning Works

### Startup Process

1. **Grafana Container Starts**
   ```
   docker-compose up -d grafana
   ```

2. **Grafana Reads Provisioning Configs**
   - Scans `/etc/grafana/provisioning/` (mounted from `./grafana/provisioning/`)
   - Loads datasource configurations from `datasources/datasources.yml`
   - Loads dashboard provider configurations from `dashboards/dashboards.yml`

3. **Dashboards Auto-Loaded**
   - Scans `/var/lib/grafana/dashboards/` (mounted from `./grafana/dashboards/`)
   - Imports all `.json` files as dashboards
   - Places dashboards in the "Birthday Scheduler" folder

4. **Prometheus Datasource Configured**
   - Creates "Prometheus" datasource
   - Points to http://prometheus:9090
   - Sets as default datasource

### Docker Compose Mounts

From `docker-compose.yml`:

```yaml
grafana:
  volumes:
    # Grafana data persistence
    - grafana_data:/var/lib/grafana
    # Provisioning configurations
    - ./grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards:ro
    - ./grafana/provisioning/datasources:/etc/grafana/provisioning/datasources:ro
    # Dashboard JSON files
    - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
    # Alert rules
    - ./grafana/alerts:/var/lib/grafana/alerts:ro
```

## Usage

### Starting the Monitoring Stack

```bash
# Start all services (Prometheus, Alertmanager, Grafana)
docker-compose up -d

# View Grafana logs
docker-compose logs -f grafana

# Check Grafana health
curl http://localhost:3001/api/health
```

### Accessing Grafana

**URL**: http://localhost:3001

**Default Credentials**:
- Username: `admin`
- Password: `grafana_dev_password`

**Anonymous Access**: Enabled (Viewer role)
- No login required for viewing dashboards
- Read-only access

### Viewing Dashboards

1. **Navigate to Dashboards**
   - Click "Dashboards" in the left sidebar
   - Select "Birthday Scheduler" folder
   - Choose a dashboard:
     - Overview Dashboard (default home)
     - API Performance
     - Message Processing
     - Database Performance
     - Infrastructure Health
     - Security

2. **Using Variables**
   - Select namespace (production, staging, etc.)
   - Filter by instance (pod/container)
   - Adjust time interval for aggregation
   - Use dashboard-specific filters (path, queue, table)

## Adding New Dashboards

### Method 1: File-Based (Recommended for Version Control)

1. **Export Dashboard JSON**
   ```bash
   # From Grafana UI: Dashboard Settings → JSON Model → Copy
   # Or export via API
   curl -H "Authorization: Bearer $API_KEY" \
     http://localhost:3001/api/dashboards/uid/overview-dashboard \
     | jq .dashboard > new-dashboard.json
   ```

2. **Save to dashboards/ Directory**
   ```bash
   cp new-dashboard.json grafana/dashboards/my-custom-dashboard.json
   ```

3. **Wait for Auto-Reload**
   - Grafana checks for changes every 10 seconds
   - Dashboard appears in "Birthday Scheduler" folder

### Method 2: UI-Based (For Quick Prototyping)

1. Create dashboard in Grafana UI
2. Save dashboard
3. Export JSON via "Dashboard Settings → JSON Model"
4. Save JSON to `grafana/dashboards/` for persistence

**Note**: Dashboards created via UI will be lost on container restart unless exported.

## Updating Dashboards

### Updating Existing Dashboard

1. **Edit JSON File**
   ```bash
   vim grafana/dashboards/api-performance.json
   ```

2. **Grafana Auto-Reloads**
   - Changes detected within 10 seconds
   - Dashboard updates automatically

### Best Practices

- **Version Control**: Commit all dashboard JSON files to Git
- **Backup Before Editing**: Copy dashboard JSON before making changes
- **Validate JSON**: Use `jq` or `python -m json.tool` to validate syntax
- **Test Changes**: Test in development environment first
- **Document Changes**: Add comments in panel descriptions

## Datasource Configuration

### Prometheus Datasource Settings

Configured in `datasources/datasources.yml`:

```yaml
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
    jsonData:
      httpMethod: POST
      queryTimeout: 60s
      timeInterval: 15s
```

### Adding Additional Datasources

1. **Edit datasources.yml**
   ```yaml
   datasources:
     - name: Prometheus
       type: prometheus
       url: http://prometheus:9090
       isDefault: true

     - name: Loki
       type: loki
       url: http://loki:3100
       isDefault: false
   ```

2. **Restart Grafana**
   ```bash
   docker-compose restart grafana
   ```

## Troubleshooting

### Dashboards Not Loading

**Symptoms**: Dashboards folder empty or dashboards missing

**Solutions**:

1. **Check Volume Mounts**
   ```bash
   docker-compose exec grafana ls -la /var/lib/grafana/dashboards
   docker-compose exec grafana ls -la /etc/grafana/provisioning/dashboards
   ```

2. **Verify JSON Syntax**
   ```bash
   jq . grafana/dashboards/overview-dashboard.json
   ```

3. **Check Grafana Logs**
   ```bash
   docker-compose logs grafana | grep -i provision
   docker-compose logs grafana | grep -i dashboard
   ```

4. **Restart Grafana**
   ```bash
   docker-compose restart grafana
   ```

### Datasource Not Connected

**Symptoms**: "Data source not found" or "Bad Gateway"

**Solutions**:

1. **Verify Prometheus is Running**
   ```bash
   docker-compose ps prometheus
   curl http://localhost:9090/-/healthy
   ```

2. **Check Network Connectivity**
   ```bash
   docker-compose exec grafana ping prometheus
   docker-compose exec grafana wget -O- http://prometheus:9090/api/v1/status/config
   ```

3. **Verify Datasource Configuration**
   ```bash
   docker-compose exec grafana cat /etc/grafana/provisioning/datasources/datasources.yml
   ```

4. **Test Datasource in Grafana UI**
   - Go to Configuration → Data Sources → Prometheus
   - Click "Test" button
   - Should show "Data source is working"

### Dashboard Variables Not Working

**Symptoms**: Variables show "No data" or incorrect values

**Solutions**:

1. **Check Metric Availability**
   ```bash
   # Query Prometheus directly
   curl 'http://localhost:9090/api/v1/label/namespace/values'
   curl 'http://localhost:9090/api/v1/label/instance/values'
   ```

2. **Verify Application Metrics**
   - Ensure application is exposing metrics at `/metrics`
   - Check Prometheus is scraping the target
   - Visit http://localhost:9090/targets

3. **Update Variable Query**
   - Edit dashboard JSON
   - Update `templating.list[].query` with correct metric name

### Permissions Issues

**Symptoms**: "Permission denied" errors in logs

**Solutions**:

1. **Fix Directory Permissions**
   ```bash
   chmod -R 755 grafana/provisioning
   chmod -R 644 grafana/provisioning/**/*.yml
   chmod -R 644 grafana/dashboards/*.json
   ```

2. **Check Docker User**
   ```bash
   docker-compose exec grafana id
   # Should show uid=472(grafana)
   ```

## Environment Variables

Grafana configuration via environment variables in `docker-compose.yml`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `GF_SECURITY_ADMIN_USER` | admin | Admin username |
| `GF_SECURITY_ADMIN_PASSWORD` | grafana_dev_password | Admin password |
| `GF_SERVER_ROOT_URL` | http://localhost:3001 | Grafana URL |
| `GF_AUTH_ANONYMOUS_ENABLED` | true | Allow anonymous viewing |
| `GF_AUTH_ANONYMOUS_ORG_ROLE` | Viewer | Anonymous user role |
| `GF_PATHS_PROVISIONING` | /etc/grafana/provisioning | Provisioning path |
| `GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH` | /var/lib/grafana/dashboards/overview-dashboard.json | Default home dashboard |
| `GF_DATABASE_WAL` | true | Enable WAL for better performance |
| `GF_DATAPROXY_TIMEOUT` | 60 | Datasource proxy timeout |

## Production Considerations

### Security

1. **Change Default Password**
   ```yaml
   environment:
     GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
   ```

2. **Disable Anonymous Access**
   ```yaml
   GF_AUTH_ANONYMOUS_ENABLED: 'false'
   ```

3. **Enable HTTPS**
   ```yaml
   GF_SERVER_PROTOCOL: https
   GF_SERVER_CERT_FILE: /etc/grafana/certs/cert.pem
   GF_SERVER_CERT_KEY: /etc/grafana/certs/key.pem
   ```

4. **Use External Authentication**
   - Configure OAuth, LDAP, or SAML
   - See https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/

### Performance

1. **Increase Query Timeout for Complex Dashboards**
   ```yaml
   GF_DATAPROXY_TIMEOUT: 120
   ```

2. **Enable Query Caching**
   ```yaml
   GF_DATAPROXY_CACHE_TTL: 60
   ```

3. **Use Recording Rules in Prometheus**
   - Pre-compute expensive queries
   - Reduce dashboard load time

### High Availability

1. **External Database**
   - Use PostgreSQL/MySQL instead of SQLite
   ```yaml
   GF_DATABASE_TYPE: postgres
   GF_DATABASE_HOST: postgres:5432
   GF_DATABASE_NAME: grafana
   GF_DATABASE_USER: grafana
   GF_DATABASE_PASSWORD: ${DB_PASSWORD}
   ```

2. **Persistent Storage**
   - Use external volume for `grafana_data`
   - Backup dashboards and configs regularly

3. **Load Balancing**
   - Run multiple Grafana instances
   - Use shared database
   - Configure session storage (Redis)

## Additional Resources

- **Grafana Provisioning Documentation**: https://grafana.com/docs/grafana/latest/administration/provisioning/
- **Dashboard Best Practices**: https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/
- **Prometheus Integration**: https://grafana.com/docs/grafana/latest/datasources/prometheus/
- **Project Dashboard Documentation**: `/grafana/dashboards/README.md`

## Support

For issues related to:
- **Dashboards**: See `/grafana/dashboards/README.md`
- **Alerts**: See `/grafana/alerts/` YAML files
- **Prometheus**: See `/prometheus/prometheus.yml`
- **Metrics**: See `/src/services/metrics.service.ts`

---

**Last Updated**: January 1, 2026
**Grafana Version**: 10.2.2
**Provisioning API Version**: 1
