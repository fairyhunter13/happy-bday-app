---
description: Synchronize, maintain, and organize documentation and plans with current repository state
---

# DOCUMENTATION SYNCHRONIZATION & ORGANIZATION COMMAND

You are a documentation synchronization and organization agent tasked with ensuring all documentation and plan files accurately reflect the current state of the repository, are well-organized, and properly maintained.

## OBJECTIVE

Synchronize, maintain, and organize all documentation in: **docs/**, **plan/**, and root **.md** files.

## SCOPE

### Target Directories

1. **docs/** - Technical documentation
2. **plan/** - Project plans, research, and reports
3. **Root .md files** - README, CONTRIBUTING, etc.

### Source of Truth

1. **project_data/** - **PRIMARY REQUIREMENTS** (Assessment specification)
2. **src/** - Source code implementation
3. **tests/** - Test implementations
4. **package.json** - Dependencies and scripts
5. **.github/workflows/** - CI/CD configuration

---

# PHASE 0: REQUIREMENTS CONFORMANCE

## Project Requirements from project_data/

All plan and documentation files MUST conform to the core requirements defined in `project_data/`:

### Core Requirements Checklist

**Mandatory Features:**
- [ ] TypeScript codebase
- [ ] POST /user - Create user endpoint
- [ ] DELETE /user - Delete user endpoint
- [ ] PUT /user - Edit user endpoint (Bonus)
- [ ] User fields: firstName, lastName, birthday, location/timezone, email
- [ ] Birthday message at 9am local time
- [ ] Message format: "Hey, {full_name} it's your birthday"
- [ ] Integration with email-service.digitalenvision.com.au
- [ ] Recovery mechanism for unsent messages after downtime
- [ ] Handle API random errors and timeouts

**Quality Requirements:**
- [ ] Scalable code with good abstraction
- [ ] Support for future message types (e.g., anniversary)
- [ ] Code is tested and testable
- [ ] No race conditions / duplicate messages
- [ ] Handle thousands of birthdays per day

### Conformance Verification Steps

1. **Read** `project_data/*.txt` and `project_data/*.rtf` files
2. **Extract** all requirements and constraints
3. **Compare** plan files against requirements
4. **Flag** any plan items that:
   - Contradict core requirements
   - Add scope beyond assessment requirements
   - Miss required features
5. **Update** plan files to align with requirements

### Conformance Report Section

Add to sync report:

```markdown
## Requirements Conformance

### project_data/ Requirements Status

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| TypeScript codebase | ✅ Verified | src/**/*.ts |
| POST /user endpoint | ✅ Verified | src/controllers/user.controller.ts |
| DELETE /user endpoint | ✅ Verified | src/controllers/user.controller.ts |
| PUT /user endpoint | ✅ Verified | src/controllers/user.controller.ts |
| 9am local time sending | ✅ Verified | src/services/timezone.service.ts |
| Message format correct | ✅ Verified | src/strategies/birthday-message.strategy.ts |
| Recovery mechanism | ✅ Verified | src/schedulers/recovery.scheduler.ts |
| Error/timeout handling | ✅ Verified | src/services/message-sender.service.ts |
| Scalable abstraction | ✅ Verified | src/strategies/ (Strategy pattern) |
| No duplicate messages | ✅ Verified | src/services/idempotency.service.ts |

### Scope Alignment

- Items IN SCOPE: [list items matching requirements]
- Items OUT OF SCOPE: [list items beyond assessment - flag for review]
```

---

# PHASE 1: SYNCHRONIZATION

## STEP 1: Remove Duplicate/Older Documentation Versions

**CRITICAL:** Keep only the LATEST version of each documentation file. Remove all duplicates and older versions.

### Duplicate Detection Patterns

Scan for files with these naming patterns:
- **Dated versions:** `FILENAME_2026-01-01.md`, `FILENAME_2026-01-02.md`
  - Action: Keep ONLY the latest date, DELETE older dates
- **Version suffixes:** `FILENAME_v1.md`, `FILENAME_v2.md`, `FILENAME_final.md`
  - Action: Keep ONLY `_FINAL.md` or highest version, DELETE others
- **Backup copies:** `FILENAME_backup.md`, `FILENAME_old.md`, `FILENAME_copy.md`
  - Action: DELETE all backup copies
- **Interim versions:** `FILENAME_interim.md`, `FILENAME_temp.md`, `FILENAME_draft.md`
  - Action: Keep final version, DELETE interim/temp/draft

### Removal Protocol

For each duplicate set found:

1. **Identify the latest version:**
   - By date in filename (e.g., `2026-01-02` > `2026-01-01`)
   - By suffix (`_FINAL` > `_interim` > `_draft`)
   - By file modification time (if no date/version in name)

2. **Verify the latest version is complete:**
   - File size > 1KB
   - Contains complete sections
   - Not a stub or draft

3. **Delete older versions:**
   - Use `rm` command to delete older files
   - Update any references in INDEX.md files
   - Update any cross-references in other docs

4. **Document the cleanup:**
   - List removed files in sync report
   - Note the kept version

### Example Cleanup

```bash
# Found duplicates:
plan/09-reports/GAP_ANALYSIS_2026-01-01.md
plan/09-reports/GAP_ANALYSIS_2026-01-02.md
plan/09-reports/GAP_ANALYSIS_2026-01-02_FINAL.md

# Keep: GAP_ANALYSIS_2026-01-02_FINAL.md (latest + final)
# Delete: GAP_ANALYSIS_2026-01-01.md, GAP_ANALYSIS_2026-01-02.md
```

### Common Duplicate Locations

Check these directories for duplicates:
- `plan/09-reports/` - Most likely to have dated versions
- `docs/` - May have backup copies
- `plan/06-phase-reports/` - May have dated versions
- Root directory - May have old README/CHANGELOG versions

## STEP 2: Identify Outdated Content

Scan documentation for:
1. References to non-existent files
2. Outdated code examples
3. Deprecated features
4. Incorrect file paths
5. Stale configuration examples

## STEP 3: Identify Unfeasible Checklists

**REMOVE** any checklist items matching these patterns:

**External Resource Dependencies:**
- "Create demo video" / "Record tutorial"
- "Post to blog" / "Write article"
- "Create marketing materials"
- "Social media promotion"

**Infrastructure/Deployment:**
- "Deploy to production/staging"
- "Set up AWS/GCP/Azure"
- "Configure Kubernetes cluster"
- "Set up cloud databases"
- "Configure CDN"
- "Set up load balancer"
- "Purchase domain"
- "Obtain SSL certificates"

**Human Resource Dependencies:**
- "Hire developers"
- "Schedule meetings"
- "Get stakeholder approval"
- "Present to management"
- "Customer training"
- "User onboarding"

**External Services:**
- "Integrate with third-party API" (unless mock exists)
- "Set up payment processing"
- "Configure email service" (unless test mock exists)
- "Set up analytics"

## STEP 3: Update Documentation

For each outdated item:
1. **Verify** against current codebase
2. **Update** if implementation exists
3. **Mark Complete** if feature is implemented
4. **Remove** if unfeasible
5. **Add Note** explaining any removal

## STEP 4: Update Plan Files

For plan directory files:
1. Mark `[x]` for completed items
2. Add file references: `Implemented in: src/path/file.ts`
3. Remove unfeasible items with tracking comment
4. Update status sections

### Unfeasible Item Handling

When removing unfeasible items:

```markdown
<!-- REMOVED: [original item text]
     Reason: [unfeasible category]
     Date: [removal date]
-->
```

Or replace with:

```markdown
- ~~[original item]~~ - Removed: Outside project scope
```

### Auto-Complete Detection

Check these paths to auto-mark items:
- Services: `src/services/*.ts`
- Controllers: `src/controllers/*.ts`
- Repositories: `src/repositories/*.ts`
- Schedulers: `src/schedulers/*.ts`
- Queue: `src/queue/*.ts`
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`
- Config: `src/config/*.ts`

### Never Auto-Complete

- Performance benchmarks (need human verification)
- Security audits
- Code review items
- Documentation review

---

# PHASE 2: ORGANIZATION

## STEP 5: Audit Current Structure

Analyze existing documentation for:
1. **Duplicate Content** - Same information in multiple files
2. **Orphaned Files** - Files not linked from any index
3. **Empty/Stub Files** - Files with minimal content
4. **Outdated Files** - Files referencing deprecated features
5. **Naming Inconsistencies** - Files not following naming conventions
6. **Missing Index Files** - Directories without README/INDEX.md

## STEP 6: Target Directory Structures

**docs/ Directory Structure:**
```
docs/
├── README.md                    # Documentation index
├── getting-started/            # Onboarding docs
│   ├── README.md
│   ├── DEVELOPER_SETUP.md
│   └── QUICKSTART.md
├── architecture/               # System design
│   ├── README.md
│   ├── OVERVIEW.md
│   └── DECISIONS.md
├── api/                        # API documentation
│   ├── README.md
│   └── ENDPOINTS.md
├── operations/                 # Ops and runbooks
│   ├── README.md
│   ├── RUNBOOK.md
│   └── MONITORING.md
├── testing/                    # Test documentation
│   ├── README.md
│   └── STRATEGIES.md
└── vendor-specs/               # External integrations
    └── README.md
```

**plan/ Directory Structure:**
```
plan/
├── README.md                   # Plan index with links
├── 01-requirements/            # Requirements
├── 02-architecture/            # Architecture decisions
├── 03-research/                # Research findings
├── 04-testing/                 # Testing strategy
├── 05-implementation/          # Implementation plans
├── 06-phase-reports/           # Phase completions
├── 07-monitoring/              # Monitoring plans
├── 08-operations/              # Operational procedures
└── 09-reports/                 # Status reports & gap analysis
```

**Note:** Archive directory (99-archive/) has been removed. Obsolete files should be deleted rather than archived.

## STEP 7: File Naming Conventions

**Apply these naming rules:**

| Pattern | Example | Usage |
|---------|---------|-------|
| UPPERCASE.md | README.md, RUNBOOK.md | Primary index/reference docs |
| kebab-case.md | testing-strategy.md | Topic-specific documents |
| CATEGORY_TOPIC.md | ARCHITECTURE_SCOPE.md | Scoped documents |
| INDEX.md | INDEX.md | Directory index files |

**Avoid:**
- Spaces in filenames
- Mixed case (e.g., TestingStrategy.md)
- Underscores for word separation
- Overly long names (>50 chars)

## STEP 8: Content Organization

**Each file should have:**
1. **Clear Title** - H1 heading matching purpose
2. **Purpose Statement** - What this document covers
3. **Table of Contents** - For files >100 lines
4. **Consistent Sections** - Standard structure
5. **Cross-References** - Links to related docs
6. **Last Updated** - Date of last revision

**Standard Document Template:**
```markdown
# Document Title

> Brief description of this document's purpose

## Overview

[High-level summary]

## Details

[Main content sections]

## Related Documents

- [Link to related doc](./path/to/doc.md)

---
*Last updated: YYYY-MM-DD*
```

## STEP 9: Consolidation Rules

**Merge files when:**
- Same topic split across multiple files
- Files < 50 lines that could be combined
- Redundant content in similar files

**Archive files when:**
- Content is >6 months old and unchanged
- Feature is fully implemented
- Research is complete and implemented
- Phase is finished

**Delete files when:**
- Empty or stub files with <10 lines
- Duplicate of another file
- No longer relevant to project

## STEP 10: Index File Updates

**Update all INDEX.md and README.md files to:**
1. List all files in directory
2. Provide brief description of each
3. Link to related directories
4. Show completion status if applicable

**Example INDEX.md:**
```markdown
# Section Title

## Documents in this Section

| Document | Description | Status |
|----------|-------------|--------|
| [document-1.md](./document-1.md) | Description | Complete |
| [document-2.md](./document-2.md) | Description | In Progress |

## Related Sections

- [Related Section](../related-section/)
```

---

# PHASE 3: MAINTENANCE

## Content Quality

1. **Fix Broken Links** - Update or remove dead links
2. **Update Code Examples** - Ensure examples match current API
3. **Correct File Paths** - Fix references to moved/renamed files
4. **Remove Stale Content** - Archive outdated sections

## Organization

1. **Consistent Headers** - Ensure H1, H2, H3 hierarchy
2. **Add TOC** - For files >100 lines
3. **Cross-References** - Link related documents
4. **Timestamps** - Add/update "Last updated" dates

## File Health

1. **Remove Empty Files** - Delete files <10 lines with no content
2. **Merge Duplicates** - Consolidate redundant files
3. **Archive Old** - Move completed/old items to 99-archive/
4. **Naming Conventions** - Rename files to kebab-case or UPPERCASE

## Recent Changes Integration

Track and incorporate recent changes from:

1. **Git Log** - Recent commits affecting src/, tests/
2. **User Prompts** - Changes discussed in current session
3. **CI/CD Results** - Test and build outcomes
4. **Code Reviews** - Comments and suggestions

Update documentation to reflect:
- New features implemented
- Bugs fixed
- Tests added
- Configuration changes
- API modifications

---

# PHASE 4: README BADGE MANAGEMENT

## Overview

Automatically update `README.md` with comprehensive badges from GitHub Actions, third-party services, and dynamic endpoints.

## Badge Categories

### 1. CI/CD Pipeline Status Badges

**GitHub Actions Native Badges:**
```markdown
[![CI](https://github.com/{owner}/{repo}/actions/workflows/ci.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/ci.yml)
[![Security Scan](https://github.com/{owner}/{repo}/actions/workflows/security.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/security.yml)
[![Code Quality](https://github.com/{owner}/{repo}/actions/workflows/code-quality.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/code-quality.yml)
[![Performance Tests](https://github.com/{owner}/{repo}/actions/workflows/performance.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/performance.yml)
[![Docker Build](https://github.com/{owner}/{repo}/actions/workflows/docker-build.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/docker-build.yml)
[![Deploy Documentation](https://github.com/{owner}/{repo}/actions/workflows/docs.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/docs.yml)
```

**Shields.io Workflow Badges (more descriptive):**
```markdown
[![Unit Tests](https://img.shields.io/github/actions/workflow/status/{owner}/{repo}/ci.yml?label=unit%20tests&logo=vitest)](...)
[![Integration Tests](https://img.shields.io/github/actions/workflow/status/{owner}/{repo}/ci.yml?label=integration%20tests&logo=vitest)](...)
[![E2E Tests](https://img.shields.io/github/actions/workflow/status/{owner}/{repo}/ci.yml?label=e2e%20tests&logo=docker)](...)
[![Chaos Tests](https://img.shields.io/github/actions/workflow/status/{owner}/{repo}/ci.yml?label=chaos%20tests)](...)
```

### 2. Code Coverage Badges

**Codecov Integration:**
```markdown
[![codecov](https://codecov.io/gh/{owner}/{repo}/branch/main/graph/badge.svg)](https://codecov.io/gh/{owner}/{repo})
```

**Custom Coverage Badge (from GitHub Pages JSON endpoint):**
```markdown
[![Code Coverage](https://img.shields.io/endpoint?url=https://{owner}.github.io/{repo}/coverage-badge.json&logo=vitest)](https://{owner}.github.io/{repo}/coverage-trends.html)
```

**Coverage Badge JSON Format (`docs/coverage-badge.json`):**
```json
{
  "schemaVersion": 1,
  "label": "coverage",
  "message": "85%",
  "color": "brightgreen"
}
```

### 3. Security Scanning Badges

```markdown
[![Snyk Security](https://img.shields.io/snyk/vulnerabilities/github/{owner}/{repo}?logo=snyk)](https://snyk.io/test/github/{owner}/{repo})
[![Dependabot](https://img.shields.io/badge/Dependabot-enabled-blue?logo=dependabot)](https://github.com/{owner}/{repo}/security/dependabot)
[![OWASP](https://img.shields.io/badge/OWASP-Dependency%20Check-orange)](https://github.com/{owner}/{repo}/actions/workflows/security.yml)
[![CodeQL](https://github.com/{owner}/{repo}/actions/workflows/codeql.yml/badge.svg)](https://github.com/{owner}/{repo}/security/code-scanning)
```

### 4. Code Quality Badges

**SonarCloud:**
```markdown
[![SonarCloud](https://github.com/{owner}/{repo}/actions/workflows/sonar.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/sonar.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project={sonar_project_key}&metric=alert_status)](https://sonarcloud.io/dashboard?id={sonar_project_key})
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project={sonar_project_key}&metric=sqale_rating)](https://sonarcloud.io/dashboard?id={sonar_project_key})
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project={sonar_project_key}&metric=code_smells)](https://sonarcloud.io/dashboard?id={sonar_project_key})
```

**Mutation Testing:**
```markdown
[![Mutation Testing](https://github.com/{owner}/{repo}/actions/workflows/ci.yml/badge.svg)](https://github.com/{owner}/{repo}/actions/workflows/ci.yml)
[![Stryker](https://img.shields.io/badge/Stryker-mutation%20testing-yellow?logo=stryker)](https://stryker-mutator.io/)
```

**Code Duplication:**
```markdown
[![Code Duplication](https://img.shields.io/badge/Code%20Duplication-%3C5%25-brightgreen?logo=codacy)](https://github.com/{owner}/{repo}/actions/workflows/code-quality.yml)
```

### 5. Performance Badges

**RPS/Throughput Badges (from k6 results):**
```markdown
[![Performance](https://img.shields.io/endpoint?url=https://{owner}.github.io/{repo}/performance-badge.json&logo=prometheus)](https://{owner}.github.io/{repo}/performance-report.html)
[![RPS Capacity](https://img.shields.io/badge/RPS-100%2B%20msg%2Fsec-brightgreen?logo=graphql)](https://github.com/{owner}/{repo}/actions/workflows/performance.yml)
[![Throughput](https://img.shields.io/badge/Throughput-1M%2B%20msgs%2Fday-brightgreen?logo=apache-kafka)](https://github.com/{owner}/{repo}/actions/workflows/performance.yml)
[![p95 Latency](https://img.shields.io/badge/p95%20Latency-%3C200ms-brightgreen?logo=speedtest)](https://github.com/{owner}/{repo}/actions/workflows/performance.yml)
```

**Dynamic Performance Badge JSON (`docs/performance-badge.json`):**
```json
{
  "schemaVersion": 1,
  "label": "performance",
  "message": "1M+ msgs/day • 100+ RPS",
  "color": "brightgreen",
  "namedLogo": "prometheus"
}
```

**Performance Badge Generation Script (`scripts/performance/generate-badges.sh`):**

The project includes a comprehensive performance badge generator that:
- Parses k6 JSON results from multiple test files
- Extracts RPS, p95/p99 latency, error rate, and throughput metrics
- Generates multiple shields.io endpoint badge JSON files
- Uses intelligent color coding based on metric thresholds

```bash
# Usage
./scripts/performance/generate-badges.sh [results-dir] [output-dir]

# Example: Generate badges from performance test results
./scripts/performance/generate-badges.sh perf-results docs

# Generated badge files:
#   - performance-badge.json    - Overall: "1M+ msgs/day | 100+ RPS"
#   - rps-badge.json           - RPS: "100+ msg/sec"
#   - latency-badge.json       - p95 Latency: "150ms"
#   - throughput-badge.json    - Throughput: "1M+ msgs/day"
#   - error-rate-badge.json    - Error Rate: "0.00%"
#   - performance-metrics.json - Full metrics JSON for dashboards
```

**Color Thresholds:**
| Metric | Excellent (brightgreen) | Good (green) | Warning (yellow) | Critical (orange/red) |
|--------|------------------------|--------------|------------------|----------------------|
| **RPS** | ≥100 msg/sec | ≥50 msg/sec | ≥25 msg/sec | <25 msg/sec |
| **p95 Latency** | <200ms | <500ms | <1000ms | ≥1000ms |
| **Error Rate** | <0.1% | <1% | <5% | ≥5% |
| **Throughput** | ≥1M msgs/day | ≥500K msgs/day | ≥100K msgs/day | <100K msgs/day |

**GitHub Actions Integration:**

The performance workflow automatically generates badges:

```yaml
# .github/workflows/performance.yml
- name: Generate performance badges
  run: |
    chmod +x scripts/performance/generate-badges.sh
    ./scripts/performance/generate-badges.sh perf-results docs

- name: Upload performance badges
  uses: actions/upload-artifact@v4
  with:
    name: performance-badges
    path: |
      docs/performance-badge.json
      docs/rps-badge.json
      docs/latency-badge.json
      docs/throughput-badge.json
      docs/error-rate-badge.json
      docs/performance-metrics.json
```

**Performance Metrics to Display:**
| Metric | Description | Good | Warning | Critical |
|--------|-------------|------|---------|----------|
| **RPS** | Requests per second | >100 | 50-100 | <50 |
| **p95 Latency** | 95th percentile response time | <200ms | 200-500ms | >500ms |
| **p99 Latency** | 99th percentile response time | <500ms | 500-1000ms | >1000ms |
| **Throughput** | Messages processed per day | 1M+ | 500K-1M | <500K |
| **Error Rate** | Failed requests percentage | <0.1% | 0.1-1% | >1% |

### 6. Tech Stack Badges

```markdown
[![Node.js](https://img.shields.io/badge/Node.js-≥20.0.0-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-black?logo=fastify)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.x-orange?logo=rabbitmq)](https://www.rabbitmq.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue?logo=docker)](https://docs.docker.com/compose/)
[![Prometheus](https://img.shields.io/badge/Prometheus-Monitoring-orange?logo=prometheus)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-Dashboards-orange?logo=grafana)](https://grafana.com/)
```

### 6. Documentation & Resources Badges

```markdown
[![API Documentation](https://img.shields.io/badge/API-Documentation-blue?logo=swagger)](https://{owner}.github.io/{repo}/)
[![Coverage Trends](https://img.shields.io/badge/Coverage-Trends-purple?logo=chartdotjs)](https://{owner}.github.io/{repo}/coverage-trends.html)
[![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-blue?logo=github)](https://{owner}.github.io/{repo}/)
```

### 7. Project Info Badges

```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub issues](https://img.shields.io/github/issues/{owner}/{repo})](https://github.com/{owner}/{repo}/issues)
[![GitHub stars](https://img.shields.io/github/stars/{owner}/{repo})](https://github.com/{owner}/{repo}/stargazers)
[![GitHub release](https://img.shields.io/github/release/{owner}/{repo})](https://github.com/{owner}/{repo}/releases)
```

### 8. Dynamic Endpoint Badges (Custom JSON)

**Custom badges using shields.io endpoint API for dynamic data:**

```markdown
[![Security Status](https://img.shields.io/endpoint?url=https://{owner}.github.io/{repo}/security-badge.json)](https://{owner}.github.io/{repo}/security-summary.html)
[![Test Status](https://img.shields.io/endpoint?url=https://{owner}.github.io/{repo}/test-badge.json)](https://{owner}.github.io/{repo}/test-reports.html)
[![Performance](https://img.shields.io/endpoint?url=https://{owner}.github.io/{repo}/performance-badge.json)](https://{owner}.github.io/{repo}/performance-report.html)
```

**Badge JSON Endpoint Format:**
```json
{
  "schemaVersion": 1,
  "label": "tests",
  "message": "992 passing",
  "color": "brightgreen",
  "namedLogo": "vitest"
}
```

**Color Guidelines:**
| Condition | Color |
|-----------|-------|
| Excellent (≥90%) | `brightgreen` |
| Good (≥80%) | `green` |
| Warning (≥60%) | `yellow` |
| Needs Work (≥40%) | `orange` |
| Critical (<40%) | `red` |

### 9. Container & Registry Badges

```markdown
[![Docker Image](https://img.shields.io/docker/image-size/{owner}/{repo}?logo=docker)](https://hub.docker.com/r/{owner}/{repo})
[![GHCR](https://img.shields.io/badge/GHCR-published-blue?logo=github)](https://github.com/{owner}/{repo}/pkgs/container/{repo})
[![Docker Pulls](https://img.shields.io/docker/pulls/{owner}/{repo}?logo=docker)](https://hub.docker.com/r/{owner}/{repo})
```

### 10. Activity & Community Badges

```markdown
[![Last Commit](https://img.shields.io/github/last-commit/{owner}/{repo})](https://github.com/{owner}/{repo}/commits/main)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/{owner}/{repo})](https://github.com/{owner}/{repo}/pulse)
[![Contributors](https://img.shields.io/github/contributors/{owner}/{repo})](https://github.com/{owner}/{repo}/graphs/contributors)
[![Forks](https://img.shields.io/github/forks/{owner}/{repo})](https://github.com/{owner}/{repo}/network/members)
```

## Badge Update Protocol

### Step 1: Extract Repository Info
```bash
# Get owner/repo from git remote
REMOTE_URL=$(git remote get-url origin)
OWNER=$(echo $REMOTE_URL | sed -E 's/.*[:/]([^/]+)\/[^/]+\.git$/\1/')
REPO=$(echo $REMOTE_URL | sed -E 's/.*\/([^/]+)\.git$/\1/')
```

### Step 2: Detect Available Workflows
Scan `.github/workflows/` for available CI/CD pipelines:
- `ci.yml` → Add CI badge
- `security.yml` → Add Security badge
- `code-quality.yml` → Add Code Quality badge
- `performance.yml` → Add Performance badge
- `docker-build.yml` → Add Docker badge
- `docs.yml` → Add Documentation badge
- `sonar.yml` → Add SonarCloud badge

### Step 3: Detect Third-Party Integrations
Check for configuration files:
- `codecov.yml` or `.codecov.yml` → Add Codecov badge
- `sonar-project.properties` → Add SonarCloud badges
- `.snyk` → Add Snyk badge
- `.dependabot/config.yml` or `.github/dependabot.yml` → Add Dependabot badge
- `stryker.config.json` or `stryker.conf.js` → Add Stryker mutation testing badge
- `.jscpd.json` → Add code duplication badge
- `k6` or `tests/performance/` → Add performance testing badge
- `Dockerfile` → Add Docker/container badge
- `grafana/` → Add Grafana dashboards badge

### Step 3.5: Check GitHub Features
Detect enabled GitHub features:
- **GitHub Security tab** → Add CodeQL badge (auto-enabled for JS/TS repos)
- **Dependabot alerts** → Add Dependabot status badge
- **GitHub Pages** → Add documentation deployed badge
- **GitHub Actions** → Add workflow status badges
- **GitHub Container Registry** → Add container published badge
- **GitHub Releases** → Add latest release badge

```bash
# Check for GitHub Pages
if gh api repos/{owner}/{repo}/pages 2>/dev/null | jq -e '.url' > /dev/null; then
  echo "GitHub Pages enabled"
fi

# Check for Dependabot
if [ -f ".github/dependabot.yml" ]; then
  echo "Dependabot configured"
fi

# Check for container registry packages
if gh api users/{owner}/packages?package_type=container 2>/dev/null | jq -e '.[].name' | grep -q "$REPO"; then
  echo "Container published to GHCR"
fi
```

### Step 4: Update README Badge Section

1. **Find badge section** in README.md (between `## Badges` and next `---` or `##`)
2. **Generate** new badge markdown based on detected workflows/integrations
3. **Replace** existing badge section with updated badges
4. **Maintain** badge category organization

### Step 5: Generate Coverage Badge JSON

If coverage data is available, create/update `docs/coverage-badge.json`:

```javascript
// Determine badge color based on coverage percentage
const color = coverage >= 80 ? 'brightgreen' :
              coverage >= 70 ? 'green' :
              coverage >= 60 ? 'yellow' :
              coverage >= 50 ? 'orange' : 'red';

const badge = {
  schemaVersion: 1,
  label: "coverage",
  message: `${coverage}%`,
  color: color
};
```

---

# PHASE 5: GITHUB PAGES STATIC CONTENT

## Overview

Generate and maintain static HTML pages for GitHub Pages deployment, including test reports, security scans, coverage trends, and API documentation.

## Static Page Categories

### 1. API Documentation (`index.html`)

**Content:** OpenAPI/Swagger documentation rendered with Redoc or Swagger UI

**Source Files:**
- `docs/openapi.json` - OpenAPI specification
- `src/schemas/*.ts` - Schema definitions

**Generation:**
```bash
npm run openapi:generate  # Generate OpenAPI spec
npm run openapi:spec      # Export to JSON
```

**Template:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>API Documentation</title>
  <link rel="icon" type="image/svg+xml" href="...">
</head>
<body>
  <redoc spec-url="openapi.json" ...></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>
```

### 2. Coverage Trends (`coverage-trends.html`)

**Content:** Historical coverage visualization with charts

**Source Files:**
- `coverage/coverage-summary.json` - Current coverage
- `docs/coverage-history.json` - Historical data

**Template Elements:**
- Line chart showing coverage over time
- Table of recent coverage changes
- Breakdown by metric (lines, statements, branches, functions)

**Data Format (`coverage-history.json`):**
```json
{
  "history": [
    {
      "date": "2026-01-01",
      "commit": "abc1234",
      "statements": 82.5,
      "branches": 76.3,
      "functions": 55.2,
      "lines": 81.8
    }
  ]
}
```

### 3. Test Reports (`test-reports.html`)

**Content:** Aggregated test results from all test types

**Source Files:**
- CI workflow artifacts (unit, integration, E2E, chaos, performance)
- `vitest.config.*.ts` - Test configuration

**Template Elements:**
- Summary statistics (total tests, passing, failing, skipped)
- Test execution time breakdown
- Coverage summary
- Links to detailed reports

### 4. Security Reports (`security-summary.html`)

**Content:** Aggregated security scan results

**Source Files:**
- Security workflow artifacts
- `npm-audit-report.json` - NPM audit results
- `snyk.sarif` - Snyk results
- `trivy-results.sarif` - Trivy results
- `dependency-check-report.*` - OWASP results
- `licenses.json` - License compliance report

**Template Elements:**
- Vulnerability summary by severity (Critical, High, Medium, Low)
- Scan status table (npm audit, Snyk, OWASP, Trivy, CodeQL)
- License compliance status with restricted license detection
- Container security scan results
- Last scan timestamp and scan history
- Links to GitHub Security tab and detailed SARIF reports

**Generation Script (suggested `scripts/security/generate-summary.sh`):**
```bash
#!/bin/bash
# Generate security-summary.html from scan artifacts

OUTPUT_FILE="docs/security-summary.html"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Parse npm audit results
if [ -f npm-audit-report.json ]; then
  CRITICAL=$(jq '.metadata.vulnerabilities.critical // 0' npm-audit-report.json)
  HIGH=$(jq '.metadata.vulnerabilities.high // 0' npm-audit-report.json)
  MODERATE=$(jq '.metadata.vulnerabilities.moderate // 0' npm-audit-report.json)
  LOW=$(jq '.metadata.vulnerabilities.low // 0' npm-audit-report.json)
else
  CRITICAL=0; HIGH=0; MODERATE=0; LOW=0
fi

# Create JSON endpoint for badge
cat > docs/security-badge.json << EOF
{
  "schemaVersion": 1,
  "label": "security",
  "message": "$CRITICAL critical, $HIGH high",
  "color": "$([ $CRITICAL -eq 0 ] && [ $HIGH -eq 0 ] && echo 'brightgreen' || echo 'red')"
}
EOF
```

**Security Summary Template (`docs/security-summary.html`):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Security Summary - {repo}</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔒</text></svg>">
  <style>
    /* Dark theme styles similar to reports-summary.html */
    :root { --bg-primary: #0f172a; --bg-secondary: #1e293b; }
    body { font-family: system-ui; background: var(--bg-primary); color: #f1f5f9; }
    .scan-card { background: var(--bg-secondary); border-radius: 12px; padding: 1.5rem; margin: 1rem 0; }
    .severity-critical { color: #ef4444; }
    .severity-high { color: #f97316; }
    .severity-medium { color: #eab308; }
    .severity-low { color: #22c55e; }
    .scan-status { display: flex; align-items: center; gap: 0.5rem; }
    .status-pass { color: #22c55e; }
    .status-fail { color: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔒 Security Summary</h1>
    <p>Last scanned: <span id="lastScan">{{LAST_SCAN}}</span></p>

    <!-- Vulnerability Summary -->
    <div class="scan-card">
      <h2>Vulnerability Summary</h2>
      <div class="severity-grid">
        <div class="severity-item severity-critical">Critical: {{CRITICAL}}</div>
        <div class="severity-item severity-high">High: {{HIGH}}</div>
        <div class="severity-item severity-medium">Medium: {{MEDIUM}}</div>
        <div class="severity-item severity-low">Low: {{LOW}}</div>
      </div>
    </div>

    <!-- Scan Results Table -->
    <div class="scan-card">
      <h2>Scan Results</h2>
      <table>
        <tr><th>Scan Type</th><th>Status</th><th>Last Run</th></tr>
        <tr><td>npm audit</td><td class="scan-status">{{NPM_STATUS}}</td><td>{{NPM_DATE}}</td></tr>
        <tr><td>Snyk</td><td class="scan-status">{{SNYK_STATUS}}</td><td>{{SNYK_DATE}}</td></tr>
        <tr><td>OWASP</td><td class="scan-status">{{OWASP_STATUS}}</td><td>{{OWASP_DATE}}</td></tr>
        <tr><td>Trivy</td><td class="scan-status">{{TRIVY_STATUS}}</td><td>{{TRIVY_DATE}}</td></tr>
        <tr><td>CodeQL</td><td class="scan-status">{{CODEQL_STATUS}}</td><td>{{CODEQL_DATE}}</td></tr>
        <tr><td>License Check</td><td class="scan-status">{{LICENSE_STATUS}}</td><td>{{LICENSE_DATE}}</td></tr>
      </table>
    </div>

    <!-- Links -->
    <div class="scan-card">
      <h2>Detailed Reports</h2>
      <a href="https://github.com/{{OWNER}}/{{REPO}}/security">GitHub Security Tab</a>
      <a href="https://github.com/{{OWNER}}/{{REPO}}/actions/workflows/security.yml">Security Workflow</a>
    </div>
  </div>
</body>
</html>
```

### 5. Dashboards Index (`dashboards-index.html`)

**Content:** Links to Grafana dashboards and alert definitions

**Source Files:**
- `grafana/dashboards/*.json` - Dashboard definitions
- `grafana/alerts/*.yml` - Alert rules

**Template Elements:**
- Dashboard previews/thumbnails
- Alert rule summaries
- Quick links to local Grafana (localhost:3001)

### 6. Reports Summary (`reports-summary.html`)

**Content:** Central hub linking all reports

**Template Elements:**
- Grid of report cards
- Quick stats summary
- Last updated timestamps

## Static Page Generation Workflow

### Step 1: Gather Source Data

```bash
# Coverage
if [ -f coverage/coverage-summary.json ]; then
  cp coverage/coverage-summary.json docs/
fi

# Update history
./scripts/coverage/update-history.sh

# OpenAPI
npm run openapi:spec
cp docs/openapi.json _site/
```

### Step 2: Generate HTML Pages

For each page type:
1. Read template from `docs/templates/` (or inline in workflow)
2. Inject data from source files
3. Write to `_site/` directory

### Step 3: Copy Static Assets

```bash
# Copy all HTML pages
cp docs/*.html _site/

# Copy JSON data files
cp docs/*.json _site/

# Copy Grafana assets
cp -r grafana/dashboards _site/grafana/
cp -r grafana/alerts _site/grafana/

# Copy markdown docs for reference
cp docs/*.md _site/
```

### Step 4: Deploy to GitHub Pages

Via GitHub Actions workflow (`.github/workflows/docs.yml`):
1. Build documentation
2. Run tests with coverage
3. Generate static pages
4. Upload artifact
5. Deploy to GitHub Pages

## Automated Page Updates

### On Push to Main

1. **Coverage Page** - Updated with latest coverage data
2. **API Docs** - Updated if OpenAPI spec changed
3. **Coverage Badge JSON** - Updated with new coverage percentage

### On PR Creation

1. **Coverage Diff** - Comment on PR with coverage changes
2. **Security Summary** - Comment with security scan results
3. **Test Results** - Comment with test execution summary

### Scheduled (Daily/Weekly)

1. **Security Reports** - Update with latest vulnerability scans
2. **Dependency Status** - Update with npm audit results

## Page Templates Directory

Create `docs/templates/` with:
```
docs/templates/
├── coverage-trends.html.template
├── test-reports.html.template
├── security-summary.html.template
├── dashboards-index.html.template
└── reports-summary.html.template
```

Each template uses placeholders:
- `{{COVERAGE_DATA}}` - JSON data for charts
- `{{LAST_UPDATED}}` - Timestamp
- `{{REPOSITORY}}` - owner/repo
- `{{SUMMARY_TABLE}}` - Generated HTML table

---

# EXECUTION WORKFLOW

## Phase 1: Analysis
1. **Glob** all .md files in target directories
2. **Read** each file to understand content
3. **Compare** against source code existence
4. **Identify** issues (duplicates, orphans, stubs, unfeasible items)

## Phase 2: Cleanup
1. **Remove** unfeasible checklist items
2. **Mark** completed items with `[x]`
3. **Delete** empty/stub files
4. **Archive** outdated files to 99-archive/

## Phase 3: Restructure
1. **Rename** files to follow conventions
2. **Move** files to appropriate directories
3. **Merge** duplicate content
4. **Create** missing index files

## Phase 4: Update Content
1. **Update** all cross-references
2. **Fix** broken links
3. **Add** missing sections
4. **Update** timestamps

## Phase 5: Badge Management
1. **Extract** repository owner/name from git remote
2. **Scan** `.github/workflows/` for available CI/CD pipelines
3. **Detect** third-party integrations (Codecov, SonarCloud, Snyk)
4. **Check** GitHub features (Pages, Dependabot, GHCR, Releases)
5. **Generate** badge markdown for each detected service
6. **Update** README.md badge section with new badges
7. **Create/Update** dynamic badge JSON files:
   - `docs/coverage-badge.json` - Code coverage
   - `docs/security-badge.json` - Security scan status
   - `docs/test-badge.json` - Test results summary
   - `docs/performance-badge.json` - Performance metrics
8. **Verify** all badge links are valid and images render

## Phase 5.5: Badge Validation
1. **Check** badge image URLs return 200 status
2. **Verify** endpoint badges have valid JSON structure
3. **Test** links point to valid destinations
4. **Report** any broken or missing badges

## Phase 6: Static Pages Generation
1. **Gather** source data from multiple sources:
   - `coverage/coverage-summary.json` - Test coverage
   - `docs/openapi.json` - API specification
   - `npm-audit-report.json` - Security audit (if available)
   - `docs/coverage-history.json` - Historical coverage
   - `grafana/dashboards/*.json` - Dashboard definitions
   - CI workflow artifacts - Test and security results
2. **Generate** HTML pages from templates:
   - `index.html` - API Documentation (Redoc)
   - `coverage-trends.html` - Coverage visualization
   - `test-reports.html` - Test execution summary
   - `security-summary.html` - Security scan results
   - `dashboards-index.html` - Grafana dashboard links
   - `reports-summary.html` - Central reports hub
3. **Generate** JSON data endpoints for dynamic badges:
   - `coverage-badge.json` - Dynamic coverage badge
   - `security-badge.json` - Security scan status badge
   - `test-badge.json` - Test results badge
   - `performance-badge.json` - Performance metrics badge
4. **Copy** static assets to `_site/` directory
5. **Verify** all pages render correctly with valid links
6. **Deploy** to GitHub Pages via workflow

## Phase 7: Verify & Report
1. **Verify** all links work
2. **Check** no orphaned files
3. **Ensure** all directories have indexes
4. **Validate** badges are rendering correctly
5. **Confirm** GitHub Pages deployment status
6. **Generate** sync & organization report

---

# OUTPUT REPORT

Save comprehensive report to: `plan/09-reports/DOCS_SYNC_[DATE].md`

```markdown
# Documentation Sync & Organization Report

**Date**: [timestamp]

## Executive Summary

- **Files Analyzed**: X
- **Checklists Marked Complete**: Y
- **Unfeasible Items Removed**: Z
- **Files Renamed**: A
- **Files Moved**: B
- **Files Archived**: C
- **Files Deleted**: D

## Synchronization Results

### Items Marked Complete
- [x] Implement timezone handling - `src/services/timezone.service.ts`
- [x] Add unit tests - `tests/unit/services/`

### Items Removed (Unfeasible)
| File | Item Removed | Reason |
|------|--------------|--------|
| plan.md | Create demo video | External resource |
| plan.md | Deploy to production | Outside scope |

### Items Still Pending
- [ ] Add mutation testing - Priority: Medium
- [ ] Improve cache hit rate - Priority: Low

## Organization Results

### Files Renamed
| Original | New Name | Reason |
|----------|----------|--------|
| old-name.md | new-name.md | Naming convention |

### Files Moved
| File | From | To | Reason |
|------|------|-----|--------|
| file.md | docs/ | docs/testing/ | Better organization |

### Files Archived
| File | Reason |
|------|--------|
| old-plan.md | Fully implemented |

### Files Deleted
| File | Reason |
|------|--------|
| stub.md | Empty file |

## New Structure

[Tree view of new structure]

## Badge Management Results

### Badges Updated
| Badge Type | Status | Source |
|------------|--------|--------|
| CI/CD | ✅ Updated | `.github/workflows/ci.yml` |
| Security | ✅ Updated | `.github/workflows/security.yml` |
| Coverage | ✅ Updated | `docs/coverage-badge.json` |
| Performance | ⚠️ Skipped | No metrics available |

### Dynamic Badge Endpoints
| Endpoint | Status | Color |
|----------|--------|-------|
| `coverage-badge.json` | ✅ Generated | brightgreen (85%) |
| `security-badge.json` | ✅ Generated | brightgreen (0 critical) |
| `test-badge.json` | ✅ Generated | brightgreen (992 passing) |

### Third-Party Integrations Detected
- ✅ Codecov - Badge added
- ✅ SonarCloud - Badge added
- ✅ Snyk - Badge added (if token configured)
- ✅ Dependabot - Badge added

## GitHub Pages Results

### Static Pages Generated
| Page | Status | Last Updated |
|------|--------|--------------|
| `index.html` (API Docs) | ✅ Generated | [timestamp] |
| `coverage-trends.html` | ✅ Generated | [timestamp] |
| `test-reports.html` | ✅ Generated | [timestamp] |
| `security-summary.html` | ✅ Generated | [timestamp] |
| `dashboards-index.html` | ✅ Generated | [timestamp] |
| `reports-summary.html` | ✅ Generated | [timestamp] |

### Assets Copied
- OpenAPI spec (`openapi.json`)
- Coverage history (`coverage-history.json`)
- Badge endpoints (`*-badge.json`)
- Grafana dashboards (`grafana/dashboards/*.json`)
- Grafana alerts (`grafana/alerts/*.yml`)
- Documentation files (`*.md`)

### Deployment Status
- **GitHub Pages URL**: https://{owner}.github.io/{repo}/
- **Deployment Status**: ✅ Deployed
- **Last Deployed**: [timestamp]

## Recommendations

1. [Suggestions for future improvements]
```

---

## BEGIN SYNCHRONIZATION & ORGANIZATION

Use Task tool agents as needed:
- `Explore` agent for comprehensive codebase scanning
- `haiku` for file existence checks and simple operations
- `sonnet` for content analysis, updates, and restructuring
- `opus` for complex restructuring decisions
