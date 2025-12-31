# Documentation Hub

Welcome to the Birthday Message Scheduler documentation! This directory contains all GitHub Pages documentation and resources.

## 📚 Available Pages

### Main Documentation

- **[index.html](index.html)** - API Documentation with Redoc (auto-generated)
- **[test-reports.html](test-reports.html)** - Comprehensive test reports and coverage
- **[coverage-trends.html](coverage-trends.html)** - Historical coverage visualization
- **[dashboards-index.html](dashboards-index.html)** - Grafana monitoring dashboards
- **[reports-summary.html](reports-summary.html)** - All quality and performance reports

### Data Files

- **[coverage-history.json](coverage-history.json)** - Historical coverage data
- **[coverage-badge.json](coverage-badge.json)** - Coverage badge metadata
- **[openapi.json](openapi.json)** - OpenAPI specification (auto-generated)

### Documentation

- **[MUTATION_TESTING.md](MUTATION_TESTING.md)** - Mutation testing setup and results
- **[GITHUB_PAGES_ENHANCEMENT.md](GITHUB_PAGES_ENHANCEMENT.md)** - Enhancement details

## 🎯 Quick Links

| Page | Description | Metrics |
|------|-------------|---------|
| **Test Reports** | All test suites and results | 460+ tests, 46 files |
| **Coverage Trends** | Code coverage over time | 95%+ coverage |
| **Dashboards** | Monitoring and metrics | 6 dashboards, 50+ metrics |
| **Reports Summary** | Quality and security reports | 8 report types |

## 🚀 Local Development

To preview the documentation locally:

```bash

# Navigate to docs directory

cd docs

# Start a local server

python3 -m http.server 8000

# Open in browser

open http://localhost:8000
```

## 📊 Coverage Data

Coverage history is automatically updated by the CI/CD pipeline:
- Updates on every push to main
- Stored in `coverage-history.json`
- Visualized in `coverage-trends.html`

## 🔄 Deployment

Documentation is automatically deployed to GitHub Pages via the `.github/workflows/docs.yml` workflow:

1. **Trigger**: Push to main branch
2. **Build**: Generate OpenAPI spec and run tests
3. **Update**: Refresh coverage history
4. **Deploy**: Publish to GitHub Pages

## 📈 Dashboard References

Grafana dashboards are stored in `../grafana/dashboards/`:
- `overview-dashboard.json` - System overview
- `api-performance.json` - API metrics
- `database.json` - PostgreSQL metrics
- `infrastructure.json` - System resources
- `message-processing.json` - RabbitMQ metrics
- `security.json` - Security monitoring

Alert rules are in `../grafana/alerts/`:
- `critical-alerts.yml` - Critical system alerts
- `warning-alerts.yml` - Warning level alerts
- `info-alerts.yml` - Informational alerts
- `slo-alerts.yml` - SLO violation alerts

## 🎨 Design System

All pages follow a consistent design system:
- **Primary Color**: Blue (#3b82f6)
- **Success Color**: Green (#10b981)
- **Warning Color**: Yellow (#f59e0b)
- **Error Color**: Red (#ef4444)
- **Background**: Dark theme (#0f172a)
- **Font**: Inter (Google Fonts)

## 📱 Responsive Design

All pages are fully responsive and tested on:
- Desktop (1920x1080, 1366x768)
- Tablet (768x1024)
- Mobile (375x667, 414x896)

## ♿ Accessibility

- WCAG 2.1 Level AA compliant
- Keyboard navigable
- Screen reader friendly
- High contrast support
- Semantic HTML

## 🔗 Navigation Structure

```
┌─────────────────────────────────────────┐
│           index.html (API Docs)         │
│  ┌─────┬──────────┬──────────┬────────┐│
│  │Tests│ Coverage │Dashboards│Reports ││
└──┴─────┴──────────┴──────────┴────────┴┘
    │        │           │          │
    ▼        ▼           ▼          ▼
  Tests   Coverage   Dashboards  Reports
  Report   Trends      Index     Summary
    │        │           │          │
    └────────┴───────────┴──────────┘
              Cross-linked
```

## 📝 File Sizes

| File | Size | Lines |
|------|------|-------|
| test-reports.html | ~25 KB | 751 |
| coverage-trends.html | ~38 KB | 1,052 |
| dashboards-index.html | ~22 KB | 653 |
| reports-summary.html | ~29 KB | 808 |
| **Total** | **~114 KB** | **3,264** |

## 🛠️ Technologies Used

- **Chart.js** 4.4.1 - Interactive charts
- **Redoc** - API documentation
- **Custom CSS** - No framework dependencies
- **Vanilla JavaScript** - No library dependencies (except charts)

## 📦 Dependencies

External CDN resources:
- Chart.js (charts)
- chartjs-adapter-date-fns (date handling)
- Redoc (API documentation)
- Google Fonts (Inter)

All other resources are self-contained.

## 🔐 Security

- No inline scripts (CSP compatible)
- HTTPS only
- No external data fetching (except CDN)
- No user input collection
- No cookies or tracking

## 🚧 Maintenance

### Weekly

- [ ] Verify all links work
- [ ] Check CI/CD pipeline status

### Monthly

- [ ] Review test count and coverage
- [ ] Update screenshots if needed
- [ ] Verify mobile responsiveness

### Quarterly

- [ ] Update dependencies
- [ ] Review and update metrics
- [ ] Audit accessibility

## 📞 Support

For issues or questions:
1. Check the [repository](https://github.com/fairyhunter13/happy-bday-app)
2. Review the [enhancement documentation](GITHUB_PAGES_ENHANCEMENT.md)
3. Open an issue on GitHub

## 📄 License

This documentation is part of the Birthday Message Scheduler project and follows the same license.

---

**Last Updated**: 2025-12-31
**Documentation Version**: 1.0
