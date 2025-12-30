# GitHub Secrets Verification Strategy

**Version**: 2.0.0
**Last Updated**: 2025-12-31
**Maintainer**: Birthday Message Scheduler Team
**Status**: ARCHITECT Implementation Plan

---

## Executive Summary

This document provides a comprehensive strategy for verifying GitHub secrets beyond simple existence checks. It includes format validation, CI/CD integration, automated remediation, and security best practices.

**Key Enhancements from v1.0**:
- ✅ Secret format validation (not just existence)
- ✅ Advanced CI/CD integration with fail-fast strategies
- ✅ Automated remediation workflows
- ✅ Secret health monitoring
- ✅ Proactive secret rotation tracking

---

## Table of Contents

1. [Overview](#overview)
2. [Secret Requirements Matrix](#secret-requirements-matrix)
3. [Verification Strategy](#verification-strategy)
4. [Format Validation](#format-validation)
5. [CI/CD Integration](#cicd-integration)
6. [Verification Script](#verification-script)
7. [Automated Remediation](#automated-remediation)
8. [Security Best Practices](#security-best-practices)
9. [Implementation Plan](#implementation-plan)

---

## Overview

### Problem Statement

From GAP Analysis Report (lines 202-213):
- Need to verify SOPS_AGE_KEY, CODECOV_TOKEN, SNYK_TOKEN
- Remove unused SLACK_WEBHOOK_URL
- Current validation only checks existence, not format/validity
- Secrets may fail silently in CI

### Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  GitHub Secrets Verification                │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐         ┌────▼────┐        ┌────▼────┐
   │ Existence│         │ Format  │        │Functional│
   │  Check   │────────▶│Validation│───────▶│  Test   │
   └─────────┘         └─────────┘        └─────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Remediation   │
                    │   Workflow     │
                    └────────────────┘
```

---

## Secret Requirements Matrix

### Current Secrets Inventory

| Secret Name | Required | Used By | Purpose | Validation Method | Failure Impact |
|-------------|----------|---------|---------|-------------------|----------------|
| `SOPS_AGE_KEY` | **YES** | CI, Performance, Mutation | Decrypt env files | Format + Functional | Workflow fails immediately |
| `CODECOV_TOKEN` | **YES** | CI (coverage-report) | Upload coverage | Format + API call | Coverage upload fails |
| `SNYK_TOKEN` | **NO** | CI, Security | Vulnerability scan | Format + API call | Scan skipped (graceful) |

### Deprecated Secrets

| Secret Name | Status | Action Required | Timeline |
|-------------|--------|-----------------|----------|
| `SLACK_WEBHOOK_URL` | ❌ Deprecated | Delete from GitHub | Immediate |

---

## Verification Strategy

### Three-Layer Verification

#### Layer 1: Existence Check
- ✅ Fast (< 1 second)
- ✅ No API rate limits
- ⚠️ Cannot detect invalid secrets

```bash
gh secret list | grep -q "^SECRET_NAME"
```

#### Layer 2: Format Validation
- ✅ Detects malformed secrets
- ✅ Fast (< 1 second)
- ⚠️ Cannot detect revoked/expired tokens

**Age Key Format**:
```regex
^AGE-SECRET-KEY-1[A-Z0-9]{58}$
```

**UUID Format (Codecov/Snyk)**:
```regex
^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$
```

#### Layer 3: Functional Validation
- ✅ Verifies secret actually works
- ⚠️ Slower (1-5 seconds)
- ⚠️ Subject to API rate limits

---

## Format Validation

### SOPS_AGE_KEY Validation

**Expected Format**:
```
# created: 2025-09-27T11:06:50+07:00
# public key: age1mxkhk7p4ngsl7yagkp0m2xa5ggzl2ppfgrfuadadsxdus8jcpugqsn9x5u
AGE-SECRET-KEY-1C4G73H4Z0KJLAFQN726VCPRNMGUD07WAJUMANX5SN5PHZXR5ZGZSNU2TW0
```

**Validation Rules**:
1. ✅ Contains 3 lines (2 comments + 1 key)
2. ✅ Line 1: `# created:` timestamp
3. ✅ Line 2: `# public key:` age1...
4. ✅ Line 3: `AGE-SECRET-KEY-1` followed by 58 uppercase alphanumeric chars
5. ✅ Total length of secret key line = 74 characters

**Validation Script**:
```bash
validate_age_key() {
    local key="$1"

    # Check line count
    local line_count=$(echo "$key" | wc -l)
    if [ "$line_count" -ne 3 ]; then
        echo "Invalid: Expected 3 lines, got $line_count"
        return 1
    fi

    # Extract secret key line (line 3)
    local secret_line=$(echo "$key" | sed -n '3p')

    # Check format
    if ! echo "$secret_line" | grep -qE '^AGE-SECRET-KEY-1[A-Z0-9]{58}$'; then
        echo "Invalid: Secret key format incorrect"
        return 1
    fi

    # Check public key line
    if ! echo "$key" | sed -n '2p' | grep -qE '^# public key: age1[a-z0-9]{58}$'; then
        echo "Invalid: Public key format incorrect"
        return 1
    fi

    echo "Valid age key format"
    return 0
}
```

### CODECOV_TOKEN Validation

**Expected Format**: UUID v4
```
12345678-1234-1234-1234-123456789abc
```

**Validation Script**:
```bash
validate_codecov_token() {
    local token="$1"

    # Check UUID format
    if ! echo "$token" | grep -qE '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'; then
        echo "Invalid: Not a valid UUID format"
        return 1
    fi

    echo "Valid Codecov token format"
    return 0
}
```

### SNYK_TOKEN Validation

**Expected Format**: UUID v4 or API token
```
12345678-1234-1234-1234-123456789abc
```

**Validation Script**:
```bash
validate_snyk_token() {
    local token="$1"

    # Check UUID format or API token format
    if ! echo "$token" | grep -qE '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'; then
        if ! echo "$token" | grep -qE '^[a-f0-9]{32,}$'; then
            echo "Invalid: Not a valid Snyk token format"
            return 1
        fi
    fi

    echo "Valid Snyk token format"
    return 0
}
```

---

## CI/CD Integration

### Strategy 1: Pre-Flight Validation (Recommended)

**Workflow**: `.github/workflows/secret-validation.yml`

```yaml
name: Secret Validation

on:
  schedule:
    # Run daily at 00:00 UTC
    - cron: '0 0 * * *'
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - '.github/workflows/**'

jobs:
  validate-secrets:
    name: Validate GitHub Secrets
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Validate SOPS_AGE_KEY format
        run: |
          echo "${{ secrets.SOPS_AGE_KEY }}" > /tmp/age-key.txt
          bash scripts/validate-secrets.sh age /tmp/age-key.txt
          rm -f /tmp/age-key.txt

      - name: Validate CODECOV_TOKEN format
        run: |
          echo "${{ secrets.CODECOV_TOKEN }}" | bash scripts/validate-secrets.sh codecov

      - name: Functional test - SOPS decrypt
        run: |
          # Setup SOPS
          mkdir -p ~/.config/sops/age
          echo "${{ secrets.SOPS_AGE_KEY }}" > ~/.config/sops/age/keys.txt
          chmod 600 ~/.config/sops/age/keys.txt

          # Install SOPS
          sudo wget -qO /usr/local/bin/sops \
            https://github.com/getsops/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64
          sudo chmod +x /usr/local/bin/sops

          # Test decryption
          if ! sops --decrypt .env.test.enc > /dev/null; then
            echo "❌ SOPS_AGE_KEY cannot decrypt test file"
            exit 1
          fi
          echo "✅ SOPS_AGE_KEY functional test passed"

      - name: Functional test - Codecov API
        if: secrets.CODECOV_TOKEN != ''
        run: |
          # Test Codecov token validity
          response=$(curl -s -w "%{http_code}" -H "Authorization: token ${{ secrets.CODECOV_TOKEN }}" \
            https://codecov.io/api/gh/fairyhunter13/happy-bday-app)

          if [ "$response" -eq 401 ] || [ "$response" -eq 403 ]; then
            echo "❌ CODECOV_TOKEN is invalid or expired"
            exit 1
          fi
          echo "✅ CODECOV_TOKEN functional test passed"

      - name: Notify on failure
        if: failure()
        run: |
          echo "::error::Secret validation failed. Check secrets in repository settings."
          echo "::error::Go to: https://github.com/${{ github.repository }}/settings/secrets/actions"
```

### Strategy 2: Fail-Fast in Workflows

**Add to existing workflows** (`.github/workflows/ci.yml`):

```yaml
jobs:
  validate-secrets:
    name: Validate Secrets
    runs-on: ubuntu-latest
    timeout-minutes: 2

    steps:
      - name: Check SOPS_AGE_KEY exists
        run: |
          if [ -z "${{ secrets.SOPS_AGE_KEY }}" ]; then
            echo "::error::SOPS_AGE_KEY secret is not set"
            echo "::error::Configure at: https://github.com/${{ github.repository }}/settings/secrets/actions"
            exit 1
          fi

      - name: Validate SOPS_AGE_KEY format
        run: |
          key="${{ secrets.SOPS_AGE_KEY }}"
          if ! echo "$key" | grep -qE 'AGE-SECRET-KEY-1[A-Z0-9]{58}'; then
            echo "::error::SOPS_AGE_KEY has invalid format"
            exit 1
          fi
          echo "✅ SOPS_AGE_KEY format valid"

  unit-tests:
    needs: validate-secrets  # Fail-fast: don't run tests if secrets invalid
    # ... rest of job
```

### Strategy 3: Dependency Graph Integration

```yaml
# .github/workflows/ci.yml
jobs:
  # Secrets validation runs first
  validate-secrets:
    name: Validate Secrets
    runs-on: ubuntu-latest
    outputs:
      sops-valid: ${{ steps.validate.outputs.sops-valid }}
      codecov-valid: ${{ steps.validate.outputs.codecov-valid }}
    steps:
      - id: validate
        run: |
          # Validation logic
          echo "sops-valid=true" >> $GITHUB_OUTPUT
          echo "codecov-valid=true" >> $GITHUB_OUTPUT

  # All other jobs depend on validation
  unit-tests:
    needs: validate-secrets
    if: needs.validate-secrets.outputs.sops-valid == 'true'
    # ... rest of job

  coverage-report:
    needs: validate-secrets
    if: needs.validate-secrets.outputs.codecov-valid == 'true'
    # ... rest of job
```

---

## Verification Script

### Enhanced `scripts/validate-secrets.sh`

**New comprehensive validation script**:

```bash
#!/bin/bash
# GitHub Secrets Format Validation Script
# Purpose: Validate secret format before CI/CD usage
# Usage: ./scripts/validate-secrets.sh <secret-type> [secret-value-or-file]
# Exit codes: 0 = valid, 1 = invalid

set -e

SECRET_TYPE="$1"
SECRET_INPUT="$2"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Read secret from file or stdin
read_secret() {
    if [ -f "$SECRET_INPUT" ]; then
        cat "$SECRET_INPUT"
    elif [ -n "$SECRET_INPUT" ]; then
        echo "$SECRET_INPUT"
    else
        cat  # Read from stdin
    fi
}

# Validate age key format
validate_age_key() {
    local key="$1"
    local errors=0

    echo "Validating SOPS_AGE_KEY format..."

    # Check line count
    local line_count=$(echo "$key" | wc -l | tr -d ' ')
    if [ "$line_count" -ne 3 ]; then
        echo -e "${RED}✗ Invalid line count: expected 3, got $line_count${NC}"
        ((errors++))
    else
        echo -e "${GREEN}✓ Correct line count (3)${NC}"
    fi

    # Check created timestamp line
    if echo "$key" | sed -n '1p' | grep -qE '^# created: [0-9]{4}-[0-9]{2}-[0-9]{2}'; then
        echo -e "${GREEN}✓ Created timestamp present${NC}"
    else
        echo -e "${RED}✗ Missing or invalid created timestamp${NC}"
        ((errors++))
    fi

    # Check public key line
    if echo "$key" | sed -n '2p' | grep -qE '^# public key: age1[a-z0-9]{58}$'; then
        echo -e "${GREEN}✓ Public key format valid${NC}"
    else
        echo -e "${RED}✗ Invalid public key format${NC}"
        ((errors++))
    fi

    # Check secret key line
    local secret_line=$(echo "$key" | sed -n '3p')
    if echo "$secret_line" | grep -qE '^AGE-SECRET-KEY-1[A-Z0-9]{58}$'; then
        echo -e "${GREEN}✓ Secret key format valid${NC}"
    else
        echo -e "${RED}✗ Invalid secret key format${NC}"
        echo "  Expected: AGE-SECRET-KEY-1 followed by 58 uppercase alphanumeric characters"
        echo "  Got: $secret_line"
        ((errors++))
    fi

    # Check key length
    local key_length=$(echo "$secret_line" | wc -c | tr -d ' ')
    if [ "$key_length" -eq 75 ]; then  # 74 + newline
        echo -e "${GREEN}✓ Secret key length correct (74 chars)${NC}"
    else
        echo -e "${RED}✗ Invalid secret key length: expected 74, got $((key_length - 1))${NC}"
        ((errors++))
    fi

    if [ $errors -eq 0 ]; then
        echo -e "${GREEN}✅ SOPS_AGE_KEY validation passed${NC}"
        return 0
    else
        echo -e "${RED}❌ SOPS_AGE_KEY validation failed ($errors errors)${NC}"
        return 1
    fi
}

# Validate UUID format (Codecov, Snyk)
validate_uuid() {
    local token="$1"
    local name="$2"

    echo "Validating $name format..."

    # Trim whitespace
    token=$(echo "$token" | tr -d '[:space:]')

    # Check UUID v4 format
    if echo "$token" | grep -qE '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'; then
        echo -e "${GREEN}✓ Valid UUID v4 format${NC}"
        echo -e "${GREEN}✅ $name validation passed${NC}"
        return 0
    fi

    # Check generic UUID format
    if echo "$token" | grep -qE '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'; then
        echo -e "${YELLOW}⚠ Valid UUID format (not strictly v4)${NC}"
        echo -e "${GREEN}✅ $name validation passed${NC}"
        return 0
    fi

    # Check alternative token format (long hex string)
    if echo "$token" | grep -qE '^[a-f0-9]{32,}$'; then
        echo -e "${YELLOW}⚠ Valid token format (hex string)${NC}"
        echo -e "${GREEN}✅ $name validation passed${NC}"
        return 0
    fi

    echo -e "${RED}✗ Invalid token format${NC}"
    echo "  Expected: UUID (12345678-1234-1234-1234-123456789abc)"
    echo "  Got: ${token:0:20}... (${#token} chars)"
    echo -e "${RED}❌ $name validation failed${NC}"
    return 1
}

# Main validation logic
main() {
    if [ -z "$SECRET_TYPE" ]; then
        echo "Usage: $0 <age|codecov|snyk> [secret-value-or-file]"
        echo ""
        echo "Examples:"
        echo "  $0 age ~/.config/sops/age/keys.txt"
        echo "  $0 codecov 12345678-1234-1234-1234-123456789abc"
        echo "  echo \"\$SECRET\" | $0 age"
        exit 1
    fi

    local secret=$(read_secret)

    case "$SECRET_TYPE" in
        age|sops)
            validate_age_key "$secret"
            ;;
        codecov)
            validate_uuid "$secret" "CODECOV_TOKEN"
            ;;
        snyk)
            validate_uuid "$secret" "SNYK_TOKEN"
            ;;
        *)
            echo "Unknown secret type: $SECRET_TYPE"
            echo "Supported: age, codecov, snyk"
            exit 1
            ;;
    esac
}

main "$@"
```

**Make executable**:
```bash
chmod +x scripts/validate-secrets.sh
```

### Updated `scripts/verify-github-secrets.sh`

**Enhance existing script with format validation**:

```bash
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
EXIT_CODE=0

echo "🔐 GitHub Secrets Verification (Enhanced)"
echo "=========================================="
echo ""

# Function to check if running in CI
is_ci() {
    [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]
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

# Function to validate secret format in CI
validate_secret_format() {
    local secret_name=$1
    local secret_value="$2"

    case "$secret_name" in
        SOPS_AGE_KEY)
            echo "$secret_value" | bash scripts/validate-secrets.sh age > /dev/null 2>&1
            ;;
        CODECOV_TOKEN)
            echo "$secret_value" | bash scripts/validate-secrets.sh codecov > /dev/null 2>&1
            ;;
        SNYK_TOKEN)
            echo "$secret_value" | bash scripts/validate-secrets.sh snyk > /dev/null 2>&1
            ;;
        *)
            return 1
            ;;
    esac
}

# Function to check and validate secret
check_secret() {
    local secret_name=$1
    local required=$2

    if ! check_secret_exists "$secret_name"; then
        if [ "$required" = "true" ]; then
            echo -e "${RED}✗${NC} $secret_name is ${RED}missing${NC}"
            MISSING_REQUIRED+=("$secret_name")
            EXIT_CODE=1
        else
            echo -e "${YELLOW}~${NC} $secret_name is not configured ${YELLOW}(optional)${NC}"
            MISSING_OPTIONAL+=("$secret_name")
        fi
        return 1
    fi

    # If in CI, validate format
    if is_ci && [ -n "$VALIDATE_FORMAT" ]; then
        local secret_value
        case "$secret_name" in
            SOPS_AGE_KEY) secret_value="$SOPS_AGE_KEY" ;;
            CODECOV_TOKEN) secret_value="$CODECOV_TOKEN" ;;
            SNYK_TOKEN) secret_value="$SNYK_TOKEN" ;;
        esac

        if ! validate_secret_format "$secret_name" "$secret_value"; then
            echo -e "${RED}✗${NC} $secret_name ${RED}has invalid format${NC}"
            INVALID_FORMAT+=("$secret_name")
            EXIT_CODE=1
            return 1
        fi
        echo -e "${GREEN}✓${NC} $secret_name is configured and valid"
    else
        echo -e "${GREEN}✓${NC} $secret_name is configured"
    fi

    return 0
}

# Main verification
main() {
    # Check prerequisites (only locally)
    if ! is_ci; then
        if ! command -v gh &> /dev/null; then
            echo -e "${RED}❌ gh CLI not found${NC}"
            echo "Install: brew install gh (macOS) or https://cli.github.com"
            exit 1
        fi

        if ! gh auth status &> /dev/null; then
            echo -e "${RED}❌ Not authenticated with GitHub${NC}"
            echo "Run: gh auth login"
            exit 1
        fi
        echo -e "${GREEN}✓${NC} gh CLI authenticated"
        echo ""
    fi

    # Check required secrets
    echo "Checking required secrets..."
    check_secret "SOPS_AGE_KEY" "true"
    check_secret "CODECOV_TOKEN" "true"
    echo ""

    # Check optional secrets
    echo "Checking optional secrets..."
    check_secret "SNYK_TOKEN" "false"
    echo ""

    # Summary
    echo "=========================================="
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ All required secrets are configured!${NC}"

        if [ ${#MISSING_OPTIONAL[@]} -gt 0 ]; then
            echo ""
            echo -e "${YELLOW}Note:${NC} Optional secrets not configured:"
            for secret in "${MISSING_OPTIONAL[@]}"; do
                echo "  - $secret"
            done
        fi
    else
        echo -e "${RED}❌ Secret validation failed${NC}"

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
        echo "📖 Setup guide: plan/github-secrets-verification.md"
        echo "🔧 Setup script: scripts/setup-github-secrets.sh"
        echo "✅ Validation script: scripts/validate-secrets.sh"
    fi
    echo ""

    exit $EXIT_CODE
}

# Run main
main
```

---

## Automated Remediation

### Self-Service Remediation Workflow

**`.github/workflows/secret-remediation.yml`**:

```yaml
name: Secret Remediation Assistant

on:
  workflow_dispatch:
    inputs:
      secret_name:
        description: 'Which secret needs remediation?'
        required: true
        type: choice
        options:
          - SOPS_AGE_KEY
          - CODECOV_TOKEN
          - SNYK_TOKEN
      issue_type:
        description: 'What is the issue?'
        required: true
        type: choice
        options:
          - missing
          - invalid_format
          - expired
          - rotation_needed

jobs:
  remediation-guide:
    name: Generate Remediation Guide
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Generate remediation instructions
        run: |
          SECRET="${{ inputs.secret_name }}"
          ISSUE="${{ inputs.issue_type }}"

          echo "# Secret Remediation Guide" > remediation.md
          echo "" >> remediation.md
          echo "**Secret**: \`$SECRET\`" >> remediation.md
          echo "**Issue**: $ISSUE" >> remediation.md
          echo "" >> remediation.md

          case "$SECRET" in
            SOPS_AGE_KEY)
              cat >> remediation.md <<'EOF'
## Steps to Fix SOPS_AGE_KEY

### 1. Verify age key exists locally
```bash
cat ~/.config/sops/age/keys.txt
```

### 2. If missing, generate new key
```bash
brew install age
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
chmod 600 ~/.config/sops/age/keys.txt
```

### 3. Update GitHub secret
```bash
gh secret set SOPS_AGE_KEY < ~/.config/sops/age/keys.txt
```

### 4. Update .sops.yaml with new public key
```bash
cat ~/.config/sops/age/keys.txt | grep "public key:" | awk '{print $NF}'
# Update .sops.yaml with this public key
```

### 5. Re-encrypt all .env files
```bash
bash scripts/sops/encrypt-all.sh
```

### 6. Verify
```bash
./scripts/verify-github-secrets.sh
```
EOF
              ;;

            CODECOV_TOKEN)
              cat >> remediation.md <<'EOF'
## Steps to Fix CODECOV_TOKEN

### 1. Get token from Codecov
1. Go to https://codecov.io/
2. Login with GitHub
3. Select repository: fairyhunter13/happy-bday-app
4. Go to Settings → General
5. Copy "Repository Upload Token"

### 2. Set GitHub secret
```bash
gh secret set CODECOV_TOKEN
# Paste token when prompted
```

### 3. Verify
```bash
./scripts/verify-github-secrets.sh
```

### 4. Test in CI
Push a commit and verify coverage upload succeeds.
EOF
              ;;

            SNYK_TOKEN)
              cat >> remediation.md <<'EOF'
## Steps to Fix SNYK_TOKEN (Optional)

### 1. Get token from Snyk
1. Go to https://snyk.io/
2. Login/sign up
3. Go to Account Settings
4. Copy API Token

### 2. Set GitHub secret
```bash
gh secret set SNYK_TOKEN
# Paste token when prompted
```

### 3. Verify
```bash
./scripts/verify-github-secrets.sh
```
EOF
              ;;
          esac

      - name: Upload remediation guide
        uses: actions/upload-artifact@v4
        with:
          name: remediation-guide
          path: remediation.md

      - name: Display instructions
        run: cat remediation.md
```

### Proactive Secret Health Monitoring

**`.github/workflows/secret-health.yml`**:

```yaml
name: Secret Health Check

on:
  schedule:
    # Run weekly on Monday at 09:00 UTC
    - cron: '0 9 * * 1'
  workflow_dispatch:

jobs:
  health-check:
    name: Check Secret Health
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Check secret age
        id: secret-age
        run: |
          # Get secret update times via gh API
          SECRETS=$(gh api repos/${{ github.repository }}/actions/secrets --jq '.secrets[] | {name: .name, updated_at: .updated_at}')

          echo "$SECRETS" > secrets.json

          # Check for secrets older than 90 days
          NINETY_DAYS_AGO=$(date -d '90 days ago' -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -v-90d -u +%Y-%m-%dT%H:%M:%SZ)

          OLD_SECRETS=$(echo "$SECRETS" | jq -r "select(.updated_at < \"$NINETY_DAYS_AGO\") | .name")

          if [ -n "$OLD_SECRETS" ]; then
            echo "::warning::Secrets needing rotation: $OLD_SECRETS"
            echo "old-secrets=$OLD_SECRETS" >> $GITHUB_OUTPUT
          fi
        env:
          GH_TOKEN: ${{ github.token }}

      - name: Create rotation reminder issue
        if: steps.secret-age.outputs.old-secrets != ''
        uses: actions/github-script@v7
        with:
          script: |
            const oldSecrets = '${{ steps.secret-age.outputs.old-secrets }}';

            const issue = await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🔐 Secret Rotation Reminder',
              body: `## Secrets Need Rotation

The following secrets have not been updated in over 90 days:

${oldSecrets.split('\n').map(s => `- \`${s}\``).join('\n')}

**Action Required**: Rotate these secrets following the guide in \`plan/github-secrets-verification.md\`

**Remediation Workflow**: [Run Secret Remediation](https://github.com/${context.repo.owner}/${context.repo.repo}/actions/workflows/secret-remediation.yml)
              `,
              labels: ['security', 'maintenance']
            });
```

---

## Security Best Practices

### Secret Lifecycle Management

```
┌─────────────┐
│  Creation   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Validation  │ ◄─── Format + Functional checks
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Storage   │ ◄─── GitHub Secrets (encrypted)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Usage    │ ◄─── CI/CD workflows only
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Rotation   │ ◄─── Every 90 days
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Revocation  │ ◄─── When compromised
└─────────────┘
```

### DO's

✅ **Rotate secrets every 90 days**
```bash
# Set calendar reminder
# Use automated health check workflow
```

✅ **Use separate secrets for different environments**
```yaml
# Development
SOPS_AGE_KEY_DEV

# Production
SOPS_AGE_KEY_PROD
```

✅ **Validate secrets before use**
```yaml
- name: Validate before use
  run: ./scripts/validate-secrets.sh age
```

✅ **Monitor secret usage in workflows**
```bash
grep -r "secrets\." .github/workflows/
```

✅ **Use minimal permissions**
```yaml
permissions:
  contents: read
  secrets: read  # Only if needed
```

### DON'Ts

❌ **Never commit secrets** (even encrypted)
- ✅ `.env.test.enc` (SOPS-encrypted) - OK
- ❌ `.env.test` (plaintext) - NEVER

❌ **Never log secret values**
```yaml
# BAD
- run: echo "${{ secrets.SOPS_AGE_KEY }}"

# GOOD
- run: |
    if [ -z "${{ secrets.SOPS_AGE_KEY }}" ]; then
      echo "Secret missing"
    fi
```

❌ **Never share secrets over insecure channels**
- ❌ Slack, email, SMS
- ✅ 1Password, HashiCorp Vault, encrypted email

❌ **Never use production secrets in CI**
- Use test/staging credentials only
- Production secrets → production environment only

---

## Implementation Plan

### Phase 1: Enhanced Validation (Week 1)

**Priority**: HIGH
**Estimated Time**: 4 hours

#### Tasks

1. **Create validation script** ✅
   ```bash
   # Create scripts/validate-secrets.sh
   # Implement format validation for all secret types
   # Add functional tests (SOPS decrypt, API calls)
   ```
   - **Deliverable**: `scripts/validate-secrets.sh`
   - **Testing**: Test with valid/invalid secrets locally

2. **Update verification script** ✅
   ```bash
   # Enhance scripts/verify-github-secrets.sh
   # Add format validation integration
   # Improve error messages
   ```
   - **Deliverable**: Enhanced `scripts/verify-github-secrets.sh`
   - **Testing**: Run in local environment

3. **Update setup script** ✅
   ```bash
   # Update scripts/setup-github-secrets.sh
   # Add validation step after setting secrets
   ```
   - **Deliverable**: Enhanced `scripts/setup-github-secrets.sh`
   - **Testing**: Test secret setup flow

#### Acceptance Criteria

- ✅ Format validation for all 3 secret types
- ✅ Clear error messages for invalid formats
- ✅ Scripts work in both local and CI environments
- ✅ Exit codes properly indicate success/failure

---

### Phase 2: CI/CD Integration (Week 1)

**Priority**: HIGH
**Estimated Time**: 3 hours

#### Tasks

1. **Create secret validation workflow** ✅
   ```yaml
   # Create .github/workflows/secret-validation.yml
   # Daily scheduled validation
   # Pre-flight checks before test runs
   ```
   - **Deliverable**: `.github/workflows/secret-validation.yml`
   - **Testing**: Trigger workflow manually

2. **Update existing workflows** ✅
   ```yaml
   # Add validation job to ci.yml
   # Make test jobs depend on validation
   # Add fail-fast strategy
   ```
   - **Deliverable**: Updated `.github/workflows/ci.yml`
   - **Testing**: Verify dependency graph works

3. **Add secret health monitoring** ✅
   ```yaml
   # Create .github/workflows/secret-health.yml
   # Weekly secret age checks
   # Auto-create rotation reminder issues
   ```
   - **Deliverable**: `.github/workflows/secret-health.yml`
   - **Testing**: Run workflow manually

#### Acceptance Criteria

- ✅ Secrets validated before every CI run
- ✅ Invalid secrets cause immediate workflow failure
- ✅ Weekly health checks create issues for old secrets
- ✅ Clear notifications when secrets need attention

---

### Phase 3: Remediation Automation (Week 2)

**Priority**: MEDIUM
**Estimated Time**: 2 hours

#### Tasks

1. **Create remediation workflow** ✅
   ```yaml
   # Create .github/workflows/secret-remediation.yml
   # Interactive workflow for guided fixes
   # Generate remediation guides
   ```
   - **Deliverable**: `.github/workflows/secret-remediation.yml`
   - **Testing**: Test all remediation scenarios

2. **Create remediation documentation** ✅
   ```markdown
   # Update this document with remediation steps
   # Add troubleshooting guides
   # Include common error scenarios
   ```
   - **Deliverable**: Enhanced documentation
   - **Testing**: Follow guide to fix test secrets

#### Acceptance Criteria

- ✅ Self-service remediation for all secret types
- ✅ Clear step-by-step instructions
- ✅ Automated generation of remediation guides
- ✅ Integration with GitHub Issues for tracking

---

### Phase 4: Documentation & Training (Week 2)

**Priority**: MEDIUM
**Estimated Time**: 2 hours

#### Tasks

1. **Update documentation** ✅
   ```markdown
   # Update README.md with secret validation info
   # Update DEVELOPER_SETUP.md
   # Create SECURITY.md if missing
   ```
   - **Deliverable**: Updated documentation
   - **Testing**: New developer onboarding test

2. **Create runbook** ✅
   ```markdown
   # Secret rotation procedures
   # Incident response for compromised secrets
   # Emergency recovery procedures
   ```
   - **Deliverable**: Operations runbook
   - **Testing**: Walkthrough with team

#### Acceptance Criteria

- ✅ Complete documentation for all secret operations
- ✅ Clear runbook for common scenarios
- ✅ Training materials for new developers
- ✅ Emergency procedures documented

---

### Phase 5: Cleanup (Week 2)

**Priority**: LOW
**Estimated Time**: 1 hour

#### Tasks

1. **Remove deprecated secrets** ✅
   ```bash
   # Delete SLACK_WEBHOOK_URL if exists
   gh secret delete SLACK_WEBHOOK_URL

   # Remove references from workflows
   grep -r "SLACK_WEBHOOK" .github/workflows/
   ```
   - **Deliverable**: Clean secret inventory
   - **Testing**: Verify no broken workflows

2. **Audit secret usage** ✅
   ```bash
   # Verify all secrets are used
   # Remove unused secrets
   # Document secret purposes
   ```
   - **Deliverable**: Secret usage audit report
   - **Testing**: Cross-reference with workflows

#### Acceptance Criteria

- ✅ No deprecated secrets in GitHub
- ✅ All secrets have documented purposes
- ✅ No broken references in workflows
- ✅ Clean secret inventory

---

## Implementation Checklist

### Prerequisites
- [ ] gh CLI installed and authenticated
- [ ] SOPS and age installed locally
- [ ] Access to GitHub repository settings
- [ ] Test environment for validation

### Week 1: Core Implementation
- [ ] Create `scripts/validate-secrets.sh`
- [ ] Test validation script with all secret types
- [ ] Update `scripts/verify-github-secrets.sh`
- [ ] Update `scripts/setup-github-secrets.sh`
- [ ] Create `.github/workflows/secret-validation.yml`
- [ ] Update `.github/workflows/ci.yml` with fail-fast validation
- [ ] Create `.github/workflows/secret-health.yml`
- [ ] Test all workflows in CI environment

### Week 2: Automation & Documentation
- [ ] Create `.github/workflows/secret-remediation.yml`
- [ ] Test remediation workflow for all scenarios
- [ ] Update README.md
- [ ] Update DEVELOPER_SETUP.md
- [ ] Create operations runbook
- [ ] Delete SLACK_WEBHOOK_URL secret (if exists)
- [ ] Audit and document all secret usage
- [ ] Final testing and verification

### Validation
- [ ] All tests pass with valid secrets
- [ ] Invalid secrets trigger clear error messages
- [ ] Remediation workflows generate correct guides
- [ ] Health monitoring creates rotation reminders
- [ ] Documentation is complete and accurate

---

## Quick Reference

### Validation Commands

```bash
# Validate age key
./scripts/validate-secrets.sh age ~/.config/sops/age/keys.txt

# Validate Codecov token
echo "12345678-1234-1234-1234-123456789abc" | ./scripts/validate-secrets.sh codecov

# Verify all secrets
./scripts/verify-github-secrets.sh

# Setup all secrets
./scripts/setup-github-secrets.sh
```

### Secret Setup Commands

```bash
# SOPS_AGE_KEY
gh secret set SOPS_AGE_KEY < ~/.config/sops/age/keys.txt

# CODECOV_TOKEN
gh secret set CODECOV_TOKEN  # Interactive prompt

# SNYK_TOKEN
gh secret set SNYK_TOKEN  # Interactive prompt

# List secrets
gh secret list

# Delete secret
gh secret delete SECRET_NAME
```

### Troubleshooting Commands

```bash
# Check secret exists
gh secret list | grep SOPS_AGE_KEY

# Test SOPS decryption
sops --decrypt .env.test.enc > /tmp/test.env
rm /tmp/test.env

# Test Codecov API
curl -H "Authorization: token YOUR_TOKEN" https://codecov.io/api/gh/USER/REPO

# Run remediation workflow
gh workflow run secret-remediation.yml
```

---

## Support

- **Documentation**: [`plan/github-secrets-verification.md`](github-secrets-verification.md) (this file)
- **Setup Script**: [`scripts/setup-github-secrets.sh`](../scripts/setup-github-secrets.sh)
- **Verification Script**: [`scripts/verify-github-secrets.sh`](../scripts/verify-github-secrets.sh)
- **Validation Script**: [`scripts/validate-secrets.sh`](../scripts/validate-secrets.sh)
- **SOPS Scripts**: [`scripts/sops/`](../scripts/sops/)

---

## Official Documentation

### GitHub
- [Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [gh secret command](https://cli.github.com/manual/gh_secret)

### SOPS
- [SOPS GitHub](https://github.com/getsops/sops)
- [age encryption](https://github.com/FiloSottile/age)

### Third-Party Services
- [Codecov Tokens](https://docs.codecov.com/docs/quick-start)
- [Snyk API](https://docs.snyk.io/snyk-api-info/authentication-for-api)

---

**Document Version**: 2.0.0
**Last Updated**: 2025-12-31
**Next Review**: 2026-01-31
**Owner**: ARCHITECT Agent / Hive Mind
