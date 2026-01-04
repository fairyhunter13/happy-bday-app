---
description: Update all GitHub Pages badge JSON files with latest metrics
globs:
  - "docs/*-badge.json"
  - "coverage/coverage-summary.json"
  - "reports/mutation/mutation.json"
  - "tests/**/*.test.ts"
---

# Update GitHub Pages Badges

This skill updates all badge JSON files with the latest metrics from test runs, coverage reports, and other sources, then commits and pushes the changes.

## Usage

```bash
/update-badges
```

## What It Does

1. **Collects latest metrics** from:
   - Test count (from test files)
   - Coverage percentage (from coverage reports)
   - Security vulnerabilities (from npm audit)
   - Documentation health (from file counts)
   - Build performance (from GitHub API)

2. **Updates badge JSON files** in docs/:
   - `test-badge.json` - Test count
   - `coverage-badge.json` - Code coverage percentage
   - `security-badge.json` - Security vulnerability count
   - `health-badge.json` - Documentation health score
   - `build-duration-badge.json` - CI build time
   - `health-summary.json` - Complete metrics summary

3. **Commits and pushes** changes to trigger GitHub Pages deployment

## Prerequisites

- Node.js and npm installed
- GitHub CLI (`gh`) installed and authenticated
- Tests have been run to generate coverage data

## Example Output

```
📊 Updating GitHub Pages badges...

Collecting metrics...
✓ Test files: 62 found
✓ Estimated tests: 992+
✓ Coverage: 88.42% (from coverage-summary.json)
✓ Security: 0 critical, 0 high vulnerabilities
✓ Documentation: 130+ markdown files (100% health)
✓ Build time: 5m (average of last 5 runs)

Updating badge files...
✓ test-badge.json updated
✓ coverage-badge.json updated
✓ security-badge.json updated
✓ health-badge.json updated
✓ build-duration-badge.json updated
✓ health-summary.json updated

Committing changes...
✓ Changes committed
✓ Pushed to origin/main

✅ Badge data updated successfully!
🌐 GitHub Pages will update automatically
```

## Notes

- Badge JSON files follow shields.io endpoint schema v1
- GitHub Pages deployment happens automatically after push
- All badges use dynamic endpoints for real-time metrics
- Coverage data requires running `npm run test:coverage` first

## Troubleshooting

### Coverage data not found

Run tests with coverage first:
```bash
npm run test:coverage
```

### GitHub API rate limit

The build duration metric uses GitHub API. If rate limited, it will fall back to a default value.

### Permission denied on git push

Ensure you have write access to the repository and your git credentials are configured.
