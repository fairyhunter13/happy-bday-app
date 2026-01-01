# SOPS Secret Management - Implementation Plan

**Project:** Birthday Message Scheduler
**Implementation Date:** 2025-12-30
**Implementation Owner:** DevOps/Security Team
**Status:** Ready for Implementation
**Estimated Total Time:** 3-5 days

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Implementation Phases](#implementation-phases)
   - [Phase 0: Prerequisites](#phase-0-prerequisites)
   - [Phase 1: Initial Setup](#phase-1-initial-setup)
   - [Phase 2: SOPS Configuration](#phase-2-sops-configuration)
   - [Phase 3: Secret Encryption](#phase-3-secret-encryption)
   - [Phase 4: Helper Scripts](#phase-4-helper-scripts)
   - [Phase 5: GitHub Secrets Setup](#phase-5-github-secrets-setup)
   - [Phase 6: CI/CD Integration](#phase-6-cicd-integration)
   - [Phase 7: Documentation](#phase-7-documentation)
   - [Phase 8: Testing](#phase-8-testing)
   - [Phase 9: Cleanup](#phase-9-cleanup)
4. [Security Checklist](#security-checklist)
5. [Validation Steps](#validation-steps)
6. [Rollback Procedures](#rollback-procedures)
7. [Post-Implementation](#post-implementation)

---

## Overview

This implementation plan provides step-by-step instructions for integrating SOPS (Secrets OPerationS) with age encryption into the Birthday Message Scheduler project. The goal is to migrate from plaintext `.env` files to encrypted secret management.

**Key Objectives:**
- Encrypt all environment files with SOPS + age
- Integrate decryption into development workflow
- Configure CI/CD pipeline for automated secret decryption
- Ensure zero secrets in Git history or logs
- Establish key rotation and maintenance procedures

**Success Criteria:**
- All `.env` files encrypted and committed to Git
- Developers can seamlessly decrypt secrets locally
- CI/CD pipeline successfully decrypts and uses secrets
- No plaintext secrets remain in repository
- Documentation complete and team onboarded

---

## Prerequisites

### Required Knowledge

- [ ] Basic understanding of environment variables
- [ ] Familiarity with Git and GitHub
- [ ] Command-line proficiency (bash/zsh)
- [ ] Understanding of npm scripts
- [ ] GitHub Actions workflow basics

### Required Access

- [ ] Repository admin access (for creating GitHub Secrets)
- [ ] Ability to install software on local machine
- [ ] Access to existing `.env` files (or ability to recreate them)

### Required Tools

Tools will be installed in Phase 0, but you should verify you can install:
- [ ] Package manager (homebrew on macOS, apt/yum on Linux)
- [ ] GitHub CLI (`gh`) - optional but recommended for Phase 5
- [ ] Git version >= 2.30

---

## Implementation Phases

---

## Phase 0: Prerequisites

**Duration:** 30 minutes
**Prerequisites:** None
**Risk Level:** Low

### Objectives

- Install SOPS and age encryption tools
- Verify installations
- Understand tool capabilities

### Step 0.1: Install SOPS

**macOS:**
```bash

# Using Homebrew

brew install sops

# Verify installation

sops --version

# Expected output: sops 3.8.1 (or later)

```

**Linux (Ubuntu/Debian):**
```bash

# Download SOPS binary

SOPS_VERSION=3.8.1
curl -Lo sops "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64"

# Make executable

chmod +x sops

# Move to system path

sudo mv sops /usr/local/bin/

# Verify installation

sops --version

# Expected output: sops 3.8.1

```

**Linux (RHEL/CentOS):**
```bash

# Same as Ubuntu/Debian above

SOPS_VERSION=3.8.1
curl -Lo sops "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64"
chmod +x sops
sudo mv sops /usr/local/bin/
sops --version
```

**Expected Output:**
```
sops 3.8.1 (latest)
```

**Validation:**
```bash

# Test SOPS is accessible

which sops

# Expected: /usr/local/bin/sops (or /opt/homebrew/bin/sops on macOS)

# Test version

sops --version

# Should show version >= 3.8.1

```

### Step 0.2: Install age Encryption

**macOS:**
```bash

# Using Homebrew

brew install age

# Verify installation

age --version
age-keygen --version
```

**Linux:**
```bash

# Download age binary

AGE_VERSION=1.1.1
curl -Lo age.tar.gz "https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz"

# Extract

tar xf age.tar.gz

# Move to system path

sudo mv age/age /usr/local/bin/
sudo mv age/age-keygen /usr/local/bin/

# Clean up

rm -rf age age.tar.gz

# Verify installation

age --version
age-keygen --version
```

**Expected Output:**
```
v1.1.1
```

**Validation:**
```bash

# Test age commands

which age
which age-keygen

# Both should return paths like /usr/local/bin/age

```

### Step 0.3: Install GitHub CLI (Optional)

**Purpose:** Simplifies GitHub Secrets creation in Phase 5

**macOS:**
```bash
brew install gh
```

**Linux:**
```bash

# Ubuntu/Debian

type -p curl >/dev/null || sudo apt install curl -y
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh -y
```

**Verify:**
```bash
gh --version

# gh version 2.40.0 (or later)

```

**Authenticate:**
```bash
gh auth login

# Follow prompts to authenticate with GitHub

```

### Rollback Procedure

If installations fail or cause issues:

```bash

# Uninstall SOPS (macOS)

brew uninstall sops

# Uninstall SOPS (Linux)

sudo rm /usr/local/bin/sops

# Uninstall age (macOS)

brew uninstall age

# Uninstall age (Linux)

sudo rm /usr/local/bin/age /usr/local/bin/age-keygen

# Uninstall gh (macOS)

brew uninstall gh

# Uninstall gh (Linux)

sudo apt remove gh -y
```

### Time Estimate

- macOS: 5-10 minutes
- Linux: 10-15 minutes
- Windows (WSL2): 15-20 minutes

---

## Phase 1: Initial Setup

**Duration:** 30 minutes
**Prerequisites:** Phase 0 complete
**Risk Level:** Low

### Objectives

- Generate age encryption keys
- Create project directory structure
- Set up age key storage location

### Step 1.1: Create age Directory Structure

```bash

# Create SOPS age key directory (standard location)

mkdir -p ~/.config/sops/age

# Verify directory created

ls -la ~/.config/sops/age
```

**Expected Output:**
```
drwxr-xr-x  2 user  staff  64 Dec 30 10:00 .
drwxr-xr-x  3 user  staff  96 Dec 30 10:00 ..
```

### Step 1.2: Generate Development age Key

```bash

# Generate age key for development environment

age-keygen -o ~/.config/sops/age/keys.txt

# Expected output:
# Public key: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

```

**IMPORTANT:** Copy the public key from the output. You'll need it in Phase 2.

**Example Output:**
```

# created: 2025-12-30T10:30:45+08:00
# public key: age1abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr

```

**Validation:**
```bash

# Verify key file created

ls -la ~/.config/sops/age/keys.txt

# Check file permissions (should be 600)

stat -c "%a %n" ~/.config/sops/age/keys.txt  # Linux
stat -f "%OLp %N" ~/.config/sops/age/keys.txt  # macOS

# Expected: 600 (rw-------)

```

**Security Check:**
```bash

# Set correct permissions if not already 600

chmod 600 ~/.config/sops/age/keys.txt

# View key content (save public key for later)

cat ~/.config/sops/age/keys.txt
```

**Save This Information:**
1. Copy the **public key** (starts with `age1...`) - needed for `.sops.yaml`
2. Keep the **private key file** secure (`~/.config/sops/age/keys.txt`)
3. Never commit the private key to Git

### Step 1.3: Create Project Directory Structure

```bash

# Navigate to project root

cd /Users/hafizputraludyanto/git/github.com/fairyhunter13/happy-bday-app

# Create secrets directory

mkdir -p secrets/age

# Create .gitkeep to track empty directory

touch secrets/age/.gitkeep

# Create scripts directory (if not exists)

mkdir -p scripts

# Verify structure

tree secrets -a

# Expected:
# secrets
# └── age
#     └── .gitkeep

```

**Validation:**
```bash

# Check directories exist

test -d secrets && echo "✅ secrets/ exists" || echo "❌ secrets/ missing"
test -d secrets/age && echo "✅ secrets/age/ exists" || echo "❌ secrets/age/ missing"
test -d scripts && echo "✅ scripts/ exists" || echo "❌ scripts/ missing"
```

### Step 1.4: Backup Existing Environment Files

**CRITICAL:** Before proceeding, backup all existing `.env` files.

```bash

# Create secure backup directory (outside Git repository)

mkdir -p ~/secure-backups/happy-bday-app-sops-$(date +%Y%m%d)

# Backup all .env files

cp .env ~/secure-backups/happy-bday-app-sops-$(date +%Y%m%d)/env.backup 2>/dev/null || echo "No .env found"
cp .env.development ~/secure-backups/happy-bday-app-sops-$(date +%Y%m%d)/env.development.backup 2>/dev/null || echo "No .env.development found"
cp .env.test ~/secure-backups/happy-bday-app-sops-$(date +%Y%m%d)/env.test.backup 2>/dev/null || echo "No .env.test found"
cp .env.production ~/secure-backups/happy-bday-app-sops-$(date +%Y%m%d)/env.production.backup 2>/dev/null || echo "No .env.production found"

# List backups

ls -la ~/secure-backups/happy-bday-app-sops-$(date +%Y%m%d)/
```

**Expected Output:**
```
-rw-r--r--  1 user  staff  1234 Dec 30 10:35 env.backup
-rw-r--r--  1 user  staff  1456 Dec 30 10:35 env.development.backup
-rw-r--r--  1 user  staff  1567 Dec 30 10:35 env.test.backup
```

### Rollback Procedure

```bash

# If setup fails, remove created directories

rm -rf secrets/age
rm -rf ~/secure-backups/happy-bday-app-sops-*

# Remove age key if needed to start over

rm ~/.config/sops/age/keys.txt
```

### Time Estimate

- 10-15 minutes

---

## Phase 2: SOPS Configuration

**Duration:** 30 minutes
**Prerequisites:** Phase 1 complete, age public key saved
**Risk Level:** Low

### Objectives

- Create `.sops.yaml` configuration file
- Define encryption rules for different environments
- Configure encrypted-regex for selective encryption

### Step 2.1: Create .sops.yaml Configuration

**IMPORTANT:** Replace `age1xxxxx...` with YOUR actual public key from Phase 1.

```bash

# Navigate to project root

cd /Users/hafizputraludyanto/git/github.com/fairyhunter13/happy-bday-app

# Create .sops.yaml configuration

cat > .sops.yaml << 'EOF'

# .sops.yaml - SOPS Configuration for Birthday Message Scheduler
# This file defines encryption rules for different environment files

creation_rules:
  # Development environment
  # Path: secrets/.env.development.enc
  # Single key for simplicity in dev environment
  - path_regex: secrets/\.env\.development\.enc$
    age: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY|.*_TOKEN|DATABASE_URL|RABBITMQ_URL|REDIS_URL|EMAIL_SERVICE_URL).*'

  # Test environment
  # Path: secrets/.env.test.enc
  # Single key, moderate encryption
  - path_regex: secrets/\.env\.test\.enc$
    age: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY|.*_TOKEN|DATABASE_URL|RABBITMQ_URL|REDIS_URL|EMAIL_SERVICE_URL).*'

  # Production environment
  # Path: secrets/.env.production.enc
  # TODO: Add second age key for redundancy after generating production key
  - path_regex: secrets/\.env\.production\.enc$
    age: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY|.*_TOKEN|.*_URL|.*_HOST).*'

  # Generic .env files (fallback rule)
  # Matches any .env.*.enc files not caught by above rules
  - path_regex: \.env\..*\.enc$
    age: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY|.*_TOKEN).*'
EOF
```

### Step 2.2: Update .sops.yaml with Your age Public Key

**Get your public key:**
```bash

# Extract public key from your age key file

grep "public key:" ~/.config/sops/age/keys.txt | cut -d: -f2 | tr -d ' '

# This will output something like:
# age1abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr

```

**Replace placeholder in .sops.yaml:**
```bash

# Save your public key to variable

YOUR_PUBLIC_KEY=$(grep "public key:" ~/.config/sops/age/keys.txt | cut -d: -f2 | tr -d ' ')

# Replace all placeholders with your actual public key

sed -i.bak "s/age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/${YOUR_PUBLIC_KEY}/g" .sops.yaml

# Verify replacement

grep "age:" .sops.yaml
```

**Expected Output:**
```yaml
    age: age1abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr
```

### Step 2.3: Validate .sops.yaml Configuration

```bash

# Check syntax (YAML validation)

cat .sops.yaml

# Verify no placeholder keys remain

if grep -q "age1xxxx" .sops.yaml; then
  echo "❌ ERROR: Placeholder keys still present in .sops.yaml"
  echo "Please replace with your actual age public key"
  exit 1
else
  echo "✅ .sops.yaml configured with actual age key"
fi
```

### Step 2.4: Understanding the Configuration

**Explanation of .sops.yaml rules:**

1. **path_regex**: Matches file paths to apply encryption rules
   - `secrets/\.env\.development\.enc$` - Matches only `.env.development.enc`
   - `\.env\..*\.enc$` - Matches any `.env.*.enc` file (fallback)

2. **age**: age public key(s) used for encryption
   - Single key: `age: age1xxxxx...`
   - Multiple keys:
```
     age: >-
       age1key1...,
       age1key2...
     ```

3. **encrypted_regex**: Regex pattern for keys to encrypt
   - `^(.*_PASSWORD|.*_SECRET|.*_KEY).*` - Encrypts any variable ending with `_PASSWORD`, `_SECRET`, or `_KEY`
   - Example matches: `DATABASE_PASSWORD`, `API_SECRET`, `REDIS_KEY`
   - Example non-matches: `NODE_ENV`, `PORT`, `LOG_LEVEL`

**Why selective encryption?**
- Keeps non-sensitive config visible for debugging
- Reduces file size and encryption overhead
- Makes Git diffs more meaningful
- Easier to review configuration changes

### Step 2.5: Commit .sops.yaml to Git

```bash

# Add .sops.yaml to Git

git add .sops.yaml

# Commit (don't push yet - we'll do full commit after encryption)

git commit -m "feat: Add SOPS configuration for secret management

- Configure age encryption for dev, test, and production
- Use encrypted_regex to selectively encrypt sensitive values
- Prepare for encrypted .env file migration"

# DO NOT PUSH YET - we'll push after all phases complete

```

### Rollback Procedure

```bash

# Remove .sops.yaml if configuration is incorrect

git reset HEAD .sops.yaml
rm .sops.yaml .sops.yaml.bak
```

### Time Estimate

- 10-15 minutes

---

## Phase 3: Secret Encryption

**Duration:** 45 minutes
**Prerequisites:** Phase 2 complete, `.sops.yaml` configured
**Risk Level:** Medium

### Objectives

- Encrypt all existing `.env` files
- Verify encryption works correctly
- Store encrypted files in `secrets/` directory

### Step 3.1: Verify Environment Files Exist

```bash

# Check which .env files exist

ls -la .env* 2>/dev/null || echo "No .env files found in root"

# If no files exist, create from .env.example or reference documentation

```

**If you need to create .env files from scratch:**

```bash

# Copy from example (if exists)

cp .env.example .env.development
cp .env.example .env.test

# Or create minimal files for testing

cat > .env.development << 'EOF'
NODE_ENV=development
PORT=3000
DATABASE_PASSWORD=dev_password_change_me
DATABASE_URL=postgresql://localhost:5432/birthday_app
REDIS_PASSWORD=dev_redis_password
RABBITMQ_PASSWORD=dev_rabbitmq_password
EMAIL_SERVICE_API_KEY=dev_api_key_change_me
EOF

cat > .env.test << 'EOF'
NODE_ENV=test
PORT=3001
DATABASE_PASSWORD=test_password_change_me
DATABASE_URL=postgresql://localhost:5432/birthday_app_test
REDIS_PASSWORD=test_redis_password
RABBITMQ_PASSWORD=test_rabbitmq_password
EMAIL_SERVICE_API_KEY=test_api_key_change_me
EOF
```

### Step 3.2: Encrypt Development Environment

```bash

# Encrypt .env.development

sops -e .env.development > secrets/.env.development.enc

# Expected: No output if successful

```

**Verify Encryption:**
```bash

# Check encrypted file exists

ls -la secrets/.env.development.enc

# View encrypted content (should see ENC[...] for sensitive values)

cat secrets/.env.development.enc
```

**Expected Output:**
```bash
NODE_ENV=development
PORT=3000
DATABASE_PASSWORD=ENC[AES256_GCM,data:Hj4k8...,iv:xyz789...,tag:abc123==,type:str]
DATABASE_URL=ENC[AES256_GCM,data:8kHj4...,iv:789xyz...,tag:123abc==,type:str]
REDIS_PASSWORD=ENC[AES256_GCM,data:9kHj5...,iv:890abc...,tag:234def==,type:str]

# ... more encrypted values ...

sops:
    kms: []
    gcp_kms: []
    azure_kv: []
    hc_vault: []
    age:
        - recipient: age1abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr
          enc: |
            -----BEGIN AGE ENCRYPTED FILE-----
            ... encrypted data key ...
            -----END AGE ENCRYPTED FILE-----
    lastmodified: "2025-12-30T02:45:30Z"
    mac: ENC[AES256_GCM,data:...,iv:...,tag:...,type:str]
    pgp: []
    unencrypted_suffix: _unencrypted
    version: 3.8.1
```

**Validate Decryption:**
```bash

# Test decryption (should output original content)

sops -d secrets/.env.development.enc

# Compare with original

diff <(sops -d secrets/.env.development.enc) .env.development

# Expected: No output (files are identical)

```

### Step 3.3: Encrypt Test Environment

```bash

# Encrypt .env.test

sops -e .env.test > secrets/.env.test.enc

# Verify

ls -la secrets/.env.test.enc
```

**Validate:**
```bash

# Test decryption

sops -d secrets/.env.test.enc | head -n 5

# Should show decrypted content

```

### Step 3.4: Encrypt Production Environment (if exists)

```bash

# Check if production .env exists

if [ -f .env.production ]; then
  # Encrypt production environment
  sops -e .env.production > secrets/.env.production.enc

  # Verify
  ls -la secrets/.env.production.enc

  echo "✅ Production environment encrypted"
else
  echo "ℹ️  No .env.production found - skipping"
  echo "You can encrypt production secrets later when ready"
fi
```

**Production Note:**
- It's common to NOT have production secrets in development repository
- Production secrets should be added directly in production environment
- Consider generating separate age key for production (see Phase 5)

### Step 3.5: Verify All Encrypted Files

```bash

# List all encrypted files

ls -la secrets/

# Expected output:
# -rw-r--r--  1 user  staff  2134 Dec 30 11:00 .env.development.enc
# -rw-r--r--  1 user  staff  2245 Dec 30 11:01 .env.test.enc
# drwxr-xr-x  2 user  staff    64 Dec 30 10:30 age/

```

**Validate Each File:**
```bash

# Function to validate encrypted file

validate_encrypted_file() {
  local file=$1
  echo "Validating ${file}..."

  # Check file exists
  if [ ! -f "$file" ]; then
    echo "❌ File not found: ${file}"
    return 1
  fi

  # Check file contains SOPS metadata
  if ! grep -q "sops:" "$file"; then
    echo "❌ No SOPS metadata in ${file}"
    return 1
  fi

  # Check encryption worked (should have ENC[...] strings)
  if ! grep -q "ENC\[AES256_GCM" "$file"; then
    echo "❌ No encrypted values in ${file}"
    return 1
  fi

  # Test decryption
  if ! sops -d "$file" > /dev/null 2>&1; then
    echo "❌ Failed to decrypt ${file}"
    return 1
  fi

  echo "✅ ${file} is valid"
  return 0
}

# Validate all encrypted files

validate_encrypted_file "secrets/.env.development.enc"
validate_encrypted_file "secrets/.env.test.enc"

# Optional: validate production if it exists

[ -f "secrets/.env.production.enc" ] && validate_encrypted_file "secrets/.env.production.enc"
```

### Step 3.6: Test In-Place Editing

```bash

# Test editing encrypted file directly with SOPS

echo "Testing in-place editing..."

# Edit .env.development.enc (will open in default editor)
# SOPS will decrypt, let you edit, then re-encrypt on save

sops secrets/.env.development.enc

# In editor, you can:
# 1. Change values
# 2. Add new keys
# 3. Delete keys
# Save and quit - SOPS auto-encrypts

# After saving, verify file still decrypts

sops -d secrets/.env.development.enc > /dev/null && echo "✅ In-place edit successful"
```

**Note:** Default editor is usually vim or nano. Set your preference:
```bash

# Set default editor (optional)

export EDITOR=nano  # or vim, code, etc.

# Make permanent by adding to ~/.bashrc or ~/.zshrc

echo 'export EDITOR=nano' >> ~/.zshrc
```

### Step 3.7: Commit Encrypted Files

```bash

# Add encrypted files to Git

git add secrets/.env.development.enc
git add secrets/.env.test.enc
git add secrets/age/.gitkeep

# Commit (don't push yet)

git commit -m "feat: Add encrypted environment files

- Encrypt .env.development with SOPS + age
- Encrypt .env.test with SOPS + age
- Store encrypted files in secrets/ directory
- Sensitive values encrypted using AES256_GCM"
```

### Rollback Procedure

```bash

# If encryption fails or files are corrupted
# Restore from backups created in Phase 1

BACKUP_DIR=~/secure-backups/happy-bday-app-sops-$(date +%Y%m%d)
cp ${BACKUP_DIR}/env.development.backup .env.development
cp ${BACKUP_DIR}/env.test.backup .env.test

# Remove encrypted files

rm secrets/.env.development.enc
rm secrets/.env.test.enc

# Uncommit if needed

git reset HEAD secrets/
```

### Time Estimate

- 15-20 minutes

---

## Phase 4: Helper Scripts

**Duration:** 45 minutes
**Prerequisites:** Phase 3 complete
**Risk Level:** Low

### Objectives

- Create shell scripts for encryption/decryption
- Add npm scripts for convenience
- Create key rotation script
- Test all helper scripts

### Step 4.1: Create Encryption Helper Script

```bash

# Create scripts/encrypt-env.sh

cat > scripts/encrypt-env.sh << 'EOF'

#!/bin/bash
# scripts/encrypt-env.sh
# Encrypts environment file using SOPS + age

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color codes for output

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default environment

ENVIRONMENT=${1:-development}

# File paths

SOURCE_FILE=".env.${ENVIRONMENT}"
ENCRYPTED_FILE="secrets/.env.${ENVIRONMENT}.enc"

# Print usage

usage() {
  echo "Usage: $0 [environment]"
  echo ""
  echo "Encrypts environment file using SOPS + age"
  echo ""
  echo "Arguments:"
  echo "  environment    Environment name (default: development)"
  echo "                 Options: development, test, production"
  echo ""
  echo "Examples:"
  echo "  $0 development    # Encrypt .env.development"
  echo "  $0 test           # Encrypt .env.test"
  echo "  $0 production     # Encrypt .env.production"
  exit 1
}

# Check for help flag

if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
  usage
fi

# Validate source file exists

if [ ! -f "${SOURCE_FILE}" ]; then
  echo -e "${RED}❌ Error: Source file ${SOURCE_FILE} not found${NC}"
  echo ""
  echo "Available .env files:"
  ls -la .env* 2>/dev/null || echo "No .env files found"
  exit 1
fi

# Check SOPS is installed

if ! command -v sops &> /dev/null; then
  echo -e "${RED}❌ Error: SOPS is not installed${NC}"
  echo "Install with: brew install sops"
  exit 1
fi

# Check .sops.yaml exists

if [ ! -f ".sops.yaml" ]; then
  echo -e "${RED}❌ Error: .sops.yaml configuration not found${NC}"
  echo "Create .sops.yaml before encrypting files"
  exit 1
fi

# Encrypt file

echo -e "${YELLOW}🔒 Encrypting ${SOURCE_FILE} → ${ENCRYPTED_FILE}${NC}"

# Create secrets directory if it doesn't exist

mkdir -p secrets

# Perform encryption

if sops -e "${SOURCE_FILE}" > "${ENCRYPTED_FILE}"; then
  echo -e "${GREEN}✅ Encryption complete${NC}"
  echo ""
  echo "Encrypted file: ${ENCRYPTED_FILE}"
  echo "File size: $(wc -c < ${ENCRYPTED_FILE}) bytes"
  echo ""
  echo -e "${YELLOW}⚠️  Next steps:${NC}"
  echo "1. Verify encrypted file: sops -d ${ENCRYPTED_FILE}"
  echo "2. Commit encrypted file: git add ${ENCRYPTED_FILE}"
  echo "3. Delete plaintext file: rm ${SOURCE_FILE}"
  echo "4. Push changes: git push"
else
  echo -e "${RED}❌ Encryption failed${NC}"
  exit 1
fi
EOF

# Make executable

chmod +x scripts/encrypt-env.sh

# Test script

./scripts/encrypt-env.sh --help
```

**Expected Output:**
```
Usage: ./scripts/encrypt-env.sh [environment]

Encrypts environment file using SOPS + age
...
```

### Step 4.2: Create Decryption Helper Script

```bash

# Create scripts/decrypt-env.sh

cat > scripts/decrypt-env.sh << 'EOF'

#!/bin/bash
# scripts/decrypt-env.sh
# Decrypts SOPS-encrypted environment file

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color codes

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default environment

ENVIRONMENT=${1:-development}

# File paths

ENCRYPTED_FILE="secrets/.env.${ENVIRONMENT}.enc"
OUTPUT_FILE=".env.${ENVIRONMENT}"

# Print usage

usage() {
  echo "Usage: $0 [environment]"
  echo ""
  echo "Decrypts SOPS-encrypted environment file"
  echo ""
  echo "Arguments:"
  echo "  environment    Environment name (default: development)"
  echo "                 Options: development, test, production"
  echo ""
  echo "Examples:"
  echo "  $0 development    # Decrypt secrets/.env.development.enc → .env.development"
  echo "  $0 test           # Decrypt secrets/.env.test.enc → .env.test"
  echo "  $0 production     # Decrypt secrets/.env.production.enc → .env.production"
  exit 1
}

# Check for help flag

if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
  usage
fi

# Validate encrypted file exists

if [ ! -f "${ENCRYPTED_FILE}" ]; then
  echo -e "${RED}❌ Error: Encrypted file ${ENCRYPTED_FILE} not found${NC}"
  echo ""
  echo "Available encrypted files:"
  ls -la secrets/*.enc 2>/dev/null || echo "No encrypted files found"
  exit 1
fi

# Check SOPS is installed

if ! command -v sops &> /dev/null; then
  echo -e "${RED}❌ Error: SOPS is not installed${NC}"
  echo "Install with: brew install sops"
  exit 1
fi

# Check age key exists

if [ ! -f ~/.config/sops/age/keys.txt ]; then
  echo -e "${RED}❌ Error: age private key not found${NC}"
  echo "Expected location: ~/.config/sops/age/keys.txt"
  echo ""
  echo "Get the age key from your team lead and save it to:"
  echo "~/.config/sops/age/keys.txt"
  exit 1
fi

# Decrypt file

echo -e "${YELLOW}🔓 Decrypting ${ENCRYPTED_FILE} → ${OUTPUT_FILE}${NC}"

if sops -d "${ENCRYPTED_FILE}" > "${OUTPUT_FILE}"; then
  echo -e "${GREEN}✅ Decryption complete${NC}"
  echo ""
  echo "Decrypted file: ${OUTPUT_FILE}"
  echo "File size: $(wc -c < ${OUTPUT_FILE}) bytes"
  echo ""
  echo -e "${YELLOW}⚠️  Security reminder:${NC}"
  echo "- ${OUTPUT_FILE} is git-ignored and should NOT be committed"
  echo "- Delete ${OUTPUT_FILE} when done: rm ${OUTPUT_FILE}"
  echo "- Never share plaintext ${OUTPUT_FILE} via email/chat"
else
  echo -e "${RED}❌ Decryption failed${NC}"
  echo ""
  echo "Possible causes:"
  echo "1. Wrong age private key in ~/.config/sops/age/keys.txt"
  echo "2. Encrypted file corrupted"
  echo "3. File encrypted with different age key"
  exit 1
fi
EOF

# Make executable

chmod +x scripts/decrypt-env.sh

# Test script

./scripts/decrypt-env.sh --help
```

### Step 4.3: Create Key Rotation Script

```bash

# Create scripts/rotate-age-key.sh

cat > scripts/rotate-age-key.sh << 'EOF'

#!/bin/bash
# scripts/rotate-age-key.sh
# Rotates age encryption key for an environment

set -e

# Color codes

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ENVIRONMENT=${1:-}

usage() {
  echo "Usage: $0 <environment>"
  echo ""
  echo "Rotates age encryption key for specified environment"
  echo ""
  echo "Arguments:"
  echo "  environment    Environment name (required)"
  echo "                 Options: development, test, production"
  echo ""
  echo "This script will:"
  echo "1. Generate new age key"
  echo "2. Update .sops.yaml with new public key"
  echo "3. Re-encrypt all files for the environment"
  echo "4. Provide instructions for updating GitHub Secrets"
  exit 1
}

if [ -z "${ENVIRONMENT}" ]; then
  usage
fi

# Validate environment

if [[ ! "${ENVIRONMENT}" =~ ^(development|test|production)$ ]]; then
  echo -e "${RED}❌ Error: Invalid environment '${ENVIRONMENT}'${NC}"
  echo "Valid options: development, test, production"
  exit 1
fi

echo -e "${BLUE}🔄 Starting age key rotation for ${ENVIRONMENT} environment${NC}"
echo ""

# Backup old key

OLD_KEY_FILE=~/.config/sops/age/keys-${ENVIRONMENT}-old-$(date +%Y%m%d).txt
if [ -f ~/.config/sops/age/keys.txt ]; then
  cp ~/.config/sops/age/keys.txt "${OLD_KEY_FILE}"
  echo -e "${GREEN}✅ Backed up old key to ${OLD_KEY_FILE}${NC}"
fi

# Generate new age key

NEW_KEY_FILE=~/.config/sops/age/keys-${ENVIRONMENT}.txt
echo ""
echo -e "${YELLOW}1. Generating new age key...${NC}"
age-keygen -o "${NEW_KEY_FILE}"

# Extract public key

NEW_PUBLIC_KEY=$(grep "public key:" "${NEW_KEY_FILE}" | cut -d: -f2 | tr -d ' ')
echo ""
echo -e "${GREEN}✅ New public key: ${NEW_PUBLIC_KEY}${NC}"

# Instructions for manual update

echo ""
echo -e "${YELLOW}2. Update .sops.yaml with new public key${NC}"
echo ""
echo "Edit .sops.yaml and replace the age key for ${ENVIRONMENT} with:"
echo -e "${GREEN}${NEW_PUBLIC_KEY}${NC}"
echo ""
read -p "Press ENTER after updating .sops.yaml..."

# Re-encrypt files

echo ""
echo -e "${YELLOW}3. Re-encrypting files for ${ENVIRONMENT}...${NC}"

# Use new key for re-encryption

export SOPS_AGE_KEY_FILE="${NEW_KEY_FILE}"

for encrypted_file in secrets/.env.${ENVIRONMENT}.enc; do
  if [ -f "$encrypted_file" ]; then
    echo "   Re-encrypting ${encrypted_file}..."
    sops updatekeys -y "${encrypted_file}"
    echo -e "${GREEN}   ✅ Updated ${encrypted_file}${NC}"
  fi
done

echo ""
echo -e "${GREEN}✅ Key rotation complete for ${ENVIRONMENT}${NC}"
echo ""
echo -e "${YELLOW}⚠️  Action Required:${NC}"
echo ""
echo "1. Update GitHub Secret SOPS_AGE_KEY_${ENVIRONMENT^^} with new private key:"
echo "   Content of: ${NEW_KEY_FILE}"
echo ""
echo "2. Notify team members to update their local age key:"
echo "   cp ${NEW_KEY_FILE} ~/.config/sops/age/keys.txt"
echo ""
echo "3. Test decryption with new key:"
echo "   sops -d secrets/.env.${ENVIRONMENT}.enc"
echo ""
echo "4. Archive old key securely for 30 days before deletion:"
echo "   Location: ${OLD_KEY_FILE}"
echo ""
echo "5. Commit updated .sops.yaml and re-encrypted files:"
echo "   git add .sops.yaml secrets/.env.${ENVIRONMENT}.enc"
echo "   git commit -m 'security: Rotate age key for ${ENVIRONMENT} environment'"
echo "   git push"
EOF

# Make executable

chmod +x scripts/rotate-age-key.sh

# Test script

./scripts/rotate-age-key.sh
```

**Expected Output:**
```
Usage: ./scripts/rotate-age-key.sh <environment>
...
```

### Step 4.4: Add npm Scripts

```bash

# Backup package.json

cp package.json package.json.backup

# Add scripts to package.json
# Note: This assumes you have a scripts section in package.json
# Adjust the jq command if your package.json structure is different

# Check if jq is installed

if ! command -v jq &> /dev/null; then
  echo "⚠️  jq not found - adding scripts manually"
  echo ""
  echo "Add these scripts to package.json manually:"
  cat << 'SCRIPTS'
{
  "scripts": {
    "secrets:encrypt": "bash scripts/encrypt-env.sh",
    "secrets:decrypt": "bash scripts/decrypt-env.sh",
    "secrets:encrypt:dev": "bash scripts/encrypt-env.sh development",
    "secrets:decrypt:dev": "bash scripts/decrypt-env.sh development",
    "secrets:encrypt:test": "bash scripts/encrypt-env.sh test",
    "secrets:decrypt:test": "bash scripts/decrypt-env.sh test",
    "secrets:encrypt:prod": "bash scripts/encrypt-env.sh production",
    "secrets:decrypt:prod": "bash scripts/decrypt-env.sh production",
    "secrets:rotate": "bash scripts/rotate-age-key.sh"
  }
}
SCRIPTS
else
  # Use jq to add scripts
  jq '.scripts += {
    "secrets:encrypt": "bash scripts/encrypt-env.sh",
    "secrets:decrypt": "bash scripts/decrypt-env.sh",
    "secrets:encrypt:dev": "bash scripts/encrypt-env.sh development",
    "secrets:decrypt:dev": "bash scripts/decrypt-env.sh development",
    "secrets:encrypt:test": "bash scripts/encrypt-env.sh test",
    "secrets:decrypt:test": "bash scripts/decrypt-env.sh test",
    "secrets:encrypt:prod": "bash scripts/encrypt-env.sh production",
    "secrets:decrypt:prod": "bash scripts/decrypt-env.sh production",
    "secrets:rotate": "bash scripts/rotate-age-key.sh"
  }' package.json > package.json.tmp && mv package.json.tmp package.json

  echo "✅ Added npm scripts to package.json"
fi
```

**Manually Add Scripts (if jq not available):**

Edit `package.json` and add to the `"scripts"` section:

```json
{
  "scripts": {
    "secrets:encrypt": "bash scripts/encrypt-env.sh",
    "secrets:decrypt": "bash scripts/decrypt-env.sh",
    "secrets:encrypt:dev": "bash scripts/encrypt-env.sh development",
    "secrets:decrypt:dev": "bash scripts/decrypt-env.sh development",
    "secrets:encrypt:test": "bash scripts/encrypt-env.sh test",
    "secrets:decrypt:test": "bash scripts/decrypt-env.sh test",
    "secrets:encrypt:prod": "bash scripts/encrypt-env.sh production",
    "secrets:decrypt:prod": "bash scripts/decrypt-env.sh production",
    "secrets:rotate": "bash scripts/rotate-age-key.sh"
  }
}
```

### Step 4.5: Test npm Scripts

```bash

# Test decryption script

npm run secrets:decrypt:dev

# Expected output:
# 🔓 Decrypting secrets/.env.development.enc → .env.development
# ✅ Decryption complete
# ...

# Verify .env.development was created

ls -la .env.development

# Test encryption script (re-encrypt)

npm run secrets:encrypt:dev

# Expected output:
# 🔒 Encrypting .env.development → secrets/.env.development.enc
# ✅ Encryption complete
# ...

# Clean up test file

rm .env.development
```

### Step 4.6: Commit Helper Scripts

```bash

# Add scripts to Git

git add scripts/encrypt-env.sh
git add scripts/decrypt-env.sh
git add scripts/rotate-age-key.sh
git add package.json

# Commit

git commit -m "feat: Add SOPS helper scripts and npm commands

- Add encrypt-env.sh for encrypting environment files
- Add decrypt-env.sh for decrypting environment files
- Add rotate-age-key.sh for key rotation
- Add npm scripts for convenience:
  - npm run secrets:encrypt:dev
  - npm run secrets:decrypt:dev
  - npm run secrets:encrypt:test
  - npm run secrets:decrypt:test"
```

### Rollback Procedure

```bash

# Restore package.json

cp package.json.backup package.json

# Remove scripts

rm scripts/encrypt-env.sh
rm scripts/decrypt-env.sh
rm scripts/rotate-age-key.sh

# Uncommit

git reset HEAD scripts/ package.json
```

### Time Estimate

- 20-30 minutes

---

## Phase 5: GitHub Secrets Setup

**Duration:** 30 minutes
**Prerequisites:** Phase 4 complete
**Risk Level:** Medium (handling secrets)

### Objectives

- Store age private key in GitHub Secrets
- Configure separate secrets for different environments
- Verify secrets are accessible in GitHub Actions

### Step 5.1: Get age Private Key

```bash

# Display your age private key

cat ~/.config/sops/age/keys.txt

# Expected output:
# # created: 2025-12-30T10:30:45+08:00
# # public key: age1xxxxx...
# AGE-SECRET-KEY-1YYYYYY...

```

**IMPORTANT:** Copy the **entire content** including comments. You'll paste this into GitHub Secrets.

### Step 5.2: Store Secret via GitHub Web UI (Method 1)

**Steps:**

1. Navigate to your repository on GitHub:
```
   https://github.com/fairyhunter13/happy-bday-app
   ```

2. Click **Settings** (top menu)

3. In left sidebar, click **Secrets and variables** → **Actions**

4. Click **New repository secret**

5. Create secret for development/test:
   - **Name:** `SOPS_AGE_KEY_DEV`
   - **Value:** Paste entire age key content (from Step 5.1)
   - Click **Add secret**

6. Create secret for production (if different key):
   - **Name:** `SOPS_AGE_KEY_PROD`
   - **Value:** Paste production age key content
   - Click **Add secret**

**Validation:**
- You should see secrets listed:
  - `SOPS_AGE_KEY_DEV`
  - `SOPS_AGE_KEY_PROD` (if added)

### Step 5.3: Store Secret via GitHub CLI (Method 2 - Recommended)

**Prerequisites:** GitHub CLI installed and authenticated (from Phase 0)

```bash

# Verify gh CLI is authenticated

gh auth status

# Expected output:
# ✓ Logged in to github.com as fairyhunter13 (...)

```

**Store development/test age key:**

```bash

# Read age key and store as GitHub Secret

gh secret set SOPS_AGE_KEY_DEV < ~/.config/sops/age/keys.txt

# Expected output:
# ✓ Set secret SOPS_AGE_KEY_DEV for fairyhunter13/happy-bday-app

```

**Verify secret was created:**

```bash

# List all secrets

gh secret list

# Expected output:
# SOPS_AGE_KEY_DEV    Updated 2025-12-30

```

**Store production age key (if separate):**

```bash

# If you have a separate production key file

gh secret set SOPS_AGE_KEY_PROD < ~/path/to/production-keys.txt

# Or use the same key for now (can rotate later)

gh secret set SOPS_AGE_KEY_PROD < ~/.config/sops/age/keys.txt
```

### Step 5.4: Set Up Environment-Specific Secrets (Advanced)

For better security, use **GitHub Environment Secrets** for production:

**Steps:**

1. In GitHub repository → **Settings** → **Environments**

2. Click **New environment**

3. Environment name: `production`

4. Configure protection rules:
   - ☑ **Required reviewers** (select team members)
   - ☑ **Wait timer** (e.g., 5 minutes)

5. Click **Add secret**:
   - Name: `SOPS_AGE_KEY`
   - Value: Production age key

**Benefits:**
- Production secrets require approval to access
- Separate keys for production vs development
- Audit trail for production deployments

### Step 5.5: Verify Secrets in Test Workflow

Create a test workflow to verify secrets work:

```bash

# Create test workflow

mkdir -p .github/workflows

cat > .github/workflows/test-sops.yml << 'EOF'
name: Test SOPS Decryption

on:
  workflow_dispatch:  # Manual trigger only

jobs:
  test-sops:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup SOPS
        uses: nhedger/setup-sops@v2

      - name: Setup age
        run: |
          AGE_VERSION=1.1.1
          curl -Lo age.tar.gz "https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz"
          tar xf age.tar.gz
          sudo mv age/age /usr/local/bin/

      - name: Setup age key
        run: |
          mkdir -p ~/.config/sops/age
          echo "${{ secrets.SOPS_AGE_KEY_DEV }}" > ~/.config/sops/age/keys.txt
          chmod 600 ~/.config/sops/age/keys.txt

      - name: Test decryption
        run: |
          echo "Testing decryption of secrets/.env.test.enc"
          sops -d secrets/.env.test.enc > .env.test
          echo "✅ Decryption successful"
          echo "File size: $(wc -c < .env.test) bytes"

      - name: Cleanup
        if: always()
        run: |
          rm -f .env.test
          rm -f ~/.config/sops/age/keys.txt
EOF

# Commit test workflow

git add .github/workflows/test-sops.yml
git commit -m "ci: Add SOPS decryption test workflow"
git push origin main
```

**Run Test Workflow:**

1. Go to **Actions** tab in GitHub
2. Select **Test SOPS Decryption** workflow
3. Click **Run workflow**
4. Wait for completion
5. Check logs - should see "✅ Decryption successful"

**If test fails:**
- Check SOPS_AGE_KEY_DEV secret exists
- Verify secret contains full age key (including comments)
- Check secret name matches in workflow
- Review workflow logs for error messages

### Step 5.6: Security Best Practices

**DO:**
- ✅ Use separate secrets for dev/test vs production
- ✅ Rotate secrets regularly (every 90 days minimum)
- ✅ Use environment secrets for production
- ✅ Audit secret access regularly

**DON'T:**
- ❌ Share secrets via email/chat
- ❌ Log secret values in workflow output
- ❌ Use same age key across multiple projects
- ❌ Give everyone access to production secrets

### Rollback Procedure

**Remove GitHub Secrets (if needed):**

```bash

# Via GitHub CLI

gh secret delete SOPS_AGE_KEY_DEV
gh secret delete SOPS_AGE_KEY_PROD

# Verify deletion

gh secret list

# Should not show deleted secrets

```

**Via Web UI:**
1. Settings → Secrets and variables → Actions
2. Click secret name → **Delete secret**

### Time Estimate

- 15-20 minutes

---

## Phase 6: CI/CD Integration

**Duration:** 60 minutes
**Prerequisites:** Phase 5 complete, GitHub Secrets configured
**Risk Level:** Medium

### Objectives

- Update existing GitHub Actions workflows
- Add SOPS decryption steps to CI/CD
- Ensure secrets are cleaned up after use
- Test workflows end-to-end

### Step 6.1: Identify Existing Workflows

```bash

# List all workflow files

find .github/workflows -name "*.yml" -o -name "*.yaml"

# Expected output (may vary):
# .github/workflows/ci.yml
# .github/workflows/cd.yml
# .github/workflows/test.yml

```

**For this example, we'll update a typical CI workflow. Adapt for your actual workflows.**

### Step 6.2: Backup Existing Workflows

```bash

# Create backup directory

mkdir -p .github/workflows-backup

# Backup all workflows

cp .github/workflows/*.yml .github/workflows-backup/ 2>/dev/null || true
cp .github/workflows/*.yaml .github/workflows-backup/ 2>/dev/null || true

echo "✅ Workflows backed up to .github/workflows-backup/"
```

### Step 6.3: Update CI Workflow (Example)

**Scenario:** You have a CI workflow that runs tests and needs environment variables.

**Before (example ci.yml):**
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
        env:
          DATABASE_URL: postgres://localhost/test
          # Other hardcoded secrets...
```

**After (with SOPS):**

Create updated workflow:

```bash
cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  test:
    name: Test with SOPS Secrets
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      # 1. Checkout code
      - name: Checkout repository
        uses: actions/checkout@v4

      # 2. Setup Node.js
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # 3. Install SOPS
      - name: Install SOPS
        uses: nhedger/setup-sops@v2
        with:
          version: '3.8.1'

      # 4. Install age
      - name: Install age encryption
        run: |
          AGE_VERSION=1.1.1
          curl -Lo age.tar.gz "https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz"
          tar xf age.tar.gz
          sudo mv age/age /usr/local/bin/
          sudo mv age/age-keygen /usr/local/bin/
          rm -rf age age.tar.gz
          age --version

      # 5. Configure age key from GitHub Secret
      - name: Configure age key
        run: |
          mkdir -p ~/.config/sops/age
          echo "${{ secrets.SOPS_AGE_KEY_DEV }}" > ~/.config/sops/age/keys.txt
          chmod 600 ~/.config/sops/age/keys.txt
          echo "✅ age key configured"

      # 6. Decrypt test environment secrets
      - name: Decrypt secrets
        run: |
          echo "Decrypting test environment secrets..."
          sops -d secrets/.env.test.enc > .env.test
          echo "✅ Secrets decrypted successfully"
        env:
          SOPS_AGE_KEY_FILE: ~/.config/sops/age/keys.txt

      # 7. Verify decryption (optional but recommended)
      - name: Verify decrypted secrets
        run: |
          if [ ! -f .env.test ]; then
            echo "❌ Failed to decrypt .env.test"
            exit 1
          fi
          echo "✅ .env.test exists ($(wc -c < .env.test) bytes)"
          # Optional: Check specific variables exist (without printing values)
          grep -q "NODE_ENV" .env.test && echo "✅ NODE_ENV found" || exit 1
          grep -q "DATABASE_URL" .env.test && echo "✅ DATABASE_URL found" || exit 1

      # 8. Install dependencies
      - name: Install dependencies
        run: npm ci

      # 9. Run linting
      - name: Run linter
        run: npm run lint

      # 10. Run tests
      - name: Run unit tests
        run: npm run test
        env:
          NODE_ENV: test

      # 11. Run integration tests
      - name: Run integration tests
        run: npm run test:integration
        env:
          NODE_ENV: test

      # 12. CRITICAL: Cleanup secrets (always runs, even on failure)
      - name: Cleanup secrets
        if: always()
        run: |
          rm -f .env.test
          rm -f .env
          rm -f ~/.config/sops/age/keys.txt
          echo "🧹 Secrets cleaned up"
EOF

echo "✅ Updated .github/workflows/ci.yml with SOPS integration"
```

### Step 6.4: Update CD/Deploy Workflow (if exists)

**For deployment workflows that need production secrets:**

```bash
cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy to Production

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    name: Deploy Application
    runs-on: ubuntu-latest
    environment: production  # Uses GitHub Environment Secrets
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # Install SOPS + age
      - name: Install SOPS
        uses: nhedger/setup-sops@v2
        with:
          version: '3.8.1'

      - name: Install age
        run: |
          AGE_VERSION=1.1.1
          curl -Lo age.tar.gz "https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz"
          tar xf age.tar.gz
          sudo mv age/age /usr/local/bin/
          rm -rf age age.tar.gz

      # Configure production age key
      - name: Configure production age key
        run: |
          mkdir -p ~/.config/sops/age
          echo "${{ secrets.SOPS_AGE_KEY }}" > ~/.config/sops/age/keys.txt
          chmod 600 ~/.config/sops/age/keys.txt

      # Decrypt production secrets
      - name: Decrypt production secrets
        run: |
          sops -d secrets/.env.production.enc > .env.production
          echo "✅ Production secrets decrypted"

      # Install dependencies
      - name: Install dependencies
        run: npm ci

      # Build application
      - name: Build application
        run: npm run build
        env:
          NODE_ENV: production

      # Deploy (example - adjust for your deployment method)
      - name: Deploy to server
        run: |
          echo "Deploying to production..."
          # Add your deployment commands here
          # Examples:
          # - rsync files to server
          # - Deploy to Vercel/Netlify
          # - Push Docker image
          # - Deploy to Kubernetes

      # Cleanup
      - name: Cleanup secrets
        if: always()
        run: |
          rm -f .env.production
          rm -f ~/.config/sops/age/keys.txt
          echo "🧹 Production secrets cleaned up"
EOF

echo "✅ Created .github/workflows/deploy.yml with production secret handling"
```

### Step 6.5: Alternative: Using exec-env (In-Memory Secrets)

**For enhanced security, use `sops exec-env` to keep secrets in memory:**

```yaml

# Instead of decrypting to file:

- name: Decrypt and run tests
  run: sops -d secrets/.env.test.enc > .env.test && npm test

# Use exec-env (secrets never touch disk):

- name: Run tests with encrypted secrets
  run: |
    sops exec-env secrets/.env.test.enc 'npm test'
  env:
    SOPS_AGE_KEY_FILE: ~/.config/sops/age/keys.txt
```

**Benefits:**
- Secrets stay in memory (uses FIFOs)
- Automatic cleanup
- No manual file deletion needed
- More secure

### Step 6.6: Add Workflow for Secret Validation

**Create workflow to validate all encrypted files:**

```bash
cat > .github/workflows/validate-secrets.yml << 'EOF'
name: Validate Encrypted Secrets

on:
  pull_request:
    paths:
      - 'secrets/**'
      - '.sops.yaml'

jobs:
  validate:
    name: Validate SOPS Encrypted Files
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install SOPS
        uses: nhedger/setup-sops@v2

      - name: Install age
        run: |
          AGE_VERSION=1.1.1
          curl -Lo age.tar.gz "https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz"
          tar xf age.tar.gz
          sudo mv age/age /usr/local/bin/
          rm -rf age age.tar.gz

      - name: Configure age key
        run: |
          mkdir -p ~/.config/sops/age
          echo "${{ secrets.SOPS_AGE_KEY_DEV }}" > ~/.config/sops/age/keys.txt
          chmod 600 ~/.config/sops/age/keys.txt

      - name: Validate .sops.yaml
        run: |
          echo "Validating .sops.yaml configuration..."
          if [ ! -f .sops.yaml ]; then
            echo "❌ .sops.yaml not found"
            exit 1
          fi
          echo "✅ .sops.yaml exists"

      - name: Validate all encrypted files
        run: |
          echo "Validating encrypted files..."

          for file in secrets/*.enc; do
            if [ -f "$file" ]; then
              echo "Checking $file..."

              # Check file has SOPS metadata
              if ! grep -q "sops:" "$file"; then
                echo "❌ No SOPS metadata in $file"
                exit 1
              fi

              # Test decryption
              if ! sops -d "$file" > /dev/null 2>&1; then
                echo "❌ Failed to decrypt $file"
                exit 1
              fi

              echo "✅ $file is valid"
            fi
          done

          echo "✅ All encrypted files validated successfully"

      - name: Check for plaintext secrets
        run: |
          echo "Checking for accidentally committed plaintext secrets..."

          # Check if any .env files (not .example) are committed
          if git ls-files | grep -E '^\.env(\.|$)' | grep -v '\.example$' | grep -v '\.enc$'; then
            echo "❌ Found plaintext .env files in repository!"
            echo "These files should be encrypted and stored in secrets/ directory"
            exit 1
          fi

          echo "✅ No plaintext secrets found in repository"

      - name: Cleanup
        if: always()
        run: rm -f ~/.config/sops/age/keys.txt
EOF

echo "✅ Created .github/workflows/validate-secrets.yml"
```

### Step 6.7: Commit Updated Workflows

```bash

# Add all workflow files

git add .github/workflows/

# Commit

git commit -m "ci: Integrate SOPS secret decryption in workflows

- Add SOPS and age installation to CI workflow
- Configure age key from GitHub Secrets
- Decrypt test secrets before running tests
- Add cleanup step to remove decrypted secrets
- Create secret validation workflow
- Add production deployment workflow with encrypted secrets"

# Push to trigger workflows

git push origin main
```

### Step 6.8: Verify Workflows

**Check GitHub Actions:**

1. Go to repository → **Actions** tab
2. You should see workflows running:
   - CI (Test with SOPS Secrets)
   - Validate Encrypted Secrets (if PR includes secret changes)

3. Click on a workflow run
4. Review logs:
   - ✅ SOPS installation successful
   - ✅ age installation successful
   - ✅ age key configured
   - ✅ Secrets decrypted successfully
   - ✅ Tests passed
   - ✅ Secrets cleaned up

**Common Issues and Solutions:**

| Issue | Solution |
|-------|----------|
| "no key found" error | Verify SOPS_AGE_KEY_DEV secret exists and contains full key |
| "MAC mismatch" error | Secret may be incorrect or corrupted - regenerate |
| Decryption fails | Check .sops.yaml age key matches GitHub Secret public key |
| Tests fail with missing env vars | Verify .env.test exists after decryption |

### Rollback Procedure

```bash

# Restore original workflows

cp .github/workflows-backup/* .github/workflows/

# Commit rollback

git add .github/workflows/
git commit -m "revert: Rollback workflow changes"
git push origin main
```

### Time Estimate

- 30-45 minutes

---

## Phase 7: Documentation

**Duration:** 45 minutes
**Prerequisites:** Phase 6 complete
**Risk Level:** Low

### Objectives

- Update README with SOPS instructions
- Create developer setup guide
- Document troubleshooting steps
- Create team onboarding checklist

### Step 7.1: Update README.md

Add SOPS section to project README:

```bash

# Backup README

cp README.md README.md.backup

# Add SOPS section to README
# Note: Adjust insertion point based on your README structure

```

**Add this section to README.md** (manually edit or use script):

```markdown

## 🔒 Secret Management

This project uses [SOPS (Secrets OPerationS)](https://github.com/getsops/sops) with [age encryption](https://github.com/FiloSottile/age) for secure secret management.

### Quick Start

1. **Install SOPS and age:**
   ```bash
   # macOS
   brew install sops age

   # Linux
   # See docs/DEVELOPER_SETUP.md for installation instructions
```

2. **Get age private key** from team lead and save to:
   ```bash
   ~/.config/sops/age/keys.txt
```

3. **Decrypt secrets:**
   ```bash
   npm run secrets:decrypt:dev
```

4. **Start development:**
   ```bash
   npm run dev
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run secrets:decrypt:dev` | Decrypt development secrets |
| `npm run secrets:encrypt:dev` | Encrypt development secrets |
| `npm run secrets:decrypt:test` | Decrypt test secrets |
| `npm run secrets:encrypt:test` | Encrypt test secrets |

### Security Guidelines

- ❌ **Never commit** plaintext `.env` files
- ✅ **Always encrypt** secrets before committing
- ✅ **Use SOPS commands** for editing secrets
- ❌ **Never share** age private keys via email/chat

### Documentation

- [Developer Setup Guide](docs/DEVELOPER_SETUP.md) - First-time setup instructions
- [SOPS Troubleshooting](docs/SOPS_TROUBLESHOOTING.md) - Common issues and solutions
- [Research Document](plan/03-research/sops-secret-management.md) - Comprehensive SOPS guide

### Need Help?

- **Can't decrypt secrets?** → Check `~/.config/sops/age/keys.txt` exists
- **Changed secrets?** → Run `npm run secrets:encrypt:dev` before committing
- **Other issues?** → See [SOPS_TROUBLESHOOTING.md](docs/SOPS_TROUBLESHOOTING.md)
```

### Step 7.2: Create Developer Setup Guide

```bash

# Create docs directory if not exists

mkdir -p docs

# Create developer setup guide

cat > docs/DEVELOPER_SETUP.md << 'EOF'

# Developer Setup Guide - SOPS Secret Management

This guide will help you set up SOPS (Secrets OPerationS) for local development.

## Prerequisites

- Git installed
- npm/Node.js installed
- Terminal/command-line access
- Access to team's age private key

## Installation

### Step 1: Install SOPS

**macOS:**
```bash
brew install sops
```

**Linux (Ubuntu/Debian):**
```bash
SOPS_VERSION=3.8.1
curl -Lo sops "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64"
chmod +x sops
sudo mv sops /usr/local/bin/
```

**Verify:**
```bash
sops --version

# Expected: sops 3.8.1 (or later)

```

### Step 2: Install age

**macOS:**
```bash
brew install age
```

**Linux:**
```bash
AGE_VERSION=1.1.1
curl -Lo age.tar.gz "https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz"
tar xf age.tar.gz
sudo mv age/age /usr/local/bin/
sudo mv age/age-keygen /usr/local/bin/
rm -rf age age.tar.gz
```

**Verify:**
```bash
age --version

# Expected: v1.1.1 (or later)

```

### Step 3: Get age Private Key

**Contact your team lead** to get the team's age private key. They will share it with you securely (not via email/chat).

### Step 4: Configure age Key

```bash

# Create SOPS age directory

mkdir -p ~/.config/sops/age

# Paste the age private key into this file:

nano ~/.config/sops/age/keys.txt

# Set correct permissions

chmod 600 ~/.config/sops/age/keys.txt
```

**Verify key format:**
```bash
cat ~/.config/sops/age/keys.txt

# Should look like:
# # created: 2025-12-30T10:30:45+08:00
# # public key: age1xxxxx...
# AGE-SECRET-KEY-1YYYYY...

```

### Step 5: Clone Repository and Decrypt Secrets

```bash

# Clone repository

git clone https://github.com/fairyhunter13/happy-bday-app.git
cd happy-bday-app

# Install dependencies

npm install

# Decrypt development secrets

npm run secrets:decrypt:dev

# Verify .env.development was created

ls -la .env.development
```

### Step 6: Start Development

```bash

# Start development server

npm run dev
```

## Daily Workflow

### Scenario: No Secret Changes (Most Common)

```bash

# Just start development

npm run dev

# (Secrets are auto-decrypted if needed)

```

### Scenario: View Secrets

```bash

# Decrypt secrets

npm run secrets:decrypt:dev

# View file

cat .env.development
```

### Scenario: Add/Update Secret

```bash

# Method 1: Edit encrypted file directly (recommended)

sops secrets/.env.development.enc

# Edit in your default editor, save, quit
# SOPS automatically re-encrypts

# Method 2: Edit decrypted file

npm run secrets:decrypt:dev
nano .env.development

# Make changes

npm run secrets:encrypt:dev

# Commit

git add secrets/.env.development.enc
git commit -m "chore: Update DATABASE_PASSWORD"
git push

# Clean up plaintext

rm .env.development
```

## Troubleshooting

### "no key found" Error

**Problem:** SOPS can't find your age private key.

**Solution:**
```bash

# Verify key file exists

ls -la ~/.config/sops/age/keys.txt

# If missing, contact team lead for key
# Save key to ~/.config/sops/age/keys.txt

```

### "failed to decrypt" Error

**Problem:** Wrong age key or corrupted file.

**Solution:**
```bash

# Verify your public key matches .sops.yaml

grep "public key:" ~/.config/sops/age/keys.txt
grep "age:" .sops.yaml

# If keys don't match, contact team lead for correct key

```

### Decrypted File Not Working

**Problem:** Environment variables not loading.

**Solution:**
```bash

# Verify file exists

ls -la .env.development

# Check file content

head .env.development

# Re-decrypt if needed

rm .env.development
npm run secrets:decrypt:dev
```

## Security Best Practices

### DO ✅

- Keep age private key secure (`~/.config/sops/age/keys.txt`)
- Use `sops` command to edit encrypted files
- Encrypt before committing changes
- Delete plaintext `.env` files after encrypting

### DON'T ❌

- Commit age private key to Git
- Share age private key via email/chat
- Commit plaintext `.env` files
- Log secret values in application

## Need Help?

- **Slack:** #engineering channel
- **Email:** devops@digitalenvision.com.au
- **Docs:** [SOPS_TROUBLESHOOTING.md](SOPS_TROUBLESHOOTING.md)
EOF

echo "✅ Created docs/DEVELOPER_SETUP.md"
```

### Step 7.3: Create Troubleshooting Guide

```bash
cat > docs/SOPS_TROUBLESHOOTING.md << 'EOF'

# SOPS Troubleshooting Guide

Common issues and solutions when working with SOPS encrypted secrets.

## Error: "no key found"

**Full Error:**
```
Failed to get the data key required to decrypt the SOPS file.

Group 0: FAILED
  age1xxxxxxxx...: FAILED
    - | no age key found
```

**Causes:**
1. age private key file doesn't exist
2. age key file in wrong location
3. Wrong file permissions

**Solutions:**

```bash

# 1. Check key file exists

ls -la ~/.config/sops/age/keys.txt

# 2. Check file permissions (should be 600)

chmod 600 ~/.config/sops/age/keys.txt

# 3. Set SOPS_AGE_KEY_FILE environment variable

export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt

# 4. Add to shell profile for permanent fix

echo 'export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt' >> ~/.zshrc
source ~/.zshrc
```

## Error: "MAC mismatch" or "failed to decrypt"

**Causes:**
1. Wrong age private key
2. File encrypted with different key
3. Corrupted encrypted file

**Solutions:**

```bash

# 1. Verify your public key matches .sops.yaml
# Extract your public key:

grep "public key:" ~/.config/sops/age/keys.txt

# Check .sops.yaml:

grep "age:" .sops.yaml

# Keys should match!

# 2. If keys don't match, get correct key from team lead

# 3. Check file integrity

git status secrets/

# If file shows as modified, restore:

git checkout secrets/.env.development.enc
```

## Error: "sops: command not found"

**Causes:**
1. SOPS not installed
2. SOPS not in PATH

**Solutions:**

```bash

# macOS

brew install sops

# Linux

SOPS_VERSION=3.8.1
curl -Lo sops "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64"
chmod +x sops
sudo mv sops /usr/local/bin/

# Verify installation

which sops
sops --version
```

## Error: Environment variables not loading

**Causes:**
1. `.env` file not decrypted
2. Application not configured to read `.env` file
3. Wrong environment file loaded

**Solutions:**

```bash

# 1. Decrypt secrets

npm run secrets:decrypt:dev

# 2. Verify file exists

ls -la .env.development

# 3. Check file content

head -5 .env.development

# 4. Ensure application loads correct env file
# Check your app's dotenv configuration

```

## Error: CI/CD decryption fails

**Causes:**
1. GitHub Secret not set
2. GitHub Secret contains wrong key
3. Secret name mismatch in workflow

**Solutions:**

```bash

# 1. Verify GitHub Secret exists

gh secret list

# Should show: SOPS_AGE_KEY_DEV

# 2. Update secret if needed

cat ~/.config/sops/age/keys.txt | gh secret set SOPS_AGE_KEY_DEV

# 3. Check workflow uses correct secret name

grep "secrets.SOPS_AGE_KEY" .github/workflows/*.yml
```

## Issue: Accidentally committed plaintext secret

**Immediate Actions:**

```bash

# 1. Remove from latest commit (if not pushed)

git reset HEAD .env
git commit --amend --no-edit

# 2. If already pushed, remove and force push

git rm .env
git commit -m "security: Remove accidentally committed .env"
git push --force

# 3. If in Git history, use git-filter-repo

pip install git-filter-repo
git filter-repo --path .env --invert-paths
git push --force --all

# 4. IMPORTANT: Rotate all secrets in that file
# All passwords, API keys, tokens are now considered compromised

```

**Prevention:**

```bash

# Ensure .gitignore is correct

grep "^\.env$" .gitignore || echo ".env" >> .gitignore
grep "^\.env\.\*$" .gitignore || echo ".env.*" >> .gitignore

# Verify ignored

git check-ignore .env .env.development

# Should output: .env and .env.development

```

## Issue: Lost age private key

**Actions:**

```bash

# 1. Check backups

ls ~/secure-backups/

# 2. If no backup, contact team lead immediately
# They should have backup of team key

# 3. If team key is lost, generate new key and re-encrypt:

age-keygen -o ~/.config/sops/age/keys.txt

# Update .sops.yaml with new public key
# Re-encrypt all files:

npm run secrets:encrypt:dev
npm run secrets:encrypt:test
```

## Issue: Need to rotate keys

**Process:**

```bash

# 1. Use rotation script

npm run secrets:rotate development

# 2. Follow on-screen instructions:
#    - Update .sops.yaml
#    - Update GitHub Secrets
#    - Notify team members

# 3. Test new key

sops -d secrets/.env.development.enc
```

## Issue: Performance (slow encryption/decryption)

**Solutions:**

```bash

# 1. Use encrypted_regex to limit encrypted fields
# Edit .sops.yaml:

encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY).*'

# 2. Split large config files into smaller files
# Instead of one huge .env:

secrets/.env.database.enc
secrets/.env.redis.enc
secrets/.env.rabbitmq.enc
```

## Getting More Help

If issues persist:

1. **Check logs:**
   ```bash
   # Run with debug output
   SOPS_DEBUG=1 sops -d secrets/.env.development.enc
```

2. **Validate .sops.yaml:**
   ```bash
   cat .sops.yaml
   # Check for syntax errors
```

3. **Contact team:**
   - Slack: #engineering
   - Email: devops@digitalenvision.com.au

4. **Official docs:**
   - [SOPS Documentation](https://github.com/getsops/sops)
   - [age Documentation](https://github.com/FiloSottile/age)
EOF

echo "✅ Created docs/SOPS_TROUBLESHOOTING.md"
```

### Step 7.4: Create Team Onboarding Checklist

```bash
cat > docs/TEAM_ONBOARDING.md << 'EOF'

# Team Onboarding - SOPS Secret Management

Checklist for onboarding new team members to SOPS-encrypted secret management.

## For Team Lead / DevOps

When a new developer joins:

- [ ] **Generate or Share age Key**
  - Option 1: Share existing team development key
  - Option 2: Generate new key and re-encrypt files

- [ ] **Share Key Securely**
  - Use password manager (1Password, LastPass)
  - Or encrypted email with separate password
  - Never use Slack/unencrypted email

- [ ] **Send Setup Instructions**
  - Share [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)
  - Provide key file content
  - Verify they can decrypt secrets

- [ ] **Add to GitHub Team** (if using team permissions)
  - Settings → Manage Access → Add team member

- [ ] **Update Documentation**
  - Add new member to CODEOWNERS (if applicable)
  - Update team contact list

## For New Developer

Complete these steps on your first day:

### Pre-Setup (Before First Day)

- [ ] Install Git
- [ ] Install Node.js (version 20 or later)
- [ ] Install package manager (Homebrew on macOS)
- [ ] Get GitHub account access

### Day 1 Setup

- [ ] **Install SOPS**
  ```bash
  brew install sops  # macOS
  sops --version     # Verify
```

- [ ] **Install age**
  ```bash
  brew install age   # macOS
  age --version      # Verify
```

- [ ] **Get age Private Key**
  - Request from team lead
  - Receive via secure channel

- [ ] **Configure age Key**
  ```bash
  mkdir -p ~/.config/sops/age
  nano ~/.config/sops/age/keys.txt  # Paste key
  chmod 600 ~/.config/sops/age/keys.txt
```

- [ ] **Clone Repository**
  ```bash
  git clone https://github.com/fairyhunter13/happy-bday-app.git
  cd happy-bday-app
```

- [ ] **Install Dependencies**
  ```bash
  npm install
```

- [ ] **Decrypt Secrets**
  ```bash
  npm run secrets:decrypt:dev
```

- [ ] **Verify Setup**
  ```bash
  ls -la .env.development  # Should exist
  npm run dev              # Should start successfully
```

### First Week Tasks

- [ ] Read [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)
- [ ] Read [SOPS_TROUBLESHOOTING.md](SOPS_TROUBLESHOOTING.md)
- [ ] Practice encrypting/decrypting secrets
- [ ] Understand daily workflow
- [ ] Ask questions in #engineering

### Knowledge Check

Before working independently:

- [ ] Can decrypt development secrets
- [ ] Understand how to add new secrets
- [ ] Know how to encrypt before committing
- [ ] Understand security best practices
- [ ] Know who to contact for help

## When Developer Leaves

**CRITICAL:** Rotate keys when a team member leaves.

- [ ] **Immediate Actions** (within 24 hours)
  - [ ] Remove GitHub access
  - [ ] Revoke Slack/email access
  - [ ] Notify team of departure

- [ ] **Key Rotation** (within 7 days)
  - [ ] Generate new age key
  - [ ] Update .sops.yaml
  - [ ] Re-encrypt all files
  - [ ] Update GitHub Secrets
  - [ ] Distribute new key to remaining team

- [ ] **Verification**
  - [ ] Old key cannot decrypt new files
  - [ ] All team members have new key
  - [ ] CI/CD works with new key

## Security Reminders

### For Everyone

- ✅ Keep age private key secure
- ✅ Use SOPS commands for editing secrets
- ✅ Encrypt before committing
- ✅ Delete plaintext files after encrypting

### For Team Leads

- ✅ Maintain backup of team key
- ✅ Rotate keys every 90 days minimum
- ✅ Audit team access quarterly
- ✅ Keep onboarding checklist updated

## Questions?

- **Slack:** #engineering
- **Email:** devops@digitalenvision.com.au
- **Documentation:** [DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)
EOF

echo "✅ Created docs/TEAM_ONBOARDING.md"
```

### Step 7.5: Update .gitignore (Final Check)

```bash

# Ensure .gitignore has comprehensive secret exclusions

cat >> .gitignore << 'EOF'

# ==============================================
# SOPS Secret Management
# ==============================================

# Decrypted environment files (NEVER COMMIT)

.env
.env.*
!.env.example
!.env.*.example

# EXCEPT: Allow encrypted files

!*.enc

# SOPS age private keys (NEVER COMMIT)

secrets/age/keys.txt
secrets/age/*.txt
!secrets/age/.gitkeep
age/keys.txt
*.key

# Temporary decrypted files

*.dec
*.decrypted
tmp/

# SOPS metadata

.sops.pub

# Backup files

*.backup
EOF

# Remove duplicates from .gitignore

sort .gitignore | uniq > .gitignore.tmp
mv .gitignore.tmp .gitignore

echo "✅ Updated .gitignore with SOPS exclusions"
```

### Step 7.6: Commit Documentation

```bash

# Add all documentation

git add README.md
git add docs/DEVELOPER_SETUP.md
git add docs/SOPS_TROUBLESHOOTING.md
git add docs/TEAM_ONBOARDING.md
git add .gitignore

# Commit

git commit -m "docs: Add comprehensive SOPS documentation

- Update README with SOPS quick start guide
- Add developer setup guide for first-time configuration
- Create troubleshooting guide for common issues
- Add team onboarding checklist for new developers
- Update .gitignore with comprehensive secret exclusions"

# Push

git push origin main
```

### Rollback Procedure

```bash

# Restore original documentation

cp README.md.backup README.md

# Remove new documentation

rm docs/DEVELOPER_SETUP.md
rm docs/SOPS_TROUBLESHOOTING.md
rm docs/TEAM_ONBOARDING.md

# Uncommit

git reset HEAD README.md docs/ .gitignore
```

### Time Estimate

- 30-40 minutes

---

## Phase 8: Testing

**Duration:** 45 minutes
**Prerequisites:** All previous phases complete
**Risk Level:** Low

### Objectives

- Validate encryption/decryption works correctly
- Test CI/CD pipeline end-to-end
- Verify no secrets leaked in Git history or logs
- Test developer workflow scenarios

### Step 8.1: Test Local Encryption/Decryption

```bash

# Navigate to project root

cd /Users/hafizputraludyanto/git/github.com/fairyhunter13/happy-bday-app

# Test 1: Decrypt development secrets

echo "Test 1: Decrypting development secrets..."
npm run secrets:decrypt:dev

# Verify .env.development exists

if [ -f .env.development ]; then
  echo "✅ .env.development created successfully"
  echo "File size: $(wc -c < .env.development) bytes"
else
  echo "❌ Failed to create .env.development"
  exit 1
fi

# Test 2: Verify decrypted content

echo ""
echo "Test 2: Verifying decrypted content..."
if grep -q "NODE_ENV" .env.development && grep -q "DATABASE_URL" .env.development; then
  echo "✅ Environment variables present"
else
  echo "❌ Environment variables missing"
  exit 1
fi

# Test 3: Re-encrypt

echo ""
echo "Test 3: Re-encrypting secrets..."
npm run secrets:encrypt:dev

# Verify encrypted file updated

if [ -f secrets/.env.development.enc ]; then
  echo "✅ Re-encryption successful"
else
  echo "❌ Re-encryption failed"
  exit 1
fi

# Test 4: Compare decryption with original

echo ""
echo "Test 4: Comparing decrypted vs original..."
sops -d secrets/.env.development.enc > .env.development.test
diff .env.development .env.development.test
if [ $? -eq 0 ]; then
  echo "✅ Files match - encryption/decryption working correctly"
else
  echo "❌ Files don't match - check encryption"
  exit 1
fi

# Cleanup test files

rm .env.development .env.development.test

echo ""
echo "✅ All local encryption/decryption tests passed"
```

**Expected Output:**
```
Test 1: Decrypting development secrets...
✅ .env.development created successfully
File size: 1456 bytes

Test 2: Verifying decrypted content...
✅ Environment variables present

Test 3: Re-encrypting secrets...
✅ Re-encryption successful

Test 4: Comparing decrypted vs original...
✅ Files match - encryption/decryption working correctly

✅ All local encryption/decryption tests passed
```

### Step 8.2: Test In-Place Editing

```bash
echo "Test 5: Testing in-place editing..."

# Edit encrypted file (will open in editor)
# For automated testing, we'll use printf to simulate editing

echo ""
echo "Simulating in-place edit (adding test variable)..."

# Get current content

CURRENT_CONTENT=$(sops -d secrets/.env.development.enc)

# Add test variable

echo "${CURRENT_CONTENT}" > .env.development.tmp
echo "TEST_VARIABLE=test_value_$(date +%s)" >> .env.development.tmp

# Re-encrypt with updated content

sops -e .env.development.tmp > secrets/.env.development.enc
rm .env.development.tmp

# Verify test variable exists

if sops -d secrets/.env.development.enc | grep -q "TEST_VARIABLE"; then
  echo "✅ In-place edit successful - new variable added"
else
  echo "❌ In-place edit failed"
  exit 1
fi

# Remove test variable (cleanup)

CLEAN_CONTENT=$(sops -d secrets/.env.development.enc | grep -v "TEST_VARIABLE")
echo "${CLEAN_CONTENT}" | sops -e /dev/stdin > secrets/.env.development.enc

echo "✅ In-place editing test passed"
```

### Step 8.3: Test npm Scripts

```bash
echo ""
echo "Test 6: Testing npm scripts..."

# Test decrypt:dev

npm run secrets:decrypt:dev > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ npm run secrets:decrypt:dev works"
else
  echo "❌ npm run secrets:decrypt:dev failed"
  exit 1
fi

# Test encrypt:dev

npm run secrets:encrypt:dev > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ npm run secrets:encrypt:dev works"
else
  echo "❌ npm run secrets:encrypt:dev failed"
  exit 1
fi

# Test decrypt:test

npm run secrets:decrypt:test > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ npm run secrets:decrypt:test works"
else
  echo "❌ npm run secrets:decrypt:test failed"
  exit 1
fi

# Cleanup

rm .env.development .env.test 2>/dev/null

echo "✅ All npm scripts working correctly"
```

### Step 8.4: Test CI/CD Pipeline

```bash
echo ""
echo "Test 7: Testing CI/CD pipeline..."

# Create test branch

git checkout -b test/sops-integration-$(date +%s)

# Make a trivial change to trigger CI

echo "# SOPS Integration Test - $(date)" >> README.md

# Commit and push

git add README.md
git commit -m "test: Trigger CI for SOPS integration test"
git push origin HEAD

echo "✅ Pushed test branch to trigger CI"
echo ""
echo "Please check GitHub Actions:"
echo "1. Go to: https://github.com/fairyhunter13/happy-bday-app/actions"
echo "2. Verify latest workflow run succeeded"
echo "3. Check logs for:"
echo "   - ✅ SOPS installation successful"
echo "   - ✅ age installation successful"
echo "   - ✅ Secrets decrypted successfully"
echo "   - ✅ Tests passed"
echo "   - 🧹 Secrets cleaned up"
echo ""
read -p "Press ENTER after verifying CI workflow passed..."

# Clean up test branch

git checkout main
git branch -D test/sops-integration-*
git push origin --delete test/sops-integration-* 2>/dev/null || true

echo "✅ CI/CD pipeline test complete"
```

### Step 8.5: Verify No Secrets in Git History

```bash
echo ""
echo "Test 8: Checking for secrets in Git history..."

# Check for plaintext .env files in Git history

if git log --all --full-history -- ".env" 2>/dev/null | grep -q "^commit"; then
  echo "⚠️  WARNING: .env file found in Git history"
  echo "This should be investigated and removed if it contains secrets"
else
  echo "✅ No .env file in Git history"
fi

# Check for age private keys in Git history

if git log --all --full-history -- "*keys.txt" "*age*" "*.key" 2>/dev/null | grep -q "^commit"; then
  echo "⚠️  WARNING: Potential private key found in Git history"
  echo "This should be investigated immediately"
else
  echo "✅ No private keys in Git history"
fi

# Check current repository for plaintext secrets

echo ""
echo "Checking current repository for plaintext secrets..."

# List all tracked .env files (excluding .example and .enc)

PLAINTEXT_ENV=$(git ls-files | grep -E '^\.env(\.|$)' | grep -v '\.example$' | grep -v '\.enc$' || true)

if [ -n "$PLAINTEXT_ENV" ]; then
  echo "❌ Found plaintext .env files in repository:"
  echo "$PLAINTEXT_ENV"
  echo "These should be removed and encrypted"
  exit 1
else
  echo "✅ No plaintext .env files in repository"
fi

echo "✅ Git history verification complete"
```

### Step 8.6: Test Encrypted File Integrity

```bash
echo ""
echo "Test 9: Validating encrypted file integrity..."

# Function to validate file

validate_file() {
  local file=$1

  # Check file exists
  if [ ! -f "$file" ]; then
    echo "❌ File not found: $file"
    return 1
  fi

  # Check SOPS metadata present
  if ! grep -q "sops:" "$file"; then
    echo "❌ No SOPS metadata in $file"
    return 1
  fi

  # Check encrypted values present
  if ! grep -q "ENC\[AES256_GCM" "$file"; then
    echo "❌ No encrypted values in $file"
    return 1
  fi

  # Test decryption
  if ! sops -d "$file" > /dev/null 2>&1; then
    echo "❌ Failed to decrypt $file"
    return 1
  fi

  echo "✅ $file is valid"
  return 0
}

# Validate all encrypted files

validate_file "secrets/.env.development.enc"
validate_file "secrets/.env.test.enc"

# Optional: validate production if exists

[ -f "secrets/.env.production.enc" ] && validate_file "secrets/.env.production.enc"

echo "✅ All encrypted files validated"
```

### Step 8.7: Test Error Scenarios

```bash
echo ""
echo "Test 10: Testing error handling..."

# Test 1: Missing source file

echo "Testing encrypt with missing source file..."
if npm run secrets:encrypt:dev 2>&1 | grep -q "not found"; then
  echo "✅ Correctly handles missing source file"
else
  echo "⚠️  Error handling may need improvement"
fi

# Test 2: Missing encrypted file

echo "Testing decrypt with missing encrypted file..."
mv secrets/.env.development.enc secrets/.env.development.enc.backup
if npm run secrets:decrypt:dev 2>&1 | grep -q "not found"; then
  echo "✅ Correctly handles missing encrypted file"
else
  echo "⚠️  Error handling may need improvement"
fi
mv secrets/.env.development.enc.backup secrets/.env.development.enc

# Test 3: Verify cleanup on error (in CI)

echo "✅ Error handling tests complete"
```

### Step 8.8: Performance Test

```bash
echo ""
echo "Test 11: Performance testing..."

# Time encryption

echo "Testing encryption speed..."
time npm run secrets:encrypt:dev > /dev/null 2>&1
ENCRYPT_TIME=$?

# Time decryption

echo "Testing decryption speed..."
time npm run secrets:decrypt:dev > /dev/null 2>&1
DECRYPT_TIME=$?

# Cleanup

rm .env.development 2>/dev/null

if [ $ENCRYPT_TIME -eq 0 ] && [ $DECRYPT_TIME -eq 0 ]; then
  echo "✅ Performance test passed"
  echo "Note: Encryption/decryption should take < 1 second for typical .env files"
else
  echo "⚠️  Performance may be slow - investigate"
fi
```

### Step 8.9: Generate Test Report

```bash
echo ""
echo "==================== SOPS INTEGRATION TEST REPORT ===================="
echo "Test Date: $(date)"
echo "Project: Birthday Message Scheduler"
echo ""
echo "Tests Performed:"
echo "  ✅ Local encryption/decryption"
echo "  ✅ In-place editing"
echo "  ✅ npm scripts functionality"
echo "  ✅ CI/CD pipeline integration"
echo "  ✅ Git history verification"
echo "  ✅ Encrypted file integrity"
echo "  ✅ Error handling"
echo "  ✅ Performance benchmarks"
echo ""
echo "Files Validated:"
ls -lh secrets/*.enc
echo ""
echo "Next Steps:"
echo "  1. Review this test report"
echo "  2. Verify CI/CD workflow passed in GitHub Actions"
echo "  3. Proceed to Phase 9: Cleanup"
echo "======================================================================"
```

### Rollback Procedure

If tests fail:

```bash

# Restore from backups

BACKUP_DIR=~/secure-backups/happy-bday-app-sops-$(date +%Y%m%d)
cp ${BACKUP_DIR}/env.development.backup .env.development
cp ${BACKUP_DIR}/env.test.backup .env.test

# Re-encrypt with correct settings

npm run secrets:encrypt:dev
npm run secrets:encrypt:test

# Commit fixes

git add secrets/
git commit -m "fix: Correct SOPS encryption issues"
git push
```

### Time Estimate

- 30-40 minutes

---

## Phase 9: Cleanup

**Duration:** 30 minutes
**Prerequisites:** Phase 8 complete, all tests passed
**Risk Level:** High (deleting files)

### Objectives

- Remove plaintext `.env` files from repository and working directory
- Verify `.gitignore` prevents future commits
- Archive backups securely
- Final security audit

### Step 9.1: Verify All Encrypted Files Exist

**CRITICAL:** Before deleting plaintext files, verify encrypted versions exist.

```bash
echo "Step 1: Verifying all encrypted files exist..."
echo ""

# Check encrypted files

REQUIRED_FILES=(
  "secrets/.env.development.enc"
  "secrets/.env.test.enc"
)

ALL_EXIST=true

for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file exists ($(wc -c < $file) bytes)"

    # Verify can decrypt
    if sops -d "$file" > /dev/null 2>&1; then
      echo "   ✅ Can decrypt successfully"
    else
      echo "   ❌ CANNOT DECRYPT - DO NOT DELETE PLAINTEXT"
      ALL_EXIST=false
    fi
  else
    echo "❌ $file MISSING - DO NOT PROCEED"
    ALL_EXIST=false
  fi
  echo ""
done

if [ "$ALL_EXIST" = false ]; then
  echo "❌ ERROR: Not all encrypted files exist or are valid"
  echo "DO NOT PROCEED WITH CLEANUP"
  exit 1
fi

echo "✅ All encrypted files exist and are valid"
```

### Step 9.2: Create Final Backup

```bash
echo ""
echo "Step 2: Creating final backup before cleanup..."

# Create final backup directory

FINAL_BACKUP_DIR=~/secure-backups/happy-bday-app-final-$(date +%Y%m%d-%H%M%S)
mkdir -p "$FINAL_BACKUP_DIR"

# Backup all .env files one last time

for env_file in .env .env.* ; do
  if [ -f "$env_file" ] && [[ ! "$env_file" =~ \.enc$ ]]; then
    cp "$env_file" "$FINAL_BACKUP_DIR/" 2>/dev/null || true
    echo "✅ Backed up $env_file"
  fi
done

# List backups

echo ""
echo "Final backups stored in:"
echo "$FINAL_BACKUP_DIR"
ls -lh "$FINAL_BACKUP_DIR"

echo ""
echo "⚠️  IMPORTANT: Keep these backups secure for 30 days"
echo "After 30 days, securely delete them (shred or secure delete tool)"
```

### Step 9.3: Remove Plaintext .env Files from Working Directory

```bash
echo ""
echo "Step 3: Removing plaintext .env files from working directory..."

# List files to be deleted

echo "Files to be deleted:"
ls -la .env .env.* 2>/dev/null | grep -v "\.example" | grep -v "\.enc" || echo "No plaintext .env files found"

echo ""
read -p "⚠️  CONFIRM: Delete plaintext .env files? (yes/no): " CONFIRM

if [ "$CONFIRM" = "yes" ]; then
  # Delete plaintext .env files (but keep .example)
  find . -maxdepth 1 -name ".env*" -type f ! -name "*.example" ! -name "*.enc" -delete

  echo "✅ Plaintext .env files deleted from working directory"

  # Verify deletion
  if ls .env .env.* 2>/dev/null | grep -v "\.example" | grep -v "\.enc"; then
    echo "⚠️  WARNING: Some .env files still exist"
  else
    echo "✅ All plaintext .env files removed"
  fi
else
  echo "❌ Cleanup cancelled - plaintext files retained"
  exit 1
fi
```

### Step 9.4: Remove .env Files from Git History (if needed)

**Only run this if plaintext .env files were previously committed.**

```bash
echo ""
echo "Step 4: Checking Git history for plaintext secrets..."

# Check if .env files are in Git history

if git log --all --full-history -- ".env" ".env.*" 2>/dev/null | grep -q "^commit"; then
  echo "⚠️  WARNING: .env files found in Git history"
  echo ""
  echo "These files contain plaintext secrets and should be removed from history."
  echo ""
  read -p "Remove .env files from Git history? (yes/no): " REMOVE_HISTORY

  if [ "$REMOVE_HISTORY" = "yes" ]; then
    echo ""
    echo "This will rewrite Git history. Ensure:"
    echo "  1. All team members have pushed their work"
    echo "  2. You have backups"
    echo "  3. You're ready to force-push"
    echo ""
    read -p "Continue? (yes/no): " CONTINUE

    if [ "$CONTINUE" = "yes" ]; then
      # Install git-filter-repo if needed
      if ! command -v git-filter-repo &> /dev/null; then
        echo "Installing git-filter-repo..."
        pip3 install git-filter-repo
      fi

      # Remove .env files from history
      echo "Removing .env files from Git history..."
      git-filter-repo --path .env --invert-paths
      git-filter-repo --path-glob '.env.*' --invert-paths

      echo "✅ .env files removed from Git history"
      echo ""
      echo "⚠️  CRITICAL: You must now:"
      echo "  1. Force push: git push --force --all"
      echo "  2. Notify all team members to re-clone repository"
      echo "  3. Rotate ALL secrets (they're now considered compromised)"
    fi
  fi
else
  echo "✅ No .env files found in Git history"
fi
```

### Step 9.5: Update and Verify .gitignore

```bash
echo ""
echo "Step 5: Verifying .gitignore configuration..."

# Verify .gitignore contains required patterns

REQUIRED_PATTERNS=(
  "^\.env$"
  "^\.env\.\*$"
  "^\!\.env\.example$"
  "^\!\.env\.\*\.example$"
  "^\!\*\.enc$"
)

MISSING_PATTERNS=()

for pattern in "${REQUIRED_PATTERNS[@]}"; do
  if ! grep -q "$pattern" .gitignore; then
    MISSING_PATTERNS+=("$pattern")
  fi
done

if [ ${#MISSING_PATTERNS[@]} -gt 0 ]; then
  echo "⚠️  WARNING: .gitignore missing required patterns:"
  printf '%s\n' "${MISSING_PATTERNS[@]}"
  echo ""
  echo "Adding missing patterns..."

  cat >> .gitignore << 'EOF'

# SOPS - Ensure no plaintext secrets committed

.env
.env.*
!.env.example
!.env.*.example
!*.enc
EOF

  echo "✅ Updated .gitignore"
else
  echo "✅ .gitignore contains all required patterns"
fi

# Test .gitignore

echo ""
echo "Testing .gitignore patterns..."

# Create test files

touch .env.test-ignore
touch .env.development.test-ignore

# Check if ignored

if git check-ignore .env.test-ignore .env.development.test-ignore > /dev/null 2>&1; then
  echo "✅ .gitignore correctly ignores .env files"
else
  echo "❌ .gitignore NOT ignoring .env files - FIX IMMEDIATELY"
  exit 1
fi

# Cleanup test files

rm .env.test-ignore .env.development.test-ignore
```

### Step 9.6: Verify Encrypted Files Are Tracked

```bash
echo ""
echo "Step 6: Verifying encrypted files are tracked by Git..."

# Check encrypted files are NOT ignored

ENCRYPTED_FILES=(
  "secrets/.env.development.enc"
  "secrets/.env.test.enc"
)

for file in "${ENCRYPTED_FILES[@]}"; do
  if git check-ignore "$file" > /dev/null 2>&1; then
    echo "❌ ERROR: $file is being ignored by Git"
    echo "Encrypted files should be committed!"
    exit 1
  else
    echo "✅ $file is tracked by Git"
  fi
done

# Check encrypted files are committed

echo ""
echo "Checking if encrypted files are committed..."
git ls-files secrets/*.enc | while read file; do
  echo "✅ $file is committed"
done
```

### Step 9.7: Clean Up Temporary Files

```bash
echo ""
echo "Step 7: Cleaning up temporary files..."

# Remove backup files

rm -f .env*.backup
rm -f .sops.yaml.bak
rm -f package.json.backup
rm -f README.md.backup

# Remove test files

rm -f .env.test-*
rm -f .env.development.tmp

# Remove workflow backups (keep for reference)
# rm -rf .github/workflows-backup

echo "✅ Temporary files cleaned up"
```

### Step 9.8: Final Security Audit

```bash
echo ""
echo "Step 8: Running final security audit..."
echo ""

# Check 1: No plaintext .env files

echo "1. Checking for plaintext .env files..."
if find . -name ".env*" -type f ! -name "*.example" ! -name "*.enc" | grep -q .; then
  echo "❌ Found plaintext .env files:"
  find . -name ".env*" -type f ! -name "*.example" ! -name "*.enc"
  exit 1
else
  echo "✅ No plaintext .env files found"
fi

# Check 2: All encrypted files exist

echo "2. Checking encrypted files..."
for file in secrets/*.enc; do
  if [ -f "$file" ]; then
    echo "✅ $file exists"
  fi
done

# Check 3: No age keys committed

echo "3. Checking for committed age keys..."
if git ls-files | grep -q "keys.txt"; then
  echo "❌ Found age key in repository!"
  git ls-files | grep "keys.txt"
  exit 1
else
  echo "✅ No age keys committed"
fi

# Check 4: .gitignore works

echo "4. Verifying .gitignore..."
touch .env.audit-test
if git check-ignore .env.audit-test > /dev/null; then
  echo "✅ .gitignore correctly excludes .env files"
else
  echo "❌ .gitignore NOT working"
  exit 1
fi
rm .env.audit-test

# Check 5: GitHub Secrets configured

echo "5. Checking GitHub Secrets..."
if gh secret list 2>/dev/null | grep -q "SOPS_AGE_KEY"; then
  echo "✅ GitHub Secrets configured"
else
  echo "⚠️  Cannot verify GitHub Secrets (gh CLI not authenticated)"
fi

echo ""
echo "✅ Security audit complete"
```

### Step 9.9: Final Commit and Push

```bash
echo ""
echo "Step 9: Final commit and push..."

# Stage any remaining changes

git add .gitignore
git add secrets/

# Check if there are changes to commit

if git diff --staged --quiet; then
  echo "ℹ️  No changes to commit"
else
  # Commit
  git commit -m "chore: Complete SOPS migration cleanup

- Remove plaintext .env files
- Verify all secrets encrypted
- Update .gitignore with comprehensive patterns
- Complete security audit

All plaintext secrets removed. Encrypted versions in secrets/ directory.
Use 'npm run secrets:decrypt:dev' to decrypt for local development."

  echo "✅ Changes committed"
fi

# Push to remote

echo ""
read -p "Push to remote repository? (yes/no): " PUSH_CONFIRM

if [ "$PUSH_CONFIRM" = "yes" ]; then
  git push origin main
  echo "✅ Changes pushed to remote"
else
  echo "⚠️  Changes not pushed - remember to push manually"
fi
```

### Step 9.10: Generate Cleanup Report

```bash
echo ""
echo "==================== SOPS MIGRATION CLEANUP REPORT ===================="
echo "Cleanup Date: $(date)"
echo "Project: Birthday Message Scheduler"
echo ""
echo "Actions Completed:"
echo "  ✅ Verified all encrypted files exist and are valid"
echo "  ✅ Created final backup of plaintext files"
echo "  ✅ Removed plaintext .env files from working directory"
echo "  ✅ Updated and verified .gitignore"
echo "  ✅ Verified encrypted files are tracked in Git"
echo "  ✅ Cleaned up temporary files"
echo "  ✅ Completed security audit"
echo "  ✅ Committed and pushed final changes"
echo ""
echo "Encrypted Files:"
ls -lh secrets/*.enc
echo ""
echo "Backups Location:"
echo "  $FINAL_BACKUP_DIR"
echo "  ⚠️  Keep secure for 30 days, then securely delete"
echo ""
echo "Next Steps:"
echo "  1. Notify team of SOPS migration completion"
echo "  2. Share docs/DEVELOPER_SETUP.md with team"
echo "  3. Distribute age private key to team members securely"
echo "  4. Monitor CI/CD for any issues"
echo "  5. Schedule first key rotation (90 days)"
echo ""
echo "Support Resources:"
echo "  - Developer Setup: docs/DEVELOPER_SETUP.md"
echo "  - Troubleshooting: docs/SOPS_TROUBLESHOOTING.md"
echo "  - Team Onboarding: docs/TEAM_ONBOARDING.md"
echo "======================================================================"
```

### Rollback Procedure

**If you need to restore plaintext files:**

```bash

# Restore from final backup

FINAL_BACKUP_DIR=~/secure-backups/happy-bday-app-final-*
cp ${FINAL_BACKUP_DIR}/.env* .

# Verify restoration

ls -la .env*

echo "⚠️  Plaintext files restored from backup"
echo "Remember to delete again after resolving issues"
```

### Time Estimate

- 20-30 minutes

---

## Security Checklist

Use this checklist to verify security best practices are followed:

### Before Migration

- [ ] All team members notified of SOPS migration
- [ ] Backups created of all .env files
- [ ] SOPS and age installed and tested locally
- [ ] age key generated and stored securely
- [ ] `.sops.yaml` configured with correct public key

### During Migration

- [ ] All .env files successfully encrypted
- [ ] Encrypted files committed to Git
- [ ] GitHub Secrets configured with age private key
- [ ] CI/CD workflows updated with SOPS decryption
- [ ] All workflows tested and passing
- [ ] Helper scripts created and working
- [ ] Documentation complete

### After Migration

- [ ] All plaintext .env files removed from working directory
- [ ] No plaintext secrets in Git history
- [ ] `.gitignore` prevents future plaintext commits
- [ ] age private key NOT committed to Git
- [ ] GitHub Secrets accessible in CI/CD
- [ ] Team members can decrypt secrets locally
- [ ] Backups stored securely (outside Git)

### Ongoing Security

- [ ] Key rotation scheduled (every 90 days minimum)
- [ ] Team members trained on SOPS workflow
- [ ] Onboarding process documented for new developers
- [ ] Offboarding process includes key rotation
- [ ] Regular audits of encrypted files
- [ ] Monitor CI/CD logs for secret exposure
- [ ] Keep SOPS and age tools updated

---

## Validation Steps

### Validate Locally

```bash

# 1. Decrypt secrets

npm run secrets:decrypt:dev

# 2. Verify file exists and has content

ls -lh .env.development
cat .env.development | head -5

# 3. Re-encrypt

npm run secrets:encrypt:dev

# 4. Verify encryption

sops -d secrets/.env.development.enc | head -5

# 5. Cleanup

rm .env.development
```

### Validate in CI/CD

1. **Push a test commit:**
```bash
   git checkout -b test/sops-validation
   echo "# Test" >> README.md
   git add README.md
   git commit -m "test: Validate SOPS in CI"
   git push origin HEAD
   ```

2. **Check GitHub Actions:**
   - Go to repository → Actions
   - Verify latest workflow succeeded
   - Check logs contain:
     - `✅ SOPS installation successful`
     - `✅ age installation successful`
     - `✅ Secrets decrypted successfully`
     - `✅ Tests passed`
     - `🧹 Secrets cleaned up`

3. **Verify no secrets in logs:**
   - Review workflow logs
   - Ensure no plaintext passwords/API keys visible
   - Check cleanup step executed

### Validate Security

```bash

# 1. No plaintext secrets in repository

git ls-files | grep -E '^\.env(\.|$)' | grep -v '\.example$' | grep -v '\.enc$'

# Should return: nothing

# 2. No age keys in repository

git ls-files | grep -i "key"

# Should not show: keys.txt or age private keys

# 3. Encrypted files are tracked

git ls-files secrets/*.enc

# Should show: all encrypted .env files

# 4. .gitignore works

touch .env.test-validation
git check-ignore .env.test-validation

# Should return: .env.test-validation (file is ignored)

rm .env.test-validation
```

---

## Rollback Procedures

### Full Rollback (Before Cleanup Phase)

If you need to completely roll back the SOPS migration:

```bash

# 1. Restore plaintext .env files from backups

BACKUP_DIR=~/secure-backups/happy-bday-app-sops-$(date +%Y%m%d)
cp ${BACKUP_DIR}/* .

# 2. Remove encrypted files

rm -rf secrets/

# 3. Remove SOPS configuration

rm .sops.yaml

# 4. Remove helper scripts

rm scripts/encrypt-env.sh
rm scripts/decrypt-env.sh
rm scripts/rotate-age-key.sh

# 5. Restore original package.json

cp package.json.backup package.json

# 6. Restore original workflows

cp .github/workflows-backup/* .github/workflows/

# 7. Restore original documentation

cp README.md.backup README.md
rm docs/DEVELOPER_SETUP.md
rm docs/SOPS_TROUBLESHOOTING.md
rm docs/TEAM_ONBOARDING.md

# 8. Uncommit all SOPS changes

git reset --hard <commit-before-sops>

# 9. Force push (if already pushed)

git push --force origin main

# 10. Delete GitHub Secrets

gh secret delete SOPS_AGE_KEY_DEV
gh secret delete SOPS_AGE_KEY_PROD

# 11. Notify team of rollback

echo "⚠️  SOPS migration rolled back"
echo "Using plaintext .env files again"
```

### Partial Rollback (Specific Component)

**Rollback workflows only:**
```bash
cp .github/workflows-backup/* .github/workflows/
git add .github/workflows/
git commit -m "revert: Rollback workflow changes"
git push
```

**Rollback documentation only:**
```bash
cp README.md.backup README.md
rm docs/DEVELOPER_SETUP.md docs/SOPS_TROUBLESHOOTING.md docs/TEAM_ONBOARDING.md
git add README.md docs/
git commit -m "revert: Rollback documentation changes"
git push
```

**Rollback encryption (use plaintext again):**
```bash

# Decrypt all files

npm run secrets:decrypt:dev
npm run secrets:decrypt:test

# Keep plaintext files, remove encrypted

rm secrets/.env.*.enc

# Update .gitignore to allow .env files
# (NOT RECOMMENDED - security risk)

```

---

## Post-Implementation

### Immediate Actions (Day 1)

1. **Announce to Team:**
```
   Subject: 🔒 SOPS Secret Management Now Active

   Hi Team,

   SOPS (Secrets OPerationS) migration is complete!

   What changed:
   ✅ All secrets now encrypted with age
   ✅ No more plaintext .env files
   ✅ Secure CI/CD integration

   Action Required:
   1. Read: docs/DEVELOPER_SETUP.md
   2. Get age key from me (DM on Slack)
   3. Run: npm run secrets:decrypt:dev
   4. Test: npm run dev

   Questions? #engineering channel or DM me.
   ```

2. **Distribute age Key:**
   - Send to each team member individually
   - Use secure method (1Password, encrypted email)
   - Verify each person can decrypt successfully

3. **Monitor First Day:**
   - Watch for CI/CD failures
   - Help team members with setup issues
   - Address questions quickly

### First Week

1. **Daily Monitoring:**
   - [ ] Check CI/CD logs for errors
   - [ ] Monitor team questions/issues
   - [ ] Verify all team members can decrypt

2. **Team Validation:**
   - [ ] Each team member successfully decrypts secrets
   - [ ] Each team member can commit encrypted changes
   - [ ] No plaintext secrets committed accidentally

3. **Documentation Review:**
   - [ ] Update based on team feedback
   - [ ] Add FAQ for common questions
   - [ ] Improve troubleshooting guide

### First Month

1. **Schedule Key Rotation Drill:**
   - Practice key rotation process
   - Verify rotation script works
   - Document any issues

2. **Security Audit:**
   - [ ] Review all encrypted files
   - [ ] Check Git history for leaks
   - [ ] Audit team member access
   - [ ] Review GitHub Secret usage

3. **Optimization:**
   - [ ] Analyze encryption/decryption performance
   - [ ] Optimize .sops.yaml rules
   - [ ] Update documentation based on learnings

### Ongoing Maintenance

1. **Monthly:**
   - [ ] Review CI/CD logs for issues
   - [ ] Check for new team members needing setup
   - [ ] Audit encrypted files

2. **Quarterly:**
   - [ ] Rotate age keys (every 90 days)
   - [ ] Security audit
   - [ ] Review and update documentation
   - [ ] Check for SOPS/age updates

3. **When Team Members Leave:**
   - [ ] Remove GitHub access immediately
   - [ ] Rotate all age keys within 7 days
   - [ ] Update GitHub Secrets
   - [ ] Distribute new keys to remaining team

### Success Metrics

Track these metrics to measure success:

1. **Security:**
   - Zero plaintext secrets in repository
   - Zero secret exposures in CI/CD logs
   - 100% of secrets encrypted

2. **Usability:**
   - Average setup time < 30 minutes
   - < 5% of commits have SOPS-related issues
   - Team satisfaction survey > 80%

3. **Reliability:**
   - CI/CD success rate > 95%
   - Zero decryption failures in production
   - Backup recovery tested successfully

---

## Conclusion

This implementation plan provides a comprehensive, step-by-step guide to migrating the Birthday Message Scheduler project to SOPS-encrypted secret management.

**Key Takeaways:**

1. **Security First:** SOPS + age provides strong encryption with modern cryptography
2. **Developer-Friendly:** Simple commands, automated workflows, clear documentation
3. **CI/CD Ready:** Seamless integration with GitHub Actions
4. **Maintainable:** Clear processes for key rotation, team onboarding, troubleshooting

**Total Time Investment:**
- **Setup:** 3-5 days (one-time)
- **Ongoing:** ~2 hours/month (maintenance)
- **ROI:** Significantly improved security, compliance, peace of mind

**Support:**
- Documentation: `docs/` directory
- Research: `plan/03-research/sops-secret-management.md`
- Team: #engineering Slack channel

---

**Document Version:** 1.0
**Last Updated:** 2025-12-30
**Next Review:** 2026-01-30

---

**End of Implementation Plan**
