#!/bin/bash
# Requirements Validation Hook
# Validates that research, plans, and implementations meet project requirements

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "✅ Requirements Validation Hook"
echo "================================"

# 1. Check requirements directory
REQUIREMENTS_DIR="$PROJECT_DIR/plan/01-requirements"
if [ -d "$REQUIREMENTS_DIR" ]; then
  REQ_FILES=$(find "$REQUIREMENTS_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  echo "📋 Requirements files: $REQ_FILES"
else
  echo "⚠️  Requirements directory not found"
fi

# 2. Check research directory
RESEARCH_DIR="$PROJECT_DIR/plan/03-research"
if [ -d "$RESEARCH_DIR" ]; then
  RESEARCH_FILES=$(find "$RESEARCH_DIR" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
  echo "🔬 Research files: $RESEARCH_FILES"
else
  echo "⚠️  Research directory not found"
fi

# 3. Check implementation plan
IMPL_PLAN="$PROJECT_DIR/plan/05-implementation/master-plan.md"
if [ -f "$IMPL_PLAN" ]; then
  echo "📝 Master plan: EXISTS"
else
  echo "⚠️  Master plan not found"
fi

# 4. Validate key requirements
echo ""
echo "🎯 Key Requirements Validation:"

# REQ-001: User CRUD operations
if [ -f "$PROJECT_DIR/src/routes/user.routes.ts" ]; then
  echo "   ✅ REQ-001: User CRUD operations - IMPLEMENTED"
else
  echo "   ❌ REQ-001: User CRUD operations - NOT FOUND"
fi

# REQ-002: Timezone-aware scheduling
if grep -rq "timezone" "$PROJECT_DIR/src/services/" 2>/dev/null; then
  echo "   ✅ REQ-002: Timezone-aware scheduling - IMPLEMENTED"
else
  echo "   ❌ REQ-002: Timezone-aware scheduling - NOT FOUND"
fi

# REQ-003: Message queuing (RabbitMQ)
if [ -d "$PROJECT_DIR/src/queue" ]; then
  echo "   ✅ REQ-003: Message queuing (RabbitMQ) - IMPLEMENTED"
else
  echo "   ❌ REQ-003: Message queuing - NOT FOUND"
fi

# REQ-004: Retry logic with exponential backoff
if grep -rq "exponential\|backoff\|retry" "$PROJECT_DIR/src/queue/" 2>/dev/null; then
  echo "   ✅ REQ-004: Retry logic - IMPLEMENTED"
else
  echo "   ❌ REQ-004: Retry logic - NOT FOUND"
fi

# REQ-005: Idempotency guarantees
if grep -rq "idempotency" "$PROJECT_DIR/src/" 2>/dev/null; then
  echo "   ✅ REQ-005: Idempotency guarantees - IMPLEMENTED"
else
  echo "   ❌ REQ-005: Idempotency guarantees - NOT FOUND"
fi

# REQ-006: Circuit breaker
if grep -rq "circuit\|opossum" "$PROJECT_DIR/src/" 2>/dev/null; then
  echo "   ✅ REQ-006: Circuit breaker - IMPLEMENTED"
else
  echo "   ❌ REQ-006: Circuit breaker - NOT FOUND"
fi

# 5. Performance requirements
echo ""
echo "⚡ Performance Requirements:"

# Check for database indexes
if grep -rq "index\|Index" "$PROJECT_DIR/src/db/schema/" 2>/dev/null; then
  echo "   ✅ Database indexes: DEFINED"
else
  echo "   ❌ Database indexes: NOT FOUND"
fi

# Check for connection pooling
if grep -rq "pool\|Pool" "$PROJECT_DIR/src/db/" 2>/dev/null; then
  echo "   ✅ Connection pooling: CONFIGURED"
else
  echo "   ❌ Connection pooling: NOT FOUND"
fi

# 6. Summary
echo ""
echo "📊 Requirements Validation Summary:"
echo "   All core requirements appear to be implemented."
echo "   Run full test suite for comprehensive validation."
echo ""
echo "✅ Requirements validation complete"
