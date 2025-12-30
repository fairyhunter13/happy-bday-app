# Coverage Trends Design Document

## Executive Summary

This document provides a comprehensive design for implementing historical coverage trend tracking for the Birthday Message Scheduler project, deployable to GitHub Pages. The solution leverages a self-hosted, static-site approach using Chart.js for visualization, JSON-based storage, and GitHub Actions for automation.

**Status**: Research Complete - Ready for Implementation
**Created**: 2025-12-31
**Author**: ARCHITECT Agent

---

## 1. Architecture Recommendation

### 1.1 Self-Hosted vs External Services

After comprehensive research and analysis, **self-hosted solution is recommended** for the following reasons:

#### Self-Hosted Advantages
- **Zero External Dependencies**: No reliance on Codecov/Coveralls API availability
- **No CODECOV_TOKEN Required**: Eliminates security token management overhead
- **Complete Control**: Full ownership of data and visualization customization
- **Cost**: Completely free - GitHub Pages provides unlimited hosting for public repos
- **Privacy**: Coverage data stays within GitHub infrastructure
- **Flexibility**: Easy to customize metrics, charts, and data retention policies
- **Integration**: Already 80% implemented in current codebase

#### External Service Comparison

| Feature | Self-Hosted | Codecov | Coveralls |
|---------|------------|---------|-----------|
| Setup Complexity | Medium | Low | Low |
| Token Management | None | Required | Required |
| Cost | Free | Free (OSS) / Paid | Free (OSS) / Paid |
| Data Control | Full | Limited | Limited |
| Customization | High | Medium | Low |
| Bundle Size | ~11KB (Chart.js) | N/A | N/A |
| Historical Data | Unlimited | Limited (Free tier) | Limited (Free tier) |
| API Access | Full control | Rate limited | Rate limited |

**Sources**:
- [Codecov vs Coveralls Comparison](https://stackshare.io/stackups/codecov-vs-coveralls)
- [Code Coverage Services Comparison](https://www.slant.co/topics/2188/~best-code-coverage-services)

### 1.2 Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Actions Workflow                      │
│  (.github/workflows/docs.yml)                                    │
└────────────┬────────────────────────────────────────────────────┘
             │
             ├─> Run Tests (npm run test:coverage)
             │   └─> Generate coverage/coverage-summary.json
             │
             ├─> Update History (scripts/coverage/update-history.sh)
             │   ├─> Read coverage-summary.json
             │   ├─> Extract metrics (jq)
             │   ├─> Add git metadata (commit, branch, timestamp)
             │   └─> Update docs/coverage-history.json
             │
             ├─> Build GitHub Pages Site
             │   ├─> Copy coverage-trends.html to _site/
             │   └─> Copy coverage-history.json to _site/
             │
             ├─> Commit History Back to Repo
             │   └─> Git add + commit + push (skip ci)
             │
             └─> Deploy to GitHub Pages
                 └─> Users access: https://[username].github.io/[repo]/coverage-trends.html
```

**Key Components**:
1. **Data Collection**: Vitest with v8 coverage provider
2. **Data Processing**: Bash script with jq for JSON manipulation
3. **Data Storage**: JSON file in docs/ directory (versioned in git)
4. **Visualization**: Static HTML + Chart.js
5. **Deployment**: GitHub Actions + GitHub Pages

---

## 2. Data Storage Strategy

### 2.1 Storage Location: Git Repository

**Recommendation**: Store `coverage-history.json` in the `docs/` directory

**Rationale**:
- **Versioned**: Full history tracked in git
- **Accessible**: Available to both CI/CD and GitHub Pages
- **Persistent**: Not affected by GitHub Actions artifact retention (90-day limit)
- **Simple**: No external storage service required
- **Recoverable**: Backup via git history

**Alternative Considered**: GitHub Actions Artifacts
- **Pros**: Separated from main codebase
- **Cons**: 90-day retention limit, requires API calls to retrieve, more complex implementation

**Sources**:
- [GitHub Actions Artifacts Documentation](https://docs.github.com/en/actions/tutorials/store-and-share-data)
- [GitHub Pages Best Practices](https://dev.to/mbarzeev/auto-publish-your-test-coverage-report-on-github-pages-35be)

### 2.2 Data Structure: coverage-history.json

```json
{
  "version": 1,
  "updated": "2025-12-31T14:30:00Z",
  "metadata": {
    "repository": "fairyhunter13/happy-bday-app",
    "thresholds": {
      "lines": 80,
      "functions": 80,
      "branches": 80,
      "statements": 85
    },
    "maxEntries": 100
  },
  "entries": [
    {
      "timestamp": "2025-12-31T14:30:00Z",
      "branch": "main",
      "commit": "a1b2c3d",
      "commitFull": "a1b2c3d4e5f6789012345678901234567890abcd",
      "author": "github-actions[bot]",
      "buildNumber": "123",
      "coverage": {
        "lines": {
          "pct": 85.5,
          "covered": 342,
          "total": 400
        },
        "functions": {
          "pct": 88.2,
          "covered": 75,
          "total": 85
        },
        "branches": {
          "pct": 82.1,
          "covered": 156,
          "total": 190
        },
        "statements": {
          "pct": 86.3,
          "covered": 380,
          "total": 440
        }
      },
      "tests": {
        "total": 145,
        "passed": 145,
        "failed": 0,
        "skipped": 0,
        "duration": 12.5
      },
      "delta": {
        "lines": 2.3,
        "functions": 1.5,
        "branches": -0.8,
        "statements": 1.9
      }
    }
  ]
}
```

### 2.3 Data Management

**Size Estimation**:
- Each entry: ~500 bytes
- 100 entries: ~50KB
- 1000 entries: ~500KB
- **Recommended max**: 100-200 entries (lightweight, ~50-100KB)

**Retention Policy**:
- Keep last 100 data points by default
- Configurable via `MAX_DATA_POINTS` environment variable
- Oldest entries automatically pruned on each update

**Performance**:
- JSON parsing: <1ms for 100 entries
- Chart rendering: <100ms for 100 data points
- No backend required - pure client-side processing

---

## 3. Chart Library Selection

### 3.1 Comparison Matrix

| Library | Bundle Size (gzipped) | Performance | Learning Curve | Customization | Verdict |
|---------|----------------------|-------------|----------------|---------------|---------|
| **Chart.js** | **11KB** | Excellent (small/medium datasets) | Low | Medium | **RECOMMENDED** |
| ApexCharts | 131KB | Excellent (large datasets) | Medium | High | Overkill |
| D3.js | ~70KB (minimal) | Excellent (optimized) | High | Very High | Over-engineered |
| Recharts | ~95KB | Good | Medium | High | React dependency |
| Chartist | ~10KB | Good | Low | Low | Limited features |
| TradingView Lightweight | ~50KB | Excellent | Medium | Medium | Financial focus |

**Sources**:
- [Chart.js vs D3.js Comparison 2025](https://www.slant.co/versus/10577/10578/~d3-js_vs_chart-js)
- [Lightweight JavaScript Chart Libraries 2025](https://www.luzmo.com/blog/javascript-chart-libraries)
- [ApexCharts vs Chart.js Bundle Size](https://npm-compare.com/apexcharts,chart.js,d3,highcharts)

### 3.2 Chart.js Recommendation

**Why Chart.js**:

1. **Lightweight**: 11KB gzipped - minimal impact on page load
2. **Simplicity**: Simple API, easy to implement and maintain
3. **Responsive**: Auto-adapts to container size (mobile-friendly)
4. **Well-Maintained**: Active development, 66K+ GitHub stars
5. **Documentation**: Excellent docs and community support
6. **Canvas-Based**: Better performance than SVG for time-series data
7. **Plugin Ecosystem**: Time-scale adapter, annotation plugins available

**Performance Characteristics**:
- Renders 100 data points in <50ms
- Smooth animations and interactions
- No performance degradation up to 500 data points
- Canvas rendering = better for line charts with many points

**Current Implementation**: Already using Chart.js 4.4.1 in coverage-trends.html

### 3.3 Chart.js Configuration

```javascript
// Recommended Chart.js setup for coverage trends
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

const config = {
  type: 'line',
  data: {
    datasets: [
      {
        label: 'Lines',
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f620',
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: 'Functions',
        borderColor: '#8b5cf6',
        backgroundColor: '#8b5cf620',
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: 'Branches',
        borderColor: '#ec4899',
        backgroundColor: '#ec489920',
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: 'Statements',
        borderColor: '#06b6d4',
        backgroundColor: '#06b6d420',
        tension: 0.3,
        pointRadius: 4
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
          displayFormats: {
            day: 'MMM d'
          }
        }
      },
      y: {
        min: 0,
        max: 100,
        ticks: {
          callback: (value) => value + '%'
        }
      }
    }
  }
};
```

---

## 4. Key Metrics to Track

### 4.1 Core Coverage Metrics

| Metric | Description | Why Track | Threshold |
|--------|-------------|-----------|-----------|
| **Line Coverage** | % of executable lines tested | Most common metric, easy to understand | 80% |
| **Branch Coverage** | % of decision branches tested | Ensures all code paths tested | 80% |
| **Function Coverage** | % of functions invoked | Identifies untested functions | 80% |
| **Statement Coverage** | % of statements executed | Granular view of code execution | 85% |

### 4.2 Extended Metrics

| Metric | Description | Implementation |
|--------|-------------|----------------|
| **Coverage Delta** | Change from previous commit | Calculate diff between entries[0] and entries[1] |
| **Uncovered Lines** | Absolute count of untested lines | `total - covered` |
| **Test Count** | Number of tests over time | Extract from Vitest output |
| **Test Duration** | Time to run full test suite | Track performance regression |
| **Build Number** | CI/CD build identifier | From `$GITHUB_RUN_NUMBER` |
| **Commit Author** | Who made the change | From git metadata |

### 4.3 Derived Insights

**Trend Analysis**:
- 7-day moving average
- Month-over-month comparison
- Coverage velocity (rate of improvement)
- Regression detection (sudden drops)

**Quality Gates**:
- Alert if coverage drops >5% in single commit
- Warn if coverage below threshold for >3 consecutive commits
- Highlight when coverage hits new all-time high

**Sources**:
- [Code Coverage Best Practices](https://www.atlassian.com/continuous-delivery/software-testing/code-coverage)
- [Test Coverage Metrics Guide](https://www.browserstack.com/guide/test-coverage-metrics-in-software-testing)

---

## 5. GitHub Actions Workflow Modifications

### 5.1 Current State Analysis

**Existing Workflow** (`.github/workflows/docs.yml`):
- Runs on `push` to main
- Executes tests with coverage
- Calls `update-history.sh` script
- Deploys to GitHub Pages
- Commits history back to repo

**Current Issues**:
- Uses `|| true` and `continue-on-error: true` (silently fails)
- No error handling if jq is missing
- No validation of coverage-history.json format
- No metrics on data points retained

### 5.2 Recommended Enhancements

```yaml
name: Deploy Documentation

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'tests/**'
      - 'docs/**'
      - '.github/workflows/docs.yml'
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for git metadata

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build TypeScript
        run: npm run build

      # ENHANCED: Better error handling
      - name: Run tests with coverage
        run: npm run test:coverage
        env:
          CI: true

      # ENHANCED: Validate coverage output
      - name: Validate coverage output
        run: |
          if [ ! -f coverage/coverage-summary.json ]; then
            echo "Error: coverage-summary.json not found"
            exit 1
          fi

          # Validate JSON format
          jq empty coverage/coverage-summary.json || exit 1

      # ENHANCED: Install jq if not present
      - name: Ensure jq is installed
        run: |
          if ! command -v jq &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y jq
          fi
          jq --version

      # ENHANCED: Update coverage history with validation
      - name: Update coverage history
        id: coverage_update
        run: |
          chmod +x scripts/coverage/update-history.sh
          ./scripts/coverage/update-history.sh coverage/coverage-summary.json docs/coverage-history.json

          # Output metrics for workflow summary
          ENTRY_COUNT=$(jq '.entries | length' docs/coverage-history.json)
          LATEST_LINES=$(jq -r '.entries[0].coverage.lines.pct' docs/coverage-history.json)
          echo "entry_count=$ENTRY_COUNT" >> $GITHUB_OUTPUT
          echo "latest_coverage=$LATEST_LINES" >> $GITHUB_OUTPUT

      # NEW: Generate workflow summary
      - name: Generate coverage summary
        run: |
          echo "## Coverage Update Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Total Historical Entries**: ${{ steps.coverage_update.outputs.entry_count }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Latest Line Coverage**: ${{ steps.coverage_update.outputs.latest_coverage }}%" >> $GITHUB_STEP_SUMMARY
          echo "- **Timestamp**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "[View Coverage Trends](https://fairyhunter13.github.io/happy-bday-app/coverage-trends.html)" >> $GITHUB_STEP_SUMMARY

      # NEW: Upload coverage as artifact (backup)
      - name: Upload coverage artifacts
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: |
            coverage/
            docs/coverage-history.json
          retention-days: 30

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Create documentation site
        run: |
          mkdir -p _site

          # ... existing Redoc setup ...

          # Copy coverage files
          cp docs/coverage-trends.html _site/coverage-trends.html
          cp docs/coverage-history.json _site/coverage-history.json

          # NEW: Copy coverage HTML report
          if [ -d coverage ]; then
            cp -r coverage _site/coverage
          fi

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '_site'

      # ENHANCED: Better git commit handling
      - name: Commit coverage history
        run: |
          if [ -f docs/coverage-history.json ]; then
            git config --local user.email "github-actions[bot]@users.noreply.github.com"
            git config --local user.name "github-actions[bot]"

            # Only commit if there are changes
            if ! git diff --quiet docs/coverage-history.json; then
              git add docs/coverage-history.json
              git commit -m "chore: update coverage history [skip ci]

              - Line coverage: ${{ steps.coverage_update.outputs.latest_coverage }}%
              - Total entries: ${{ steps.coverage_update.outputs.entry_count }}
              - Commit: ${{ github.sha }}"

              git push
            else
              echo "No changes to coverage history"
            fi
          fi

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 5.3 Key Improvements

1. **Error Handling**: Remove `continue-on-error`, fail fast on issues
2. **Validation**: Check JSON format before processing
3. **Dependencies**: Ensure jq is installed
4. **Metrics**: Output coverage metrics to workflow summary
5. **Artifacts**: Upload coverage as backup (30-day retention)
6. **Commits**: Better commit messages with metrics
7. **Conditional**: Only commit if history actually changed

---

## 6. HTML/JavaScript Implementation

### 6.1 Architecture Overview

**Current Implementation** (`docs/coverage-trends.html`):
- Self-contained HTML file
- Inline CSS and JavaScript
- Chart.js loaded from CDN
- Fetches `coverage-history.json` dynamically

**Status**: 90% complete, needs minor enhancements

### 6.2 Recommended Enhancements

#### 6.2.1 Add Test Count Tracking

```javascript
// In update-history.sh, add test count extraction
TEST_TOTAL=$(npm test -- --reporter=json | jq -r '.testResults | length' || echo 0)
TEST_PASSED=$(npm test -- --reporter=json | jq -r '.numPassedTests' || echo 0)
TEST_FAILED=$(npm test -- --reporter=json | jq -r '.numFailedTests' || echo 0)

// Add to JSON entry
"tests": {
  "total": $TEST_TOTAL,
  "passed": $TEST_PASSED,
  "failed": $TEST_FAILED,
  "duration": 0
}
```

#### 6.2.2 Add Delta Calculation

```javascript
// In renderDashboard() function
function calculateDelta(current, previous) {
  if (!previous) return null;

  return {
    lines: (current.coverage.lines.pct - previous.coverage.lines.pct).toFixed(1),
    functions: (current.coverage.functions.pct - previous.coverage.functions.pct).toFixed(1),
    branches: (current.coverage.branches.pct - previous.coverage.branches.pct).toFixed(1),
    statements: (current.coverage.statements.pct - previous.coverage.statements.pct).toFixed(1)
  };
}
```

#### 6.2.3 Add Uncovered Lines Chart

```javascript
// New chart showing absolute uncovered line count
const uncoveredData = chartData.map(e =>
  e.coverage.lines.total - e.coverage.lines.covered
);

// Add to visualization
{
  label: 'Uncovered Lines',
  data: uncoveredData,
  type: 'bar',
  backgroundColor: '#ef444420',
  borderColor: '#ef4444',
  yAxisID: 'y-uncovered'
}
```

#### 6.2.4 Add Coverage Velocity

```javascript
// Calculate 7-day moving average
function calculateMovingAverage(data, window = 7) {
  return data.map((value, index, array) => {
    if (index < window - 1) return null;
    const slice = array.slice(index - window + 1, index + 1);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    return sum / window;
  });
}
```

### 6.3 Additional Features

**Date Range Filters** (Already Implemented):
- 7 days
- 14 days
- 30 days
- All time

**New Features to Add**:
1. **Export to CSV**: Download historical data
2. **Threshold Annotations**: Visual lines at 80%, 85%
3. **Commit Links**: Click commit SHA to view on GitHub
4. **Search/Filter**: Filter by branch, date range, author
5. **Comparison Mode**: Compare two time periods
6. **Print-Friendly View**: CSS for printing reports

### 6.4 Performance Optimizations

```javascript
// Lazy load Chart.js only when needed
const loadChartJS = async () => {
  if (window.Chart) return;

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
  await new Promise(resolve => {
    script.onload = resolve;
    document.head.appendChild(script);
  });
};

// Debounce chart updates
const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

// Virtual scrolling for large datasets
const renderVisibleDataOnly = (entries, viewportRange) => {
  return entries.filter((entry, index) =>
    index >= viewportRange.start && index <= viewportRange.end
  );
};
```

---

## 7. Example Visualizations

### 7.1 Line Chart: Coverage Over Time

**Purpose**: Show trend of all coverage metrics on a single timeline

**Features**:
- 4 lines: Lines, Functions, Branches, Statements
- X-axis: Time (day/week/month granularity)
- Y-axis: Percentage (0-100%)
- Hover: Show exact values and commit info
- Threshold lines: Horizontal lines at 80%, 85%

**Use Case**: Primary view for tracking overall health

### 7.2 Bar Chart: Coverage Delta

**Purpose**: Show change in coverage per commit

**Features**:
- Positive bars (green): Coverage increased
- Negative bars (red): Coverage decreased
- X-axis: Commits (chronological)
- Y-axis: Delta percentage (-10% to +10%)

**Use Case**: Identify commits that hurt/helped coverage

### 7.3 Stacked Area Chart: Coverage Components

**Purpose**: Show proportion of covered vs uncovered code

**Features**:
- Lower area: Covered lines (green)
- Upper area: Uncovered lines (red)
- X-axis: Time
- Y-axis: Absolute line count

**Use Case**: Visualize absolute coverage growth

### 7.4 Line Chart: Test Count Over Time

**Purpose**: Track test suite growth

**Features**:
- Single line: Total test count
- X-axis: Time
- Y-axis: Test count
- Annotations: Major test additions

**Use Case**: Ensure tests grow with codebase

### 7.5 Scatter Plot: Coverage vs Test Count

**Purpose**: Show correlation between tests and coverage

**Features**:
- X-axis: Test count
- Y-axis: Coverage percentage
- Point size: Lines of code
- Color: Branch (main=blue, feature=orange)

**Use Case**: Identify if more tests = better coverage

### 7.6 Heatmap Calendar: Daily Coverage

**Purpose**: Show coverage activity over time

**Features**:
- Calendar grid (GitHub contributions style)
- Color intensity: Coverage level
- Tooltip: Date + exact percentage

**Use Case**: Identify periods of coverage neglect

### 7.7 Recommended Initial Implementation

**Phase 1** (Current):
- Line chart: Coverage over time ✅
- Stats cards: Latest metrics ✅
- Table: Recent commits ✅

**Phase 2** (Next):
- Bar chart: Coverage delta
- Line chart: Uncovered lines count
- Export to CSV

**Phase 3** (Future):
- Test count tracking
- Heatmap calendar view
- Advanced filtering

---

## 8. Testing Strategy

### 8.1 Coverage History Script Testing

```bash
# Test update-history.sh script
tests/coverage/test-update-history.sh

#!/bin/bash
# Test coverage history update script

set -e

echo "Testing update-history.sh..."

# Setup
TEMP_DIR=$(mktemp -d)
MOCK_COVERAGE="$TEMP_DIR/coverage-summary.json"
MOCK_HISTORY="$TEMP_DIR/coverage-history.json"

# Create mock coverage data
cat > "$MOCK_COVERAGE" <<EOF
{
  "total": {
    "lines": { "pct": 85.5, "covered": 342, "total": 400 },
    "functions": { "pct": 88.2, "covered": 75, "total": 85 },
    "branches": { "pct": 82.1, "covered": 156, "total": 190 },
    "statements": { "pct": 86.3, "covered": 380, "total": 440 }
  }
}
EOF

# Test 1: Initial creation
./scripts/coverage/update-history.sh "$MOCK_COVERAGE" "$MOCK_HISTORY"
test -f "$MOCK_HISTORY" || exit 1
echo "✓ Test 1: History file created"

# Test 2: Entry added
ENTRIES=$(jq '.entries | length' "$MOCK_HISTORY")
test "$ENTRIES" -eq 1 || exit 1
echo "✓ Test 2: Entry added"

# Test 3: Second update
./scripts/coverage/update-history.sh "$MOCK_COVERAGE" "$MOCK_HISTORY"
ENTRIES=$(jq '.entries | length' "$MOCK_HISTORY")
test "$ENTRIES" -eq 2 || exit 1
echo "✓ Test 3: Second entry added"

# Test 4: Max entries limit
for i in {1..105}; do
  ./scripts/coverage/update-history.sh "$MOCK_COVERAGE" "$MOCK_HISTORY"
done
ENTRIES=$(jq '.entries | length' "$MOCK_HISTORY")
test "$ENTRIES" -le 100 || exit 1
echo "✓ Test 4: Max entries enforced"

# Cleanup
rm -rf "$TEMP_DIR"

echo "All tests passed!"
```

### 8.2 HTML/JavaScript Testing

```javascript
// tests/coverage/test-coverage-trends.spec.js
import { test, expect } from '@playwright/test';

test.describe('Coverage Trends Dashboard', () => {
  test('should load and display coverage data', async ({ page }) => {
    await page.goto('/coverage-trends.html');

    // Wait for data to load
    await page.waitForSelector('.stats-grid');

    // Check stats cards are visible
    const statsCards = await page.locator('.stat-card').count();
    expect(statsCards).toBe(4); // Lines, Functions, Branches, Statements
  });

  test('should render chart with data', async ({ page }) => {
    await page.goto('/coverage-trends.html');

    // Wait for chart to render
    await page.waitForSelector('canvas#coverageChart');

    // Check canvas exists and has content
    const canvas = await page.locator('canvas#coverageChart');
    expect(await canvas.isVisible()).toBe(true);
  });

  test('should filter data by date range', async ({ page }) => {
    await page.goto('/coverage-trends.html');

    // Click 7-day filter
    await page.click('[data-range="7"]');

    // Wait for chart update
    await page.waitForTimeout(500);

    // Verify active button
    const activeButton = await page.locator('.chart-btn.active');
    expect(await activeButton.getAttribute('data-range')).toBe('7');
  });

  test('should handle missing data gracefully', async ({ page }) => {
    // Intercept JSON request to return empty data
    await page.route('**/coverage-history.json', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ version: 1, updated: new Date().toISOString(), entries: [] })
      });
    });

    await page.goto('/coverage-trends.html');

    // Should show no-data message
    const noData = await page.locator('.no-data');
    expect(await noData.isVisible()).toBe(true);
  });
});
```

### 8.3 Integration Testing

```yaml
# .github/workflows/test-coverage-workflow.yml
name: Test Coverage Workflow

on:
  pull_request:
    paths:
      - 'scripts/coverage/**'
      - 'docs/coverage-trends.html'
      - '.github/workflows/docs.yml'

jobs:
  test-coverage-update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:coverage

      - name: Test update script
        run: |
          chmod +x tests/coverage/test-update-history.sh
          ./tests/coverage/test-update-history.sh

      - name: Validate coverage history
        run: |
          jq empty docs/coverage-history.json

          # Check required fields
          jq -e '.version' docs/coverage-history.json
          jq -e '.updated' docs/coverage-history.json
          jq -e '.entries' docs/coverage-history.json
```

---

## 9. Migration Plan

### 9.1 Current State

- Coverage generation: ✅ Working (Vitest + v8)
- History script: ✅ Implemented (`update-history.sh`)
- HTML dashboard: ✅ 90% complete
- GitHub Pages: ✅ Deployed
- Workflow integration: ✅ Basic implementation

### 9.2 Gaps to Address

1. **Test Count Tracking**: Not currently captured
2. **Error Handling**: Too many `continue-on-error: true`
3. **Validation**: No JSON schema validation
4. **Documentation**: Missing usage docs
5. **Monitoring**: No alerts on coverage drops

### 9.3 Implementation Roadmap

**Week 1: Stabilize Existing**
- [ ] Remove `continue-on-error` flags
- [ ] Add JSON validation
- [ ] Improve error messages
- [ ] Add workflow summary output
- [ ] Test script edge cases

**Week 2: Enhance Data Collection**
- [ ] Add test count tracking
- [ ] Capture test duration
- [ ] Add build number
- [ ] Include commit author
- [ ] Calculate deltas

**Week 3: Improve Visualization**
- [ ] Add uncovered lines chart
- [ ] Add coverage delta chart
- [ ] Implement CSV export
- [ ] Add print styles
- [ ] Improve mobile responsiveness

**Week 4: Documentation & Monitoring**
- [ ] Write usage documentation
- [ ] Add troubleshooting guide
- [ ] Set up coverage drop alerts
- [ ] Create demo video
- [ ] Publish blog post

### 9.4 Rollback Plan

If issues arise:

1. **Revert workflow changes**: Git revert to previous docs.yml
2. **Restore history file**: Use git history to restore coverage-history.json
3. **Disable auto-commit**: Comment out commit step
4. **Manual updates**: Run `update-history.sh` locally and commit manually

---

## 10. Performance Considerations

### 10.1 Page Load Performance

**Current Metrics**:
- HTML size: ~15KB (minified)
- CSS size: ~5KB (inline)
- JavaScript size: ~3KB (inline)
- Chart.js CDN: ~60KB (cached)
- coverage-history.json: ~5KB (100 entries)
- **Total**: ~88KB (~30KB gzipped)

**Target Metrics**:
- First Contentful Paint (FCP): <1s
- Time to Interactive (TTI): <2s
- Total Load Time: <3s

**Optimizations**:
1. **CDN Caching**: Chart.js loaded from CDN (cached)
2. **Minification**: Minify HTML/CSS/JS
3. **Compression**: GitHub Pages serves gzip automatically
4. **Lazy Loading**: Load Chart.js only after data fetch succeeds
5. **Code Splitting**: Consider separate files for large features

### 10.2 Chart Rendering Performance

**Performance Budget**:
- Initial render: <100ms (100 data points)
- Update render: <50ms
- Interaction response: <16ms (60fps)

**Optimizations**:
1. **Decimation**: Skip points when zoomed out
2. **Lazy Rendering**: Only render visible date range
3. **Debouncing**: Debounce resize/filter events
4. **Canvas vs SVG**: Use canvas (faster for many points)

### 10.3 Data Processing Performance

**Benchmarks**:
- JSON parse (100 entries): <1ms
- Data transformation: <5ms
- Chart data preparation: <10ms
- Total processing: <20ms

**Optimizations**:
1. **Memoization**: Cache processed data
2. **Web Workers**: Offload heavy calculations
3. **Pagination**: Show only recent data initially
4. **Incremental Loading**: Load older data on demand

### 10.4 Scalability

**Current Limits**:
- Max entries: 100 (configurable)
- Max file size: ~100KB
- Max load time: <3s

**Future Scalability** (if needed):
- Pagination: Load data in chunks
- API endpoint: Serve from GitHub API instead of static file
- Database: Move to Supabase/Firebase for >1000 entries
- CDN: Use dedicated CDN for large datasets

---

## 11. Security Considerations

### 11.1 Data Privacy

**Coverage Data**:
- Contains: Coverage percentages, commit SHAs, dates
- Does NOT contain: Source code, secrets, user data
- Visibility: Public (GitHub Pages for public repos)

**Mitigation**:
- Store only metadata, no code snippets
- No user identification beyond git author
- No sensitive build information

### 11.2 GitHub Actions Security

**Token Management**:
- No external API tokens required (self-hosted solution)
- Uses built-in `GITHUB_TOKEN` for git operations
- Scoped permissions: `contents: write`, `pages: write`

**Script Security**:
- No external script execution
- All scripts in repo (version controlled)
- No dynamic script loading

### 11.3 CDN Security

**Chart.js CDN**:
- Loaded from `cdn.jsdelivr.net`
- Consider Subresource Integrity (SRI) hashes
- Fallback to local copy if CDN fails

**Recommendation**:
```html
<script
  src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
  integrity="sha384-..."
  crossorigin="anonymous">
</script>
```

### 11.4 Input Validation

**coverage-summary.json**:
- Validate JSON structure before processing
- Check for required fields
- Sanitize commit messages before display

**coverage-history.json**:
- Validate on read and write
- Enforce max entries limit
- Prevent JSON injection attacks

---

## 12. Monitoring and Alerts

### 12.1 Workflow Monitoring

**GitHub Actions**:
- Workflow status: Success/Failure notifications
- Build time: Track duration trends
- Step failures: Identify bottlenecks

**Metrics to Track**:
- Coverage update success rate
- Average workflow duration
- History file size growth
- Failed commits count

### 12.2 Coverage Monitoring

**Alerts**:
- Coverage drop >5% in single commit
- Coverage below threshold for >3 days
- No coverage data for >1 week
- History file corruption

**Implementation**:
```yaml
# .github/workflows/coverage-alerts.yml
- name: Check coverage regression
  run: |
    CURRENT=$(jq -r '.entries[0].coverage.lines.pct' docs/coverage-history.json)
    PREVIOUS=$(jq -r '.entries[1].coverage.lines.pct' docs/coverage-history.json)
    DELTA=$(echo "$CURRENT - $PREVIOUS" | bc)

    if (( $(echo "$DELTA < -5" | bc -l) )); then
      echo "::warning::Coverage dropped by ${DELTA}%"
      # Send Slack notification, create issue, etc.
    fi
```

### 12.3 Dashboard Health Checks

**Automated Tests**:
- Daily Playwright test: Verify dashboard loads
- Weekly link check: Ensure no broken links
- Monthly accessibility audit: Check a11y compliance

**Uptime Monitoring**:
- GitHub Pages uptime (via external service)
- Coverage data freshness check
- Chart rendering test

---

## 13. Cost Analysis

### 13.1 Self-Hosted Solution (Recommended)

| Resource | Cost | Notes |
|----------|------|-------|
| GitHub Pages | **$0** | Free for public repos, 1GB limit |
| GitHub Actions | **$0** | 2000 minutes/month free tier |
| Storage (git repo) | **$0** | ~100KB coverage history |
| Chart.js CDN | **$0** | Free, community supported |
| Development Time | **~8 hours** | One-time setup + enhancements |
| Maintenance | **~1 hour/month** | Monitor, update dependencies |
| **Total** | **$0/month** | |

### 13.2 External Services

#### Codecov

| Tier | Cost | Limits |
|------|------|--------|
| Free (OSS) | $0 | Unlimited repos, limited history |
| Pro | $12/user/month | Advanced features, longer history |

#### Coveralls

| Tier | Cost | Limits |
|------|------|--------|
| Free (OSS) | $0 | Unlimited public repos |
| Pro | $10/month | 1 repo, 5 users |

### 13.3 ROI Analysis

**Self-Hosted Benefits**:
- Save $120-$240/year (vs paid tiers)
- No vendor lock-in
- Full customization
- Learning opportunity for team

**Trade-offs**:
- Initial setup time: ~8 hours
- Maintenance overhead: ~12 hours/year
- No built-in PR comments (can add with GitHub Actions)

**Verdict**: Self-hosted provides excellent ROI for this project size

---

## 14. References and Resources

### 14.1 Research Sources

**Chart Libraries**:
- [Chart.js vs D3.js Comparison](https://www.slant.co/versus/10577/10578/~d3-js_vs_chart-js)
- [Lightweight JavaScript Chart Libraries 2025](https://www.luzmo.com/blog/javascript-chart-libraries)
- [Chart.js Official Documentation](https://www.chartjs.org/)
- [ApexCharts vs Chart.js Bundle Size](https://npm-compare.com/apexcharts,chart.js,d3,highcharts)

**Coverage Services**:
- [Codecov vs Coveralls Comparison](https://stackshare.io/stackups/codecov-vs-coveralls)
- [Best Code Coverage Services 2025](https://www.slant.co/topics/2188/~best-code-coverage-services)
- [Code Coverage Tools Comparison](https://softwaretesting.ai/code-coverage-tools/)

**GitHub Actions & Pages**:
- [GitHub Actions Artifacts Documentation](https://docs.github.com/en/actions/tutorials/store-and-share-data)
- [Auto-Publish Coverage on GitHub Pages](https://dev.to/mbarzeev/auto-publish-your-test-coverage-report-on-github-pages-35be)
- [GitHub Pages Best Practices](https://docs.github.com/en/pages)

**Best Practices**:
- [Code Coverage Best Practices - Atlassian](https://www.atlassian.com/continuous-delivery/software-testing/code-coverage)
- [Test Coverage Metrics Guide](https://www.browserstack.com/guide/test-coverage-metrics-in-software-testing)
- [Measuring Code Coverage - Parasoft](https://www.parasoft.com/blog/measuring-code-coverage/)

### 14.2 Tools and Libraries

**Current Stack**:
- Vitest 3.0.6 with @vitest/coverage-v8
- Chart.js 4.4.1
- chartjs-adapter-date-fns 3.0.0
- jq (JSON processor)

**Recommended Additions**:
- chartjs-plugin-annotation (threshold lines)
- date-fns (date formatting)
- Playwright (E2E testing)

### 14.3 Example Repositories

**Similar Implementations**:
- [jest-coverage-report-action](https://github.com/marketplace/actions/jest-coverage-report)
- [coverage-action](https://github.com/marketplace/actions/code-coverage-summary)
- [OpenCov](https://github.com/dspinellis/opencov) - Self-hosted alternative

---

## 15. Conclusion

### 15.1 Summary

This design document provides a comprehensive blueprint for implementing historical coverage trend tracking for the Happy Birthday App project. The recommended self-hosted approach using Chart.js, JSON storage, and GitHub Actions offers:

**Strengths**:
- Zero cost
- Full control and customization
- No external dependencies
- Lightweight and performant
- Easy to maintain
- Already 80% implemented

**Next Steps**:
1. Implement test count tracking
2. Enhance error handling in workflow
3. Add coverage delta visualizations
4. Write comprehensive documentation
5. Set up monitoring and alerts

### 15.2 Success Metrics

**Implementation Success**:
- [ ] 100% workflow success rate
- [ ] <3s page load time
- [ ] <100ms chart render time
- [ ] 100+ historical data points stored
- [ ] Zero manual interventions needed

**Usage Success**:
- [ ] Coverage trends visible on every commit
- [ ] Team references dashboard weekly
- [ ] Coverage improvements tracked over time
- [ ] Regressions caught within 1 day
- [ ] Documentation viewed by new contributors

### 15.3 Future Enhancements

**Short Term** (1-3 months):
- Add test count and duration tracking
- Implement CSV export
- Add coverage delta alerts
- Create mobile app view

**Medium Term** (3-6 months):
- Multi-branch comparison
- PR coverage preview
- Integration with Slack/Discord
- Automated coverage reports

**Long Term** (6-12 months):
- ML-powered trend prediction
- Anomaly detection
- Coverage recommendation engine
- Cross-repo coverage aggregation

---

## Appendix A: Sample Data Structures

### A.1 coverage-summary.json (Vitest Output)

```json
{
  "total": {
    "lines": {
      "total": 400,
      "covered": 342,
      "skipped": 0,
      "pct": 85.5
    },
    "statements": {
      "total": 440,
      "covered": 380,
      "skipped": 0,
      "pct": 86.36
    },
    "functions": {
      "total": 85,
      "covered": 75,
      "skipped": 0,
      "pct": 88.24
    },
    "branches": {
      "total": 190,
      "covered": 156,
      "skipped": 0,
      "pct": 82.11
    }
  }
}
```

### A.2 coverage-history.json (Enhanced)

```json
{
  "version": 1,
  "updated": "2025-12-31T14:30:00Z",
  "metadata": {
    "repository": "fairyhunter13/happy-bday-app",
    "thresholds": {
      "lines": 80,
      "functions": 80,
      "branches": 80,
      "statements": 85
    },
    "maxEntries": 100,
    "retentionDays": 90
  },
  "entries": [
    {
      "timestamp": "2025-12-31T14:30:00Z",
      "branch": "main",
      "commit": "a1b2c3d",
      "commitFull": "a1b2c3d4e5f6789012345678901234567890abcd",
      "author": "github-actions[bot]",
      "buildNumber": "123",
      "workflow": "Deploy Documentation",
      "coverage": {
        "lines": {
          "pct": 85.5,
          "covered": 342,
          "total": 400,
          "skipped": 0
        },
        "functions": {
          "pct": 88.24,
          "covered": 75,
          "total": 85,
          "skipped": 0
        },
        "branches": {
          "pct": 82.11,
          "covered": 156,
          "total": 190,
          "skipped": 0
        },
        "statements": {
          "pct": 86.36,
          "covered": 380,
          "total": 440,
          "skipped": 0
        }
      },
      "tests": {
        "total": 145,
        "passed": 145,
        "failed": 0,
        "skipped": 0,
        "duration": 12.5
      },
      "delta": {
        "lines": 2.3,
        "functions": 1.5,
        "branches": -0.8,
        "statements": 1.9
      }
    }
  ]
}
```

---

## Appendix B: Configuration Examples

### B.1 Environment Variables

```bash
# .env.example for coverage tracking

# Coverage History Settings
MAX_DATA_POINTS=100
COVERAGE_THRESHOLD_LINES=80
COVERAGE_THRESHOLD_FUNCTIONS=80
COVERAGE_THRESHOLD_BRANCHES=80
COVERAGE_THRESHOLD_STATEMENTS=85

# Alert Settings
ALERT_ON_REGRESSION=true
ALERT_THRESHOLD=-5
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Git Settings
GIT_AUTHOR_NAME="github-actions[bot]"
GIT_AUTHOR_EMAIL="github-actions[bot]@users.noreply.github.com"

# Paths
COVERAGE_FILE=coverage/coverage-summary.json
HISTORY_FILE=docs/coverage-history.json
```

### B.2 Chart.js Theme Configuration

```javascript
// Dark theme for coverage trends
const darkTheme = {
  colors: {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    background: '#0f172a',
    backgroundSecondary: '#1e293b',
    border: '#475569'
  },
  chart: {
    gridColor: '#334155',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    fontSize: 12
  }
};

// Apply theme to Chart.js
Chart.defaults.color = darkTheme.colors.text;
Chart.defaults.borderColor = darkTheme.colors.border;
Chart.defaults.font.family = darkTheme.chart.fontFamily;
```

---

**Document Version**: 1.0
**Last Updated**: 2025-12-31
**Status**: Ready for Implementation
**Approver**: ARCHITECT Agent
