#!/bin/bash
# Documentation Health Scoring Script
# Calculates a health score for repository documentation
#
# Usage: ./calculate-health.sh [docs-dir] [plan-dir]
#   docs-dir: Documentation directory (default: docs)
#   plan-dir: Planning directory (default: plan)
#
# Health Score Formula:
#   Base Score: 100
#   - Orphaned files: -5 points each
#   - Broken links: -3 points each
#   - Missing index files: -10 points each
#   - Duplicate content: -2 points each
#
# Exit codes:
#   0 - Always succeeds (prints score to stdout)

set -e

DOCS_DIR="${1:-docs}"
PLAN_DIR="${2:-plan}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Documentation Health Scoring"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Initialize counters
TOTAL_FILES=0
ORPHANED_FILES=0
BROKEN_LINKS=0
MISSING_INDICES=0
DUPLICATE_FILES=0
TOTAL_SIZE=0

# Count total documentation files
if [ -d "$DOCS_DIR" ]; then
  DOCS_FILES=$(find "$DOCS_DIR" -type f \( -name "*.md" -o -name "*.html" \) | wc -l | tr -d ' ')
  TOTAL_FILES=$((TOTAL_FILES + DOCS_FILES))
fi

if [ -d "$PLAN_DIR" ]; then
  PLAN_FILES=$(find "$PLAN_DIR" -type f -name "*.md" | wc -l | tr -d ' ')
  TOTAL_FILES=$((TOTAL_FILES + PLAN_FILES))
fi

echo "📊 File Statistics:"
echo "  Documentation files: $DOCS_FILES"
echo "  Planning files:      $PLAN_FILES"
echo "  Total files:         $TOTAL_FILES"
echo ""

# Check for index files
echo "📑 Index File Check:"
INDEX_FILES=0

if [ -f "$DOCS_DIR/INDEX.md" ]; then
  echo "  ✅ docs/INDEX.md exists"
  INDEX_FILES=$((INDEX_FILES + 1))
else
  echo "  ❌ docs/INDEX.md missing"
  MISSING_INDICES=$((MISSING_INDICES + 1))
fi

if [ -f "$PLAN_DIR/README.md" ]; then
  echo "  ✅ plan/README.md exists"
  INDEX_FILES=$((INDEX_FILES + 1))
else
  echo "  ❌ plan/README.md missing"
  MISSING_INDICES=$((MISSING_INDICES + 1))
fi

if [ -f "README.md" ]; then
  echo "  ✅ README.md exists"
  INDEX_FILES=$((INDEX_FILES + 1))
else
  echo "  ❌ README.md missing"
  MISSING_INDICES=$((MISSING_INDICES + 1))
fi

echo ""

# Check for orphaned files (files not linked from INDEX.md)
echo "🔗 Orphan Detection:"

if [ -f "$DOCS_DIR/INDEX.md" ] && [ -d "$DOCS_DIR" ]; then
  # Get list of all .md files in docs (excluding INDEX.md and vendor-specs/README.md)
  ALL_DOCS=$(find "$DOCS_DIR" -name "*.md" -type f ! -name "INDEX.md" ! -name "README.md" ! -path "*/templates/*" 2>/dev/null || true)

  # Count orphaned files
  for file in $ALL_DOCS; do
    BASENAME=$(basename "$file")
    if ! grep -q "$BASENAME" "$DOCS_DIR/INDEX.md" 2>/dev/null; then
      ORPHANED_FILES=$((ORPHANED_FILES + 1))
      echo "  ⚠️  Orphaned: $file"
    fi
  done

  if [ $ORPHANED_FILES -eq 0 ]; then
    echo "  ✅ No orphaned documentation files"
  else
    echo "  Found $ORPHANED_FILES orphaned file(s)"
  fi
else
  echo "  ⚠️  Cannot check orphans (INDEX.md missing)"
fi

echo ""

# Check for broken links in INDEX.md
echo "🔗 Link Integrity Check:"

if [ -f "$DOCS_DIR/INDEX.md" ]; then
  # Extract markdown links: [text](path.md)
  LINKS=$(grep -oP '\[.*?\]\(\./.*?\.md\)' "$DOCS_DIR/INDEX.md" 2>/dev/null || true)

  TOTAL_LINKS=0
  VALID_LINKS=0

  while IFS= read -r link; do
    if [ -n "$link" ]; then
      TOTAL_LINKS=$((TOTAL_LINKS + 1))
      # Extract path from [text](./path.md)
      PATH=$(echo "$link" | sed -n 's/.*(\.\(.*\)).*/\1/p')

      # Check if file exists (relative to docs dir)
      if [ -f "$DOCS_DIR$PATH" ]; then
        VALID_LINKS=$((VALID_LINKS + 1))
      else
        BROKEN_LINKS=$((BROKEN_LINKS + 1))
        echo "  ❌ Broken: $PATH"
      fi
    fi
  done <<< "$LINKS"

  if [ $TOTAL_LINKS -gt 0 ]; then
    echo "  Total links:  $TOTAL_LINKS"
    echo "  Valid links:  $VALID_LINKS"
    echo "  Broken links: $BROKEN_LINKS"

    if [ $BROKEN_LINKS -eq 0 ]; then
      echo "  ✅ All links valid"
    fi
  else
    echo "  ⚠️  No links found to check"
  fi
else
  echo "  ⚠️  Cannot check links (INDEX.md missing)"
fi

echo ""

# Check for duplicate content (by MD5 hash)
echo "📄 Duplicate Detection:"

if [ -d "$DOCS_DIR" ] && [ -d "$PLAN_DIR" ]; then
  # Find duplicate MD5 hashes
  TEMP_MD5=$(mktemp)

  find "$DOCS_DIR" "$PLAN_DIR" -type f \( -name "*.md" -o -name "*.html" -o -name "*.json" \) -exec md5sum {} \; 2>/dev/null | \
    sort | \
    awk '{if (seen[$1]++) print $2}' > "$TEMP_MD5"

  DUPLICATE_FILES=$(wc -l < "$TEMP_MD5" | tr -d ' ')

  if [ "$DUPLICATE_FILES" -gt 0 ]; then
    echo "  ⚠️  Found $DUPLICATE_FILES duplicate file(s):"
    cat "$TEMP_MD5" | head -5 | sed 's/^/    /'
    if [ "$DUPLICATE_FILES" -gt 5 ]; then
      echo "    ... and $((DUPLICATE_FILES - 5)) more"
    fi
  else
    echo "  ✅ No duplicate files detected"
  fi

  rm -f "$TEMP_MD5"
else
  echo "  ⚠️  Cannot check duplicates (directories missing)"
fi

echo ""

# Calculate health score
BASE_SCORE=100
ORPHAN_PENALTY=$((ORPHANED_FILES * 5))
BROKEN_LINK_PENALTY=$((BROKEN_LINKS * 3))
MISSING_INDEX_PENALTY=$((MISSING_INDICES * 10))
DUPLICATE_PENALTY=$((DUPLICATE_FILES * 2))

HEALTH_SCORE=$((BASE_SCORE - ORPHAN_PENALTY - BROKEN_LINK_PENALTY - MISSING_INDEX_PENALTY - DUPLICATE_PENALTY))

# Ensure score doesn't go below 0
if [ $HEALTH_SCORE -lt 0 ]; then
  HEALTH_SCORE=0
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Health Score Calculation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Base Score:                 100"
echo "Orphaned files penalty:     -$ORPHAN_PENALTY ($ORPHANED_FILES × 5)"
echo "Broken links penalty:       -$BROKEN_LINK_PENALTY ($BROKEN_LINKS × 3)"
echo "Missing indices penalty:    -$MISSING_INDEX_PENALTY ($MISSING_INDICES × 10)"
echo "Duplicate files penalty:    -$DUPLICATE_PENALTY ($DUPLICATE_FILES × 2)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Determine health status
if [ $HEALTH_SCORE -ge 95 ]; then
  STATUS="🟢 Excellent"
  STATUS_TEXT="Excellent"
elif [ $HEALTH_SCORE -ge 85 ]; then
  STATUS="🟡 Very Good"
  STATUS_TEXT="Very Good"
elif [ $HEALTH_SCORE -ge 75 ]; then
  STATUS="🟠 Good"
  STATUS_TEXT="Good"
elif [ $HEALTH_SCORE -ge 60 ]; then
  STATUS="🟠 Fair"
  STATUS_TEXT="Fair"
else
  STATUS="🔴 Needs Improvement"
  STATUS_TEXT="Needs Improvement"
fi

echo "FINAL HEALTH SCORE: ${HEALTH_SCORE}/100 ($STATUS)"
echo ""

# Generate health badge JSON
HEALTH_BADGE_FILE="docs/health-badge.json"

if [ -d "docs" ]; then
  # Determine badge color
  if [ $HEALTH_SCORE -ge 95 ]; then
    BADGE_COLOR="brightgreen"
  elif [ $HEALTH_SCORE -ge 85 ]; then
    BADGE_COLOR="green"
  elif [ $HEALTH_SCORE -ge 75 ]; then
    BADGE_COLOR="yellow"
  elif [ $HEALTH_SCORE -ge 60 ]; then
    BADGE_COLOR="orange"
  else
    BADGE_COLOR="red"
  fi

  cat > "$HEALTH_BADGE_FILE" << EOF
{
  "schemaVersion": 1,
  "label": "docs health",
  "message": "${HEALTH_SCORE}% ${STATUS_TEXT}",
  "color": "$BADGE_COLOR"
}
EOF

  echo "✅ Generated health badge: $HEALTH_BADGE_FILE"
  echo ""
fi

# Output JSON summary for automation
cat > "docs/health-summary.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "score": $HEALTH_SCORE,
  "status": "$STATUS_TEXT",
  "metrics": {
    "total_files": $TOTAL_FILES,
    "orphaned_files": $ORPHANED_FILES,
    "broken_links": $BROKEN_LINKS,
    "missing_indices": $MISSING_INDICES,
    "duplicate_files": $DUPLICATE_FILES
  },
  "penalties": {
    "orphaned": $ORPHAN_PENALTY,
    "broken_links": $BROKEN_LINK_PENALTY,
    "missing_indices": $MISSING_INDEX_PENALTY,
    "duplicates": $DUPLICATE_PENALTY
  }
}
EOF

echo "✅ Generated health summary: docs/health-summary.json"
echo ""

exit 0
