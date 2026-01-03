#!/bin/bash
# Coverage Trend Analysis Script
# Analyzes coverage trends and alerts on regressions
#
# Usage: ./analyze-trends.sh [coverage-history.json] [threshold]
#   coverage-history.json: Coverage history file (default: docs/coverage-history.json)
#   threshold: Regression threshold percentage (default: 1.0 = alert if drops >1%)
#
# Exit codes:
#   0 - No regression detected (or insufficient data)
#   1 - Coverage regression detected

set -e

HISTORY_FILE="${1:-docs/coverage-history.json}"
THRESHOLD="${2:-1.0}"

# Check if history file exists
if [ ! -f "$HISTORY_FILE" ]; then
  echo "⚠️  No coverage history found: $HISTORY_FILE"
  echo "Skipping trend analysis (insufficient data)"
  exit 0
fi

# Check if we have at least 2 entries for comparison
ENTRY_COUNT=$(jq '.history | length' "$HISTORY_FILE")

if [ "$ENTRY_COUNT" -lt 2 ]; then
  echo "⚠️  Insufficient coverage history: $ENTRY_COUNT entries"
  echo "Need at least 2 entries for trend analysis"
  exit 0
fi

# Get last 2 entries
CURRENT=$(jq -r '.history[-1].lines' "$HISTORY_FILE")
PREVIOUS=$(jq -r '.history[-2].lines' "$HISTORY_FILE")
CURRENT_COMMIT=$(jq -r '.history[-1].commit' "$HISTORY_FILE")
PREVIOUS_COMMIT=$(jq -r '.history[-2].commit' "$HISTORY_FILE")
CURRENT_TIMESTAMP=$(jq -r '.history[-1].timestamp' "$HISTORY_FILE")

# Calculate difference
DIFF=$(echo "$CURRENT - $PREVIOUS" | bc)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Coverage Trend Analysis"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Current Coverage:  ${CURRENT}% (commit: $CURRENT_COMMIT)"
echo "Previous Coverage: ${PREVIOUS}% (commit: $PREVIOUS_COMMIT)"
echo "Change:            ${DIFF}%"
echo "Threshold:         -${THRESHOLD}%"
echo "Timestamp:         $CURRENT_TIMESTAMP"
echo ""

# Check for regression
if (( $(echo "$DIFF < -$THRESHOLD" | bc -l) )); then
  echo "❌ COVERAGE REGRESSION DETECTED!"
  echo ""
  echo "Coverage dropped by ${DIFF}% (threshold: -${THRESHOLD}%)"
  echo ""
  echo "Previous: ${PREVIOUS}%"
  echo "Current:  ${CURRENT}%"
  echo ""
  echo "This indicates that recent changes may have reduced test coverage."
  echo "Please add tests to maintain coverage levels."
  echo ""

  # Show additional metrics if available
  CURRENT_STATEMENTS=$(jq -r '.history[-1].statements' "$HISTORY_FILE")
  PREVIOUS_STATEMENTS=$(jq -r '.history[-2].statements' "$HISTORY_FILE")
  CURRENT_BRANCHES=$(jq -r '.history[-1].branches' "$HISTORY_FILE")
  PREVIOUS_BRANCHES=$(jq -r '.history[-2].branches' "$HISTORY_FILE")
  CURRENT_FUNCTIONS=$(jq -r '.history[-1].functions' "$HISTORY_FILE")
  PREVIOUS_FUNCTIONS=$(jq -r '.history[-2].functions' "$HISTORY_FILE")

  echo "Detailed Metrics:"
  echo "  Statements: ${PREVIOUS_STATEMENTS}% → ${CURRENT_STATEMENTS}%"
  echo "  Branches:   ${PREVIOUS_BRANCHES}% → ${CURRENT_BRANCHES}%"
  echo "  Functions:  ${PREVIOUS_FUNCTIONS}% → ${CURRENT_FUNCTIONS}%"
  echo ""

  exit 1
elif (( $(echo "$DIFF > 0" | bc -l) )); then
  echo "✅ Coverage IMPROVED by ${DIFF}%"
  echo ""
  echo "Previous: ${PREVIOUS}%"
  echo "Current:  ${CURRENT}%"
  echo ""
  exit 0
else
  echo "➖ Coverage unchanged or minor decrease within threshold"
  echo ""
  echo "Previous: ${PREVIOUS}%"
  echo "Current:  ${CURRENT}%"
  echo "Change:   ${DIFF}% (threshold: -${THRESHOLD}%)"
  echo ""
  exit 0
fi
