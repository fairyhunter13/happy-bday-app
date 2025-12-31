#!/bin/bash
# Project Requirements Validation Hook
# Validates that research, plans, and implementations meet the original project_data requirements
# Source: project_data/Fullstack Backend Developer Assessment Test.docx.txt

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
REQUIREMENTS_FILE="$PROJECT_DIR/project_data/Fullstack Backend Developer Assessment Test.docx.txt"

echo "🎯 Project Requirements Validation Hook"
echo "========================================"
echo "Validating against: project_data/Fullstack Backend Developer Assessment Test.docx.txt"
echo ""

# Track validation results
PASSED=0
FAILED=0
WARNINGS=0

pass() { echo "   ✅ $1"; PASSED=$((PASSED + 1)); }
fail() { echo "   ❌ $1"; FAILED=$((FAILED + 1)); }
warn() { echo "   ⚠️  $1"; WARNINGS=$((WARNINGS + 1)); }

# ============================================
# CORE REQUIREMENTS
# ============================================
echo "📋 CORE REQUIREMENTS:"
echo ""

# REQ-1: TypeScript
echo "1. TypeScript Implementation:"
if [ -f "$PROJECT_DIR/tsconfig.json" ]; then
  TS_FILES=$(find "$PROJECT_DIR/src" -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$TS_FILES" -gt 0 ]; then
    pass "TypeScript configured ($TS_FILES source files)"
  else
    fail "No TypeScript files found"
  fi
else
  fail "tsconfig.json not found"
fi

# REQ-2: POST /user endpoint
echo ""
echo "2. POST /user Endpoint:"
if grep -rq "POST.*user\|post.*user" "$PROJECT_DIR/src/routes/" 2>/dev/null; then
  pass "POST /user endpoint implemented"
else
  fail "POST /user endpoint not found"
fi

# REQ-3: DELETE /user endpoint
echo ""
echo "3. DELETE /user Endpoint:"
if grep -rq "DELETE.*user\|delete.*user" "$PROJECT_DIR/src/routes/" 2>/dev/null; then
  pass "DELETE /user endpoint implemented"
else
  fail "DELETE /user endpoint not found"
fi

# REQ-4: User fields (firstName, lastName, birthday, location)
echo ""
echo "4. User Entity Fields:"
if [ -f "$PROJECT_DIR/src/db/schema/users.ts" ]; then
  HAS_FIRST_NAME=$(grep -c "firstName\|first_name" "$PROJECT_DIR/src/db/schema/users.ts" 2>/dev/null || echo "0")
  HAS_LAST_NAME=$(grep -c "lastName\|last_name" "$PROJECT_DIR/src/db/schema/users.ts" 2>/dev/null || echo "0")
  HAS_BIRTHDAY=$(grep -c "birthday\|birthdayDate\|birthday_date" "$PROJECT_DIR/src/db/schema/users.ts" 2>/dev/null || echo "0")
  HAS_LOCATION=$(grep -c "location\|timezone\|city\|country" "$PROJECT_DIR/src/db/schema/users.ts" 2>/dev/null || echo "0")

  if [ "$HAS_FIRST_NAME" -gt 0 ]; then pass "firstName field exists"; else fail "firstName field missing"; fi
  if [ "$HAS_LAST_NAME" -gt 0 ]; then pass "lastName field exists"; else fail "lastName field missing"; fi
  if [ "$HAS_BIRTHDAY" -gt 0 ]; then pass "birthday field exists"; else fail "birthday field missing"; fi
  if [ "$HAS_LOCATION" -gt 0 ]; then pass "location/timezone field exists"; else fail "location field missing"; fi
else
  fail "User schema file not found"
fi

# REQ-5: Birthday message at 9am local time
echo ""
echo "5. Birthday Message at 9am Local Time:"
if grep -rq "9.*am\|09:00\|9:00" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "9am scheduling logic found"
else
  warn "9am scheduling logic not explicitly found (may use config)"
fi

if grep -rq "timezone\|luxon\|moment" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Timezone handling implemented"
else
  fail "Timezone handling not found"
fi

# REQ-6: Email service integration
echo ""
echo "6. Email Service Integration (email-service.digitalenvision.com.au):"
if grep -rq "email-service.digitalenvision\|email.*service" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Email service endpoint configured"
else
  if grep -rq "EMAIL_SERVICE_URL\|emailService" "$PROJECT_DIR/src/" 2>/dev/null; then
    pass "Email service integration exists (configurable URL)"
  else
    warn "Email service URL not explicitly found"
  fi
fi

# REQ-7: Message format "Hey, {full_name} it's your birthday"
echo ""
echo "7. Birthday Message Format:"
if grep -rq "Hey.*birthday\|it's your birthday\|full_name" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Birthday message template found"
else
  if grep -rq "template\|message.*content\|messageContent" "$PROJECT_DIR/src/" 2>/dev/null; then
    pass "Message templating system exists"
  else
    warn "Message template not explicitly found"
  fi
fi

# REQ-8: Handle API errors and timeouts
echo ""
echo "8. Error Handling (API errors, timeouts):"
if grep -rq "retry\|Retry\|RETRY" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Retry logic implemented"
else
  fail "Retry logic not found"
fi

if grep -rq "timeout\|Timeout\|TIMEOUT" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Timeout handling implemented"
else
  warn "Timeout handling not explicitly found"
fi

# REQ-9: Recovery mechanism for unsent messages
echo ""
echo "9. Recovery Mechanism (resend unsent messages):"
if grep -rq "recovery\|Recovery\|unsent\|FAILED\|retry" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Recovery mechanism implemented"
else
  fail "Recovery mechanism not found"
fi

if grep -rq "scheduler\|Scheduler\|cron\|interval" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Scheduler service exists"
else
  fail "Scheduler not found"
fi

# ============================================
# THINGS TO CONSIDER
# ============================================
echo ""
echo "📋 SCALABILITY & QUALITY REQUIREMENTS:"
echo ""

# Scalability - Abstraction for future message types
echo "10. Abstraction for Multiple Message Types:"
if grep -rq "strategy\|Strategy\|MessageType\|ANNIVERSARY" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Strategy pattern / message type abstraction exists"
else
  warn "Message type abstraction not found"
fi

# Testability
echo ""
echo "11. Testing:"
TEST_FILES=$(find "$PROJECT_DIR/tests" -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')
if [ "$TEST_FILES" -gt 0 ]; then
  pass "Test files found ($TEST_FILES test files)"
else
  fail "No test files found"
fi

# Race conditions / Duplicate prevention
echo ""
echo "12. Race Condition Prevention (no duplicate messages):"
if grep -rq "idempotency\|Idempotency\|idempotent\|unique" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Idempotency mechanism found"
else
  fail "Idempotency not found - duplicate messages possible!"
fi

if grep -rq "lock\|mutex\|transaction" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Locking/transaction mechanism found"
else
  warn "Explicit locking not found (may use DB constraints)"
fi

# Scalability (thousands of birthdays)
echo ""
echo "13. Scalability (handle thousands of birthdays):"
if grep -rq "queue\|Queue\|RabbitMQ\|bullmq\|worker" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Message queue implemented for scalability"
else
  fail "Message queue not found - scalability concern"
fi

if grep -rq "batch\|Batch\|chunk\|paginate" "$PROJECT_DIR/src/" 2>/dev/null; then
  pass "Batch processing found"
else
  warn "Batch processing not explicitly found"
fi

# ============================================
# BONUS REQUIREMENTS
# ============================================
echo ""
echo "📋 BONUS REQUIREMENTS:"
echo ""

# PUT /user endpoint
echo "14. PUT /user Endpoint (edit user details):"
if grep -rq "PUT.*user\|put.*user" "$PROJECT_DIR/src/routes/" 2>/dev/null; then
  pass "PUT /user endpoint implemented (BONUS)"
else
  warn "PUT /user not implemented (bonus feature)"
fi

# ============================================
# SUMMARY
# ============================================
echo ""
echo "========================================"
echo "📊 VALIDATION SUMMARY"
echo "========================================"
echo "   ✅ Passed:   $PASSED"
echo "   ❌ Failed:   $FAILED"
echo "   ⚠️  Warnings: $WARNINGS"
echo ""

TOTAL=$((PASSED + FAILED))
if [ "$TOTAL" -gt 0 ]; then
  SCORE=$((PASSED * 100 / TOTAL))
  echo "   📈 Score: $SCORE% ($PASSED/$TOTAL requirements met)"
else
  SCORE=0
  echo "   📈 Score: Unable to calculate"
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "🎉 All core requirements are fulfilled!"
elif [ "$FAILED" -le 2 ]; then
  echo "⚠️  Minor gaps detected - review failed items"
else
  echo "❌ Significant gaps detected - action required"
fi

echo ""
echo "✅ Project requirements validation complete"
