#!/bin/bash
# Setup GitHub Secrets for Birthday Message Scheduler
# Usage: ./scripts/setup-github-secrets.sh
# DRY Principle: Automated secret management

set -e

echo "🔐 GitHub Secrets Setup for Birthday Message Scheduler"
echo "======================================================"
echo ""

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ Error: gh CLI not found${NC}"
    echo "Install: brew install gh (macOS) or https://cli.github.com"
    exit 1
fi

# Check gh auth status
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with GitHub${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${GREEN}✓${NC} gh CLI authenticated"
echo ""

# 1. SOPS_AGE_KEY
echo -e "${BLUE}[1/1] Setting up SOPS_AGE_KEY${NC}"

if [ -f ~/.config/sops/age/keys.txt ]; then
    gh secret set SOPS_AGE_KEY < ~/.config/sops/age/keys.txt
    echo -e "${GREEN}✓${NC} SOPS_AGE_KEY set successfully"
else
    echo -e "${YELLOW}⚠️  Age key not found at ~/.config/sops/age/keys.txt${NC}"
    echo "   Generate one first: age-keygen -o ~/.config/sops/age/keys.txt"
fi

echo ""
echo -e "${GREEN}✅ All secrets configured!${NC}"
echo ""
echo "Verify with: gh secret list"
