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
The README.md includes **4 categories of badges** that must stay synchronized:

1. **CI/CD Status Badges** (9 workflows):
   - CI, Code Quality, Security Scanning, Performance Tests
   - Docker Build, OpenAPI Validation, Deploy Documentation
   - Mutation Testing, SonarCloud Analysis
   - Format: `[![Name](https://github.com/{owner}/{repo}/workflows/{Name}/badge.svg)]({workflow-url})`

2. **Quality & Coverage Badges** (3 badges):
   - Coverage (dynamic from GitHub Pages: `coverage-badge.json`)
   - Code Duplication (<5% threshold)
   - SonarCloud Quality Gate
   - Format: `[![Coverage](https://img.shields.io/endpoint?url=https://{user}.github.io/{repo}/coverage-badge.json)](...)`

3. **Tech Stack Badges** (8 badges):
   - Node.js, TypeScript, Fastify, PostgreSQL, RabbitMQ
   - Docker, Prometheus, Grafana
   - Update when dependencies change in `package.json`

4. **Documentation & API Badges** (3 badges):
   - API Docs (GitHub Pages)
   - Coverage Trends (GitHub Pages)
   - GitHub Pages status
   - Update when documentation structure changes

**Badge Sync Checklist:**
- [ ] Workflow badges match actual workflow files in `.github/workflows/`
- [ ] Coverage badge URL matches GitHub Pages deployment
- [ ] Tech stack versions match `package.json` and `docker-compose.yml`
- [ ] Documentation links point to correct GitHub Pages URLs
- [ ] All badge links are functional (no 404s)

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
The project uses **GitHub Pages** for live documentation at: `https://{username}.github.io/{repo}/`

**Deployed Content** (via `.github/workflows/docs.yml`):
- **API Documentation** (`index.html`) - Redoc-rendered OpenAPI spec
- **Coverage Trends** (`coverage-trends.html`) - Historical coverage visualization
- **Test Reports** (`test-reports.html`) - Test execution summaries
- **Dashboards Index** (`dashboards-index.html`) - Grafana dashboard catalog
- **Reports Summary** (`reports-summary.html`) - Comprehensive report hub
- **OpenAPI Spec** (`openapi.json`) - Machine-readable API specification
- **Coverage Badge** (`coverage-badge.json`) - Dynamic badge endpoint
- **Coverage History** (`coverage-history.json`) - Trend data
- **Grafana Dashboards** (`grafana/dashboards/*.json`) - Dashboard definitions
- **Alert Rules** (`grafana/alerts/*.yml`) - Prometheus alert rules

**GitHub Pages Sync Tasks:**
1. Verify all HTML pages in `docs/` are included in deployment workflow
2. Check navigation links in `index.html` point to correct pages
3. Ensure coverage badge endpoint URL is correct in README.md
4. Validate OpenAPI spec generates successfully (`npm run openapi:spec`)
5. Confirm coverage history updates automatically on CI runs

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

**Current Workflow Badges (9 total):**
- CI (`.github/workflows/ci.yml`)
- Code Quality (`.github/workflows/code-quality.yml`)
- Security Scanning (`.github/workflows/security.yml`)
- Performance Tests (`.github/workflows/performance.yml`)
- Docker Build (`.github/workflows/docker-build.yml`)
- OpenAPI Validation (`.github/workflows/openapi-validation.yml`)
- Deploy Documentation (`.github/workflows/docs.yml`)
- Mutation Testing (`.github/workflows/mutation.yml`)
- SonarCloud Analysis (`.github/workflows/sonar.yml`)

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
- Badge URL format: `https://img.shields.io/endpoint?url=https://{user}.github.io/{repo}/coverage-badge.json`
- Badge data auto-updates on every CI run (main branch)
- Manual update: run coverage script and commit changes
- Badge color thresholds: <60% red, 60-80% yellow, >80% green

## Protocol
1. **IDENTIFY** modified files this session (use `git status` / `git diff`)
2. **DETERMINE** which docs need updates based on changes
3. **UPDATE** each affected file comprehensively
4. **VERIFY** cross-references and badge links are valid
5. **CHECK** GitHub Pages content is synchronized
6. **VALIDATE** workflow badges match actual workflows
7. **CONFIRM** coverage badge endpoint is accessible

## Verification Checklist
- [ ] README.md badges match actual workflows
- [ ] GitHub Pages URLs are correct and accessible
- [ ] Coverage badge endpoint is deployed and rendering
- [ ] All documentation links return 200 (not 404)
- [ ] Test statistics in README.md match actual test counts
- [ ] Tech stack versions match package.json
- [ ] INDEX.md files list all current documents
- [ ] Cross-references between docs are valid

## Execution
Analyze the recent changes and update all affected documentation. Be thorough but focused - only update docs that are actually affected by the changes made.

**Priority Order:**
1. Update README.md badges if workflows changed
2. Update coverage badge if test coverage changed
3. Update GitHub Pages content if docs/ changed
4. Update plan/ documentation if architecture/requirements changed
5. Update INDEX.md files if new documents were added
