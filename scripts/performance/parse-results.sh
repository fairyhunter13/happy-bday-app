#!/bin/bash
# Parse k6 performance test results and generate performance-results.json

PERF_DIR="${1:-.}"
OUTPUT_DIR="${2:-./docs}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Initialize result arrays
declare -a tests=()
max_rps=0
total_p95=0
total_p99=0
max_error_rate=0
test_count=0

# Process each JSON file
for json_file in "$PERF_DIR"/*.json; do
  [ -f "$json_file" ] || continue
  
  # Extract metrics using jq
  test_name=$(basename "$json_file" .json)
  rps=$(jq -r '.metrics.http_reqs.values.rate // 0' "$json_file" 2>/dev/null || echo "0")
  p50=$(jq -r '.metrics.http_req_duration.values.p50 // 0' "$json_file" 2>/dev/null || echo "0")
  p95=$(jq -r '.metrics.http_req_duration.values.p95 // 0' "$json_file" 2>/dev/null || echo "0")
  p99=$(jq -r '.metrics.http_req_duration.values.p99 // 0' "$json_file" 2>/dev/null || echo "0")
  avg=$(jq -r '.metrics.http_req_duration.values.avg // 0' "$json_file" 2>/dev/null || echo "0")
  error_rate=$(jq -r '.metrics.http_req_failed.values.rate // 0' "$json_file" 2>/dev/null || echo "0")
  
  # Update maximums
  [ $(echo "$rps > $max_rps" | bc -l 2>/dev/null || echo "0") -eq 1 ] && max_rps=$rps
  [ $(echo "$error_rate > $max_error_rate" | bc -l 2>/dev/null || echo "0") -eq 1 ] && max_error_rate=$error_rate
  
  # Sum for averages
  total_p95=$(echo "$total_p95 + $p95" | bc -l 2>/dev/null || echo "0")
  total_p99=$(echo "$total_p99 + $p99" | bc -l 2>/dev/null || echo "0")
  test_count=$((test_count + 1))
  
  # Add to tests array
  tests+=("{\"test\":\"$test_name\",\"rps\":$rps,\"latency_p50\":$p50,\"latency_p95\":$p95,\"latency_p99\":$p99,\"error_rate\":$error_rate}")
done

# Calculate averages
if [ $test_count -gt 0 ]; then
  avg_p95=$(echo "scale=2; $total_p95 / $test_count" | bc -l 2>/dev/null || echo "0")
  avg_p99=$(echo "scale=2; $total_p99 / $test_count" | bc -l 2>/dev/null || echo "0")
else
  avg_p95=0
  avg_p99=0
fi

throughput=$(echo "scale=0; $max_rps * 86400" | bc -l 2>/dev/null || echo "0")

# Generate JSON
cat > "$OUTPUT_DIR/performance-results.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "max_rps": $max_rps,
    "avg_latency_p95": $avg_p95,
    "avg_latency_p99": $avg_p99,
    "max_error_rate": $max_error_rate,
    "throughput_per_day": $throughput
  },
  "smoke_test": {
    "rps": 0,
    "latency_p95": 0,
    "latency_p99": 0,
    "error_rate": 0
  },
  "load_test": {
    "rps": 0,
    "latency_p95": 0,
    "latency_p99": 0,
    "error_rate": 0
  },
  "all_tests": [$(IFS=,; echo "${tests[*]}")]
}
EOF

echo "Generated performance-results.json with $test_count tests"
