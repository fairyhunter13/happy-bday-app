# sync-docs

Comprehensive documentation sync after code changes. This command ensures all 205+ markdown files across the repository remain synchronized and accurate.

## When to Run
- After modifying source code in `src/`
- After adding/modifying tests in `tests/`
- After changing configuration files (package.json, docker-compose.yml, etc.)
- After updating dependencies
- After adding/modifying/removing GitHub workflows
- After architecture changes
- After updating monitoring dashboards or metrics
- After modifying .claude commands or configuration
- Before ending a significant coding session
- Before creating pull requests

## Complete Documentation Inventory

**Total Documentation Files**: 205+ markdown files across:
- Root level: 4 files (README.md, CLAUDE.md, CONTRIBUTING.md, TIMEZONE_TESTS_COMPLETION_REPORT.md)
- `.github/`: 3 files + 4 issue templates
- `docs/`: 13 primary files + vendor-specs subdirectory
- `plan/`: 11 subdirectories with 60+ planning documents
- `tests/`: 7 README/guide files
- `.claude/commands/`: 135+ command documentation files across 16 categories

## Documentation Sync Tasks

### 1. Root-Level Documentation Updates

#### README.md
**Update Triggers:**
- Source code changes affecting features or structure
- Test statistics changes (new tests, coverage metrics)
- Dependency updates (package.json, docker-compose.yml)
- GitHub workflow additions/modifications/removals
- API endpoint changes
- Performance metric changes
- GitHub Pages URL changes

**Specific Update Areas:**
- **Project structure section** (if directories added/removed/renamed)
- **Test statistics table** (total tests, test files, coverage percentages)
- **Quick Links table** (verify all GitHub Pages URLs work)
- **Tech stack badges** (versions must match package.json)
- **Key features list** (new/removed functionality)
- **API endpoints** (new/removed/modified routes)
- **All 70+ GitHub badges** organized in 7 categories (see section 6 for details)

#### CLAUDE.md
**Update Triggers:**
- Changes to project structure or technology stack
- Updates to available agent types or swarm commands
- Changes to coding standards or best practices
- Modifications to the .claude/commands directory structure
- Updates to model selection strategy or cost considerations

**Specific Update Areas:**
- **Available Agents list** (all 54+ SPARC modes and command categories)
- **Directory Structure section** (src/, tests/, docs/, plan/ layout)
- **Tech Stack section** (runtime, language, framework versions)
- **Golden Rules section** (best practices for agent spawning)

#### CONTRIBUTING.md
**Update Triggers:**
- Changes to development workflow
- Updates to coding standards
- New PR requirements or templates
- Changes to testing requirements

#### TIMEZONE_TESTS_COMPLETION_REPORT.md
**Update Triggers:**
- Completion of timezone-related features
- Updates to timezone test coverage
- This is typically a historical document and rarely changes

### 2. GitHub Documentation Updates (.github/)

#### .github/README.md
**Update Triggers:**
- Workflow additions/modifications/removals
- Changes to CI/CD pipeline structure
- Updates to branch protection rules
- New GitHub Actions or secrets

**Specific Update Areas:**
- **Workflow inventory** (must list all 9 current workflows)
- **Secret requirements** (SNYK_TOKEN, SONAR_TOKEN, etc.)
- **Branch protection rules reference**

#### .github/BRANCH_PROTECTION.md
**Update Triggers:**
- Changes to branch protection requirements
- Updates to required status checks
- Modifications to merge strategies

#### .github/pull_request_template.md
**Update Triggers:**
- Changes to PR requirements
- Updates to testing checklist items
- New documentation requirements

#### .github/ISSUE_TEMPLATE/*.yml
**Update Triggers:**
- New issue types needed
- Changes to required fields in bug reports
- Updates to feature request template

**Files to maintain:**
- `bug_report.yml`
- `feature_request.yml`
- `performance_issue.yml`
- `config.yml`

### 3. GitHub Badges in README.md

The README.md includes **70+ badges** organized in **7 categories**:

#### Category 1: CI/CD Pipeline Status (6 badges)
**Badges:** CI, Unit Tests, Integration Tests, E2E Tests, Chaos Tests, Performance Tests
**Update Trigger:** Workflow file changes in `.github/workflows/`
**Verification:**
- [ ] Badge links point to correct workflow file (ci.yml, performance.yml)
- [ ] Workflow names match the `name:` field in workflow YAML
- [ ] All workflows exist and are not archived

#### Category 2: Build & Deployment (2 badges)
**Badges:** Docker Build and Push, Deploy Documentation
**Update Trigger:** Changes to docker-build.yml or docs.yml workflows
**Verification:**
- [ ] Docker badge links to docker-build.yml workflow
- [ ] Documentation badge links to docs.yml workflow

#### Category 3: Code Quality & Security (6 badges)
**Badges:** Code Quality, Security Scan, Snyk Security, SonarCloud, Quality Gate Status, Mutation Testing
**Update Trigger:**
- Changes to code-quality.yml, security.yml, sonar.yml, mutation.yml
- New security scanning tools added
- SonarCloud project configuration changes

**Verification:**
- [ ] Snyk badge is present (SNYK_TOKEN configured)
- [ ] SonarCloud badges link to correct project: `fairyhunter13_happy-bday-app`
- [ ] Quality Gate badge URL is current

#### Category 4: Coverage & Validation (3 badges)
**Badges:** Code Coverage, Code Duplication, OpenAPI Validation
**Update Trigger:**
- Coverage percentage changes (auto-updated via GitHub Pages)
- OpenAPI validation workflow changes

**Critical URLs:**
- Coverage badge endpoint: `https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json`
- Coverage trends page: `https://fairyhunter13.github.io/happy-bday-app/coverage-trends.html`

**Verification:**
- [ ] Coverage badge URL points to GitHub Pages JSON endpoint
- [ ] Coverage badge link navigates to coverage-trends.html
- [ ] OpenAPI badge links to openapi-validation.yml workflow

#### Category 5: Tech Stack (8 badges)
**Badges:** Node.js, TypeScript, Fastify, PostgreSQL, RabbitMQ, Docker, Prometheus, Grafana
**Update Trigger:** Dependency version changes in package.json or docker-compose.yml

**Version Verification:**
- [ ] Node.js version matches package.json `engines.node`
- [ ] TypeScript version matches package.json devDependencies
- [ ] Fastify version matches package.json dependencies
- [ ] PostgreSQL version matches docker-compose.yml
- [ ] RabbitMQ version matches docker-compose.yml
- [ ] Prometheus version matches docker-compose.yml
- [ ] Grafana version matches docker-compose.yml

#### Category 6: Documentation & Resources (3 badges)
**Badges:** API Documentation, Coverage Trends, GitHub Pages
**Update Trigger:** GitHub Pages deployment changes, documentation structure changes

**URLs to verify:**
- [ ] API Documentation: `https://fairyhunter13.github.io/happy-bday-app/`
- [ ] Coverage Trends: `https://fairyhunter13.github.io/happy-bday-app/coverage-trends.html`
- [ ] GitHub Pages status badge is functional

#### Category 7: Project Info (3 badges)
**Badges:** License (MIT), PRs Welcome, Dependabot
**Update Trigger:** Rarely changes; update if license changes or contribution policy changes

### 4. docs/ Documentation Updates

The `docs/` directory contains 13 primary files plus vendor specifications:

#### Core Documentation Files

**docs/RUNBOOK.md**
**Update Triggers:**
- Changes to operational procedures
- New monitoring dashboards added
- Alert rule modifications
- Incident response procedure updates
- New operational commands or scripts

**Specific Update Areas:**
- **Quick Start Commands** (docker-compose, service startup)
- **Service Management** (start/stop/restart procedures)
- **Monitoring & Alerting** (dashboard URLs, alert thresholds)
- **Troubleshooting Guide** (common issues, solutions)
- **Database Operations** (backup, restore, migrations)
- **Message Queue Operations** (RabbitMQ management)

**docs/METRICS.md**
**Update Triggers:**
- New Prometheus metrics added to code
- New Grafana dashboards created
- Alert rules added/modified
- Metric naming conventions change
- New exporters added (postgres, rabbitmq)

**Specific Update Areas:**
- **Available Metrics List** (all Prometheus metrics with descriptions)
- **Metric Naming Conventions** (prefixes, labels)
- **Dashboard Inventory** (list all Grafana dashboards)
- **Alert Rules** (all alert conditions documented)
- **Exporter Configuration** (postgres_exporter, rabbitmq_exporter)

**docs/DEPLOYMENT_GUIDE.md**
**Update Triggers:**
- Docker configuration changes
- CI/CD pipeline modifications
- New deployment environments
- Secret management updates (SOPS)
- Infrastructure changes

**Specific Update Areas:**
- **Prerequisites** (required tools, versions)
- **Environment Variables** (required env vars)
- **Docker Deployment Steps** (docker-compose commands)
- **GitHub Secrets** (list all required secrets)
- **SOPS Configuration** (secret encryption setup)

**docs/ARCHITECTURE_SCOPE.md**
**Update Triggers:**
- Architecture decisions or changes
- Component additions/removals
- Technology stack changes
- Scalability approach modifications

**docs/CACHE_IMPLEMENTATION.md**
**Update Triggers:**
- Redis caching strategy changes
- New cache layers added
- Cache invalidation logic updates

**docs/DEVELOPER_SETUP.md**
**Update Triggers:**
- Development environment changes
- New development tools required
- Local setup procedure updates
- IDE configuration changes

**docs/GITHUB_PAGES_ENHANCEMENT.md**
**Update Triggers:**
- GitHub Pages content changes
- New documentation pages added
- Documentation deployment workflow changes

**docs/LOCAL_READINESS.md**
**Update Triggers:**
- Local development readiness criteria changes
- New prerequisite checks added

**docs/MUTATION_TESTING.md**
**Update Triggers:**
- Mutation testing configuration changes
- Stryker.js setup modifications
- Mutation testing thresholds updated

**docs/QUEUE_METRICS_IMPLEMENTATION.md**
**Update Triggers:**
- RabbitMQ metrics changes
- Queue monitoring enhancements
- New queue-related metrics

**docs/README.md**
**Update Triggers:**
- New documentation files added to docs/
- Documentation structure changes

**docs/TESTING-PROBABILISTIC-APIS.md**
**Update Triggers:**
- Testing strategy for probabilistic APIs changes
- New testing patterns for non-deterministic systems

#### GitHub Pages Files (Auto-Generated)

These files are typically auto-generated by CI/CD but should be verified:

**docs/coverage-badge.json**
- Auto-generated by `scripts/coverage/update-history.sh`
- Update trigger: Test coverage percentage changes
- Consumed by: README.md coverage badge

**docs/coverage-history.json**
- Auto-generated by coverage scripts
- Update trigger: Coverage trend data updates

**docs/coverage-trends.html**
- Static HTML page showing coverage history charts
- Update trigger: Coverage visualization updates

**docs/test-reports.html**
- Test execution summary page
- Update trigger: Test suite changes

**docs/dashboards-index.html**
- Grafana dashboard catalog
- Update trigger: New dashboards added to grafana/dashboards/

**docs/reports-summary.html**
- Comprehensive report hub linking to all reports
- Update trigger: New report types added

**docs/openapi.json**
- Auto-generated by `npm run openapi:spec`
- Update trigger: API endpoint changes in src/

#### Vendor Specifications

**docs/vendor-specs/**
- Contains external API specifications
- Update trigger: Vendor API changes or new vendor integrations
- Files: Email service API specs, third-party integration docs

#### Test Pattern Documentation

**docs/test-patterns/**
- Testing pattern documentation
- Update trigger: New testing patterns documented
- Current focus: Probabilistic API testing patterns

### 5. plan/ Planning Documentation Updates

The `plan/` directory contains 11 subdirectories with 60+ planning documents:

#### plan/01-requirements/ (Requirements Documentation)
**Files:** 4 documents
- `INDEX.md` - Directory index
- `REQUIREMENTS_VERIFICATION.md` - Verification checklist
- `technical-specifications.md` - Technical specs
- `system-flows.md` - System flow diagrams

**Update Triggers:**
- Requirement changes or additions
- Verification status updates
- Technical specification modifications

#### plan/02-architecture/ (Architecture Documentation)
**Files:** 7 documents
- `INDEX.md` - Directory index
- `architecture-overview.md` - Overall architecture
- `ARCHITECTURE_CHANGE_RABBITMQ.md` - RabbitMQ migration
- `cicd-pipeline.md` - CI/CD design
- `docker-compose.md` - Container orchestration
- `high-scale-design.md` - Scalability architecture
- `monitoring.md` - Monitoring architecture

**Update Triggers:**
- Architecture decisions or changes
- Component additions/removals
- Technology stack changes
- Scalability approach modifications

#### plan/03-research/ (Research Documentation)
**Files:** 16 documents including:
- `INDEX.md` - Directory index
- `MESSAGE_QUEUE_RESEARCH.md` - Queue technology research
- `RABBITMQ_VS_BULLMQ_ANALYSIS.md` - Technology comparison
- `RABBITMQ_IMPLEMENTATION_GUIDE.md` - Implementation guide
- `MIGRATION_GUIDE_BULLMQ_TO_RABBITMQ.md` - Migration steps
- `PROS_CONS_COMPARISON.md` - Technology trade-offs
- `comprehensive-monitoring.md` - Monitoring research
- `distributed-coordination.md` - Coordination patterns
- `DRY-COMPLIANCE-OFFICER.md` - Code quality standards
- `dry-principle-audit.md` - DRY principle audit
- `openapi-client-generation.md` - API client generation
- `openapi-documentation.md` - API documentation
- `PERFORMANCE_OPTIMIZATION_CONSTITUTION.md` - Performance guidelines
- `performance-consistency-analysis.md` - Performance analysis
- `redis-caching-strategy.md` - Caching strategy
- `scale-performance-1m-messages.md` - Scalability research
- `sops-secret-management.md` - Secret management
- `test-coverage-and-reporting.md` - Testing research

**Update Triggers:**
- New technology research
- Performance analysis updates
- Technology comparison updates
- Best practices research

#### plan/04-testing/ (Testing Documentation)
**Files:** 7 documents including:
- `INDEX.md` - Directory index
- `testing-strategy.md` - Overall testing approach
- `edge-cases-catalog.md` - Edge case documentation
- `performance-testing-guide.md` - Performance testing
- `coverage-tracking/coverage-trends-design.md` - Coverage design
- `coverage-tracking/coverage-trends-implementation.md` - Coverage implementation

**Update Triggers:**
- Testing strategy changes
- New test types added
- Coverage threshold changes
- Edge case discoveries

#### plan/05-implementation/ (Implementation Plans)
**Files:** 6 documents including:
- `INDEX.md` - Directory index
- `master-plan.md` - Overall implementation plan
- `phase9-enhancements-plan.md` - Enhancement phase
- `openapi-implementation-plan.md` - OpenAPI implementation
- `OPENAPI_CHANGES.md` - OpenAPI change log
- `sops-implementation-plan.md` - SOPS implementation

**Update Triggers:**
- Implementation phase completions
- New phases planned
- Implementation approach changes

#### plan/06-phase-reports/ (Phase Reports)
**Files:** 1 document
- `INDEX.md` - Directory index

**Update Triggers:**
- Completion of implementation phases
- Phase retrospectives

#### plan/07-monitoring/ (Monitoring Plans)
**Files:** 7 documents including:
- `INDEX.md` - Directory index
- `alert-rules-enhancements.md` - Alert rule designs
- `grafana-dashboard-specifications.md` - Dashboard specs
- `grafana-dashboards-research.md` - Dashboard research
- `metrics-expansion-plan.md` - Metrics expansion
- `metrics-implementation-plan.md` - Metrics implementation
- `metrics-strategy-research.md` - Metrics strategy

**Update Triggers:**
- New monitoring metrics added
- Dashboard changes
- Alert rule modifications

#### plan/08-operations/ (Operations Plans)
**Files:** 5 documents including:
- `INDEX.md` - Directory index
- `exporter-deployment-checklist.md` - Exporter deployment
- `github-secrets-verification.md` - Secret verification
- `postgres-exporter-deployment.md` - Postgres exporter
- `rabbitmq-prometheus-deployment.md` - RabbitMQ exporter

**Update Triggers:**
- Operational procedure changes
- New exporters deployed
- Secret management updates

#### plan/09-reports/ (Reports)
**Files:** 5 documents including:
- `INDEX.md` - Directory index
- `GAP_ANALYSIS_REPORT.md` - Gap analysis (CRITICAL - track project progress)
- `IMPLEMENTATION_PLAN_2025-12-31.md` - Implementation plan snapshot
- `MODEL_USAGE_AUDIT_REPORT.md` - Model usage tracking
- `VALIDATION_SUMMARY.md` - Validation status

**Update Triggers:**
- Project milestone completions
- Gap analysis updates (after major changes)
- Model usage audit updates
- Validation status changes

#### plan/99-archive/ (Archived Documents)
**Files:** 7 documents including:
- `INDEX.md` - Archive index
- `ARCHIVE_INDEX.md` - Archive catalog
- `CLEANUP_FINAL_REPORT.md` - Cleanup reports
- `FINAL_CLEANUP_VERIFICATION.md` - Cleanup verification
- `GAP_ANALYSIS_CURRENT_STATE.md` - Historical gap analysis
- `SCOPE_CHANGE_SUMMARY.md` - Scope changes
- `ARCHITECT_SCOPE_UPDATE_REPORT.md` - Architecture updates

**Update Triggers:**
- Documents archived from active directories
- Historical reference needs

#### plan/README.md
**Update Triggers:**
- New plan directories added
- Planning structure changes
- Index of all planning documents updates

### 6. tests/ Test Documentation Updates

The `tests/` directory contains 7 README/guide files:

**tests/README.md**
**Update Triggers:**
- Test suite structure changes
- New test types added
- Testing commands updated

**tests/QUICK_START.md**
**Update Triggers:**
- Quick start procedure changes
- Test execution commands updated

**tests/README_USER_TESTS.md**
**Update Triggers:**
- User-related test changes
- User API test coverage updates

**tests/unit/TIMEZONE_TESTS_README.md**
**Update Triggers:**
- Timezone test coverage changes
- New timezone test cases added

**tests/unit/edge-cases/README.md**
**Update Triggers:**
- New edge cases discovered
- Edge case test coverage updates

**tests/performance/README.md**
**Update Triggers:**
- Performance test changes
- Performance metrics updated
- Load testing scenarios changed

**tests/e2e/README.md**
**Update Triggers:**
- E2E test scenario changes
- E2E test setup procedure updates

**tests/chaos/README.md**
**Update Triggers:**
- Chaos testing strategy changes
- New chaos scenarios added
- Chaos testing tools updated

### 7. .claude/ Commands Documentation Updates

The `.claude/commands/` directory contains 135+ command documentation files across 16 categories:

#### Command Categories

**sparc/** (16 files)
- All SPARC mode documentation (architect, coder, tester, reviewer, debugger, optimizer, documenter, researcher, analyzer, designer, innovator, tdd, memory-manager, batch-executor, swarm-coordinator, workflow-manager)
- Update trigger: SPARC mode changes or new modes added

**coordination/** (7 files)
- Coordination commands (init, spawn, orchestrate, swarm-init, agent-spawn, task-orchestrate, README)
- Update trigger: Coordination patterns change

**swarm/** (7 files)
- Swarm management (swarm, swarm-init, swarm-status, swarm-monitor, swarm-background, swarm-modes, README)
- Update trigger: Swarm topology or coordination changes

**hive-mind/** (7 files)
- Hive mind operations (init, spawn, status, metrics, memory, consensus, README)
- Update trigger: Hive mind architecture changes

**workflows/** (6 files)
- Workflow management (development, research, workflow-create, workflow-execute, workflow-export, README)
- Update trigger: Workflow patterns change

**monitoring/** (6 files)
- Monitoring commands (status, agents, swarm-monitor, agent-metrics, real-time-view, README)
- Update trigger: Monitoring capabilities change

**memory/** (5 files)
- Memory operations (memory-search, memory-persist, memory-usage, neural, README)
- Update trigger: Memory management changes

**optimization/** (6 files)
- Optimization commands (auto-topology, parallel-execution, parallel-execute, cache-manage, topology-optimize, README)
- Update trigger: Optimization strategies change

**github/** (6 files)
- GitHub integration (repo-analyze, code-review, pr-enhance, issue-triage, github-swarm, README)
- Update trigger: GitHub integration changes

**analysis/** (3 files)
- Analysis commands (token-usage, token-efficiency, README)
- Update trigger: Analysis capabilities change

**automation/** (7 files)
- Automation commands (workflow-select, session-memory, self-healing, smart-agents, smart-spawn, auto-agent, README)
- Update trigger: Automation patterns change

**training/** (6 files)
- Training commands (neural-train, pattern-learn, specialization, model-update, neural-patterns, README)
- Update trigger: Training capabilities change

**agents/** (5 files)
- Agent management (agent-spawning, agent-types, agent-coordination, agent-capabilities, README)
- Update trigger: Agent types or capabilities change

**hooks/** (7 files)
- Hook system (pre-edit, post-edit, pre-task, post-task, session-end, setup, README)
- Update trigger: Hook system changes

**Root-level commands:**
- `validate.md` - Validation command
- `sync-docs.md` - THIS FILE (documentation sync)

**Update Triggers for .claude/commands/:**
- New commands added
- Command syntax changes
- New agent types or capabilities
- Coordination patterns change
- Best practices updates

#### Critical .claude/ Files (Outside commands/)

**.claude/HIVE_MIND_MODEL_STRATEGY.md**
**Update Triggers:**
- Hive mind model selection strategy changes
- New models added to hive mind
- Cost optimization strategies change

**.claude/config.json**
**Update Triggers:**
- Claude Code configuration changes
- New capabilities enabled

**.claude/hive-mind-config.json**
**Update Triggers:**
- Hive mind configuration changes
- Agent topology changes

**.claude/settings.json**
**Update Triggers:**
- Settings changes
- Permission mode changes

**.claude/hooks/** (Directory)
**Update Triggers:**
- Hook script changes
- New hooks added

**.claude/statusline-command.sh**
**Update Triggers:**
- Statusline display changes
- New status information added

### 8. INDEX.md Maintenance

Index files must be kept current across all directories:

**Required INDEX.md files:**
- `plan/01-requirements/INDEX.md`
- `plan/02-architecture/INDEX.md`
- `plan/03-research/INDEX.md`
- `plan/04-testing/INDEX.md`
- `plan/05-implementation/INDEX.md`
- `plan/06-phase-reports/INDEX.md`
- `plan/07-monitoring/INDEX.md`
- `plan/08-operations/INDEX.md`
- `plan/09-reports/INDEX.md`
- `plan/99-archive/INDEX.md`
- `docs/README.md` (serves as index for docs/)
- `.claude/commands/*/README.md` (16 category READMEs)

**Index Update Protocol:**
1. List all markdown files in the directory
2. Categorize by purpose/topic
3. Include brief description of each file
4. Note any archived or deprecated files
5. Update "Last Updated" timestamp

### 9. GitHub Pages Documentation Site

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

### 10. GitHub Workflow Synchronization

#### Current Workflows (9 total)

**Workflow Inventory** (must match `.github/workflows/` directory):

1. **ci.yml** - Main CI/CD pipeline
   - Name: "CI"
   - Triggers: Push to main/develop, PRs
   - Jobs: Unit, Integration, E2E, Chaos tests
   - Badge: CI badge in README

2. **code-quality.yml** - Code quality checks
   - Name: "Code Quality"
   - Triggers: Push, PRs
   - Jobs: Linting, formatting, complexity analysis
   - Badge: Code Quality badge in README

3. **security.yml** - Security scanning
   - Name: "Security Scan" or "Security Scanning"
   - Triggers: Push, PRs, scheduled
   - Jobs: npm audit, Snyk scanning (if token configured)
   - Badges: Security Scan badge, Snyk badge in README

4. **performance.yml** - Performance testing
   - Name: "Performance Tests"
   - Triggers: Push to main, manual
   - Jobs: Load testing, performance benchmarks
   - Badge: Performance Tests badge in README

5. **docker-build.yml** - Docker image building
   - Name: "Docker Build and Push"
   - Triggers: Push to main, tags
   - Jobs: Build and push Docker images
   - Badge: Docker Build badge in README

6. **openapi-validation.yml** - OpenAPI spec validation
   - Name: "OpenAPI Validation"
   - Triggers: Push, PRs
   - Jobs: Validate OpenAPI spec, check API consistency
   - Badge: OpenAPI Validation badge in README

7. **docs.yml** - Documentation deployment
   - Name: "Deploy Documentation"
   - Triggers: Push to main (docs/**, src/**), manual
   - Jobs: Build and deploy GitHub Pages
   - Badge: Deploy Documentation badge in README

8. **mutation.yml** - Mutation testing
   - Name: "Mutation Testing"
   - Triggers: Manual, scheduled
   - Jobs: Stryker mutation testing
   - Badge: Mutation Testing badge in README

9. **sonar.yml** - SonarCloud analysis
   - Name: "SonarCloud"
   - Triggers: Push, PRs
   - Jobs: Code quality, security analysis via SonarCloud
   - Badges: SonarCloud badge, Quality Gate Status badge in README

#### Workflow Sync Protocol

**When adding a new workflow:**
1. Create workflow file in `.github/workflows/`
2. Add corresponding badge to README.md in appropriate category
3. Update `.github/README.md` workflow inventory
4. Update this sync-docs.md workflow list
5. Verify badge displays correctly after first workflow run

**When removing a workflow:**
1. Delete workflow file from `.github/workflows/`
2. Remove corresponding badge from README.md
3. Update `.github/README.md` workflow inventory
4. Update this sync-docs.md workflow list
5. Check for any documentation references to removed workflow

**When modifying a workflow:**
1. If workflow `name:` field changes, update README.md badge
2. If workflow purpose changes, update `.github/README.md` description
3. If triggers change significantly, document in workflow comments

#### Workflow Badge Verification Checklist
- [ ] All 9 workflow files exist in `.github/workflows/`
- [ ] Each workflow has corresponding badge in README.md
- [ ] Badge names match workflow `name:` field exactly
- [ ] Badge URLs use correct workflow file names
- [ ] Workflow links navigate to Actions tab correctly
- [ ] All badges render without 404 errors

### 11. Coverage Badge Synchronization

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

### 12. Cross-Reference Validation

Documentation files often reference other files. These cross-references must remain valid:

#### Common Cross-Reference Patterns

**README.md references:**
- Links to docs/ files (RUNBOOK.md, METRICS.md, etc.)
- Links to plan/ files (architecture, testing strategy)
- Links to GitHub Pages URLs
- Links to workflow files
- Badge URLs to shields.io and GitHub

**CLAUDE.md references:**
- Directory structure references (src/, tests/, docs/, plan/)
- Available agent list (must match .claude/commands/)
- Tech stack versions (must match package.json)

**docs/RUNBOOK.md references:**
- Links to METRICS.md
- Links to DEPLOYMENT_GUIDE.md
- Links to Grafana dashboards (localhost URLs)
- Links to monitoring endpoints

**plan/*/INDEX.md references:**
- Links to all files in the directory
- Cross-references to related plan directories

#### Cross-Reference Validation Checklist
- [ ] All internal markdown links use correct relative paths
- [ ] All GitHub Pages URLs use correct base URL
- [ ] All workflow badge URLs point to existing workflows
- [ ] All cross-directory references are accurate
- [ ] All external URLs are still valid (Grafana, Prometheus, etc.)
- [ ] All file references match actual file names (case-sensitive)

### 13. Documentation Quality Standards

All documentation updates should maintain these quality standards:

#### Writing Standards
- **Clarity**: Use clear, concise language
- **Completeness**: Cover all relevant scenarios
- **Accuracy**: Verify all technical details
- **Consistency**: Use consistent terminology across docs
- **Examples**: Include code examples where helpful
- **Updates**: Include "Last Updated" dates where appropriate

#### Structure Standards
- **Headers**: Use consistent header hierarchy
- **Lists**: Use consistent list formatting (ordered vs unordered)
- **Code blocks**: Include language identifiers for syntax highlighting
- **Links**: Use descriptive link text, not "click here"
- **Tables**: Keep tables aligned and readable

#### Technical Standards
- **Paths**: Use absolute paths in examples
- **Commands**: Include full command examples with flags
- **Versions**: Specify version numbers where relevant
- **Prerequisites**: List all prerequisites at start of procedures
- **Troubleshooting**: Include common issues and solutions

## Documentation Sync Protocol

Follow this systematic approach when syncing documentation:

### Step 1: IDENTIFY Changes
Run these commands to identify what changed:
```bash
git status                    # See modified/new/deleted files
git diff                      # See specific changes
git log --oneline -10         # See recent commits
```

### Step 2: CATEGORIZE Impact
Determine which documentation categories are affected:
- [ ] Root-level docs (README.md, CLAUDE.md, CONTRIBUTING.md)
- [ ] GitHub docs (.github/README.md, workflows, templates)
- [ ] Project docs (docs/*.md)
- [ ] Planning docs (plan/*/*.md)
- [ ] Test docs (tests/**/README.md)
- [ ] Command docs (.claude/commands/*/*.md)
- [ ] GitHub Pages (docs/*.html, docs/*.json)
- [ ] Badges (README.md badges)
- [ ] Workflows (.github/workflows/*.yml)

### Step 3: UPDATE Documentation
Update each affected category systematically:

**For code changes (src/):**
1. Update README.md (features, structure, API endpoints)
2. Update docs/RUNBOOK.md (operational impacts)
3. Update docs/METRICS.md (new metrics added)
4. Update plan/05-implementation/master-plan.md (implementation status)

**For test changes (tests/):**
1. Update README.md (test statistics)
2. Update tests/README.md (test structure)
3. Update specific test type README (unit/, e2e/, performance/, chaos/)
4. Update plan/04-testing/testing-strategy.md (strategy changes)

**For workflow changes (.github/workflows/):**
1. Update README.md (badges)
2. Update .github/README.md (workflow inventory)
3. Update this file (workflow list in section 10)
4. Verify badge rendering

**For documentation changes (docs/):**
1. Update docs/README.md (index)
2. Update plan/README.md (cross-references)
3. Verify GitHub Pages deployment

**For architecture changes:**
1. Update plan/02-architecture/*.md
2. Update docs/ARCHITECTURE_SCOPE.md
3. Update CLAUDE.md (if structure changed)
4. Update plan/09-reports/GAP_ANALYSIS_REPORT.md

**For dependency changes (package.json, docker-compose.yml):**
1. Update README.md (tech stack badges)
2. Update CLAUDE.md (tech stack section)
3. Update docs/DEPLOYMENT_GUIDE.md (prerequisites)

### Step 4: VERIFY Cross-References
Check that all references remain valid:
```bash
# Find broken markdown links (manual verification needed)
grep -r "\[.*\](.*\.md)" . --include="*.md" | grep -v node_modules
```

### Step 5: VALIDATE Badges and URLs
- [ ] All 70+ README.md badges render correctly
- [ ] All 9 workflow badges match actual workflows
- [ ] GitHub Pages URLs are accessible
- [ ] Coverage badge endpoint works
- [ ] All external links are valid

### Step 6: UPDATE Indexes
Update all INDEX.md files in affected directories:
- [ ] plan/*/INDEX.md (10 files)
- [ ] docs/README.md
- [ ] .claude/commands/*/README.md (16 files)

### Step 7: FINAL REVIEW
- [ ] Run `npm run lint` (if applicable)
- [ ] Check for typos and formatting
- [ ] Verify all code blocks have language identifiers
- [ ] Confirm all checklists are properly formatted
- [ ] Review git diff before committing

## Comprehensive Verification Checklist

### README.md Verification
- [ ] All 70+ badges render without 404s
- [ ] All 9 workflow badges match actual workflow files
- [ ] Workflow badge names match the `name:` field in each workflow YAML
- [ ] Test statistics match actual counts (run tests to verify)
- [ ] Tech stack badges show correct versions (check package.json, docker-compose.yml)
- [ ] GitHub Pages URLs use correct base: `https://fairyhunter13.github.io/happy-bday-app/`
- [ ] Coverage badge URL points to: `https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json`
- [ ] All "Quick Links" table URLs are accessible
- [ ] Project structure section reflects actual directory layout

### GitHub Workflow Verification
- [ ] All 9 workflow files exist in `.github/workflows/`
- [ ] Each workflow has corresponding badge in README.md
- [ ] Workflow triggers are documented in .github/README.md
- [ ] No orphaned badges (badges without workflows)
- [ ] No orphaned workflows (workflows without badges)

### GitHub Pages Verification
- [ ] Coverage badge JSON is deployed and accessible
- [ ] Coverage trends HTML page loads correctly
- [ ] API documentation (index.html) renders OpenAPI spec
- [ ] Test reports HTML page is current
- [ ] Dashboards index HTML lists all Grafana dashboards
- [ ] Reports summary HTML links to all reports
- [ ] OpenAPI JSON is valid and current

### Documentation Structure Verification
- [ ] All 205+ markdown files are accounted for
- [ ] No duplicate documentation files
- [ ] All INDEX.md files list current directory contents
- [ ] All archived documents are in plan/99-archive/
- [ ] No orphaned documentation files

### Cross-Reference Verification
- [ ] All internal markdown links work
- [ ] All links to docs/ files are correct
- [ ] All links to plan/ files are correct
- [ ] All links to .github/ files are correct
- [ ] All badge URLs are functional

### Tech Stack Verification
- [ ] Node.js badge version matches package.json engines.node
- [ ] TypeScript badge version matches package.json devDependencies
- [ ] Fastify badge version matches package.json dependencies
- [ ] PostgreSQL badge version matches docker-compose.yml
- [ ] RabbitMQ badge version matches docker-compose.yml
- [ ] Prometheus badge version matches docker-compose.yml
- [ ] Grafana badge version matches docker-compose.yml

### Security Badge Verification
- [x] SNYK_TOKEN secret is configured
- [x] Snyk badge is present in README.md
- [ ] Snyk badge links to correct project dashboard
- [ ] Security Scanning workflow badge is present
- [ ] SonarCloud badges link to correct project: fairyhunter13_happy-bday-app

### Index File Verification
- [ ] plan/01-requirements/INDEX.md lists all 4 files
- [ ] plan/02-architecture/INDEX.md lists all 7 files
- [ ] plan/03-research/INDEX.md lists all 16 files
- [ ] plan/04-testing/INDEX.md lists all 7 files
- [ ] plan/05-implementation/INDEX.md lists all 6 files
- [ ] plan/06-phase-reports/INDEX.md is current
- [ ] plan/07-monitoring/INDEX.md lists all 7 files
- [ ] plan/08-operations/INDEX.md lists all 5 files
- [ ] plan/09-reports/INDEX.md lists all 5 files
- [ ] plan/99-archive/INDEX.md lists all archived files
- [ ] docs/README.md lists all 13 primary docs
- [ ] All 16 .claude/commands/*/README.md files are current

## Execution Priority Order

When time is limited, follow this priority order:

### Priority 1: CRITICAL (Always update)
1. README.md badges (if workflows changed)
2. GitHub Pages URLs in README.md
3. Coverage badge endpoint verification
4. Test statistics in README.md (if tests changed)
5. plan/09-reports/GAP_ANALYSIS_REPORT.md (if major features completed)

### Priority 2: HIGH (Update for significant changes)
1. docs/RUNBOOK.md (if operational procedures changed)
2. docs/METRICS.md (if metrics added/changed)
3. CLAUDE.md (if project structure changed)
4. plan/02-architecture/*.md (if architecture changed)
5. plan/05-implementation/master-plan.md (if implementation progressed)

### Priority 3: MEDIUM (Update regularly)
1. docs/DEPLOYMENT_GUIDE.md (if deployment changed)
2. .github/README.md (if workflows changed)
3. plan/04-testing/testing-strategy.md (if testing approach changed)
4. Relevant plan/*/INDEX.md files

### Priority 4: LOW (Update as needed)
1. tests/**/README.md files
2. .claude/commands documentation (if commands changed)
3. Historical reports and archives

## Quick Commands

Useful commands for documentation sync:

```bash
# Count total markdown files
find . -name "*.md" -not -path "*/node_modules/*" | wc -l

# List all workflow files
ls -1 .github/workflows/*.yml

# Find files modified today
find . -name "*.md" -mtime -1 -not -path "*/node_modules/*"

# Search for broken internal links (returns files with .md links)
grep -r "\[.*\](.*\.md)" . --include="*.md" -l | grep -v node_modules

# Check if specific badge URL is accessible (requires curl)
curl -I https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json

# List all INDEX.md files
find . -name "INDEX.md" -not -path "*/node_modules/*"

# Count docs by directory
find docs/ -name "*.md" | wc -l
find plan/ -name "*.md" | wc -l
find tests/ -name "*.md" | wc -l
find .claude/ -name "*.md" | wc -l
```

## Final Notes

- **Be thorough**: With 205+ documentation files, systematic checking is essential
- **Be focused**: Only update what actually changed
- **Be consistent**: Maintain naming conventions and formatting standards
- **Be accurate**: Verify all technical details (versions, URLs, counts)
- **Be complete**: Don't leave partial updates; finish entire documentation sections
- **Be efficient**: Use parallel updates when multiple files need the same change

**Remember**: Documentation sync is not just about updating text—it's about maintaining the integrity of the entire documentation system across 205+ interconnected files.
