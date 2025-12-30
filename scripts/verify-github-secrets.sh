#!/bin/bash
# GitHub Secrets Verification Script (Enhanced)
# Purpose: Verify GitHub secrets exist AND have valid format
# Usage: ./scripts/verify-github-secrets.sh
# Exit codes: 0 = all valid, 1 = missing or invalid

set -e

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Track issues
MISSING_REQUIRED=()
INVALID_FORMAT=()
MISSING_OPTIONAL=()
DEPRECATED_FOUND=()
EXIT_CODE=0

echo "GitHub Secrets Verification (Enhanced)"
echo "=========================================="
echo ""

# Function to check if running in CI
is_ci() {
    [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]
}

# Function to check if gh CLI is installed
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        echo -e "${RED}✗ gh CLI is not installed${NC}"
        echo ""
        echo "Install gh CLI:"
        echo "  macOS:   brew install gh"
        echo "  Linux:   https://cli.github.com/"
        echo "  Windows: winget install --id GitHub.cli"
        echo ""
        return 1
    fi
    echo -e "${GREEN}✓${NC} gh CLI is installed"
    return 0
}

# Function to check gh authentication (only in local environment)
check_gh_auth() {
    if is_ci; then
        return 0  # Skip in CI
    fi

    if ! gh auth status &> /dev/null; then
        echo -e "${RED}✗ Not authenticated with GitHub${NC}"
        echo ""
        echo "Authenticate with: gh auth login"
        echo ""
        return 1
    fi
    echo -e "${GREEN}✓${NC} Authenticated with GitHub"
    return 0
}

# Function to check secret existence
check_secret_exists() {
    local secret_name=$1
    if is_ci; then
        # In CI, check environment variable
        case "$secret_name" in
            SOPS_AGE_KEY) [ -n "$SOPS_AGE_KEY" ] ;;
            CODECOV_TOKEN) [ -n "$CODECOV_TOKEN" ] ;;
            SNYK_TOKEN) [ -n "$SNYK_TOKEN" ] ;;
            *) return 1 ;;
        esac
    else
        # Locally, use gh CLI
        gh secret list 2>/dev/null | grep -q "^${secret_name}"
    fi
}

# Function to validate secret format (basic checks without exposing values)
validate_secret_format_basic() {
    local secret_name=$1

    # In local environment, we can't validate without exposing secret values
    # This is a placeholder for CI environment validation
    if ! is_ci; then
        echo -e "  ${YELLOW}Format validation skipped (requires CI environment)${NC}"
        return 0
    fi

    # In CI, we can validate format
    local secret_value
    case "$secret_name" in
        SOPS_AGE_KEY)
            secret_value="$SOPS_AGE_KEY"
            # Check for AGE-SECRET-KEY-1 prefix
            if ! echo "$secret_value" | grep -q "AGE-SECRET-KEY-1"; then
                echo -e "  ${RED}Invalid format: Missing AGE-SECRET-KEY-1 prefix${NC}"
                return 1
            fi
            ;;
        CODECOV_TOKEN)
            secret_value="$CODECOV_TOKEN"
            # Check UUID format (basic check)
            if ! echo "$secret_value" | grep -qE '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'; then
                echo -e "  ${RED}Invalid format: Not a valid UUID${NC}"
                return 1
            fi
            ;;
        SNYK_TOKEN)
            secret_value="$SNYK_TOKEN"
            # Check UUID or hex token format
            if ! echo "$secret_value" | grep -qE '^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32,})$'; then
                echo -e "  ${RED}Invalid format: Not a valid token${NC}"
                return 1
            fi
            ;;
    esac

    return 0
}

# Function to check and validate secret
check_secret() {
    local secret_name=$1
    local required=$2
    local deprecated=${3:-false}

    if ! check_secret_exists "$secret_name"; then
        if [ "$deprecated" = "true" ]; then
            echo -e "${GREEN}✓${NC} $secret_name is ${GREEN}not present${NC} (deprecated, should be removed)"
            return 0
        elif [ "$required" = "true" ]; then
            echo -e "${RED}✗${NC} $secret_name is ${RED}missing${NC} (required)"
            MISSING_REQUIRED+=("$secret_name")
            EXIT_CODE=1
        else
            echo -e "${YELLOW}~${NC} $secret_name is not configured ${YELLOW}(optional)${NC}"
            MISSING_OPTIONAL+=("$secret_name")
        fi
        return 1
    fi

    # If deprecated secret exists, flag it
    if [ "$deprecated" = "true" ]; then
        echo -e "${YELLOW}!${NC} $secret_name ${YELLOW}exists but is deprecated${NC} (should be removed)"
        DEPRECATED_FOUND+=("$secret_name")
        return 1
    fi

    # Validate format if in CI
    if is_ci && [ "$required" = "true" ]; then
        if ! validate_secret_format_basic "$secret_name"; then
            INVALID_FORMAT+=("$secret_name")
            EXIT_CODE=1
            return 1
        fi
    fi

    echo -e "${GREEN}✓${NC} $secret_name is configured"
    return 0
}

# Main verification
main() {
    # Check prerequisites (only locally)
    if ! is_ci; then
        if ! check_gh_cli; then
            exit 1
        fi

        if ! check_gh_auth; then
            exit 1
        fi
        echo ""
    fi

    # Layer 1: Existence Check
    echo "Layer 1: Existence Check"
    echo "-------------------------"

    # Check required secrets
    echo "Required secrets:"
    check_secret "SOPS_AGE_KEY" "true"
    check_secret "CODECOV_TOKEN" "true"
    echo ""

    # Check optional secrets
    echo "Optional secrets:"
    check_secret "SNYK_TOKEN" "false"
    echo ""

    # Layer 2: Format Validation
    if is_ci; then
        echo "Layer 2: Format Validation"
        echo "-------------------------"
        echo "Format validation completed during existence check"
        echo ""
    else
        echo "Layer 2: Format Validation"
        echo "-------------------------"
        echo -e "${YELLOW}Skipped${NC} (only available in CI environment)"
        echo "Reason: Cannot access secret values locally without exposing them"
        echo ""
    fi

    # Layer 3: Functional Validation
    echo "Layer 3: Functional Validation"
    echo "-------------------------"
    echo -e "${YELLOW}Skipped${NC} (requires dedicated workflow)"
    echo "To run functional tests:"
    echo "  - SOPS_AGE_KEY: Test decryption with 'sops --decrypt .env.test.enc'"
    echo "  - CODECOV_TOKEN: Test API access via CI workflow"
    echo "  - SNYK_TOKEN: Test API access via security workflow"
    echo ""

    # Summary
    echo "=========================================="
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}All required secrets are configured!${NC}"

        if [ ${#MISSING_OPTIONAL[@]} -gt 0 ]; then
            echo ""
            echo -e "${YELLOW}Note:${NC} Optional secrets not configured:"
            for secret in "${MISSING_OPTIONAL[@]}"; do
                echo "  - $secret"
            done
        fi

        if [ ${#DEPRECATED_FOUND[@]} -gt 0 ]; then
            echo ""
            echo -e "${YELLOW}Warning:${NC} Deprecated secrets should be removed:"
            for secret in "${DEPRECATED_FOUND[@]}"; do
                echo "  - $secret (run: gh secret delete $secret)"
            done
        fi
    else
        echo -e "${RED}Secret validation failed${NC}"

        if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
            echo ""
            echo "Missing required secrets:"
            for secret in "${MISSING_REQUIRED[@]}"; do
                echo "  - $secret"
            done
        fi

        if [ ${#INVALID_FORMAT[@]} -gt 0 ]; then
            echo ""
            echo "Invalid format:"
            for secret in "${INVALID_FORMAT[@]}"; do
                echo "  - $secret"
            done
        fi

        echo ""
        echo "Setup guide: plan/github-secrets-verification.md"
        echo "Remediation steps: See plan/github-secrets-status.md"
        echo ""
        echo "Quick setup:"
        echo "  1. SOPS_AGE_KEY: gh secret set SOPS_AGE_KEY < ~/.config/sops/age/keys.txt"
        echo "  2. CODECOV_TOKEN: Get from https://codecov.io/ and run 'gh secret set CODECOV_TOKEN'"
        echo "  3. SNYK_TOKEN: Get from https://snyk.io/ and run 'gh secret set SNYK_TOKEN' (optional)"
    fi
    echo ""

    exit $EXIT_CODE
}

# Run main function
main
