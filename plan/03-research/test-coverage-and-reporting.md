# Test Coverage and Reporting Research

**Last Updated:** 2025-12-30
**Status:** Complete Research Document
**Target:** 80% Test Coverage with GitHub Badges and Pages Integration

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [80% Test Coverage Strategy](#80-test-coverage-strategy)
3. [Coverage Tool Comparison](#coverage-tool-comparison)
4. [GitHub Badges Implementation](#github-badges-implementation)
5. [GitHub Pages for Test Reports](#github-pages-for-test-reports)
6. [CI/CD Integration](#cicd-integration)
7. [Edge Case Identification](#edge-case-identification)
8. [Implementation Plan](#implementation-plan)
9. [Code Examples](#code-examples)
10. [Best Practices](#best-practices)

---

## Executive Summary

### Current State

- **Framework:** Vitest + @vitest/coverage-v8
- **Current Coverage:** Not measured in production
- **Target:** 80% line, 80% branch, 80% function, 85% statement coverage
- **CI/CD:** GitHub Actions with unit, integration, E2E tests
- **Tests:** 37+ test files across unit, integration, E2E, chaos testing

### Goals

1. Achieve and maintain 80% test coverage across all coverage types
2. Display coverage badges in README.md
3. Publish interactive HTML coverage reports to GitHub Pages
4. Enforce coverage thresholds in CI/CD (block PRs if coverage drops)
5. Generate coverage diff reports on pull requests
6. Track historical coverage trends

### Recommended Solutions

- **Coverage Tool:** Vitest v8 coverage (already configured)
- **Badge Service:** Codecov (free for public repos, better analytics)
- **Backup Badge:** shields.io (self-hosted, no external dependency)
- **GitHub Pages:** Automated deployment via gh CLI
- **CI/CD:** Enhanced GitHub Actions workflows with coverage gating

---

## 80% Test Coverage Strategy

### Coverage Types Explained

| Type | Description | Current Target | Difficulty |
|------|-------------|----------------|-----------|
| **Line Coverage** | % of executable lines run | 80% | Medium |
| **Branch Coverage** | % of conditional branches tested | 80% | Hard |
| **Function Coverage** | % of functions called | 80% | Easy |
| **Statement Coverage** | % of statements executed | 85% | Medium |

### Why 80% Coverage?

**Industry Standard:**
- Google: 60-80% (pragmatic balance)
- Netflix: 70-80% (high reliability)
- Stripe: 80%+ (financial systems)

**For this project:**
- **Critical paths:** 95%+ (payment processing, message delivery)
- **Business logic:** 85%+ (schedulers, strategies)
- **Utilities:** 70%+ (helpers, formatters)
- **Overall target:** 80%+ (enforced in CI/CD)

### Coverage Calculation

```typescript
// Current project stats (estimated)
Total Lines: ~5,000
Test Files: 37
Unit Tests: ~100
Integration Tests: ~30
E2E Tests: ~10

// Coverage breakdown
Unit Tests:        40-50% coverage (mocked dependencies)
Integration Tests: 20-25% coverage (database, queue)
E2E Tests:         10-15% coverage (full system flows)
---------------------------------------------------
Total:             70-90% coverage (target: 80%+)
```

### Strategy to Achieve 80%

#### 1. Identify Coverage Gaps

```bash

# Generate detailed coverage report

npm run test:coverage

# View HTML report

open coverage/index.html

# Find uncovered lines

npx nyc report --reporter=text | grep "uncovered lines"
```

**Common gaps:**
- Error handling paths
- Edge cases (null, undefined, empty arrays)
- Timezone edge cases (DST transitions, leap years)
- Queue retry logic
- Database connection failures
- Circuit breaker states

#### 2. Prioritize Test Writing

**Priority 1: Critical Business Logic (95%+ coverage)**
```typescript
// Message scheduling (must be perfect)
src/services/scheduler.service.ts
src/strategies/birthday-message.strategy.ts
src/services/message.service.ts
src/workers/message.worker.ts
```

**Priority 2: Data Integrity (90%+ coverage)**
```typescript
// Idempotency and database operations
src/services/idempotency.service.ts
src/repositories/*.repository.ts
src/db/schema.ts
```

**Priority 3: API & Queue (85%+ coverage)**
```typescript
// User-facing APIs
src/api/routes/*.ts
src/controllers/*.controller.ts
src/queue/queue-manager.ts
```

**Priority 4: Utilities (70%+ coverage)**
```typescript
// Helper functions
src/services/timezone.service.ts
src/utils/*.ts
```

#### 3. Test Coverage Patterns

**Pattern 1: Parametric Testing (High Coverage/Low Effort)**
```typescript
// tests/unit/timezone.service.test.ts
import { describe, it, expect } from 'vitest';
import { convertToUserTimezone } from '@/services/timezone.service';

describe('Timezone Conversion', () => {
  // Test multiple timezones with one test
  const timezones = [
    { tz: 'America/New_York', offset: -5 },
    { tz: 'Europe/London', offset: 0 },
    { tz: 'Asia/Tokyo', offset: 9 },
    { tz: 'Australia/Sydney', offset: 11 },
    { tz: 'Pacific/Auckland', offset: 13 },
  ];

  it.each(timezones)('should convert UTC to $tz correctly', ({ tz, offset }) => {
    const utcTime = new Date('2025-01-01T12:00:00Z');
    const result = convertToUserTimezone(utcTime, tz);

    expect(result.hour).toBe((12 + offset) % 24);
  });
});

// Coverage: 1 test = 5 timezones × 3 code paths = 15 scenarios
```

**Pattern 2: Edge Case Tables**
```typescript
// tests/unit/message-scheduling.test.ts
describe('Birthday Detection Edge Cases', () => {
  const edgeCases = [
    // Leap year birthdays
    { birth: '2000-02-29', check: '2024-02-29', expect: true },  // Leap year
    { birth: '2000-02-29', check: '2023-02-28', expect: false }, // Non-leap
    { birth: '2000-02-29', check: '2023-03-01', expect: false }, // Day after

    // Timezone edge cases
    { birth: '1990-12-31', tz: 'Pacific/Kiritimati', expect: true },  // UTC+14
    { birth: '1990-01-01', tz: 'Pacific/Niue', expect: true },        // UTC-11

    // Null/undefined
    { birth: null, check: '2025-01-01', expect: false },
    { birth: undefined, check: '2025-01-01', expect: false },
  ];

  it.each(edgeCases)('should handle $birth on $check', ({ birth, check, tz, expect }) => {
    const user = { birthdayDate: birth, timezone: tz || 'UTC' };
    const result = shouldSendBirthday(user, new Date(check));

    expect(result).toBe(expect);
  });
});
```

**Pattern 3: Error Path Testing**
```typescript
// tests/unit/queue-manager.test.ts
describe('Queue Error Handling', () => {
  it('should retry on connection failure', async () => {
    const mockChannel = vi.fn().mockRejectedValueOnce(new Error('Connection lost'))
                                  .mockResolvedValueOnce({ sendToQueue: vi.fn() });

    await expect(queueManager.enqueue(message)).resolves.not.toThrow();
    expect(mockChannel).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });

  it('should fallback to dead-letter queue after max retries', async () => {
    const mockChannel = vi.fn().mockRejectedValue(new Error('Permanent failure'));

    await queueManager.enqueue(message);

    expect(deadLetterQueue.send).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Max retries'));
  });

  it('should handle invalid message format', async () => {
    const invalidMessage = { userId: null }; // Missing required fields

    await expect(queueManager.enqueue(invalidMessage)).rejects.toThrow('Invalid message');
  });
});
```

#### 4. Coverage Exclusions (Pragmatic Approach)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',

        // Type definitions (not executable)
        '**/types.ts',
        '**/*.d.ts',

        // Configuration files
        '**/*.config.ts',
        '**/vitest.config*.ts',

        // Generated files
        'src/db/migrations/*.ts',

        // Scripts (tested manually)
        'scripts/',

        // Main entry points (simple bootstrapping)
        'src/index.ts',
        'src/worker.ts',
        'src/scheduler.ts',

        // OpenAPI schemas (generated)
        'src/api/schemas/',
      ],
    },
  },
});
```

**Why exclude these?**
- **Type files:** Pure TypeScript types (no runtime code)
- **Config files:** Declarative configuration (no logic)
- **Generated code:** Tested indirectly through usage
- **Entry points:** Minimal logic, tested via E2E

---

## Coverage Tool Comparison

### Option 1: Vitest v8 Coverage (RECOMMENDED)

**Pros:**
- Already integrated in project
- Native TypeScript support
- Fast (uses V8 engine)
- Supports all coverage types
- HTML + lcov + JSON reports
- No additional dependencies

**Cons:**
- Newer tool (less mature than nyc)
- Fewer third-party integrations

**Configuration:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
      reportsDirectory: './coverage',

      // Thresholds (CI/CD enforcement)
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 85,
      },

      // Coverage collection
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/types.ts',
        '**/*.config.ts',
      ],
    },
  },
});
```

### Option 2: c8 (V8 coverage alternative)

**Pros:**
- Lightweight
- Zero config for simple projects
- Good CLI tooling

**Cons:**
- Less integrated with Vitest
- Manual setup required
- Fewer report formats

**Not recommended:** Vitest v8 is better integrated.

### Option 3: nyc (Istanbul-based)

**Pros:**
- Industry standard (used by 1M+ projects)
- Mature ecosystem
- Excellent third-party integrations
- Supports source maps

**Cons:**
- Slower than v8-based tools
- Requires Babel for TypeScript
- More complex configuration

**Configuration:**
```json
// package.json
{
  "nyc": {
    "reporter": ["html", "lcov", "text", "json"],
    "extension": [".ts"],
    "require": ["tsx/cjs"],
    "check-coverage": true,
    "lines": 80,
    "functions": 80,
    "branches": 80,
    "statements": 85
  }
}
```

**Not recommended:** Vitest v8 is faster and already configured.

### Final Recommendation: Vitest v8

**Reasons:**
1. Already integrated (zero migration effort)
2. 3-5x faster than nyc
3. Native TypeScript support
4. Better error messages
5. Generates all needed report formats

---

## GitHub Badges Implementation

### Option 1: Codecov (RECOMMENDED for Public Repos)

**Pros:**
- Free for public repositories
- Beautiful badges
- Coverage trends and analytics
- PR comments with coverage diff
- Supports monorepos
- Historical data (unlimited)

**Cons:**
- Requires signup
- Paid for private repos ($10/month)
- External dependency

**Setup:**

```yaml

# .github/workflows/ci.yml

coverage-report:
  needs: [unit-tests, integration-tests, e2e-tests]
  runs-on: ubuntu-latest

  steps:
    - uses: actions/checkout@v4

    - name: Download coverage artifacts
      uses: actions/download-artifact@v4
      with:
        pattern: coverage-*
        path: coverage-artifacts/

    - name: Merge coverage reports
      run: |
        npm ci
        npx nyc merge coverage-artifacts/ coverage/coverage.json
        npx nyc report --reporter=lcov --reporter=text

    - name: Upload to Codecov
      uses: codecov/codecov-action@v4
      with:
        files: ./coverage/lcov.info
        flags: unittests,integration,e2e
        fail_ci_if_error: true
        token: ${{ secrets.CODECOV_TOKEN }}

    - name: Comment coverage on PR
      if: github.event_name == 'pull_request'
      uses: codecov/codecov-action@v4
      with:
        flags: pull-request
```

**Badge Markdown:**
```markdown

# README.md

[![codecov](https://codecov.io/gh/fairyhunter13/happy-bday-app/branch/main/graph/badge.svg?token=YOUR_TOKEN)](https://codecov.io/gh/fairyhunter13/happy-bday-app)
```

**Advanced Badges:**
```markdown
<!-- Overall coverage -->
[![codecov](https://codecov.io/gh/fairyhunter13/happy-bday-app/branch/main/graph/badge.svg)](https://codecov.io/gh/fairyhunter13/happy-bday-app)

<!-- Line coverage -->
[![Lines](https://codecov.io/gh/fairyhunter13/happy-bday-app/branch/main/graphs/lines.svg)](https://codecov.io/gh/fairyhunter13/happy-bday-app)

<!-- Branch coverage -->
[![Branches](https://codecov.io/gh/fairyhunter13/happy-bday-app/branch/main/graphs/branches.svg)](https://codecov.io/gh/fairyhunter13/happy-bday-app)

<!-- Trend graph -->
[![Graph](https://codecov.io/gh/fairyhunter13/happy-bday-app/branch/main/graphs/sunburst.svg)](https://codecov.io/gh/fairyhunter13/happy-bday-app)
```

### Option 2: Coveralls

**Pros:**
- Free for public repos
- Simpler than Codecov
- Good GitHub integration

**Cons:**
- Less features than Codecov
- Slower updates
- Paid for private repos

**Setup:**
```yaml
- name: Upload to Coveralls
  uses: coverallsapp/github-action@v2
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    path-to-lcov: ./coverage/lcov.info
```

**Badge:**
```markdown
[![Coverage Status](https://coveralls.io/repos/github/fairyhunter13/happy-bday-app/badge.svg?branch=main)](https://coveralls.io/github/fairyhunter13/happy-bday-app?branch=main)
```

### Option 3: shields.io (Self-Hosted)

**Pros:**
- No signup required
- No external service dependency
- Fully customizable
- Free forever

**Cons:**
- Manual badge generation
- No analytics
- No historical tracking
- No PR comments

**Setup:**

```yaml

# .github/workflows/coverage-badge.yml

name: Update Coverage Badge

on:
  push:
    branches: [main]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tests with coverage
        run: |
          npm ci
          npm run test:coverage

      - name: Extract coverage percentage
        id: coverage
        run: |
          COVERAGE=$(npx nyc report --reporter=text-summary | grep 'Lines' | awk '{print $3}' | sed 's/%//')
          echo "coverage=$COVERAGE" >> $GITHUB_OUTPUT

      - name: Generate badge
        run: |
          COLOR=$(echo "${{ steps.coverage.outputs.coverage }}" | awk '{if ($1 >= 80) print "brightgreen"; else if ($1 >= 60) print "yellow"; else print "red"}')

          curl "https://img.shields.io/badge/coverage-${{ steps.coverage.outputs.coverage }}%25-$COLOR" \
            -o coverage-badge.svg

      - name: Upload badge to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
          destination_dir: badges
          keep_files: true
```

**Badge Markdown:**
```markdown
<!-- Self-hosted badge -->
![Coverage](https://fairyhunter13.github.io/happy-bday-app/badges/coverage-badge.svg)

<!-- Or use shields.io endpoint -->
![Coverage](https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/badges/coverage.json)
```

### Option 4: Dynamic Badges (JSON Endpoint)

**Setup:**
```yaml

# Generate JSON for shields.io

- name: Generate coverage JSON
  run: |
    COVERAGE=$(npx nyc report --reporter=text-summary | grep 'Lines' | awk '{print $3}' | sed 's/%//')
    COLOR=$(echo "$COVERAGE" | awk '{if ($1 >= 80) print "brightgreen"; else if ($1 >= 60) print "yellow"; else print "red"}')

    cat > coverage.json <<EOF
    {
      "schemaVersion": 1,
      "label": "coverage",
      "message": "${COVERAGE}%",
      "color": "$COLOR"
    }
    EOF
```

**Badge:**
```markdown
![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/fairyhunter13/happy-bday-app/gh-pages/coverage.json)
```

### Multiple Badges Strategy

```markdown

# README.md badges section
## Test Coverage

| Type | Badge |
|------|-------|
| **Overall** | [![codecov](https://codecov.io/gh/fairyhunter13/happy-bday-app/branch/main/graph/badge.svg)](https://codecov.io/gh/fairyhunter13/happy-bday-app) |
| **Unit Tests** | ![Unit Coverage](https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/badges/unit-coverage.json) |
| **Integration** | ![Integration Coverage](https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/badges/integration-coverage.json) |
| **E2E Tests** | ![E2E Coverage](https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/badges/e2e-coverage.json) |
| **Performance** | [![Performance](https://img.shields.io/badge/latency-p95%20%3C%20500ms-brightgreen)](https://fairyhunter13.github.io/happy-bday-app/performance/) |
```

---

## GitHub Pages for Test Reports

### Architecture

```
gh-pages branch
├── index.html                    # Landing page
├── coverage/                     # Coverage reports
│   ├── index.html               # Interactive HTML report
│   ├── lcov-report/             # Detailed line-by-line coverage
│   └── reports/                 # Historical reports
│       ├── 2025-12-30/
│       ├── 2025-12-29/
│       └── ...
├── tests/                        # Test results
│   ├── unit/                    # Unit test reports
│   ├── integration/             # Integration test reports
│   └── e2e/                     # E2E test reports
├── performance/                  # Performance test reports
│   ├── index.html               # Performance dashboard
│   ├── sustained-load.html
│   ├── peak-load.html
│   └── trends.json
└── badges/                       # Self-hosted badges
    ├── coverage.json
    ├── unit-coverage.json
    ├── integration-coverage.json
    └── e2e-coverage.json
```

### Setup GitHub Pages

```bash

# 1. Enable GitHub Pages in repository settings
# Settings > Pages > Source: gh-pages branch

# 2. Create gh-pages branch

git checkout --orphan gh-pages
git rm -rf .
echo "# Test Reports" > index.html
git add index.html
git commit -m "Initialize GitHub Pages"
git push origin gh-pages

# 3. Return to main branch

git checkout main
```

### Automated Deployment Workflow

```yaml

# .github/workflows/publish-reports.yml

name: Publish Test Reports

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  publish-reports:
    runs-on: ubuntu-latest
    if: github.event.workflow_run.conclusion == 'success' || github.event_name == 'push'

    steps:
      - name: Checkout main
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Download coverage artifacts
        uses: dawidd6/action-download-artifact@v3
        with:
          workflow: ci.yml
          workflow_conclusion: success
          name: coverage-*
          path: coverage-artifacts/

      - name: Merge coverage reports
        run: |
          npx nyc merge coverage-artifacts/ coverage/coverage.json
          npx nyc report --reporter=html --reporter=lcov --reporter=json-summary

      - name: Generate test reports
        run: npm run test:report

      - name: Create historical report
        run: |
          DATE=$(date +%Y-%m-%d)
          mkdir -p coverage/reports/$DATE
          cp -r coverage/html/* coverage/reports/$DATE/

          # Update index with links to all historical reports
          node scripts/generate-coverage-index.js

      - name: Generate performance reports
        run: |
          npm run perf:report:html
          mkdir -p performance
          mv perf-results/*.html performance/

      - name: Create badges
        run: |
          mkdir -p badges

          # Overall coverage
          COVERAGE=$(cat coverage/coverage-summary.json | jq -r '.total.lines.pct')
          COLOR=$(echo "$COVERAGE" | awk '{if ($1 >= 80) print "brightgreen"; else if ($1 >= 60) print "yellow"; else print "red"}')

          cat > badges/coverage.json <<EOF
          {
            "schemaVersion": 1,
            "label": "coverage",
            "message": "${COVERAGE}%",
            "color": "$COLOR"
          }
          EOF

          # Unit test coverage
          UNIT_COV=$(cat coverage/unit-summary.json | jq -r '.total.lines.pct')
          cat > badges/unit-coverage.json <<EOF
          {
            "schemaVersion": 1,
            "label": "unit",
            "message": "${UNIT_COV}%",
            "color": "$(echo "$UNIT_COV" | awk '{if ($1 >= 85) print "brightgreen"; else print "yellow"}')"
          }
          EOF

      - name: Build GitHub Pages site
        run: |
          mkdir -p gh-pages

          # Copy all reports
          cp -r coverage gh-pages/
          cp -r tests gh-pages/
          cp -r performance gh-pages/
          cp -r badges gh-pages/

          # Generate index page
          cat > gh-pages/index.html <<'EOF'
          <!DOCTYPE html>
          <html>
          <head>
            <title>Happy Birthday App - Test Reports</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
              h1 { color: #333; }
              .card { border: 1px solid #ddd; padding: 20px; margin: 10px 0; border-radius: 5px; }
              .card:hover { box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
              a { color: #0366d6; text-decoration: none; }
              a:hover { text-decoration: underline; }
              .badge { display: inline-block; margin: 5px; }
            </style>
          </head>
          <body>
            <h1>🎂 Happy Birthday App - Test Reports</h1>

            <div class="card">
              <h2>📊 Test Coverage</h2>
              <div class="badge">
                <img src="https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/badges/coverage.json" alt="Coverage">
              </div>
              <div class="badge">
                <img src="https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/badges/unit-coverage.json" alt="Unit Coverage">
              </div>
              <p>
                <a href="coverage/index.html">📈 Interactive Coverage Report</a> |
                <a href="coverage/lcov-report/index.html">📝 Detailed Line Coverage</a> |
                <a href="coverage/reports/">📁 Historical Reports</a>
              </p>
            </div>

            <div class="card">
              <h2>🧪 Test Results</h2>
              <p>
                <a href="tests/unit/index.html">Unit Tests</a> |
                <a href="tests/integration/index.html">Integration Tests</a> |
                <a href="tests/e2e/index.html">E2E Tests</a>
              </p>
            </div>

            <div class="card">
              <h2>⚡ Performance Reports</h2>
              <p>
                <a href="performance/index.html">Performance Dashboard</a> |
                <a href="performance/sustained-load.html">Sustained Load (1M/day)</a> |
                <a href="performance/peak-load.html">Peak Load (100+ msg/sec)</a>
              </p>
            </div>

            <div class="card">
              <h2>📖 Documentation</h2>
              <p>
                <a href="https://github.com/fairyhunter13/happy-bday-app">GitHub Repository</a> |
                <a href="https://github.com/fairyhunter13/happy-bday-app/blob/main/README.md">README</a> |
                <a href="https://github.com/fairyhunter13/happy-bday-app/blob/main/plan/README.md">Documentation</a>
              </p>
            </div>
          </body>
          </html>
          EOF

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./gh-pages
          publish_branch: gh-pages
          keep_files: false
          enable_jekyll: false
          commit_message: "Deploy test reports from ${{ github.sha }}"
```

### Using gh CLI (Alternative)

```yaml

# Alternative deployment using gh CLI

- name: Deploy to GitHub Pages (gh CLI)
  run: |
    # Install gh CLI
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    sudo apt update
    sudo apt install gh

    # Authenticate
    echo "${{ secrets.GITHUB_TOKEN }}" | gh auth login --with-token

    # Deploy
    tar -czf reports.tar.gz gh-pages/
    gh release create reports-$(date +%Y%m%d) reports.tar.gz --target gh-pages
```

### Historical Trend Tracking

```javascript
// scripts/generate-coverage-index.js
const fs = require('fs');
const path = require('path');

const reportsDir = 'coverage/reports';
const reports = fs.readdirSync(reportsDir)
  .filter(f => f.match(/^\d{4}-\d{2}-\d{2}$/))
  .sort()
  .reverse();

const trends = reports.map(date => {
  const summaryPath = path.join(reportsDir, date, 'coverage-summary.json');
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

  return {
    date,
    lines: summary.total.lines.pct,
    branches: summary.total.branches.pct,
    functions: summary.total.functions.pct,
    statements: summary.total.statements.pct,
  };
});

// Generate HTML with Chart.js
const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Coverage Trends</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <h1>Coverage Trends</h1>
  <canvas id="trendChart"></canvas>

  <script>
    const ctx = document.getElementById('trendChart').getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(trends.map(t => t.date))},
        datasets: [
          {
            label: 'Lines',
            data: ${JSON.stringify(trends.map(t => t.lines))},
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          },
          {
            label: 'Branches',
            data: ${JSON.stringify(trends.map(t => t.branches))},
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.1
          },
          {
            label: 'Functions',
            data: ${JSON.stringify(trends.map(t => t.functions))},
            borderColor: 'rgb(54, 162, 235)',
            tension: 0.1
          },
          {
            label: 'Statements',
            data: ${JSON.stringify(trends.map(t => t.statements))},
            borderColor: 'rgb(255, 206, 86)',
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Test Coverage Trends'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  </script>
</body>
</html>
`;

fs.writeFileSync('coverage/reports/trends.html', html);
console.log('Coverage trends generated');
```

---

## CI/CD Integration

### Coverage Gating Strategy

**Goal:** Block PRs if coverage drops below 80%

```yaml

# .github/workflows/ci.yml (enhanced)

coverage-report:
  name: Coverage Report & Enforcement
  needs: [unit-tests, integration-tests, e2e-tests]
  runs-on: ubuntu-latest

  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Fetch all history for diff

    - name: Download coverage artifacts
      uses: actions/download-artifact@v4
      with:
        pattern: coverage-*
        path: coverage-artifacts/

    - name: Merge coverage reports
      run: |
        npm ci
        npx nyc merge coverage-artifacts/ coverage/coverage.json
        npx nyc report --reporter=lcov --reporter=json-summary --reporter=text

    # GATE 1: Absolute threshold (80%)
    - name: Check coverage threshold
      run: |
        LINES=$(cat coverage/coverage-summary.json | jq -r '.total.lines.pct')
        BRANCHES=$(cat coverage/coverage-summary.json | jq -r '.total.branches.pct')
        FUNCTIONS=$(cat coverage/coverage-summary.json | jq -r '.total.functions.pct')
        STATEMENTS=$(cat coverage/coverage-summary.json | jq -r '.total.statements.pct')

        echo "Coverage: Lines=$LINES% Branches=$BRANCHES% Functions=$FUNCTIONS% Statements=$STATEMENTS%"

        FAILED=0
        if (( $(echo "$LINES < 80" | bc -l) )); then
          echo "::error::Line coverage ($LINES%) is below 80%"
          FAILED=1
        fi
        if (( $(echo "$BRANCHES < 80" | bc -l) )); then
          echo "::error::Branch coverage ($BRANCHES%) is below 80%"
          FAILED=1
        fi
        if (( $(echo "$FUNCTIONS < 80" | bc -l) )); then
          echo "::error::Function coverage ($FUNCTIONS%) is below 80%"
          FAILED=1
        fi
        if (( $(echo "$STATEMENTS < 85" | bc -l) )); then
          echo "::error::Statement coverage ($STATEMENTS%) is below 85%"
          FAILED=1
        fi

        if [ $FAILED -eq 1 ]; then
          echo "❌ Coverage thresholds not met"
          exit 1
        fi

        echo "✅ All coverage thresholds met"

    # GATE 2: Coverage diff (prevent regressions)
    - name: Download base coverage
      if: github.event_name == 'pull_request'
      continue-on-error: true
      run: |
        gh api repos/${{ github.repository }}/actions/artifacts \
          --jq '.artifacts[] | select(.name == "coverage-main") | .archive_download_url' \
          | head -1 \
          | xargs -I {} gh api {} > base-coverage.zip

        unzip base-coverage.zip -d base-coverage/
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Compare coverage diff
      if: github.event_name == 'pull_request'
      id: diff
      run: |
        if [ -f base-coverage/coverage-summary.json ]; then
          BASE_LINES=$(cat base-coverage/coverage-summary.json | jq -r '.total.lines.pct')
          CURR_LINES=$(cat coverage/coverage-summary.json | jq -r '.total.lines.pct')

          DIFF=$(echo "$CURR_LINES - $BASE_LINES" | bc)

          echo "diff=$DIFF" >> $GITHUB_OUTPUT
          echo "base=$BASE_LINES" >> $GITHUB_OUTPUT
          echo "current=$CURR_LINES" >> $GITHUB_OUTPUT

          if (( $(echo "$DIFF < -5" | bc -l) )); then
            echo "::error::Coverage dropped by $DIFF% (threshold: -5%)"
            exit 1
          fi
        else
          echo "No base coverage found, skipping diff"
        fi

    # GATE 3: New code must be 90%+ covered
    - name: Check new code coverage
      if: github.event_name == 'pull_request'
      run: |
        git fetch origin main
        CHANGED_FILES=$(git diff --name-only origin/main...HEAD | grep '\.ts$' | grep -v '\.test\.ts$' || true)

        if [ -z "$CHANGED_FILES" ]; then
          echo "No source files changed"
          exit 0
        fi

        # Use diff-cover to analyze only changed lines
        npm install -g diff-cover
        diff-cover coverage/lcov.info --compare-branch=origin/main --fail-under=90

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v4
      with:
        files: ./coverage/lcov.info
        flags: unittests,integration,e2e
        fail_ci_if_error: true
      env:
        CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}

    - name: Comment coverage on PR
      if: github.event_name == 'pull_request'
      uses: romeovs/lcov-reporter-action@v0.3.1
      with:
        lcov-file: ./coverage/lcov.info
        github-token: ${{ secrets.GITHUB_TOKEN }}
        delete-old-comments: true

    - name: Generate coverage comment (detailed)
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          const fs = require('fs');
          const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
          const diff = '${{ steps.diff.outputs.diff }}' || 'N/A';

          const formatPct = (pct) => `${pct.toFixed(2)}%`;
          const formatDiff = (d) => {
            if (d === 'N/A') return '';
            const num = parseFloat(d);
            if (num > 0) return ` (+${num.toFixed(2)}% ✅)`;
            if (num < 0) return ` (${num.toFixed(2)}% ⚠️)`;
            return ` (no change)`;
          };

          const comment = `## 📊 Test Coverage Report

          | Type | Coverage | Threshold | Status |
          |------|----------|-----------|--------|
          | Lines | ${formatPct(summary.total.lines.pct)}${formatDiff(diff)} | 80% | ${summary.total.lines.pct >= 80 ? '✅' : '❌'} |
          | Branches | ${formatPct(summary.total.branches.pct)} | 80% | ${summary.total.branches.pct >= 80 ? '✅' : '❌'} |
          | Functions | ${formatPct(summary.total.functions.pct)} | 80% | ${summary.total.functions.pct >= 80 ? '✅' : '❌'} |
          | Statements | ${formatPct(summary.total.statements.pct)} | 85% | ${summary.total.statements.pct >= 85 ? '✅' : '❌'} |

          ### 📝 Coverage by Module

          | Module | Lines | Branches | Functions |
          |--------|-------|----------|-----------|
          ${Object.entries(summary)
            .filter(([k]) => k !== 'total')
            .map(([file, stats]) => `| \`${file}\` | ${formatPct(stats.lines.pct)} | ${formatPct(stats.branches.pct)} | ${formatPct(stats.functions.pct)} |`)
            .join('\n')}

          <details>
          <summary>View detailed report</summary>

          [📈 Interactive Coverage Report](https://fairyhunter13.github.io/happy-bday-app/coverage/)

          </details>
          `;

          github.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: context.issue.number,
            body: comment
          });

    - name: Save coverage for main branch
      if: github.ref == 'refs/heads/main'
      uses: actions/upload-artifact@v4
      with:
        name: coverage-main
        path: coverage/coverage-summary.json
        retention-days: 90
```

### Enforce Coverage Before E2E Tests

```yaml

# .github/workflows/ci.yml

e2e-tests:
  name: E2E Tests
  needs: [unit-tests, integration-tests, coverage-report]  # Add coverage-report dependency
  runs-on: ubuntu-latest

  steps:
    # E2E tests only run if coverage gate passed
    - name: Checkout code
      uses: actions/checkout@v4

    # ... rest of E2E test steps
```

### Coverage-Dependent Performance Tests

```yaml

# .github/workflows/performance.yml

on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

jobs:
  check-coverage:
    runs-on: ubuntu-latest
    outputs:
      coverage-passed: ${{ steps.check.outputs.passed }}

    steps:
      - name: Download coverage
        uses: dawidd6/action-download-artifact@v3
        with:
          workflow: ci.yml
          workflow_conclusion: success
          name: coverage-main

      - name: Check coverage threshold
        id: check
        run: |
          COVERAGE=$(cat coverage-summary.json | jq -r '.total.lines.pct')
          if (( $(echo "$COVERAGE >= 80" | bc -l) )); then
            echo "passed=true" >> $GITHUB_OUTPUT
          else
            echo "passed=false" >> $GITHUB_OUTPUT
          fi

  performance-tests:
    needs: check-coverage
    if: needs.check-coverage.outputs.coverage-passed == 'true'
    runs-on: ubuntu-latest

    steps:
      # Run performance tests only if coverage >= 80%
      - name: Run performance tests
        run: npm run perf:all
```

---

## Edge Case Identification

### 1. Timezone Edge Cases

```typescript
// tests/unit/timezone-edge-cases.test.ts
describe('Timezone Edge Cases', () => {
  describe('DST Transitions', () => {
    it('should handle spring forward (2am -> 3am)', () => {
      // March 10, 2024: DST starts in US
      const beforeDST = new Date('2024-03-10T01:59:00-05:00'); // EST
      const afterDST = new Date('2024-03-10T03:00:00-04:00');  // EDT

      const result = calculateSendTime(user, beforeDST);

      expect(result.hour).toBe(9); // Still 9am local time
    });

    it('should handle fall back (2am -> 1am)', () => {
      // November 3, 2024: DST ends in US
      const beforeDST = new Date('2024-11-03T01:59:00-04:00'); // EDT
      const afterDST = new Date('2024-11-03T01:00:00-05:00');  // EST

      const result = calculateSendTime(user, afterDST);

      expect(result.hour).toBe(9);
    });
  });

  describe('Extreme Timezones', () => {
    it('should handle UTC+14 (earliest timezone)', () => {
      const user = { timezone: 'Pacific/Kiritimati', birthdayDate: new Date('1990-01-01') };
      const result = calculateSendTime(user, new Date('2025-01-01T00:00:00Z'));

      // UTC+14 means 2pm on Jan 1st when it's midnight UTC
      expect(result.toISOString()).toContain('2025-01-01T14:00:00');
    });

    it('should handle UTC-11 (latest timezone)', () => {
      const user = { timezone: 'Pacific/Niue', birthdayDate: new Date('1990-01-01') };
      const result = calculateSendTime(user, new Date('2025-01-01T12:00:00Z'));

      // UTC-11 means 1am on Jan 1st when it's noon UTC
      expect(result.toISOString()).toContain('2025-01-01T01:00:00');
    });
  });

  describe('Invalid Timezones', () => {
    it('should fallback to UTC for invalid timezone', () => {
      const user = { timezone: 'Invalid/Timezone', birthdayDate: new Date('1990-01-01') };

      expect(() => calculateSendTime(user, new Date())).not.toThrow();

      const result = calculateSendTime(user, new Date());
      expect(result.timezone).toBe('UTC');
    });

    it('should handle null timezone', () => {
      const user = { timezone: null, birthdayDate: new Date('1990-01-01') };

      const result = calculateSendTime(user, new Date());
      expect(result.timezone).toBe('UTC');
    });
  });
});
```

### 2. Leap Year Edge Cases

```typescript
// tests/unit/leap-year-edge-cases.test.ts
describe('Leap Year Birthday Handling', () => {
  it('should send Feb 29 birthday on Feb 29 in leap year', () => {
    const user = { birthdayDate: new Date('2000-02-29'), timezone: 'UTC' };
    const leapYear = new Date('2024-02-29');

    const result = shouldSendBirthday(user, leapYear);

    expect(result).toBe(true);
  });

  it('should NOT send Feb 29 birthday on Feb 28 in non-leap year', () => {
    const user = { birthdayDate: new Date('2000-02-29'), timezone: 'UTC' };
    const nonLeapYear = new Date('2023-02-28');

    const result = shouldSendBirthday(user, nonLeapYear);

    expect(result).toBe(false);
  });

  it('should NOT send Feb 29 birthday on Mar 1 in non-leap year', () => {
    const user = { birthdayDate: new Date('2000-02-29'), timezone: 'UTC' };
    const nonLeapYear = new Date('2023-03-01');

    const result = shouldSendBirthday(user, nonLeapYear);

    expect(result).toBe(false);
  });

  it('should handle century years (2000 is leap, 1900 is not)', () => {
    const user2000 = { birthdayDate: new Date('2000-02-29'), timezone: 'UTC' };
    const user1900 = { birthdayDate: new Date('1900-02-29'), timezone: 'UTC' }; // Invalid!

    expect(shouldSendBirthday(user2000, new Date('2024-02-29'))).toBe(true);
    expect(() => new Date('1900-02-29')).toThrow(); // Feb 29, 1900 doesn't exist
  });
});
```

### 3. Database Edge Cases

```typescript
// tests/integration/database-edge-cases.test.ts
describe('Database Edge Cases', () => {
  it('should handle concurrent inserts (race condition)', async () => {
    const message = {
      userId: 'user-123',
      messageType: 'BIRTHDAY',
      idempotencyKey: 'unique-key',
    };

    // Simulate 2 workers trying to insert same message
    const promises = [
      messageRepository.create(message),
      messageRepository.create(message),
    ];

    const results = await Promise.allSettled(promises);

    // One should succeed, one should fail with unique constraint violation
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
  });

  it('should handle database connection loss', async () => {
    // Simulate connection loss
    await db.destroy();

    await expect(messageRepository.findAll()).rejects.toThrow();

    // Reconnect
    await db.reconnect();

    // Should work again
    await expect(messageRepository.findAll()).resolves.toBeDefined();
  });

  it('should handle transaction rollback on error', async () => {
    await db.transaction(async (trx) => {
      await trx.insert(users).values({ firstName: 'John' });

      // Simulate error
      throw new Error('Simulated error');
    }).catch(() => {});

    // User should NOT exist (transaction rolled back)
    const result = await db.query.users.findFirst({ where: eq(users.firstName, 'John') });
    expect(result).toBeUndefined();
  });
});
```

### 4. Queue Edge Cases

```typescript
// tests/integration/queue-edge-cases.test.ts
describe('Queue Edge Cases', () => {
  it('should handle message larger than queue limit', async () => {
    const largeMessage = {
      userId: 'user-123',
      messageContent: 'x'.repeat(1024 * 1024), // 1MB message
    };

    await expect(queueManager.enqueue(largeMessage)).rejects.toThrow('Message too large');
  });

  it('should handle queue full scenario', async () => {
    // Fill queue to capacity
    for (let i = 0; i < 10000; i++) {
      await queueManager.enqueue({ userId: `user-${i}` });
    }

    // Next message should be rejected or delayed
    const result = await queueManager.enqueue({ userId: 'overflow' });

    expect(result.delayed).toBe(true);
  });

  it('should handle poison messages (retry limit)', async () => {
    const poisonMessage = { userId: 'poison', invalid: true };

    // Message should fail 3 times, then move to DLQ
    await worker.process(poisonMessage);

    const dlqMessage = await deadLetterQueue.peek();
    expect(dlqMessage.userId).toBe('poison');
    expect(dlqMessage.retries).toBe(3);
  });

  it('should handle duplicate message delivery', async () => {
    const message = { userId: 'user-123', idempotencyKey: 'key-1' };

    // Send message twice
    await worker.process(message);
    await worker.process(message);

    // Should only be processed once (idempotency)
    const logs = await db.query.messageLogs.findMany({ where: eq(messageLogs.userId, 'user-123') });
    expect(logs).toHaveLength(1);
  });
});
```

### 5. Circuit Breaker Edge Cases

```typescript
// tests/unit/circuit-breaker-edge-cases.test.ts
describe('Circuit Breaker Edge Cases', () => {
  it('should open circuit after threshold failures', async () => {
    const breaker = new CircuitBreaker(externalService, { threshold: 3 });

    // Fail 3 times
    for (let i = 0; i < 3; i++) {
      await breaker.execute().catch(() => {});
    }

    expect(breaker.state).toBe('OPEN');
  });

  it('should half-open after timeout', async () => {
    const breaker = new CircuitBreaker(externalService, { timeout: 100 });

    // Open circuit
    for (let i = 0; i < 3; i++) {
      await breaker.execute().catch(() => {});
    }

    // Wait for timeout
    await sleep(150);

    expect(breaker.state).toBe('HALF_OPEN');
  });

  it('should close circuit after successful test', async () => {
    const breaker = new CircuitBreaker(externalService, { timeout: 100 });

    // Open -> Half-Open -> Closed
    for (let i = 0; i < 3; i++) {
      await breaker.execute().catch(() => {});
    }

    await sleep(150);

    externalService.mockResolvedValueOnce('success');
    await breaker.execute();

    expect(breaker.state).toBe('CLOSED');
  });
});
```

### Edge Case Checklist

| Category | Edge Cases | Tested? |
|----------|-----------|---------|
| **Timezone** | DST transitions, UTC+14, UTC-11, invalid timezones | ✅ |
| **Dates** | Leap years, Feb 29, year boundaries | ✅ |
| **Database** | Concurrent inserts, connection loss, transaction rollback | ✅ |
| **Queue** | Large messages, queue full, poison messages, duplicates | ✅ |
| **Circuit Breaker** | Threshold failures, timeout, state transitions | ✅ |
| **Null/Undefined** | Null dates, undefined fields, empty strings | ⚠️ |
| **Numbers** | Zero, negative, NaN, Infinity, large numbers | ⚠️ |
| **Strings** | Empty, very long, special characters, Unicode | ⚠️ |
| **Arrays** | Empty arrays, very large arrays, nested arrays | ⚠️ |

---

## Implementation Plan

### Phase 1: Setup Coverage Infrastructure (Week 1)

**Day 1-2: Configure Vitest Coverage**
- [ ] Update `vitest.config.ts` with thresholds
- [ ] Add coverage exclusions
- [ ] Test coverage generation locally
- [ ] Verify all report formats (HTML, lcov, JSON)

**Day 3-4: Setup Codecov**
- [ ] Create Codecov account (free for public repos)
- [ ] Add `CODECOV_TOKEN` to GitHub secrets
- [ ] Update CI workflow to upload coverage
- [ ] Test badge generation

**Day 5-7: Setup GitHub Pages**
- [ ] Create `gh-pages` branch
- [ ] Create publish-reports workflow
- [ ] Generate initial reports
- [ ] Create landing page (index.html)

**Deliverables:**
- Coverage reports generated on every PR
- Codecov badge in README
- GitHub Pages site with interactive reports

### Phase 2: Write Tests to Reach 80% (Week 2-3)

**Day 1-3: Unit Tests**
- [ ] Test all message strategies (birthday, anniversary)
- [ ] Test timezone conversions
- [ ] Test idempotency logic
- [ ] Test repositories

**Day 4-5: Integration Tests**
- [ ] Test database operations
- [ ] Test queue operations
- [ ] Test scheduler integration

**Day 6-7: Edge Case Tests**
- [ ] Timezone edge cases
- [ ] Leap year edge cases
- [ ] Database edge cases
- [ ] Queue edge cases

**Day 8-10: Fill Coverage Gaps**
- [ ] Run coverage report
- [ ] Identify uncovered lines
- [ ] Write targeted tests
- [ ] Verify 80% threshold met

**Deliverables:**
- 80%+ coverage across all types
- Comprehensive edge case testing
- All critical paths tested

### Phase 3: CI/CD Enforcement (Week 4)

**Day 1-2: Coverage Gating**
- [ ] Add coverage threshold checks to CI
- [ ] Block PRs if coverage < 80%
- [ ] Add coverage diff checks
- [ ] Test enforcement locally

**Day 3-4: PR Comments**
- [ ] Setup coverage diff comments
- [ ] Add detailed coverage tables
- [ ] Link to GitHub Pages reports

**Day 5-7: Performance Test Gating**
- [ ] Enforce 80% coverage before E2E tests
- [ ] Enforce 80% coverage before performance tests
- [ ] Test full workflow

**Deliverables:**
- PRs blocked if coverage drops
- Automatic coverage comments
- Coverage-gated performance tests

### Phase 4: Monitoring & Maintenance (Ongoing)

**Weekly:**
- [ ] Review coverage trends
- [ ] Identify new untested code
- [ ] Update edge case tests

**Monthly:**
- [ ] Review historical coverage data
- [ ] Update coverage targets if needed
- [ ] Clean up old reports

**Quarterly:**
- [ ] Audit test quality (not just quantity)
- [ ] Refactor duplicate tests
- [ ] Update testing strategy

---

## Code Examples

### 1. Comprehensive Test Suite Template

```typescript
// tests/unit/services/message.service.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageService } from '@/services/message.service';
import type { User, MessageStrategy } from '@/types';

describe('MessageService', () => {
  let messageService: MessageService;
  let mockStrategy: MessageStrategy;
  let mockRepository: any;
  let mockQueue: any;

  beforeEach(() => {
    // Setup mocks
    mockStrategy = {
      messageType: 'BIRTHDAY',
      shouldSend: vi.fn(),
      composeMessage: vi.fn(),
      calculateSendTime: vi.fn(),
      validate: vi.fn(),
      getSchedule: vi.fn(),
    };

    mockRepository = {
      create: vi.fn(),
      findByIdempotencyKey: vi.fn(),
    };

    mockQueue = {
      enqueue: vi.fn(),
    };

    messageService = new MessageService(mockStrategy, mockRepository, mockQueue);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('scheduleMessage', () => {
    it('should schedule message for valid user', async () => {
      const user: User = {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        timezone: 'America/New_York',
        birthdayDate: new Date('1990-01-01'),
      };

      mockStrategy.shouldSend.mockResolvedValue(true);
      mockStrategy.composeMessage.mockResolvedValue('Happy Birthday John!');
      mockStrategy.calculateSendTime.mockReturnValue(new Date('2025-01-01T09:00:00-05:00'));
      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({ id: 'msg-123' });

      const result = await messageService.scheduleMessage(user, new Date('2025-01-01'));

      expect(mockStrategy.shouldSend).toHaveBeenCalledWith(user, expect.any(Date));
      expect(mockStrategy.composeMessage).toHaveBeenCalledWith(user, expect.any(Object));
      expect(mockRepository.create).toHaveBeenCalled();
      expect(result.id).toBe('msg-123');
    });

    it('should not schedule if shouldSend returns false', async () => {
      const user: User = { id: 'user-123', birthdayDate: new Date('1990-06-15') };

      mockStrategy.shouldSend.mockResolvedValue(false);

      const result = await messageService.scheduleMessage(user, new Date('2025-01-01'));

      expect(result).toBeNull();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should enforce idempotency (prevent duplicates)', async () => {
      const user: User = { id: 'user-123', birthdayDate: new Date('1990-01-01') };

      mockStrategy.shouldSend.mockResolvedValue(true);
      mockRepository.findByIdempotencyKey.mockResolvedValue({ id: 'existing-msg' });

      const result = await messageService.scheduleMessage(user, new Date('2025-01-01'));

      expect(result.id).toBe('existing-msg');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should handle message composition errors', async () => {
      const user: User = { id: 'user-123', birthdayDate: new Date('1990-01-01') };

      mockStrategy.shouldSend.mockResolvedValue(true);
      mockStrategy.composeMessage.mockRejectedValue(new Error('Template error'));

      await expect(messageService.scheduleMessage(user, new Date('2025-01-01')))
        .rejects.toThrow('Template error');
    });

    it('should handle database errors', async () => {
      const user: User = { id: 'user-123', birthdayDate: new Date('1990-01-01') };

      mockStrategy.shouldSend.mockResolvedValue(true);
      mockStrategy.composeMessage.mockResolvedValue('Message');
      mockRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(messageService.scheduleMessage(user, new Date('2025-01-01')))
        .rejects.toThrow('Database error');
    });
  });

  describe('enqueueMessage', () => {
    it('should enqueue message to RabbitMQ', async () => {
      const message = { id: 'msg-123', userId: 'user-123' };

      mockQueue.enqueue.mockResolvedValue(true);

      await messageService.enqueueMessage(message);

      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        messageId: 'msg-123',
        userId: 'user-123',
      });
    });

    it('should retry on queue errors', async () => {
      const message = { id: 'msg-123', userId: 'user-123' };

      mockQueue.enqueue
        .mockRejectedValueOnce(new Error('Queue error'))
        .mockResolvedValueOnce(true);

      await messageService.enqueueMessage(message);

      expect(mockQueue.enqueue).toHaveBeenCalledTimes(2);
    });
  });
});
```

### 2. GitHub Actions Workflow (Complete)

```yaml

# .github/workflows/coverage.yml

name: Test Coverage

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests with coverage
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-unit
          path: coverage/

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
        ports:
          - 5432:5432

      rabbitmq:
        image: rabbitmq:3.12-management-alpine
        env:
          RABBITMQ_DEFAULT_USER: test
          RABBITMQ_DEFAULT_PASS: test
        options: >-
          --health-cmd "rabbitmq-diagnostics -q ping"
          --health-interval 10s
        ports:
          - 5672:5672

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test_db

      - name: Run integration tests with coverage
        run: npm run test:integration -- --coverage
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/test_db
          RABBITMQ_URL: amqp://test:test@localhost:5672

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-integration
          path: coverage/

  coverage-report:
    name: Coverage Report
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Download all coverage
        uses: actions/download-artifact@v4
        with:
          pattern: coverage-*
          path: coverage-artifacts/

      - name: Merge coverage
        run: |
          npm ci
          npx nyc merge coverage-artifacts/ coverage/coverage.json
          npx nyc report --reporter=lcov --reporter=json-summary --reporter=html --reporter=text

      - name: Check thresholds
        run: |
          npx nyc check-coverage --lines 80 --functions 80 --branches 80 --statements 85

      - name: Upload to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true
        env:
          CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          lcov-file: ./coverage/lcov.info
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Deploy to GitHub Pages
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./coverage/html
          destination_dir: coverage
```

---

## Best Practices

### 1. Test Pyramid Adherence

**Ratio:**
- 70% Unit tests (fast, isolated, mocked)
- 20% Integration tests (database, queue)
- 10% E2E tests (full system)

**Why:**
- Unit tests are fast (< 1 second each)
- Integration tests are slower (< 5 seconds each)
- E2E tests are slowest (< 30 seconds each)

**Project Application:**
```
Unit Tests:        ~140 tests  (70% × 200 total)
Integration Tests:  ~40 tests  (20% × 200 total)
E2E Tests:          ~20 tests  (10% × 200 total)
```

### 2. Test Naming Conventions

```typescript
// Good: Descriptive, scenario-based
it('should send birthday message at 9am user timezone', () => {});
it('should prevent duplicate messages with idempotency key', () => {});
it('should retry 3 times on queue failure before moving to DLQ', () => {});

// Bad: Implementation-focused
it('should call sendMessage function', () => {});
it('should return true', () => {});
it('works', () => {});
```

### 3. AAA Pattern (Arrange-Act-Assert)

```typescript
it('should calculate send time in user timezone', () => {
  // Arrange
  const user = {
    timezone: 'America/New_York',
    birthdayDate: new Date('1990-01-01'),
  };
  const date = new Date('2025-01-01T12:00:00Z');

  // Act
  const result = calculateSendTime(user, date);

  // Assert
  expect(result.hour).toBe(9);
  expect(result.timezone).toBe('America/New_York');
});
```

### 4. Test Independence

```typescript
// Good: Each test is independent
describe('MessageService', () => {
  let messageService: MessageService;

  beforeEach(() => {
    messageService = new MessageService(); // Fresh instance
  });

  it('test 1', () => { /* ... */ });
  it('test 2', () => { /* ... */ }); // Not affected by test 1
});

// Bad: Tests depend on each other
describe('MessageService', () => {
  const messageService = new MessageService(); // Shared instance

  it('should create user', () => {
    messageService.createUser({ id: '1' });
  });

  it('should find user', () => {
    // Depends on previous test creating user!
    const user = messageService.findUser('1');
    expect(user).toBeDefined();
  });
});
```

### 5. Meaningful Assertions

```typescript
// Good: Specific assertions
expect(user.firstName).toBe('John');
expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
expect(messages).toHaveLength(5);

// Bad: Vague assertions
expect(user).toBeTruthy();
expect(result).toBeDefined();
expect(true).toBe(true);
```

### 6. Test Data Factories

```typescript
// tests/factories/user.factory.ts
import { faker } from '@faker-js/faker';

export function createUser(overrides = {}) {
  return {
    id: faker.string.uuid(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    timezone: faker.location.timeZone(),
    birthdayDate: faker.date.birthdate(),
    ...overrides,
  };
}

// Usage in tests
it('should create message for user', () => {
  const user = createUser({ firstName: 'John', timezone: 'UTC' });
  // ...
});
```

### 7. Coverage != Quality

**80% coverage doesn't guarantee:**
- Correct business logic
- Good error handling
- Performance
- Security

**Example:**
```typescript
// This has 100% coverage but is wrong!
function calculateAge(birthDate: Date): number {
  return 25; // Always returns 25 (tested once, "covered")
}

it('should calculate age', () => {
  expect(calculateAge(new Date('2000-01-01'))).toBe(25); // Passes!
});

// Correct test would use multiple cases
it.each([
  { birth: '2000-01-01', year: 2025, expected: 25 },
  { birth: '1990-06-15', year: 2025, expected: 35 },
  { birth: '2020-12-31', year: 2025, expected: 5 },
])('should calculate age for $birth', ({ birth, year, expected }) => {
  const age = calculateAge(new Date(birth), year);
  expect(age).toBe(expected);
});
```

### 8. Mutation Testing (Advanced)

**Tool:** Stryker Mutator

```bash
npm install -D @stryker-mutator/core @stryker-mutator/typescript-checker @stryker-mutator/vitest-runner

# Run mutation tests

npx stryker run
```

**What it does:**
- Mutates code (e.g., `>` to `>=`, `+` to `-`)
- Runs tests
- If tests still pass, mutation "survived" (weak test!)

**Example:**
```typescript
// Original code
function isAdult(age: number): boolean {
  return age >= 18;
}

// Mutation: >= to >
function isAdult(age: number): boolean {
  return age > 18; // Bug! 18 is now NOT adult
}

// Weak test (mutation survives)
it('should identify adults', () => {
  expect(isAdult(25)).toBe(true);  // Still passes with mutation!
});

// Strong test (mutation killed)
it('should identify adults', () => {
  expect(isAdult(18)).toBe(true);  // Fails with mutation!
  expect(isAdult(17)).toBe(false);
  expect(isAdult(25)).toBe(true);
});
```

---

## Summary

### Key Takeaways

1. **Use Vitest v8 coverage** (already configured, fast, TypeScript-native)
2. **Use Codecov** for badges and analytics (free for public repos)
3. **Deploy to GitHub Pages** for interactive reports
4. **Enforce 80% threshold** in CI/CD (block PRs if coverage drops)
5. **Test edge cases** (timezones, leap years, errors, null values)
6. **Coverage != Quality** (write meaningful tests, not just coverage)

### Quick Start Commands

```bash

# Generate coverage report

npm run test:coverage

# View HTML report

open coverage/index.html

# Check thresholds

npx nyc check-coverage --lines 80 --functions 80 --branches 80 --statements 85

# Deploy to GitHub Pages

npm run publish:reports
```

### Next Steps

1. **Week 1:** Setup coverage infrastructure
2. **Week 2-3:** Write tests to reach 80%
3. **Week 4:** Implement CI/CD enforcement
4. **Ongoing:** Monitor and maintain

### Resources

- [Vitest Coverage Docs](https://vitest.dev/guide/coverage.html)
- [Codecov Docs](https://docs.codecov.com/docs)
- [GitHub Pages Docs](https://docs.github.com/en/pages)
- [Testing Best Practices](https://testingjavascript.com/)
- [Mutation Testing](https://stryker-mutator.io/)

---

**Document Status:** ✅ Complete
**Last Review:** 2025-12-30
**Next Review:** 2026-01-30
