# Test Suite Results Documentation

## Overview

The project now generates individual JSON result files for each test suite type, providing detailed metrics beyond the summary `test-results.json` file.

## Generated Files

### 1. `integration-results.json`

Detailed metrics for integration tests covering database, message queue, and cache integration.

**Schema:**
```json
{
  "type": "integration",
  "status": "success",
  "metrics": {
    "total": 250,
    "passed": 250,
    "failed": 0,
    "skipped": 0,
    "duration": "3-5 min",
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

**Key Metrics:**
- **Total Tests**: Number of integration test cases
- **Pass/Fail/Skip**: Test execution results
- **Duration**: Estimated or actual execution time
- **Coverage**: Code coverage from integration tests (when available)
- **Integration Health**: Per-service test counts and health status
  - Database (PostgreSQL)
  - RabbitMQ (Message Queue)
  - Redis (Cache)

### 2. `e2e-results.json`

Detailed metrics for end-to-end tests covering full system workflows.

**Schema:**
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

**Key Metrics:**
- **Shards**: Number of parallel test shards (for faster execution)
- **Browser**: Test environment (Chrome for HTTP client testing)
- **Endpoint Coverage**: API endpoint test coverage
  - Tested endpoints vs total endpoints
  - Coverage percentage
- **Coverage**: Code coverage from E2E tests (when available)

### 3. `chaos-results.json`

Detailed metrics for chaos engineering tests covering resilience and fault tolerance.

**Schema:**
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

**Key Metrics:**
- **Scenarios**: Chaos engineering scenarios tested
  - Total scenarios
  - Passed/failed counts
- **Resilience Score**: Overall system resilience (0-100)
- **Recovery Time**: Average time to recover from failures
- **Failure Types**: Count of tests per failure type
  - Database failures
  - RabbitMQ failures
  - Redis failures
  - Network failures
- **Coverage**: Code coverage from chaos tests (when available)

## Generation Scripts

### Current Implementation (`generate-test-results.ts`)

**Location**: `scripts/test/generate-test-results.ts`

**Purpose**: Generate test result files based on environment variables and available data.

**Usage**:
```bash
# In CI/CD
INTEGRATION_STATUS=success \
E2E_STATUS=success \
CHAOS_STATUS=success \
tsx scripts/test/generate-test-results.ts ./docs
```

**Data Sources**:
- Environment variables for test status
- File system for test file counts
- Coverage directories for coverage metrics
- Reasonable estimates when data unavailable

**Advantages**:
- ✅ Simple to integrate with existing workflow
- ✅ No workflow changes required
- ✅ Fast execution
- ✅ Works with current CI/CD setup

**Limitations**:
- ❌ Uses estimated metrics
- ❌ Less accurate than actual test output

### Future Enhancement (`parse-vitest-results.ts`)

**Location**: `scripts/test/parse-vitest-results.ts`

**Purpose**: Parse actual vitest JSON output for accurate metrics.

**Usage**:
```bash
# Run tests with JSON output
vitest run --config vitest.config.integration.ts \
  --reporter=json --outputFile=integration-output.json

# Parse the output
tsx scripts/test/parse-vitest-results.ts \
  integration-output.json integration ./docs
```

**Data Sources**:
- Actual vitest JSON reporter output
- Precise test counts and durations
- Real pass/fail/skip statistics
- Coverage data from coverage reports

**Advantages**:
- ✅ Accurate test metrics
- ✅ Precise timing data
- ✅ Real test counts
- ✅ Better insights

**Requirements**:
- ❌ Requires workflow modifications
- ❌ Needs vitest JSON reporter
- ❌ Additional artifacts to manage

## CI/CD Integration

### Workflow Location

**File**: `.github/workflows/ci-full.yml`

**Job**: `coverage-report`

**Step**: `Generate detailed test suite results`

### Current Implementation

```yaml
- name: Generate detailed test suite results
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  env:
    INTEGRATION_STATUS: ${{ needs.integration-tests.result }}
    E2E_STATUS: ${{ needs.e2e-tests.result }}
    CHAOS_STATUS: ${{ needs.chaos-tests.result }}
  run: |
    # Generate individual test suite JSON files for detailed metrics
    # Creates: integration-results.json, e2e-results.json, chaos-results.json
    tsx scripts/test/generate-test-results.ts ./docs

    echo "Generated detailed test suite results:"
    echo "  - integration-results.json"
    echo "  - e2e-results.json"
    echo "  - chaos-results.json"
```

### Artifact Management

The generated JSON files are:
1. Created in the `docs/` directory
2. Committed to the repository via the `Commit and push badge updates` step
3. Deployed to GitHub Pages via the `deploy-documentation` job

### GitHub Pages Deployment

Files are copied to the `_site` directory and deployed:

```yaml
# Copy JSON files (badges and report data)
for json_file in ... integration-results.json e2e-results.json chaos-results.json; do
  [ -f "docs/$json_file" ] && cp "docs/$json_file" "_site/$json_file"
done
```

## Usage in Dashboards

### Access URLs

When deployed to GitHub Pages:
- `https://<username>.github.io/<repo>/integration-results.json`
- `https://<username>.github.io/<repo>/e2e-results.json`
- `https://<username>.github.io/<repo>/chaos-results.json`

### Example: Fetch and Display

```javascript
// Fetch integration test results
fetch('integration-results.json')
  .then(res => res.json())
  .then(data => {
    console.log(`Integration Tests: ${data.metrics.passed}/${data.metrics.total}`);
    console.log(`Status: ${data.status}`);
    console.log(`Duration: ${data.metrics.duration}`);

    // Display integration health
    const db = data.metrics.integrations.database;
    console.log(`Database: ${db.status} (${db.tests} tests)`);
  });

// Fetch E2E test results
fetch('e2e-results.json')
  .then(res => res.json())
  .then(data => {
    console.log(`E2E Tests: ${data.metrics.passed}/${data.metrics.total}`);
    console.log(`Endpoint Coverage: ${data.metrics.endpoints.coverage}%`);
    console.log(`Shards: ${data.metrics.shards}`);
  });

// Fetch chaos test results
fetch('chaos-results.json')
  .then(res => res.json())
  .then(data => {
    console.log(`Chaos Tests: ${data.metrics.passed}/${data.metrics.total}`);
    console.log(`Resilience Score: ${data.metrics.resilience.score}`);
    console.log(`Recovery Time: ${data.metrics.resilience.averageRecoveryTime}`);
  });
```

### Example: Dashboard Card

```html
<div class="test-suite-card">
  <h3>Integration Tests</h3>
  <div class="status" data-status="success">✓ Success</div>
  <div class="metrics">
    <div class="metric">
      <span class="label">Tests:</span>
      <span class="value">250/250</span>
    </div>
    <div class="metric">
      <span class="label">Duration:</span>
      <span class="value">3m 45s</span>
    </div>
    <div class="metric">
      <span class="label">Coverage:</span>
      <span class="value">85.5%</span>
    </div>
  </div>
  <div class="integrations">
    <div class="integration">
      <span class="icon">🗄️</span>
      <span class="name">Database</span>
      <span class="status">Healthy</span>
      <span class="tests">100 tests</span>
    </div>
    <div class="integration">
      <span class="icon">📨</span>
      <span class="name">RabbitMQ</span>
      <span class="status">Healthy</span>
      <span class="tests">88 tests</span>
    </div>
    <div class="integration">
      <span class="icon">⚡</span>
      <span class="name">Redis</span>
      <span class="status">Healthy</span>
      <span class="tests">62 tests</span>
    </div>
  </div>
</div>
```

## Future Enhancements

### Phase 1: Current (Implemented)
- ✅ Generate JSON files with estimated data
- ✅ Integrate with CI/CD workflow
- ✅ Deploy to GitHub Pages
- ✅ Document usage and schema

### Phase 2: Enhanced Accuracy
- ⏳ Modify test jobs to output vitest JSON
- ⏳ Parse actual test metrics
- ⏳ Use precise timing data
- ⏳ Include detailed failure information

### Phase 3: Rich Dashboards
- 📋 Create interactive test dashboard
- 📋 Visualize test trends over time
- 📋 Show integration health status
- 📋 Display chaos resilience score
- 📋 Endpoint coverage heatmap

### Phase 4: Advanced Analytics
- 📋 Test performance tracking
- 📋 Flaky test detection
- 📋 Coverage trend analysis
- 📋 Resilience score history
- 📋 Integration health monitoring

## Benefits

### For Development
- **Detailed Visibility**: See exactly what's tested in each suite
- **Quick Debugging**: Identify failing integration/E2E/chaos tests
- **Coverage Insights**: Understand coverage contribution by test type
- **Integration Health**: Monitor database/queue/cache integration status

### For Operations
- **Resilience Monitoring**: Track chaos test results and recovery times
- **Endpoint Coverage**: Ensure critical APIs are tested
- **System Health**: Monitor integration test results
- **Trend Analysis**: Track metrics over time

### For Documentation
- **Transparency**: Public metrics on test suite status
- **Confidence**: Demonstrate comprehensive testing
- **Quality**: Show test coverage and resilience
- **Traceability**: Link test results to deployments

## Troubleshooting

### Files Not Generated

**Issue**: JSON files not appearing in `docs/` directory

**Solutions**:
1. Check workflow logs for script errors
2. Verify environment variables are set
3. Ensure `tsx` is available in CI environment
4. Check file permissions

### Incorrect Metrics

**Issue**: Metrics don't match actual test results

**Solutions**:
1. Current implementation uses estimates - this is expected
2. For accurate metrics, implement Phase 2 enhancements
3. Verify coverage directories exist when coverage is enabled
4. Check test file counts with `find tests/*/`

### Not Deployed to Pages

**Issue**: Files generated but not on GitHub Pages

**Solutions**:
1. Check `Commit and push badge updates` step succeeded
2. Verify `deploy-documentation` job ran
3. Check `_site` directory includes JSON files
4. Ensure GitHub Pages is enabled in repository settings

## References

- [Scripts Documentation](../scripts/test/README.md)
- [CI/CD Workflow](../.github/workflows/ci-full.yml)
- [Test Results Summary](./test-results.json)
- [Vitest Documentation](https://vitest.dev/)
