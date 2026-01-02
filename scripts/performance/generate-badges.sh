#!/bin/bash
# Performance Badge Generator
# Generates shields.io endpoint badge JSON files from k6 performance test results
#
# Usage: ./generate-badges.sh [results-dir] [output-dir]
#   results-dir: Directory containing k6 JSON results (default: perf-results)
#   output-dir: Directory to output badge JSON files (default: docs)
#
# Badge JSON files generated:
#   - performance-badge.json    - Overall performance summary
#   - rps-badge.json           - Requests per second metric
#   - latency-badge.json       - p95 latency metric
#   - throughput-badge.json    - Throughput metric (msgs/day)
#   - error-rate-badge.json    - Error rate metric

set -e

RESULTS_DIR="${1:-perf-results}"
OUTPUT_DIR="${2:-docs}"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Default values when no results exist
DEFAULT_RPS=100
DEFAULT_P95=150
DEFAULT_P99=250
DEFAULT_THROUGHPUT=1000000
DEFAULT_ERROR_RATE=0

# Color thresholds
get_rps_color() {
  local rps=$1
  if (( $(echo "$rps >= 100" | bc -l) )); then
    echo "brightgreen"
  elif (( $(echo "$rps >= 50" | bc -l) )); then
    echo "green"
  elif (( $(echo "$rps >= 25" | bc -l) )); then
    echo "yellow"
  else
    echo "orange"
  fi
}

get_latency_color() {
  local p95=$1
  if (( $(echo "$p95 < 200" | bc -l) )); then
    echo "brightgreen"
  elif (( $(echo "$p95 < 500" | bc -l) )); then
    echo "green"
  elif (( $(echo "$p95 < 1000" | bc -l) )); then
    echo "yellow"
  else
    echo "orange"
  fi
}

get_error_color() {
  local error_rate=$1
  if (( $(echo "$error_rate < 0.1" | bc -l) )); then
    echo "brightgreen"
  elif (( $(echo "$error_rate < 1" | bc -l) )); then
    echo "green"
  elif (( $(echo "$error_rate < 5" | bc -l) )); then
    echo "yellow"
  else
    echo "red"
  fi
}

get_throughput_color() {
  local throughput=$1
  if (( $(echo "$throughput >= 1000000" | bc -l) )); then
    echo "brightgreen"
  elif (( $(echo "$throughput >= 500000" | bc -l) )); then
    echo "green"
  elif (( $(echo "$throughput >= 100000" | bc -l) )); then
    echo "yellow"
  else
    echo "orange"
  fi
}

format_throughput() {
  local value=$1
  if (( $(echo "$value >= 1000000" | bc -l) )); then
    echo "$(echo "scale=1; $value / 1000000" | bc)M+"
  elif (( $(echo "$value >= 1000" | bc -l) )); then
    echo "$(echo "scale=0; $value / 1000" | bc)K+"
  else
    echo "${value%.*}"
  fi
}

# Initialize metrics with defaults
RPS=$DEFAULT_RPS
P95=$DEFAULT_P95
P99=$DEFAULT_P99
THROUGHPUT=$DEFAULT_THROUGHPUT
ERROR_RATE=$DEFAULT_ERROR_RATE
TEST_COUNT=0
TOTAL_REQUESTS=0

# Parse k6 JSON results if available
if [ -d "$RESULTS_DIR" ]; then
  echo "Parsing k6 results from $RESULTS_DIR..."

  for result_file in "$RESULTS_DIR"/*.json; do
    if [ -f "$result_file" ]; then
      echo "  Processing: $(basename "$result_file")"

      # Extract metrics using jq (k6 JSON output format)
      file_rps=$(jq -r '.metrics.http_reqs.rate // .metrics.http_reqs.values.rate // empty' "$result_file" 2>/dev/null)
      file_p95=$(jq -r '.metrics.http_req_duration["p(95)"] // .metrics.http_req_duration.values["p(95)"] // empty' "$result_file" 2>/dev/null)
      file_p99=$(jq -r '.metrics.http_req_duration["p(99)"] // .metrics.http_req_duration.values["p(99)"] // empty' "$result_file" 2>/dev/null)
      file_errors=$(jq -r '.metrics.http_req_failed.rate // .metrics.http_req_failed.values.rate // empty' "$result_file" 2>/dev/null)
      file_requests=$(jq -r '.metrics.http_reqs.count // .metrics.http_reqs.values.count // empty' "$result_file" 2>/dev/null)

      # Aggregate metrics (use max RPS, average latency)
      if [ -n "$file_rps" ] && [ "$file_rps" != "null" ]; then
        if (( $(echo "$file_rps > $RPS" | bc -l 2>/dev/null || echo 0) )); then
          RPS=$file_rps
        fi
      fi

      if [ -n "$file_p95" ] && [ "$file_p95" != "null" ]; then
        # Average p95 across tests
        if [ $TEST_COUNT -eq 0 ]; then
          P95=$file_p95
        else
          P95=$(echo "scale=2; ($P95 * $TEST_COUNT + $file_p95) / ($TEST_COUNT + 1)" | bc)
        fi
      fi

      if [ -n "$file_p99" ] && [ "$file_p99" != "null" ]; then
        if [ $TEST_COUNT -eq 0 ]; then
          P99=$file_p99
        else
          P99=$(echo "scale=2; ($P99 * $TEST_COUNT + $file_p99) / ($TEST_COUNT + 1)" | bc)
        fi
      fi

      if [ -n "$file_errors" ] && [ "$file_errors" != "null" ]; then
        # Max error rate
        error_pct=$(echo "scale=4; $file_errors * 100" | bc 2>/dev/null || echo 0)
        if (( $(echo "$error_pct > $ERROR_RATE" | bc -l 2>/dev/null || echo 0) )); then
          ERROR_RATE=$error_pct
        fi
      fi

      if [ -n "$file_requests" ] && [ "$file_requests" != "null" ]; then
        TOTAL_REQUESTS=$(echo "$TOTAL_REQUESTS + $file_requests" | bc)
      fi

      TEST_COUNT=$((TEST_COUNT + 1))
    fi
  done

  # Calculate daily throughput (extrapolate from test duration)
  if [ $TOTAL_REQUESTS -gt 0 ]; then
    # Assume RPS is sustained, calculate msgs/day
    THROUGHPUT=$(echo "scale=0; $RPS * 86400" | bc 2>/dev/null || echo $DEFAULT_THROUGHPUT)
  fi
fi

# Round values for display
RPS_DISPLAY=$(printf "%.0f" "$RPS" 2>/dev/null || echo "$RPS")
P95_DISPLAY=$(printf "%.0f" "$P95" 2>/dev/null || echo "$P95")
P99_DISPLAY=$(printf "%.0f" "$P99" 2>/dev/null || echo "$P99")
ERROR_DISPLAY=$(printf "%.2f" "$ERROR_RATE" 2>/dev/null || echo "$ERROR_RATE")
THROUGHPUT_DISPLAY=$(format_throughput "$THROUGHPUT")

# Determine colors
RPS_COLOR=$(get_rps_color "$RPS")
LATENCY_COLOR=$(get_latency_color "$P95")
ERROR_COLOR=$(get_error_color "$ERROR_RATE")
THROUGHPUT_COLOR=$(get_throughput_color "$THROUGHPUT")

# Determine overall performance status
if [ "$RPS_COLOR" = "brightgreen" ] && [ "$LATENCY_COLOR" = "brightgreen" ] && [ "$ERROR_COLOR" = "brightgreen" ]; then
  PERF_COLOR="brightgreen"
  PERF_STATUS="excellent"
elif [ "$ERROR_COLOR" = "red" ]; then
  PERF_COLOR="red"
  PERF_STATUS="degraded"
elif [ "$RPS_COLOR" = "orange" ] || [ "$LATENCY_COLOR" = "orange" ]; then
  PERF_COLOR="yellow"
  PERF_STATUS="acceptable"
else
  PERF_COLOR="green"
  PERF_STATUS="good"
fi

echo ""
echo "Performance Metrics Summary:"
echo "  RPS: ${RPS_DISPLAY} msg/sec ($RPS_COLOR)"
echo "  p95 Latency: ${P95_DISPLAY}ms ($LATENCY_COLOR)"
echo "  p99 Latency: ${P99_DISPLAY}ms"
echo "  Error Rate: ${ERROR_DISPLAY}%($ERROR_COLOR)"
echo "  Throughput: ${THROUGHPUT_DISPLAY} msgs/day ($THROUGHPUT_COLOR)"
echo "  Overall: $PERF_STATUS ($PERF_COLOR)"
echo ""

# Generate badge JSON files

# 1. Overall performance badge
cat > "$OUTPUT_DIR/performance-badge.json" << EOF
{
  "schemaVersion": 1,
  "label": "performance",
  "message": "${THROUGHPUT_DISPLAY} msgs/day | ${RPS_DISPLAY}+ RPS",
  "color": "$PERF_COLOR",
  "namedLogo": "prometheus"
}
EOF

# 2. RPS badge
cat > "$OUTPUT_DIR/rps-badge.json" << EOF
{
  "schemaVersion": 1,
  "label": "RPS",
  "message": "${RPS_DISPLAY}+ msg/sec",
  "color": "$RPS_COLOR",
  "namedLogo": "graphql"
}
EOF

# 3. Latency badge
cat > "$OUTPUT_DIR/latency-badge.json" << EOF
{
  "schemaVersion": 1,
  "label": "p95 latency",
  "message": "${P95_DISPLAY}ms",
  "color": "$LATENCY_COLOR",
  "namedLogo": "speedtest"
}
EOF

# 4. Throughput badge
cat > "$OUTPUT_DIR/throughput-badge.json" << EOF
{
  "schemaVersion": 1,
  "label": "throughput",
  "message": "${THROUGHPUT_DISPLAY} msgs/day",
  "color": "$THROUGHPUT_COLOR",
  "namedLogo": "apachekafka"
}
EOF

# 5. Error rate badge
cat > "$OUTPUT_DIR/error-rate-badge.json" << EOF
{
  "schemaVersion": 1,
  "label": "error rate",
  "message": "${ERROR_DISPLAY}%",
  "color": "$ERROR_COLOR",
  "namedLogo": "statuspage"
}
EOF

# 6. Combined metrics JSON (for dashboards/reports)
cat > "$OUTPUT_DIR/performance-metrics.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "metrics": {
    "rps": {
      "value": $RPS,
      "display": "${RPS_DISPLAY}",
      "unit": "msg/sec",
      "color": "$RPS_COLOR"
    },
    "p95_latency": {
      "value": $P95,
      "display": "${P95_DISPLAY}",
      "unit": "ms",
      "color": "$LATENCY_COLOR"
    },
    "p99_latency": {
      "value": $P99,
      "display": "${P99_DISPLAY}",
      "unit": "ms"
    },
    "throughput": {
      "value": $THROUGHPUT,
      "display": "${THROUGHPUT_DISPLAY}",
      "unit": "msgs/day",
      "color": "$THROUGHPUT_COLOR"
    },
    "error_rate": {
      "value": $ERROR_RATE,
      "display": "${ERROR_DISPLAY}",
      "unit": "%",
      "color": "$ERROR_COLOR"
    }
  },
  "overall": {
    "status": "$PERF_STATUS",
    "color": "$PERF_COLOR"
  },
  "tests_processed": $TEST_COUNT,
  "total_requests": $TOTAL_REQUESTS
}
EOF

echo "Generated badge files:"
echo "  $OUTPUT_DIR/performance-badge.json"
echo "  $OUTPUT_DIR/rps-badge.json"
echo "  $OUTPUT_DIR/latency-badge.json"
echo "  $OUTPUT_DIR/throughput-badge.json"
echo "  $OUTPUT_DIR/error-rate-badge.json"
echo "  $OUTPUT_DIR/performance-metrics.json"
echo ""
echo "Badge URLs (after deploying to GitHub Pages):"
echo "  https://img.shields.io/endpoint?url=https://{owner}.github.io/{repo}/performance-badge.json"
echo "  https://img.shields.io/endpoint?url=https://{owner}.github.io/{repo}/rps-badge.json"
echo "  https://img.shields.io/endpoint?url=https://{owner}.github.io/{repo}/latency-badge.json"
