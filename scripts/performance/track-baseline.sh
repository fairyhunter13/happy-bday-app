#!/bin/bash
# Performance Baseline Tracker
# Tracks performance baselines and detects regressions
#
# Usage: ./track-baseline.sh [results-dir] [baseline-file] [threshold]
#   results-dir: Directory containing k6 test results (default: perf-results)
#   baseline-file: Baseline metrics file (default: docs/performance-baseline.json)
#   threshold: Degradation threshold percentage (default: 10 = alert if RPS drops >10%)
#
# Exit codes:
#   0 - No regression detected (or baseline created)
#   1 - Performance regression detected

set -e

RESULTS_DIR="${1:-perf-results}"
BASELINE_FILE="${2:-docs/performance-baseline.json}"
THRESHOLD="${3:-10}"

# Check if results directory exists
if [ ! -d "$RESULTS_DIR" ]; then
  echo "⚠️  Results directory not found: $RESULTS_DIR"
  echo "Skipping baseline tracking"
  exit 0
fi

# Find the sustained load results file (primary performance indicator)
SUSTAINED_RESULTS="$RESULTS_DIR/sustained-load-summary.json"
PEAK_RESULTS="$RESULTS_DIR/peak-load-summary.json"

# Use sustained load if available, otherwise peak load
if [ -f "$SUSTAINED_RESULTS" ]; then
  RESULTS_FILE="$SUSTAINED_RESULTS"
  TEST_TYPE="sustained"
elif [ -f "$PEAK_RESULTS" ]; then
  RESULTS_FILE="$PEAK_RESULTS"
  TEST_TYPE="peak"
else
  echo "⚠️  No performance test results found"
  echo "Looking for:"
  echo "  - $SUSTAINED_RESULTS"
  echo "  - $PEAK_RESULTS"
  exit 0
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 Performance Baseline Tracking"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Using results: $RESULTS_FILE ($TEST_TYPE load)"
echo ""

# Extract current metrics
CURRENT_RPS=$(jq -r '.metrics.http_reqs.rate // 0' "$RESULTS_FILE")
CURRENT_P95=$(jq -r '.metrics.http_req_duration["p(95)"] // .metrics.http_req_duration.values["p(95)"] // 0' "$RESULTS_FILE")
CURRENT_P99=$(jq -r '.metrics.http_req_duration["p(99)"] // .metrics.http_req_duration.values["p(99)"] // 0' "$RESULTS_FILE")
CURRENT_ERROR_RATE=$(jq -r '.metrics.http_req_failed.rate // 0' "$RESULTS_FILE")
CURRENT_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "Current Performance:"
echo "  RPS:        ${CURRENT_RPS}"
echo "  p95 Latency: ${CURRENT_P95}ms"
echo "  p99 Latency: ${CURRENT_P99}ms"
echo "  Error Rate:  ${CURRENT_ERROR_RATE}"
echo "  Commit:      $CURRENT_COMMIT"
echo ""

# Check if baseline exists
if [ ! -f "$BASELINE_FILE" ]; then
  echo "📝 No baseline found. Creating initial baseline..."
  echo ""

  # Create baseline directory if it doesn't exist
  mkdir -p "$(dirname "$BASELINE_FILE")"

  # Create baseline
  jq -n \
    --arg timestamp "$CURRENT_TIMESTAMP" \
    --arg commit "$CURRENT_COMMIT" \
    --arg test_type "$TEST_TYPE" \
    --argjson rps "$CURRENT_RPS" \
    --argjson p95 "$CURRENT_P95" \
    --argjson p99 "$CURRENT_P99" \
    --argjson error_rate "$CURRENT_ERROR_RATE" \
    '{
      baseline: {
        timestamp: $timestamp,
        commit: $commit,
        test_type: $test_type,
        rps: $rps,
        p95_latency: $p95,
        p99_latency: $p99,
        error_rate: $error_rate
      },
      history: []
    }' > "$BASELINE_FILE"

  echo "✅ Baseline created: $BASELINE_FILE"
  echo ""
  echo "Future runs will compare against this baseline."
  exit 0
fi

# Load baseline
BASELINE_RPS=$(jq -r '.baseline.rps // 0' "$BASELINE_FILE")
BASELINE_P95=$(jq -r '.baseline.p95_latency // 0' "$BASELINE_FILE")
BASELINE_P99=$(jq -r '.baseline.p99_latency // 0' "$BASELINE_FILE")
BASELINE_COMMIT=$(jq -r '.baseline.commit // "unknown"' "$BASELINE_FILE")
BASELINE_TIMESTAMP=$(jq -r '.baseline.timestamp // "unknown"' "$BASELINE_FILE")

echo "Baseline Performance (commit: $BASELINE_COMMIT):"
echo "  RPS:         ${BASELINE_RPS}"
echo "  p95 Latency: ${BASELINE_P95}ms"
echo "  p99 Latency: ${BASELINE_P99}ms"
echo "  Created:     $BASELINE_TIMESTAMP"
echo ""

# Calculate threshold values
RPS_THRESHOLD=$(echo "$BASELINE_RPS * (1 - $THRESHOLD / 100)" | bc)
P95_THRESHOLD=$(echo "$BASELINE_P95 * (1 + $THRESHOLD / 100)" | bc)
P99_THRESHOLD=$(echo "$BASELINE_P99 * (1 + $THRESHOLD / 100)" | bc)

echo "Thresholds (${THRESHOLD}% degradation tolerance):"
echo "  RPS:         ≥ ${RPS_THRESHOLD} (baseline: $BASELINE_RPS)"
echo "  p95 Latency: ≤ ${P95_THRESHOLD}ms (baseline: $BASELINE_P95)"
echo "  p99 Latency: ≤ ${P99_THRESHOLD}ms (baseline: $BASELINE_P99)"
echo ""

# Check for regressions
REGRESSION_DETECTED=0

if (( $(echo "$CURRENT_RPS < $RPS_THRESHOLD" | bc -l) )); then
  RPS_CHANGE=$(echo "scale=2; (($CURRENT_RPS - $BASELINE_RPS) / $BASELINE_RPS) * 100" | bc)
  echo "❌ RPS REGRESSION DETECTED!"
  echo "   Current: ${CURRENT_RPS} RPS"
  echo "   Baseline: ${BASELINE_RPS} RPS"
  echo "   Change: ${RPS_CHANGE}%"
  echo ""
  REGRESSION_DETECTED=1
fi

if (( $(echo "$CURRENT_P95 > $P95_THRESHOLD" | bc -l) )); then
  P95_CHANGE=$(echo "scale=2; (($CURRENT_P95 - $BASELINE_P95) / $BASELINE_P95) * 100" | bc)
  echo "❌ P95 LATENCY REGRESSION DETECTED!"
  echo "   Current: ${CURRENT_P95}ms"
  echo "   Baseline: ${BASELINE_P95}ms"
  echo "   Change: +${P95_CHANGE}%"
  echo ""
  REGRESSION_DETECTED=1
fi

if (( $(echo "$CURRENT_P99 > $P99_THRESHOLD" | bc -l) )); then
  P99_CHANGE=$(echo "scale=2; (($CURRENT_P99 - $BASELINE_P99) / $BASELINE_P99) * 100" | bc)
  echo "❌ P99 LATENCY REGRESSION DETECTED!"
  echo "   Current: ${CURRENT_P99}ms"
  echo "   Baseline: ${BASELINE_P99}ms"
  echo "   Change: +${P99_CHANGE}%"
  echo ""
  REGRESSION_DETECTED=1
fi

# Add current run to history (keep last 30 entries)
jq --arg timestamp "$CURRENT_TIMESTAMP" \
   --arg commit "$CURRENT_COMMIT" \
   --argjson rps "$CURRENT_RPS" \
   --argjson p95 "$CURRENT_P95" \
   --argjson p99 "$CURRENT_P99" \
   --argjson error_rate "$CURRENT_ERROR_RATE" \
   '.history += [{
     timestamp: $timestamp,
     commit: $commit,
     rps: $rps,
     p95_latency: $p95,
     p99_latency: $p99,
     error_rate: $error_rate
   }] | .history |= .[-30:]' \
   "$BASELINE_FILE" > "${BASELINE_FILE}.tmp"

mv "${BASELINE_FILE}.tmp" "$BASELINE_FILE"

if [ $REGRESSION_DETECTED -eq 1 ]; then
  echo "Performance has degraded beyond the ${THRESHOLD}% threshold."
  echo ""
  echo "Consider:"
  echo "  - Reviewing recent changes for performance impacts"
  echo "  - Running profiler to identify bottlenecks"
  echo "  - Updating baseline if this is expected (delete $BASELINE_FILE)"
  echo ""
  exit 1
else
  RPS_CHANGE=$(echo "scale=2; (($CURRENT_RPS - $BASELINE_RPS) / $BASELINE_RPS) * 100" | bc)
  P95_CHANGE=$(echo "scale=2; (($CURRENT_P95 - $BASELINE_P95) / $BASELINE_P95) * 100" | bc)

  echo "✅ Performance within acceptable range"
  echo ""
  echo "Performance vs Baseline:"
  echo "  RPS:         ${RPS_CHANGE:+"+"}${RPS_CHANGE}%"
  echo "  p95 Latency: ${P95_CHANGE:+"+"}${P95_CHANGE}%"
  echo ""
  exit 0
fi
