# sync-docs

Comprehensive documentation sync after code changes.

## When to Run
- After modifying source code in `src/`
- After adding/modifying tests
- After changing configuration files
- After updating dependencies
- After adding/modifying GitHub workflows
- Before ending a significant coding session

## Documentation Sync Tasks

### 1. README.md Updates
Check and update if changes affect:
- **Project structure** (directories changed)
- **Test statistics** (tests added/modified, coverage changed)
- **Quick start commands** (setup changed)
- **Tech stack** (dependencies changed)
- **Key features** (functionality changed)
- **API endpoints** (API changed)
- **GitHub badges** (workflow status, coverage badges)
- **Quick Links table** (documentation URLs)

#### GitHub Badges in README.md
The README.md includes **6 categories of badges** that must stay synchronized (28 total badges):

1. **CI/CD Pipeline Status Badges** (6 badges):
   - CI, Unit Tests, Integration Tests, E2E Tests, Chaos Tests, Performance Tests
   - Format: `[![Name](https://github.com/{owner}/{repo}/actions/workflows/{file}.yml/badge.svg)]({workflow-url})`

2. **Build & Deployment Badges** (2 badges):
   - Docker Build and Push, Deploy Documentation

3. **Code Quality & Security Badges** (6 badges):
   - Code Quality, Security Scanning, **Snyk Security** (NEW), SonarCloud, Quality Gate Status, Mutation Testing
   - **Note:** Snyk badge added (SNYK_TOKEN is configured)

4. **Coverage & Validation Badges** (3 badges):
   - Code Coverage (dynamic from GitHub Pages: `coverage-badge.json`)
   - Code Duplication (<5% threshold)
   - OpenAPI Validation
   - Format: `[![Coverage](https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json)](...)`

5. **Tech Stack Badges** (8 badges):
   - Node.js, TypeScript, Fastify, PostgreSQL, RabbitMQ
   - Docker, Prometheus, Grafana
   - Update when dependencies change in `package.json`

6. **Documentation & Resources Badges** (3 badges):
   - API Documentation (GitHub Pages: `https://fairyhunter13.github.io/happy-bday-app/`)
   - Coverage Trends (GitHub Pages: `https://fairyhunter13.github.io/happy-bday-app/coverage-trends.html`)
   - GitHub Pages status

**Badge Sync Checklist:**
- [ ] Workflow badges match actual workflow files in `.github/workflows/`
- [ ] Workflow badge names match the `name:` field in each workflow file
- [ ] Coverage badge URL points to GitHub Pages: `https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json`
- [ ] GitHub Pages URL is correct: `https://fairyhunter13.github.io/happy-bday-app/`
- [ ] Tech stack versions match `package.json` and `docker-compose.yml`
- [ ] Documentation links point to correct GitHub Pages URLs
- [ ] All badge links are functional (no 404s)
- [ ] Snyk badge is present (SNYK_TOKEN is configured)
- [ ] SonarCloud badges link to correct project dashboard

### 2. docs/ Updates
Update relevant files if changes affect:
- `docs/RUNBOOK.md` - Operational procedures
- `docs/METRICS.md` - Metrics documentation
- `docs/DEPLOYMENT_GUIDE.md` - Deployment steps
- `docs/vendor-specs/` - API specifications
- `docs/coverage-trends.html` - Coverage visualization
- `docs/test-reports.html` - Test results summary
- `docs/dashboards-index.html` - Grafana dashboards index
- `docs/reports-summary.html` - Comprehensive reports
- `docs/coverage-badge.json` - Dynamic coverage badge (auto-generated)
- `docs/coverage-history.json` - Coverage trend data (auto-generated)
- `docs/openapi.json` - API specification (auto-generated)

### 3. plan/ Updates
Update relevant files if changes affect:
- `plan/01-requirements/*.md` - Requirements changes
- `plan/02-architecture/*.md` - Architecture changes
- `plan/03-research/*.md` - Research findings
- `plan/04-testing/*.md` - Test approach changes
- `plan/05-implementation/master-plan.md` - Implementation status
- `plan/09-reports/GAP_ANALYSIS_REPORT.md` - Gap status

### 4. INDEX.md Updates
- Update `plan/*/INDEX.md` files to list all files in each directory
- Ensure `docs/README.md` index is current

### 5. GitHub Pages Documentation Site
The project uses **GitHub Pages** for live documentation at: `https://fairyhunter13.github.io/happy-bday-app/`

**Deployed Content** (via `.github/workflows/docs.yml`):
- **API Documentation** (`index.html`) - Redoc-rendered OpenAPI spec
  - URL: `https://fairyhunter13.github.io/happy-bday-app/`
- **Coverage Trends** (`coverage-trends.html`) - Historical coverage visualization
  - URL: `https://fairyhunter13.github.io/happy-bday-app/coverage-trends.html`
- **Test Reports** (`test-reports.html`) - Test execution summaries
  - URL: `https://fairyhunter13.github.io/happy-bday-app/test-reports.html`
- **Dashboards Index** (`dashboards-index.html`) - Grafana dashboard catalog
  - URL: `https://fairyhunter13.github.io/happy-bday-app/dashboards-index.html`
- **Reports Summary** (`reports-summary.html`) - Comprehensive report hub
  - URL: `https://fairyhunter13.github.io/happy-bday-app/reports-summary.html`
- **OpenAPI Spec** (`openapi.json`) - Machine-readable API specification
  - URL: `https://fairyhunter13.github.io/happy-bday-app/openapi.json`
- **Coverage Badge** (`coverage-badge.json`) - Dynamic badge endpoint
  - URL: `https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json`
- **Coverage History** (`coverage-history.json`) - Trend data
  - URL: `https://fairyhunter13.github.io/happy-bday-app/coverage-history.json`
- **Grafana Dashboards** (`grafana/dashboards/*.json`) - Dashboard definitions
- **Alert Rules** (`grafana/alerts/*.yml`) - Prometheus alert rules

**GitHub Pages Sync Tasks:**
1. Verify all HTML pages in `docs/` are included in deployment workflow
2. Check navigation links in `index.html` point to correct pages
3. **CRITICAL:** Ensure coverage badge endpoint URL in README.md is correct:
   - `https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json`
4. **CRITICAL:** Ensure all GitHub Pages URLs in README.md use the correct base URL:
   - `https://fairyhunter13.github.io/happy-bday-app/`
5. Validate OpenAPI spec generates successfully (`npm run openapi:spec`)
6. Confirm coverage history updates automatically on CI runs
7. Verify "Quick Links" table in README.md has correct GitHub Pages URLs

**Deployment Triggers:**
- Pushes to `main` branch that affect:
  - `src/**` (code changes)
  - `docs/**` (documentation updates)
  - `public/**` (static assets)
  - `scripts/coverage/**` (coverage scripts)
  - `.github/workflows/docs.yml` (workflow changes)
- Manual workflow dispatch

### 6. GitHub Workflow Badge Synchronization

**Workflow Badge Maintenance:**
When adding/modifying/removing workflows in `.github/workflows/`:

1. **Add New Workflow Badge to README.md:**
   ```markdown
   [![Workflow Name](https://github.com/{owner}/{repo}/workflows/{Workflow%20Name}/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/{workflow-file}.yml)
   ```

2. **Update Workflow Status Table** (if applicable)
   - Add row to "CI/CD Workflows" section
   - Include workflow name, purpose, and trigger conditions

3. **Verify Badge Rendering:**
   - Check badge displays correctly on GitHub
   - Ensure link navigates to workflow runs
   - Confirm badge updates after workflow execution

**Current Workflow Badges (9 workflows, 28 total badges in README):**

**Actual Workflow Files** (verify these match README.md badges):
1. CI - `.github/workflows/ci.yml` (name: "CI")
2. Code Quality - `.github/workflows/code-quality.yml` (name: "Code Quality")
3. Security Scanning - `.github/workflows/security.yml` (name: "Security Scanning")
4. Performance Tests - `.github/workflows/performance.yml` (name: "Performance Tests")
5. Docker Build - `.github/workflows/docker-build.yml` (name: "Docker Build and Push")
6. OpenAPI Validation - `.github/workflows/openapi-validation.yml` (name: "OpenAPI Validation")
7. Deploy Documentation - `.github/workflows/docs.yml` (name: "Deploy Documentation")
8. Mutation Testing - `.github/workflows/mutation.yml` (name: "Mutation Testing")
9. SonarCloud - `.github/workflows/sonar.yml` (name: "SonarCloud")

**Badge Status Verification:**
- [ ] All workflow files exist in `.github/workflows/`
- [ ] Badge names match workflow `name:` field
- [ ] Badge URLs use correct workflow file names
- [ ] Workflow links navigate to Actions tab correctly

### 7. Coverage Badge Synchronization

**Coverage Badge Flow:**
1. **Test Execution:** CI runs `npm run test:coverage`
2. **History Update:** `scripts/coverage/update-history.sh` generates:
   - `docs/coverage-badge.json` - Shields.io endpoint format
   - `docs/coverage-history.json` - Trend data for charts
3. **GitHub Pages Deploy:** Documentation workflow publishes to GitHub Pages
4. **Badge Rendering:** README.md badge fetches from deployed JSON endpoint

**Coverage Badge Update Protocol:**
1. Run tests with coverage: `npm run test:coverage`
2. Update coverage history: `./scripts/coverage/update-history.sh`
3. Commit updated JSON files to `docs/` directory
4. Push to trigger GitHub Pages deployment
5. Verify badge updates on README.md (may take 1-2 minutes)

**Coverage Badge Maintenance:**
- Badge URL format: `https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json`
- Badge data auto-updates on every CI run (main branch)
- Manual update: run coverage script and commit changes
- Badge color thresholds: <60% red, 60-80% yellow, >80% green

### 8. Snyk Security Badge Configuration

**Snyk Integration Status:**
The project has Snyk security scanning configured via `.github/workflows/security.yml` with `SNYK_TOKEN` secret.

**Badge Availability Check:**
1. Check if `SNYK_TOKEN` is configured in GitHub Secrets:
   - Run: `gh secret list | grep SNYK_TOKEN`
   - Or check: GitHub repo > Settings > Secrets > Actions
2. If configured: Snyk badge should be present in README.md
3. If not configured: Skip Snyk badge (npm audit badge is sufficient)

**Snyk Badge Format** (already added to README.md):
```markdown
[![Snyk Security](https://img.shields.io/snyk/vulnerabilities/github/fairyhunter13/happy-bday-app?logo=snyk)](https://snyk.io/test/github/fairyhunter13/happy-bday-app)
```

**Alternative Security Badges** (if Snyk not configured):
- NPM Audit badge (always available):
  ```markdown
  [![NPM Audit](https://img.shields.io/badge/npm%20audit-passing-brightgreen?logo=npm)](https://github.com/fairyhunter13/happy-bday-app/actions/workflows/security.yml)
  ```

**Security Badge Sync Checklist:**
- [x] SNYK_TOKEN secret is configured (verified)
- [x] Snyk badge added to README.md (completed)
- [ ] Verify Snyk badge links to correct project dashboard
- [ ] Ensure Security Scanning workflow badge is present
- [ ] Confirm npm audit badge is present as fallback

## Protocol
1. **IDENTIFY** modified files this session (use `git status` / `git diff`)
2. **DETERMINE** which docs need updates based on changes
3. **UPDATE** each affected file comprehensively
4. **VERIFY** cross-references and badge links are valid
5. **CHECK** GitHub Pages content is synchronized
6. **VALIDATE** workflow badges match actual workflows
7. **CONFIRM** coverage badge endpoint is accessible

## Verification Checklist
- [ ] README.md badges match actual workflows in `.github/workflows/`
- [ ] Workflow badge names match the `name:` field in each workflow file
- [ ] GitHub Pages URLs are correct: `https://fairyhunter13.github.io/happy-bday-app/`
- [ ] Coverage badge endpoint is deployed and rendering: `coverage-badge.json`
- [ ] Coverage badge URL in README.md points to GitHub Pages endpoint
- [ ] GitHub Pages documentation link is present in "Quick Links" table
- [ ] All documentation links return 200 (not 404)
- [ ] Test statistics in README.md match actual test counts
- [ ] Tech stack versions match package.json
- [x] Snyk badge is present (SNYK_TOKEN is configured and badge added)
- [ ] SonarCloud badges link to correct project dashboard
- [ ] INDEX.md files list all current documents
- [ ] Cross-references between docs are valid

## Execution
Analyze the recent changes and update all affected documentation. Be thorough but focused - only update docs that are actually affected by the changes made.

**Priority Order:**
1. **Verify GitHub Pages URLs** in README.md (CRITICAL):
   - Base URL: `https://fairyhunter13.github.io/happy-bday-app/`
   - Coverage badge: `https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json`
   - Coverage trends: `https://fairyhunter13.github.io/happy-bday-app/coverage-trends.html`
   - Quick Links table entries

2. **Update README.md badges** if workflows changed:
   - Verify all 9 workflow badges match actual workflow files
   - Check workflow badge names match the `name:` field
   - Ensure badge URLs use correct workflow file names

3. **Update coverage badge** if test coverage changed:
   - Verify endpoint URL is correct
   - Check badge color thresholds

4. **Check Snyk badge** configuration:
   - Verify if SNYK_TOKEN secret is configured
   - Add/remove Snyk badge accordingly

5. **Update GitHub Pages content** if docs/ changed:
   - Verify all HTML files are deployed
   - Check navigation links

6. **Update plan/ documentation** if architecture/requirements changed

7. **Update INDEX.md files** if new documents were added
