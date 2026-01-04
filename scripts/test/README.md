# Test Results Generation Scripts

This directory contains scripts for generating detailed JSON files for each test suite type.

## Overview

The test results system generates individual JSON files for each test suite:

- **`integration-results.json`** - Integration test metrics and status
- **`e2e-results.json`** - End-to-end test metrics and status
- **`chaos-results.json`** - Chaos engineering test metrics and status

These files complement the summary `test-results.json` file with detailed per-suite information.

## Scripts

### `generate-test-results.ts`

Generates test result JSON files based on environment variables and available data.

**Usage:**
```bash
# Generate all test result files
tsx scripts/test/generate-test-results.ts [output-dir]

# With environment variables
INTEGRATION_STATUS=success \
E2E_STATUS=success \
CHAOS_STATUS=success \
tsx scripts/test/generate-test-results.ts ./docs
```

**Environment Variables:**
- `INTEGRATION_STATUS` - Status of integration tests (success/failure/skipped)
- `E2E_STATUS` - Status of E2E tests (success/failure/skipped)
- `CHAOS_STATUS` - Status of chaos tests (success/failure/skipped)

**Features:**
- Automatically counts test files per suite
- Parses coverage data from coverage directories
- Generates reasonable estimates when actual data unavailable
- Calculates integration-specific metrics (DB/RabbitMQ/Redis health)
- Calculates E2E-specific metrics (endpoint coverage, browser info)
- Calculates chaos-specific metrics (resilience score, recovery times)

### `parse-vitest-results.ts`

Parses actual vitest JSON output for accurate test metrics.

**Usage:**
```bash
# Run tests with JSON reporter
vitest run --config vitest.config.integration.ts \
  --reporter=json --outputFile=integration-output.json

# Parse the JSON output
tsx scripts/test/parse-vitest-results.ts \
  integration-output.json integration ./docs
```

**Arguments:**
1. `input-file` - Path to vitest JSON output file
2. `test-type` - Type of test (integration, e2e, or chaos)
3. `output-dir` - Directory to write result JSON (default: ./docs)

**Features:**
- Parses actual test counts from vitest
- Extracts precise duration measurements
- Determines success/failure from test results
- Enhances with test-type-specific metrics
- Integrates coverage data when available

## JSON Schema

### Integration Results

```json
{
  "type": "integration",
  "status": "success",
  "metrics": {
    "total": 250,
    "passed": 250,
    "failed": 0,
    "skipped": 0,
    "duration": "3m 45s",
    "timestamp": "2026-01-05T10:30:00Z",
    "coverage": {
      "lines": 85.5,
      "statements": 86.2,
      "functions": 78.3,
      "branches": 82.1
    },
    "integrations": {
      "database": {
        "status": "healthy",
        "tests": 100
      },
      "rabbitmq": {
        "status": "healthy",
        "tests": 88
      },
      "redis": {
        "status": "healthy",
        "tests": 62
      }
    }
  },
  "timestamp": "2026-01-05T10:30:00Z"
}
```

### E2E Results

```json
{
  "type": "e2e",
  "status": "success",
  "metrics": {
    "total": 200,
    "passed": 200,
    "failed": 0,
    "skipped": 0,
    "duration": "12m 15s",
    "timestamp": "2026-01-05T10:30:00Z",
    "shards": 2,
    "browser": "Chrome",
    "coverage": {
      "lines": 75.2,
      "statements": 76.8,
      "functions": 68.5,
      "branches": 71.3
    },
    "endpoints": {
      "tested": 45,
      "total": 50,
      "coverage": 90.0
    }
  },
  "timestamp": "2026-01-05T10:30:00Z"
}
```

### Chaos Results

```json
{
  "type": "chaos",
  "status": "success",
  "metrics": {
    "total": 42,
    "passed": 42,
    "failed": 0,
    "skipped": 0,
    "duration": "6m 30s",
    "timestamp": "2026-01-05T10:30:00Z",
    "scenarios": {
      "total": 15,
      "passed": 15,
      "failed": 0
    },
    "resilience": {
      "score": 95,
      "averageRecoveryTime": "2.3s"
    },
    "coverage": {
      "lines": 82.1,
      "statements": 83.4,
      "functions": 71.2,
      "branches": 79.8
    },
    "failures": {
      "database": 5,
      "rabbitmq": 4,
      "redis": 3,
      "network": 3
    }
  },
  "timestamp": "2026-01-05T10:30:00Z"
}
```

## Integration with CI/CD

### Current Workflow (Estimated Data)

The `ci-full.yml` workflow currently uses `generate-test-results.ts` after test jobs complete:

```yaml
- name: Generate test suite results
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  env:
    INTEGRATION_STATUS: ${{ needs.integration-tests.result }}
    E2E_STATUS: ${{ needs.e2e-tests.result }}
    CHAOS_STATUS: ${{ needs.chaos-tests.result }}
  run: |
    tsx scripts/test/generate-test-results.ts ./docs
```

This generates results based on job status and file counts.

### Enhanced Workflow (Actual Data)

To get actual test metrics, modify test jobs to output JSON:

```yaml
integration-tests:
  steps:
    # ... existing steps ...

    - name: Run integration tests with JSON output
      run: |
        npm run test:integration -- \
          --reporter=verbose \
          --reporter=json \
          --outputFile=integration-output.json

    - name: Upload test results
      uses: actions/upload-artifact@v4
      with:
        name: integration-test-results
        path: integration-output.json
```

Then in the coverage-report job:

```yaml
coverage-report:
  steps:
    # ... existing steps ...

    - name: Download test results
      uses: actions/download-artifact@v4
      with:
        pattern: '*-test-results'
        path: test-results/

    - name: Generate detailed test suite results
      run: |
        # Parse actual vitest JSON output for accurate metrics
        if [ -f test-results/integration-test-results/integration-output.json ]; then
          tsx scripts/test/parse-vitest-results.ts \
            test-results/integration-test-results/integration-output.json \
            integration ./docs
        fi

        if [ -f test-results/e2e-test-results/e2e-output.json ]; then
          tsx scripts/test/parse-vitest-results.ts \
            test-results/e2e-test-results/e2e-output.json \
            e2e ./docs
        fi

        if [ -f test-results/chaos-test-results/chaos-output.json ]; then
          tsx scripts/test/parse-vitest-results.ts \
            test-results/chaos-test-results/chaos-output.json \
            chaos ./docs
        fi
```

## Local Usage

### Generate with Estimated Data

```bash
# Quick generation for local testing
INTEGRATION_STATUS=success \
E2E_STATUS=success \
CHAOS_STATUS=success \
tsx scripts/test/generate-test-results.ts ./docs
```

### Generate with Actual Test Data

```bash
# Run tests with JSON output
npm run test:integration -- --reporter=json --outputFile=integration-output.json
npm run test:e2e -- --reporter=json --outputFile=e2e-output.json
npm run test:chaos -- --reporter=json --outputFile=chaos-output.json

# Parse the JSON output
tsx scripts/test/parse-vitest-results.ts integration-output.json integration ./docs
tsx scripts/test/parse-vitest-results.ts e2e-output.json e2e ./docs
tsx scripts/test/parse-vitest-results.ts chaos-output.json chaos ./docs
```

## Implementation Notes

### Why Two Scripts?

1. **`generate-test-results.ts`** - For when detailed vitest JSON is not available (current state)
   - Uses environment variables and file counts
   - Provides reasonable estimates
   - Fast and doesn't require test re-runs
   - Works with existing CI/CD setup

2. **`parse-vitest-results.ts`** - For when vitest JSON output is available (future enhancement)
   - Uses actual test data
   - More accurate metrics
   - Requires vitest JSON reporter
   - Better for detailed analysis

### Current State

Currently using `generate-test-results.ts` because:
- CI workflow doesn't capture vitest JSON output
- Adds minimal overhead to existing workflow
- Provides useful data for dashboards
- Easy to enhance later with actual data

### Future Enhancement

To get actual test data:
1. Add `--reporter=json` to test commands
2. Upload JSON output as artifacts
3. Use `parse-vitest-results.ts` in coverage-report job
4. Get precise test counts, durations, and pass rates

### Trade-offs

**Current Approach (Estimated):**
- ✅ Simple to implement
- ✅ No workflow changes needed
- ✅ Fast execution
- ❌ Estimated metrics
- ❌ Less accurate

**Enhanced Approach (Actual Data):**
- ✅ Accurate metrics
- ✅ Detailed test information
- ✅ Better insights
- ❌ Requires workflow changes
- ❌ Additional artifacts to manage

## Development

### Testing Scripts Locally

```bash
# Test generate-test-results.ts
tsx scripts/test/generate-test-results.ts /tmp/test-output
cat /tmp/test-output/integration-results.json
cat /tmp/test-output/e2e-results.json
cat /tmp/test-output/chaos-results.json

# Test parse-vitest-results.ts
# First run a test suite with JSON output
vitest run --config vitest.config.unit.ts --reporter=json --outputFile=/tmp/unit-output.json
tsx scripts/test/parse-vitest-results.ts /tmp/unit-output.json integration /tmp/test-output
```

### Validation

Both scripts validate:
- Output directory exists (creates if needed)
- Coverage files are parsed correctly
- JSON output is valid and well-formed
- Required fields are present

## References

- [Vitest JSON Reporter](https://vitest.dev/guide/reporters.html#json-reporter)
- [GitHub Actions Artifacts](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts)
- [Test Results JSON Schema](../../docs/test-results.json)
