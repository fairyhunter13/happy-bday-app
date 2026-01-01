#!/bin/bash
# Coverage History Updater
# Updates coverage history JSON and generates badge data
# Usage: ./update-history.sh <coverage-summary.json> <coverage-history.json> <coverage-badge.json>

set -e

SUMMARY_FILE="${1:-coverage/coverage-summary.json}"
HISTORY_FILE="${2:-docs/coverage-history.json}"
BADGE_FILE="${3:-docs/coverage-badge.json}"

# Check if coverage summary exists
if [ ! -f "$SUMMARY_FILE" ]; then
  echo "Warning: Coverage summary file not found: $SUMMARY_FILE"
  echo "Skipping coverage history update"
  exit 0
fi

# Create docs directory if it doesn't exist
mkdir -p "$(dirname "$HISTORY_FILE")"
mkdir -p "$(dirname "$BADGE_FILE")"

# Extract coverage data using jq
LINES=$(jq -r '.total.lines.pct // 0' "$SUMMARY_FILE")
FUNCTIONS=$(jq -r '.total.functions.pct // 0' "$SUMMARY_FILE")
BRANCHES=$(jq -r '.total.branches.pct // 0' "$SUMMARY_FILE")
STATEMENTS=$(jq -r '.total.statements.pct // 0' "$SUMMARY_FILE")

# Get current timestamp in ISO 8601 format
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Get git commit hash if available
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "Coverage metrics:"
echo "  Lines:      ${LINES}%"
echo "  Functions:  ${FUNCTIONS}%"
echo "  Branches:   ${BRANCHES}%"
echo "  Statements: ${STATEMENTS}%"
echo "  Timestamp:  ${TIMESTAMP}"
echo "  Commit:     ${COMMIT_HASH}"

# Initialize history file if it doesn't exist
if [ ! -f "$HISTORY_FILE" ]; then
  echo '{"history": []}' > "$HISTORY_FILE"
fi

# Create new history entry
NEW_ENTRY=$(jq -n \
  --arg timestamp "$TIMESTAMP" \
  --arg commit "$COMMIT_HASH" \
  --argjson lines "$LINES" \
  --argjson functions "$FUNCTIONS" \
  --argjson branches "$BRANCHES" \
  --argjson statements "$STATEMENTS" \
  '{
    timestamp: $timestamp,
    commit: $commit,
    lines: $lines,
    functions: $functions,
    branches: $branches,
    statements: $statements
  }')

# Add new entry to history (keep last 100 entries)
jq --argjson entry "$NEW_ENTRY" \
  '.history += [$entry] | .history |= .[-100:]' \
  "$HISTORY_FILE" > "${HISTORY_FILE}.tmp"

mv "${HISTORY_FILE}.tmp" "$HISTORY_FILE"

echo "Updated coverage history: $HISTORY_FILE"

# Generate coverage badge data
# Badge color logic: red (<60), orange (60-79), yellow (80-89), green (>=90)
get_badge_color() {
  local coverage=$1
  if (( $(echo "$coverage >= 90" | bc -l) )); then
    echo "brightgreen"
  elif (( $(echo "$coverage >= 80" | bc -l) )); then
    echo "green"
  elif (( $(echo "$coverage >= 60" | bc -l) )); then
    echo "yellow"
  else
    echo "red"
  fi
}

BADGE_COLOR=$(get_badge_color "$STATEMENTS")

# Create badge data (Shields.io format)
jq -n \
  --arg color "$BADGE_COLOR" \
  --argjson coverage "$STATEMENTS" \
  '{
    schemaVersion: 1,
    label: "coverage",
    message: "\($coverage)%",
    color: $color
  }' > "$BADGE_FILE"

echo "Updated coverage badge: $BADGE_FILE"
echo "Badge color: $BADGE_COLOR"
echo "Coverage history update complete!"
