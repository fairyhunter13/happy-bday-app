# Coverage Trends Implementation Plan

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [1. Current State Analysis](#1-current-state-analysis)
3. [2. Technology Decisions](#2-technology-decisions)
4. [3. Data Structure Design](#3-data-structure-design)
5. [4. Implementation Plan](#4-implementation-plan)
6. [Current Coverage](#current-coverage)
7. [Trends](#trends)
8. [5. Implementation Roadmap](#5-implementation-roadmap)
9. [6. Success Metrics](#6-success-metrics)
10. [7. Maintenance & Troubleshooting](#7-maintenance-troubleshooting)
11. [8. Resources & References](#8-resources-references)
12. [9. Conclusion](#9-conclusion)
13. [Appendix: Quick Reference](#appendix-quick-reference)

---

## Executive Summary

This document provides a comprehensive technical design for implementing historical coverage trend tracking on GitHub Pages for the Happy Birthday App. The solution tracks coverage metrics over time, visualizes trends with interactive charts, and provides dynamic badges that update automatically via GitHub Actions.

**Status**: Ready for Implementation
**Priority**: Medium
**Estimated Effort**: 6-8 hours
**Dependencies**: GitHub Pages, GitHub Actions, existing test infrastructure

---

## 1. Current State Analysis

### 1.1 Existing Infrastructure

**GitHub Pages Deployment**: `.github/workflows/docs.yml`
- Deploys API documentation with Redoc
- Runs on push to main branch
- Already includes coverage history update (line 50-54)
- Commits coverage history back to repo (line 190-199)

**Coverage Scripts**: `scripts/coverage/`
- `update-history.sh` - Basic history tracking (126 lines)
- `check-thresholds.sh` - Threshold validation (89 lines)

**Visualization**: `docs/coverage-trends.html` (765 lines)
- Chart.js 4.4.1 with date-fns adapter
- Time-series line charts for all metrics
- Interactive filtering (7/14/30 days, All)
- Stats cards with delta indicators
- Recent commits table
- Dark theme, fully responsive

**Data Structure**: `docs/coverage-history.json`
- Version 1 schema
- Currently empty (2 entries placeholder)
- Sample data in `plan/coverage-history-sample.json` (386 lines)

**Test Coverage**: Vitest with v8 provider
- Thresholds: Lines 80%, Functions 80%, Branches 80%, Statements 85%
- Reporters: text, json, html, lcov
- Output: `coverage/coverage-summary.json`

### 1.2 Gap Analysis

From `plan/GAP_ANALYSIS_REPORT.md` requirements:

**Required**:
1. ✅ Historical data storage - Exists but needs enhancement
2. ✅ Trend charts - Implemented in coverage-trends.html
3. 🔨 Automated GitHub Actions updates - Partially implemented
4. 🔨 Dynamic badges - Missing
5. 🔨 Coverage delta tracking - Partially implemented

**Missing**:
- Badge JSON generation for Shields.io
- Enhanced delta calculation
- PR number extraction
- Coverage report generation
- Badge integration in README.md

---

## 2. Technology Decisions

### 2.1 Chart Library: Chart.js ✅

**Decision**: Use Chart.js 4.4.1 (already implemented)

**Rationale**:
- Lower learning curve vs D3.js
- Canvas-based (better performance for time-series)
- 90% less development effort
- Perfect for standard line charts
- Already integrated and working

**Research Sources**:
- Chart.js vs D3.js comparison: Slant.co, CreateWithData, Medium articles
- Market share: D3 8.86% vs Chart.js 1.57% (both viable)
- Performance: Both handle thousands of data points efficiently

**Alternative Considered**: D3.js
- Pros: More flexible, SVG-based, powerful customization
- Cons: Steeper learning curve, significantly more development time
- Conclusion: Unnecessary complexity for our use case

### 2.2 Badge Service: Shields.io Endpoint Badge

**Decision**: Use Shields.io Endpoint Badge with self-hosted JSON

**Rationale**:
- Free for open source
- No API tokens or third-party accounts
- Dynamic updates via JSON file on GitHub Pages
- Highly customizable (color, style, icons)
- 5-minute cache (configurable)

**Implementation**:
```
Badge URL: https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json
```

**JSON Format** (`docs/coverage-badge.json`):
```json
{
  "schemaVersion": 1,
  "label": "coverage",
  "message": "85.5%",
  "color": "brightgreen",
  "namedLogo": "vitest",
  "style": "flat-square",
  "cacheSeconds": 300
}
```

**Color Logic**:
- >= 80%: brightgreen
- 60-79%: yellow
- < 60%: red

**Research Sources**:
- Shields.io official documentation
- Dynamic Badges GitHub Action
- Coverage badge tutorials (Medium, DEV.to)

---

## 3. Data Structure Design

### 3.1 JSON Schema - coverage-history.json

**Version**: 1.0
**Location**: `docs/coverage-history.json`
**Max Entries**: 100 (configurable via metadata.maxDataPoints)

```json
{
  "version": 1,
  "updated": "2025-12-31T12:00:00Z",
  "metadata": {
    "repository": "fairyhunter13/happy-bday-app",
    "maxDataPoints": 100,
    "retentionDays": 90,
    "thresholds": {
      "lines": 80,
      "functions": 80,
      "branches": 80,
      "statements": 85
    }
  },
  "entries": [
    {
      "timestamp": "2025-12-31T12:00:00Z",
      "branch": "main",
      "commit": "abc1234",
      "commitFull": "abc1234567890def1234567890abcdef12345678",
      "author": "github-actions[bot]",
      "message": "feat: add new scheduling feature",
      "prNumber": 123,
      "coverage": {
        "lines": {"pct": 85.5, "covered": 342, "total": 400},
        "functions": {"pct": 82.3, "covered": 89, "total": 108},
        "branches": {"pct": 78.9, "covered": 123, "total": 156},
        "statements": {"pct": 86.2, "covered": 350, "total": 406}
      },
      "delta": {
        "lines": 2.3,
        "functions": 1.1,
        "branches": -0.5,
        "statements": 2.1
      }
    }
  ]
}
```

**Design Principles**:
1. **Versioning**: Schema version for future migrations
2. **Metadata**: Centralized configuration
3. **Rich Context**: Git metadata for traceability
4. **Delta Tracking**: Pre-calculated for performance
5. **Extensibility**: Room for future fields

---

## 4. Implementation Plan

### 4.1 Phase 1: Enhanced Scripts (Priority: High)

#### Task 1.1: Enhance update-history.sh

**File**: `scripts/coverage/update-history.sh`
**Current**: 126 lines, basic functionality
**Enhancements**:

1. Add badge JSON generation
2. Calculate deltas from previous entry
3. Extract PR number from commit message
4. Improve error handling and logging
5. Add support for coverage-badge.json output

**Key Changes**:
```bash

# Add third parameter for badge file

BADGE_FILE="${3:-docs/coverage-badge.json}"

# Calculate deltas

if [ -f "$HISTORY_FILE" ] && [ "$(jq '.entries | length' "$HISTORY_FILE")" -gt 0 ]; then
    PREV_LINES=$(jq -r '.entries[0].coverage.lines.pct // 0' "$HISTORY_FILE")
    DELTA_LINES=$(echo "$LINES_PCT - $PREV_LINES" | bc -l | xargs printf "%.2f")
else
    DELTA_LINES=0
fi

# Generate badge JSON

BADGE_COLOR="brightgreen"
if (( $(echo "$COVERAGE_VALUE >= 80" | bc -l) )); then
    BADGE_COLOR="brightgreen"
elif (( $(echo "$COVERAGE_VALUE >= 60" | bc -l) )); then
    BADGE_COLOR="yellow"
else
    BADGE_COLOR="red"
fi

cat > "$BADGE_FILE" <<EOF
{
  "schemaVersion": 1,
  "label": "coverage",
  "message": "${COVERAGE_VALUE}%",
  "color": "$BADGE_COLOR",
  "namedLogo": "vitest",
  "logoColor": "white",
  "style": "flat-square",
  "cacheSeconds": 300
}
EOF
```

#### Task 1.2: Create generate-coverage-report.sh

**File**: `scripts/coverage/generate-coverage-report.sh`
**Purpose**: Generate markdown coverage report with trends

**Implementation**:
```bash

#!/bin/bash
# Generate Coverage Report with Trends

set -e

HISTORY_FILE="${1:-docs/coverage-history.json}"
OUTPUT_FILE="${2:-docs/COVERAGE_REPORT.md}"

# Extract metrics

LATEST=$(jq '.entries[0]' "$HISTORY_FILE")
OLDEST=$(jq '.entries[-1]' "$HISTORY_FILE")
TREND_LINES=$(jq -r '(.entries[0].coverage.lines.pct - .entries[-1].coverage.lines.pct)' "$HISTORY_FILE")

# Generate report

cat > "$OUTPUT_FILE" <<EOF

# Coverage Trends Report

**Generated**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## Current Coverage

| Metric | Percentage | Status |
|--------|-----------|--------|
| Lines | $(jq -r '.entries[0].coverage.lines.pct' "$HISTORY_FILE")% | ✅ Pass |

## Trends

View interactive trends: [Coverage Dashboard](https://fairyhunter13.github.io/happy-bday-app/coverage-trends.html)
EOF
```

### 4.2 Phase 2: GitHub Actions Integration (Priority: High)

#### Task 2.1: Update docs.yml workflow

**File**: `.github/workflows/docs.yml`

**Changes**:

1. Update coverage history step (line 50-54):
```yaml
- name: Update coverage history
  run: |
    chmod +x scripts/coverage/update-history.sh
    ./scripts/coverage/update-history.sh coverage/coverage-summary.json docs/coverage-history.json docs/coverage-badge.json || true
  continue-on-error: true
```

2. Add report generation step (after coverage history):
```yaml
- name: Generate coverage report
  run: |
    chmod +x scripts/coverage/generate-coverage-report.sh
    ./scripts/coverage/generate-coverage-report.sh docs/coverage-history.json docs/COVERAGE_REPORT.md || true
  continue-on-error: true
```

3. Update site creation (line 70-139):
```yaml

# Copy coverage badge if it exists

if [ -f docs/coverage-badge.json ]; then
  cp docs/coverage-badge.json _site/coverage-badge.json
fi

# Copy coverage report if it exists

if [ -f docs/COVERAGE_REPORT.md ]; then
  cp docs/COVERAGE_REPORT.md _site/COVERAGE_REPORT.md
fi
```

4. Update commit step (line 190-199):
```yaml
- name: Commit coverage history
  run: |
    if [ -f docs/coverage-history.json ] || [ -f docs/coverage-badge.json ]; then
      git config --local user.email "github-actions[bot]@users.noreply.github.com"
      git config --local user.name "github-actions[bot]"
      git add docs/coverage-history.json docs/coverage-badge.json docs/COVERAGE_REPORT.md
      git diff --staged --quiet || git commit -m "chore: update coverage history and badge [skip ci]"
      git push || true
    fi
  continue-on-error: true
```

### 4.3 Phase 3: Badge Integration (Priority: High)

#### Task 3.1: Update README.md

**File**: `README.md`
**Change**: Replace Codecov badge (line 5) with Shields.io endpoint badge

**Current**:
```markdown
[![Coverage](https://codecov.io/gh/fairyhunter13/happy-bday-app/branch/main/graph/badge.svg)](https://codecov.io/gh/fairyhunter13/happy-bday-app)
```

**New**:
```markdown
[![Coverage](https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json)](https://fairyhunter13.github.io/happy-bday-app/coverage-trends.html)
```

**Benefits**:
- Self-hosted (no external service dependency)
- Links directly to trends dashboard
- Updates automatically via GitHub Actions

### 4.4 Phase 4: HTML Enhancements (Priority: Medium)

#### Task 4.1: Add Export Functionality

**File**: `docs/coverage-trends.html`
**Add to chart-controls** (around line 160):

```html
<button class="chart-btn" onclick="exportData('csv')">📥 Export CSV</button>
<button class="chart-btn" onclick="exportData('json')">📥 Export JSON</button>
```

**Add JavaScript** (before closing </script> tag):

```javascript
function exportData(format) {
    const entries = window.coverageData?.entries || [];

    if (format === 'csv') {
        const headers = ['Timestamp', 'Commit', 'Branch', 'Lines %', 'Functions %', 'Branches %', 'Statements %'];
        const rows = entries.map(e => [
            e.timestamp,
            e.commit,
            e.branch,
            e.coverage.lines.pct,
            e.coverage.functions.pct,
            e.coverage.branches.pct,
            e.coverage.statements.pct
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        downloadFile(csv, 'coverage-trends.csv', 'text/csv');
    } else if (format === 'json') {
        const json = JSON.stringify(window.coverageData, null, 2);
        downloadFile(json, 'coverage-trends.json', 'application/json');
    }
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// Store data globally for export
async function init() {
    // ... existing code ...
    window.coverageData = data; // Add this line
    renderDashboard(data);
}
```

#### Task 4.2: Add Print-Friendly CSS

**Add to <style> section** (around line 350):

```css
@media print {
    .chart-controls, .nav-links, footer {
        display: none;
    }
    .chart-container {
        height: 300px !important;
    }
    body {
        background: white;
        color: black;
    }
    .stat-card, .chart-section, .commits-section {
        border-color: #ccc !important;
        background: white !important;
    }
}
```

### 4.5 Phase 5: Testing & Validation (Priority: High)

#### Task 5.1: Manual Testing Checklist

**Pre-deployment**:
- [ ] Run `npm run test:coverage`
- [ ] Verify `coverage/coverage-summary.json` exists
- [ ] Run `./scripts/coverage/update-history.sh`
- [ ] Verify `docs/coverage-history.json` updated
- [ ] Verify `docs/coverage-badge.json` created
- [ ] Check badge color matches coverage percentage
- [ ] Verify deltas calculated correctly
- [ ] Open `docs/coverage-trends.html` in browser
- [ ] Test all chart filters (7/14/30/All days)
- [ ] Test export CSV functionality
- [ ] Test export JSON functionality
- [ ] Verify responsive design on mobile

**Post-deployment**:
- [ ] Push to GitHub
- [ ] Verify GitHub Actions workflow succeeds
- [ ] Check GitHub Pages deployment
- [ ] Verify badge displays on README.md
- [ ] Click badge to verify it links to trends page
- [ ] Verify trends page loads on GitHub Pages
- [ ] Check badge updates after next push
- [ ] Verify coverage history persists across deployments

#### Task 5.2: Unit Tests (Optional)

**File**: `tests/scripts/coverage-history.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';

describe('Coverage History Scripts', () => {
  it('should create history file on first run', () => {
    // Test implementation
  });

  it('should calculate deltas correctly', () => {
    // Test implementation
  });

  it('should generate badge with correct color', () => {
    // Test implementation
  });
});
```

---

## 5. Implementation Roadmap

### Week 1: Core Functionality

- [ ] Day 1-2: Enhance update-history.sh
- [ ] Day 2-3: Create generate-coverage-report.sh
- [ ] Day 3-4: Update docs.yml workflow
- [ ] Day 4-5: Test locally and fix issues

### Week 2: Deployment & Polish

- [ ] Day 1: Update README.md with badge
- [ ] Day 2: Deploy to GitHub and verify
- [ ] Day 3: Add HTML export functionality
- [ ] Day 4: Add print-friendly CSS
- [ ] Day 5: Final testing and documentation

### Week 3: Optional Enhancements

- [ ] PR comment workflow
- [ ] Advanced chart features
- [ ] Unit tests for scripts
- [ ] Performance optimizations

---

## 6. Success Metrics

**Technical**:
- Coverage history updates on every push to main
- Badge reflects correct coverage percentage
- Badge updates within 10 minutes of push
- Trends page loads in < 2 seconds
- 100% workflow success rate

**User Experience**:
- Developers can view historical trends
- Easy to identify coverage regressions
- Export functionality for offline analysis
- Mobile-friendly visualization

---

## 7. Maintenance & Troubleshooting

### 7.1 Common Issues

**Badge Not Updating**:
1. Check GitHub Actions run succeeded
2. Verify coverage-badge.json exists in GitHub Pages
3. Clear Shields.io cache (wait 5 minutes)
4. Check badge URL syntax in README.md

**Trends Page Not Loading**:
1. Verify GitHub Pages is enabled
2. Check coverage-trends.html exists in _site
3. Check browser console for JavaScript errors
4. Verify coverage-history.json is valid JSON

**Coverage Data Missing**:
1. Verify coverage-history.json has entries
2. Check workflow logs for errors
3. Verify update-history.sh has execute permissions
4. Check jq is available in GitHub Actions

### 7.2 Debug Commands

```bash

# Validate JSON files

jq '.' docs/coverage-history.json
jq '.' docs/coverage-badge.json

# Test badge URL

curl -I "https://img.shields.io/endpoint?url=https://fairyhunter13.github.io/happy-bday-app/coverage-badge.json"

# Test GitHub Pages deployment

curl -I "https://fairyhunter13.github.io/happy-bday-app/coverage-trends.html"

# Run scripts locally

npm run test:coverage
./scripts/coverage/update-history.sh coverage/coverage-summary.json /tmp/history.json /tmp/badge.json
cat /tmp/badge.json | jq
```

---

## 8. Resources & References

### Documentation

- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
- [Shields.io Endpoint Badge](https://shields.io/badges/endpoint-badge)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)

### Research Sources

- **Chart.js vs D3.js**: Slant.co, CreateWithData, Medium comparisons
- **Dynamic Badges**: GitHub Marketplace, DEV.to tutorials
- **Coverage Tracking**: Medium articles, devgem.io troubleshooting

### Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Chart.js | 4.4.1 | Data visualization |
| chartjs-adapter-date-fns | 3.0.0 | Time-series support |
| Vitest | Latest | Test coverage |
| jq | 1.6+ | JSON processing |
| Shields.io | N/A | Badge generation |

---

## 9. Conclusion

This implementation plan provides a complete, self-hosted solution for coverage trend tracking with minimal complexity and zero external dependencies. The design leverages existing infrastructure and follows industry best practices.

**Key Benefits**:
1. Self-hosted (no external services)
2. Zero cost
3. Automated via GitHub Actions
4. Rich visualizations with Chart.js
5. Easy maintenance

**Next Steps**:
1. Review and approve this plan
2. Execute Phase 1-3 (Week 1-2)
3. Deploy and verify (Week 2)
4. Consider optional enhancements (Week 3)

---

**Document Version**: 1.0
**Last Updated**: 2025-12-31
**Author**: RESEARCHER Agent (Hive Mind)
**Status**: Ready for Implementation

---

## Appendix: Quick Reference

### Commands

```bash

# Run coverage and update history

npm run test:coverage
./scripts/coverage/update-history.sh

# Generate report

./scripts/coverage/generate-coverage-report.sh

# View locally

open docs/coverage-trends.html

# Validate JSON

jq '.' docs/coverage-history.json
jq '.' docs/coverage-badge.json
```

### File Locations

- History: `docs/coverage-history.json`
- Badge: `docs/coverage-badge.json`
- Report: `docs/COVERAGE_REPORT.md`
- HTML: `docs/coverage-trends.html`
- Scripts: `scripts/coverage/*.sh`
- Workflow: `.github/workflows/docs.yml`

### Badge Configuration

- Good (green): >= 80%
- Warning (yellow): 60-79%
- Critical (red): < 60%
- Cache: 5 minutes

---

**End of Implementation Plan**
