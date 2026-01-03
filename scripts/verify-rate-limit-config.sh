#!/bin/bash
# Verify rate limiting configuration for performance tests
# This script checks that rate limiting can be properly disabled

set -e

echo "================================================"
echo "Rate Limiting Configuration Verification"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check environment schema includes RATE_LIMIT_ENABLED
echo "Test 1: Checking environment.ts for RATE_LIMIT_ENABLED..."
if grep -q "RATE_LIMIT_ENABLED" src/config/environment.ts; then
    echo -e "${GREEN}✓ PASS${NC}: RATE_LIMIT_ENABLED found in environment schema"
else
    echo -e "${RED}✗ FAIL${NC}: RATE_LIMIT_ENABLED not found in environment schema"
    exit 1
fi
echo ""

# Test 2: Check app.ts has conditional rate limiting registration
echo "Test 2: Checking app.ts for conditional rate limiting..."
if grep -q "if (env.RATE_LIMIT_ENABLED)" src/app.ts; then
    echo -e "${GREEN}✓ PASS${NC}: Conditional rate limiting registration found"
else
    echo -e "${RED}✗ FAIL${NC}: Conditional rate limiting registration not found"
    exit 1
fi
echo ""

# Test 3: Check docker-compose.perf.yml disables rate limiting
echo "Test 3: Checking docker-compose.perf.yml..."
if grep -q "RATE_LIMIT_ENABLED: false" docker-compose.perf.yml; then
    echo -e "${GREEN}✓ PASS${NC}: Rate limiting disabled in performance environment"
else
    echo -e "${RED}✗ FAIL${NC}: Rate limiting not properly disabled in docker-compose.perf.yml"
    exit 1
fi
echo ""

# Test 4: Check .env.example has documentation
echo "Test 4: Checking .env.example for documentation..."
if grep -q "RATE_LIMIT_ENABLED" .env.example; then
    echo -e "${GREEN}✓ PASS${NC}: RATE_LIMIT_ENABLED documented in .env.example"
else
    echo -e "${RED}✗ FAIL${NC}: RATE_LIMIT_ENABLED not documented in .env.example"
    exit 1
fi
echo ""

# Test 5: Verify TypeScript compilation
echo "Test 5: Verifying TypeScript compilation..."
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}: TypeScript compilation successful"
else
    echo -e "${RED}✗ FAIL${NC}: TypeScript compilation failed"
    exit 1
fi
echo ""

# Test 6: Check that all API instances in docker-compose.perf.yml have RATE_LIMIT_ENABLED=false
echo "Test 6: Checking all API instances have rate limiting disabled..."
api_count=$(grep -c "RATE_LIMIT_ENABLED: false" docker-compose.perf.yml)
if [ "$api_count" -ge 5 ]; then
    echo -e "${GREEN}✓ PASS${NC}: All 5 API instances have rate limiting disabled ($api_count occurrences found)"
else
    echo -e "${RED}✗ FAIL${NC}: Not all API instances have rate limiting disabled (found $api_count, expected 5+)"
    exit 1
fi
echo ""

# Summary
echo "================================================"
echo -e "${GREEN}All verification tests passed!${NC}"
echo "================================================"
echo ""
echo "Rate limiting configuration is correctly set up for performance testing."
echo ""
echo "Next steps:"
echo "1. Test locally: docker-compose -f docker-compose.perf.yml up -d"
echo "2. Check logs: docker logs perf-api-1 | grep -i 'rate limiting'"
echo "3. Run k6 test: k6 run tests/performance/peak-load.js"
echo ""
echo "Expected behavior:"
echo "- In perf environment: Rate limiting should be DISABLED"
echo "- In dev/prod: Rate limiting should be ENABLED (default)"
echo ""
