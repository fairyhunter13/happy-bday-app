#!/bin/bash

# Phase 1 Verification Script
# Verifies that Phase 1 (Foundation) is complete and working

set -e

echo "🔍 Phase 1 Foundation Verification"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check Node.js version
echo "1. Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -ge 20 ]; then
    success "Node.js version $(node -v) (>= 20 required)"
else
    error "Node.js version too old. Need >= 20, got $(node -v)"
    exit 1
fi
echo ""

# Check npm version
echo "2. Checking npm version..."
NPM_VERSION=$(npm -v | cut -d '.' -f 1)
if [ "$NPM_VERSION" -ge 10 ]; then
    success "npm version $(npm -v) (>= 10 required)"
else
    error "npm version too old. Need >= 10, got $(npm -v)"
    exit 1
fi
echo ""

# Check for required files
echo "3. Checking required configuration files..."
files=(
    "package.json"
    "tsconfig.json"
    "eslint.config.js"
    ".prettierrc.json"
    ".env.example"
    "vitest.config.ts"
    ".gitignore"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        success "$file exists"
    else
        error "$file missing"
        exit 1
    fi
done
echo ""

# Check for source directories
echo "4. Checking project structure..."
dirs=(
    "src/config"
    "src/controllers"
    "src/routes"
    "src/services"
    "src/repositories"
    "src/entities"
    "src/strategies"
    "src/utils"
    "src/types"
    "tests/unit"
    "tests/integration"
    "tests/e2e"
    "tests/helpers"
)

for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        success "$dir/ directory exists"
    else
        error "$dir/ directory missing"
        exit 1
    fi
done
echo ""

# Check for key source files
echo "5. Checking key source files..."
key_files=(
    "src/index.ts"
    "src/app.ts"
    "src/config/environment.ts"
    "src/config/logger.ts"
    "src/controllers/health.controller.ts"
    "src/routes/health.routes.ts"
    "src/types/index.ts"
    "src/utils/errors.ts"
    "tests/setup.ts"
    "tests/helpers/test-server.ts"
)

for file in "${key_files[@]}"; do
    if [ -f "$file" ]; then
        success "$file exists"
    else
        error "$file missing"
        exit 1
    fi
done
echo ""

# Check if node_modules exists
echo "6. Checking dependencies..."
if [ -d "node_modules" ]; then
    success "node_modules/ exists (dependencies installed)"

    # Count dependencies
    PROD_DEPS=$(cat package.json | grep -A 100 '"dependencies":' | grep -c '":' || true)
    DEV_DEPS=$(cat package.json | grep -A 100 '"devDependencies":' | grep -c '":' || true)
    success "Production dependencies: $PROD_DEPS"
    success "Development dependencies: $DEV_DEPS"
else
    warning "node_modules/ not found"
    warning "Run 'npm install' to install dependencies"
fi
echo ""

# Check git hooks
echo "7. Checking git hooks..."
if [ -f ".husky/pre-commit" ]; then
    success ".husky/pre-commit exists"
else
    warning ".husky/pre-commit not found"
fi

if [ -f ".husky/pre-push" ]; then
    success ".husky/pre-push exists"
else
    warning ".husky/pre-push not found"
fi
echo ""

# Count source files
echo "8. Counting source files..."
TS_FILES=$(find src -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
TEST_FILES=$(find tests -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
success "Source files: $TS_FILES"
success "Test files: $TEST_FILES"
echo ""

# Summary
echo "=================================="
echo "📊 Verification Summary"
echo "=================================="
echo ""
success "Phase 1 Foundation is complete!"
echo ""
echo "Next steps:"
echo "  1. Run 'npm install' to install dependencies"
echo "  2. Copy '.env.example' to '.env' and configure"
echo "  3. Run 'npm run dev' to start development server"
echo "  4. Visit http://localhost:3000/docs for API docs"
echo "  5. Run 'npm run test:unit' to verify tests"
echo ""
echo "Documentation:"
echo "  - QUICKSTART.md - Quick start guide"
echo "  - PHASE1_IMPLEMENTATION.md - Phase 1 details"
echo "  - IMPLEMENTATION_SUMMARY.md - Complete summary"
echo "  - plan/05-implementation/master-plan.md - Full roadmap"
echo ""
success "Phase 1 (Foundation) verification complete!"
