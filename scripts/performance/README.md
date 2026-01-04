# Performance Testing Scripts

This directory contains scripts for generating performance test badges and parsing k6 results.

## Scripts

### `generate-badges.sh`

Generates shields.io endpoint badge JSON files from k6 performance test results.

**Usage:**
```bash
./generate-badges.sh [results-dir] [output-dir]
```

**Arguments:**
- `results-dir`: Directory containing k6 JSON results (default: `perf-results`)
- `output-dir`: Directory to output badge JSON files (default: `docs`)

**Outputs:**
- `performance-badge.json` - Overall performance summary
- `rps-badge.json` - Requests per second metric
- `latency-badge.json` - p95 latency metric
- `throughput-badge.json` - Throughput metric (msgs/day)
- `error-rate-badge.json` - Error rate metric
- `performance-metrics.json` - Combined metrics JSON for dashboards

**k6 Metrics Parsed:**
- `metrics.http_reqs.rate` - Requests per second (RPS)
- `metrics.http_req_duration["p(95)"]` - 95th percentile latency
- `metrics.http_req_duration["p(99)"]` - 99th percentile latency
- `metrics.http_req_failed.rate` - Error rate (0-1)
- `metrics.http_reqs.count` - Total requests

**Example:**
```bash
# Parse results from perf-results and output to docs
./generate-badges.sh perf-results docs

# Use default directories
./generate-badges.sh
```

### `parse-results.sh`

Parses k6 JSON output and generates `performance-results.json` for dashboard consumption.

**Usage:**
```bash
./parse-results.sh [results-dir] [output-dir]
```

**Arguments:**
- `results-dir`: Directory containing k6 JSON results (default: `perf-results`)
- `output-dir`: Directory to output `performance-results.json` (default: `docs`)

**Output Format:**

The script generates a `performance-results.json` file with the following structure:

```json
{
  "timestamp": "2026-01-05T12:00:00Z",
  "summary": {
    "max_rps": 450.5,
    "avg_latency_p95": 125,
    "avg_latency_p99": 250,
    "max_error_rate": 0.01,
    "throughput_per_day": 38923200
  },
  "smoke_test": {
    "test": "smoke-test",
    "rps": 450.5,
    "latency_p50": 45,
    "latency_p95": 125,
    "latency_p99": 250,
    "latency_avg": 52,
    "error_rate": 0.01,
    "throughput": 38923200,
    "total_requests": 8456,
    "duration": "3m",
    "vus": 10
  },
  "load_test": {
    "test": "api-load",
    "rps": 1200,
    "latency_p50": 85,
    "latency_p95": 200,
    "latency_p99": 400,
    "latency_avg": 95,
    "error_rate": 0.05,
    "throughput": 103680000,
    "total_requests": 36000,
    "duration": "30m",
    "vus": 50
  },
  "all_tests": [...]
}
```

**k6 Summary JSON Format:**

The script expects k6 to output JSON in the summary format (using `handleSummary()` in k6 tests):

```javascript
export function handleSummary(data) {
  return {
    'perf-results/smoke-test-summary.json': JSON.stringify(data, null, 2),
  };
}
```

The k6 summary data structure contains:
```json
{
  "metrics": {
    "http_reqs": {
      "values": {
        "count": 8456,
        "rate": 450.5
      }
    },
    "http_req_duration": {
      "values": {
        "avg": 52.3,
        "p(50)": 45.0,
        "p(95)": 125.0,
        "p(99)": 250.0
      }
    },
    "http_req_failed": {
      "values": {
        "rate": 0.0001
      }
    },
    "vus": {
      "values": {
        "max": 10
      }
    }
  },
  "state": {
    "testRunDurationMs": 180000
  }
}
```

**Metrics Extracted:**
- **RPS** (Requests Per Second): `metrics.http_reqs.values.rate`
- **Latency Percentiles**: `metrics.http_req_duration.values["p(50|95|99)"]`
- **Error Rate**: `metrics.http_req_failed.values.rate` (converted to percentage)
- **Throughput**: Calculated as `RPS * 86400` (messages per day)
- **Duration**: `state.testRunDurationMs` (converted to human-readable format)
- **VUs**: `metrics.vus.values.max` (virtual users)

**Example:**
```bash
# Parse k6 results from perf-results directory
./parse-results.sh perf-results docs

# Use default directories
./parse-results.sh
```

### `track-baseline.sh`

Tracks performance baselines and compares current results against historical trends.

## CI/CD Integration

Both scripts are integrated into the GitHub Actions workflow (`.github/workflows/ci-full.yml`):

1. **Performance Tests** (jobs: `performance-smoke-test`, `performance-load-tests`):
   - Run k6 tests with `--out json=perf-results/*.json`
   - Upload results as artifacts

2. **Coverage Report Job** (job: `coverage-report`):
   - Downloads performance test artifacts
   - Runs `parse-results.sh` to generate `performance-results.json`
   - Runs `generate-badges.sh` to generate badge JSON files
   - Commits results to the repository

3. **Deploy Documentation Job** (job: `deploy-documentation`):
   - Copies `performance-results.json` to GitHub Pages
   - Makes data available for dashboard consumption

## Dashboard Consumption

The `performance-results.json` file is consumed by:

- **reports-summary.html**: Performance card showing key metrics
- **test-reports.html**: Detailed performance test results
- **dashboards-index.html**: Performance dashboards overview

JavaScript code to load the data:

```javascript
fetch('./performance-results.json')
  .then(r => r.ok ? r.json() : null)
  .then(data => {
    if (data && data.summary) {
      document.getElementById('rps-value').textContent = data.summary.max_rps;
      document.getElementById('latency-p95').textContent = data.summary.avg_latency_p95 + 'ms';
      document.getElementById('error-rate').textContent = data.summary.max_error_rate + '%';
    }
  });
```

## Color Thresholds

### RPS (Requests Per Second)
- **brightgreen**: >= 100 req/sec
- **green**: >= 50 req/sec
- **yellow**: >= 25 req/sec
- **orange**: < 25 req/sec

### Latency (p95)
- **brightgreen**: < 200ms
- **green**: < 500ms
- **yellow**: < 1000ms
- **orange**: >= 1000ms

### Error Rate
- **brightgreen**: < 0.1%
- **green**: < 1%
- **yellow**: < 5%
- **red**: >= 5%

### Throughput
- **brightgreen**: >= 1M msgs/day
- **green**: >= 500K msgs/day
- **yellow**: >= 100K msgs/day
- **orange**: < 100K msgs/day

## Local Testing

To test the parser locally:

```bash
# 1. Run k6 tests locally (requires k6 installation)
k6 run tests/performance/api-smoke.test.js

# 2. Parse the results
./scripts/performance/parse-results.sh perf-results docs

# 3. View the output
cat docs/performance-results.json | jq '.'

# 4. Generate badges
./scripts/performance/generate-badges.sh perf-results docs

# 5. View generated badges
ls -la docs/*badge.json docs/performance-metrics.json
```

## Troubleshooting

### Script not executable
```bash
chmod +x scripts/performance/parse-results.sh
chmod +x scripts/performance/generate-badges.sh
```

### Missing jq
```bash
# macOS
brew install jq bc

# Ubuntu/Debian
sudo apt-get install jq bc
```

### Invalid JSON output
The script validates the generated JSON using `jq empty`. If validation fails, check:
- k6 summary files are valid JSON
- File paths are correct
- All required metrics exist in k6 output

### No results found
Ensure:
- k6 tests completed successfully
- `handleSummary()` in k6 tests writes to the correct directory
- Artifacts are uploaded in CI (check GitHub Actions logs)

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Metrics](https://k6.io/docs/using-k6/metrics/)
- [k6 handleSummary()](https://k6.io/docs/results-output/end-of-test/custom-summary/)
- [Shields.io Endpoint Badges](https://shields.io/badges/endpoint-badge)
