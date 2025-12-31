#!/bin/bash
# Gap Analysis Generation Hook
# Compares current state against research, plans, and targets

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
GAP_REPORT="$PROJECT_DIR/plan/09-reports/GAP_ANALYSIS_REPORT.md"

echo "📊 Gap Analysis Hook"
echo "===================="

# 1. Check if gap analysis report exists
if [ -f "$GAP_REPORT" ]; then
  LAST_MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$GAP_REPORT" 2>/dev/null || stat -c "%y" "$GAP_REPORT" 2>/dev/null | cut -d' ' -f1-2)
  echo "📄 Gap Analysis Report: EXISTS"
  echo "   Last modified: $LAST_MODIFIED"
else
  echo "📄 Gap Analysis Report: NOT FOUND"
  echo "   ⚠️  Report needs to be created"
fi

# 2. Count implementation status
echo ""
echo "🔍 Quick Implementation Status Check:"

# Count source files
SRC_FILES=$(find "$PROJECT_DIR/src" -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
echo "   TypeScript source files: $SRC_FILES"

# Count test files
TEST_FILES=$(find "$PROJECT_DIR/tests" -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
echo "   Test files: $TEST_FILES"

# Count documentation files
DOC_FILES=$(find "$PROJECT_DIR/docs" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
echo "   Documentation files: $DOC_FILES"

# Count plan files
PLAN_FILES=$(find "$PROJECT_DIR/plan" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
echo "   Plan files: $PLAN_FILES"

# 3. Check key implementation files
echo ""
echo "🎯 Key Implementation Checks:"

# Database partitioning
if [ -f "$PROJECT_DIR/src/db/migrations/0002_add_partitioning.sql" ]; then
  echo "   ✅ Database partitioning: IMPLEMENTED"
else
  echo "   ❌ Database partitioning: NOT FOUND"
fi

# Queue metrics
if grep -q "queueMetricsInstrumentation" "$PROJECT_DIR/src/queue/connection.ts" 2>/dev/null; then
  echo "   ✅ Queue metrics wiring: IMPLEMENTED"
else
  echo "   ❌ Queue metrics wiring: NOT FOUND"
fi

# Redis cache service
if [ -f "$PROJECT_DIR/src/services/redis.service.ts" ] || [ -f "$PROJECT_DIR/src/services/cache.service.ts" ]; then
  echo "   ✅ Redis cache service: IMPLEMENTED"
else
  echo "   ⏳ Redis cache service: NOT IMPLEMENTED (planned)"
fi

# Worker tests
if [ -f "$PROJECT_DIR/tests/integration/queue/worker.test.ts" ]; then
  WORKER_TESTS=$(grep -c "it(" "$PROJECT_DIR/tests/integration/queue/worker.test.ts" 2>/dev/null || echo "0")
  echo "   ✅ Worker integration tests: $WORKER_TESTS tests"
else
  echo "   ❌ Worker integration tests: NOT FOUND"
fi

# 4. Summary
echo ""
echo "📊 Gap Analysis Summary:"
echo "   - Source files: $SRC_FILES"
echo "   - Test files: $TEST_FILES"
echo "   - Docs: $DOC_FILES"
echo "   - Plans: $PLAN_FILES"
echo ""
echo "✅ Gap analysis check complete"
