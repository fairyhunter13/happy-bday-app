#!/bin/bash
# Coverage Threshold Checker
# Checks coverage-summary.json against thresholds
# Usage: ./check-thresholds.sh <coverage-summary.json>

set -e

SUMMARY_FILE="${1:-coverage/coverage-summary.json}"

if [ ! -f "$SUMMARY_FILE" ]; then
  echo "Error: Coverage summary file not found: $SUMMARY_FILE"
  exit 1
fi

# Thresholds (must match vitest.config.base.ts)
# Updated for Phase 9 requirements
LINE_THRESHOLD=80
FUNCTION_THRESHOLD=80
BRANCH_THRESHOLD=80
STATEMENT_THRESHOLD=85

# Extract coverage percentages using jq
LINES=$(jq -r '.total.lines.pct // 0' "$SUMMARY_FILE")
FUNCTIONS=$(jq -r '.total.functions.pct // 0' "$SUMMARY_FILE")
BRANCHES=$(jq -r '.total.branches.pct // 0' "$SUMMARY_FILE")
STATEMENTS=$(jq -r '.total.statements.pct // 0' "$SUMMARY_FILE")

echo "Coverage Results:"
echo "  Lines:      ${LINES}% (threshold: ${LINE_THRESHOLD}%)"
echo "  Functions:  ${FUNCTIONS}% (threshold: ${FUNCTION_THRESHOLD}%)"
echo "  Branches:   ${BRANCHES}% (threshold: ${BRANCH_THRESHOLD}%)"
echo "  Statements: ${STATEMENTS}% (threshold: ${STATEMENT_THRESHOLD}%)"
echo ""

FAILED=0

# Check each threshold (using bc for floating point comparison)
check_threshold() {
  local name="$1"
  local value="$2"
  local threshold="$3"

  if [ "$(echo "$value < $threshold" | bc -l)" -eq 1 ]; then
    echo "FAIL: $name coverage ${value}% is below threshold ${threshold}%"
    return 1
  else
    echo "PASS: $name coverage ${value}% meets threshold ${threshold}%"
    return 0
  fi
}

echo "Threshold Check:"
check_threshold "Lines" "$LINES" "$LINE_THRESHOLD" || FAILED=1
check_threshold "Functions" "$FUNCTIONS" "$FUNCTION_THRESHOLD" || FAILED=1
check_threshold "Branches" "$BRANCHES" "$BRANCH_THRESHOLD" || FAILED=1
check_threshold "Statements" "$STATEMENTS" "$STATEMENT_THRESHOLD" || FAILED=1

echo ""
if [ $FAILED -eq 1 ]; then
  echo "Coverage thresholds NOT met!"
  exit 1
else
  echo "All coverage thresholds met!"
  exit 0
fi
