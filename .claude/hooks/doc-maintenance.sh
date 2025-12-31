#!/bin/bash
# Documentation Maintenance Hook
# Runs at end of response to update, reorganize, and tidy documentation
# Also checks for outdated docs that need sync with current repository state

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
DOCS_DIR="$PROJECT_DIR/docs"
PLAN_DIR="$PROJECT_DIR/plan"

echo "📚 Documentation Maintenance Hook"
echo "=================================="

# 1. Check for markdown files that need formatting
echo "🔍 Checking documentation status..."

# Count markdown files
MD_COUNT_DOCS=$(find "$DOCS_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
MD_COUNT_PLAN=$(find "$PLAN_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
echo "   Docs directory: $MD_COUNT_DOCS markdown files"
echo "   Plan directory: $MD_COUNT_PLAN markdown files"

# 2. Check for broken internal links (basic check)
echo ""
echo "🔗 Checking for potential broken links..."
BROKEN_LINKS=0
for file in $(find "$DOCS_DIR" -name "*.md" 2>/dev/null); do
  while IFS= read -r link; do
    if [[ -n "$link" && ! -f "$DOCS_DIR/$link" && ! -f "$PROJECT_DIR/$link" ]]; then
      ((BROKEN_LINKS++)) || true
    fi
  done < <(grep -oE '\[.*\]\(([^)]+)\)' "$file" 2>/dev/null | grep -oE '\(([^)]+)\)' | tr -d '()' | grep -v '^http' | grep -v '^#' || true)
done

if [ "$BROKEN_LINKS" -gt 0 ]; then
  echo "   ⚠️  Found $BROKEN_LINKS potential broken links"
else
  echo "   ✅ No broken links detected"
fi

# 3. Check INDEX.md files are up to date
echo ""
echo "📋 Checking INDEX files..."
INDEX_COUNT=$(find "$PLAN_DIR" -name "INDEX.md" 2>/dev/null | wc -l | tr -d ' ')
echo "   Found $INDEX_COUNT INDEX.md files"

# 4. Check documentation freshness (compare modification times)
echo ""
echo "📅 Checking documentation freshness..."
OUTDATED_DOCS=0
DAYS_THRESHOLD=7

# Get the latest source file modification time
LATEST_SRC_MOD=$(find "$PROJECT_DIR/src" -name "*.ts" -type f -mtime -1 2>/dev/null | wc -l | tr -d ' ')

if [ "$LATEST_SRC_MOD" -gt 0 ]; then
  echo "   ⚠️  $LATEST_SRC_MOD source files modified in last 24 hours"
  echo "   📝 Documentation may need updates to reflect changes"
else
  echo "   ✅ No recent source changes detected"
fi

# 5. Check for key documentation files that should exist
echo ""
echo "📋 Verifying essential documentation..."
ESSENTIAL_DOCS=(
  "docs/DEVELOPER_SETUP.md"
  "docs/DEPLOYMENT_GUIDE.md"
  "docs/RUNBOOK.md"
  "docs/METRICS.md"
  "plan/09-reports/GAP_ANALYSIS_REPORT.md"
  "plan/05-implementation/master-plan.md"
  "README.md"
)

MISSING_DOCS=0
for doc in "${ESSENTIAL_DOCS[@]}"; do
  if [ ! -f "$PROJECT_DIR/$doc" ]; then
    echo "   ❌ Missing: $doc"
    ((MISSING_DOCS++))
  fi
done

if [ "$MISSING_DOCS" -eq 0 ]; then
  echo "   ✅ All essential documentation files exist"
fi

# 6. Check for recently modified files that may need doc updates
echo ""
echo "📊 Recent activity analysis..."

# Count recent changes
RECENT_SRC=$(find "$PROJECT_DIR/src" -name "*.ts" -mtime -1 2>/dev/null | wc -l | tr -d ' ')
RECENT_TESTS=$(find "$PROJECT_DIR/tests" -name "*.ts" -mtime -1 2>/dev/null | wc -l | tr -d ' ')
RECENT_DOCS=$(find "$DOCS_DIR" "$PLAN_DIR" -name "*.md" -mtime -1 2>/dev/null | wc -l | tr -d ' ')

echo "   Recent source changes (24h): $RECENT_SRC files"
echo "   Recent test changes (24h): $RECENT_TESTS files"
echo "   Recent doc updates (24h): $RECENT_DOCS files"

# 7. Generate recommendations
echo ""
echo "💡 Documentation Recommendations:"
if [ "$RECENT_SRC" -gt "$RECENT_DOCS" ]; then
  echo "   ⚠️  Source files changed more than docs - consider updating documentation"
fi

if [ "$BROKEN_LINKS" -gt 0 ]; then
  echo "   🔧 Fix $BROKEN_LINKS broken links in documentation"
fi

if [ "$MISSING_DOCS" -gt 0 ]; then
  echo "   📝 Create $MISSING_DOCS missing essential documents"
fi

# 8. Summary
echo ""
echo "📊 Documentation Status Summary:"
echo "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   📁 Total docs: $((MD_COUNT_DOCS + MD_COUNT_PLAN)) files"
echo "   📋 Index files: $INDEX_COUNT"
echo "   🔗 Broken links: $BROKEN_LINKS"
echo "   ❌ Missing docs: $MISSING_DOCS"
echo "   📅 Recent src changes: $RECENT_SRC"
echo "   📅 Recent doc updates: $RECENT_DOCS"
echo ""

# Set exit status based on issues
if [ "$MISSING_DOCS" -gt 0 ] || [ "$BROKEN_LINKS" -gt 5 ]; then
  echo "⚠️  Documentation needs attention"
else
  echo "✅ Documentation maintenance check complete"
fi
