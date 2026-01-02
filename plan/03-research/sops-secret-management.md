# SOPS Secret Management Research & Implementation Plan

**Research Date:** 2025-12-30
**Project:** Birthday Message Scheduler
**Technology:** SOPS (Secrets OPerationS) with age encryption
**Status:** Research & Planning Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [SOPS + Age Encryption Overview](#sops--age-encryption-overview)
3. [Best Practices for Node.js/TypeScript Projects](#best-practices-for-nodejstypescript-projects)
4. [File Structure and Configuration](#file-structure-and-configuration)
5. [GitHub Actions Integration](#github-actions-integration)
6. [Multi-Environment Strategy](#multi-environment-strategy)
7. [Migration Plan](#migration-plan)
8. [Security Considerations](#security-considerations)
9. [Developer Workflow Guide](#developer-workflow-guide)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [References](#references)

---

## Executive Summary

This document provides a comprehensive guide for integrating **SOPS (Secrets OPerationS)** with **age encryption** into the Birthday Message Scheduler project. SOPS is a simple, flexible tool for managing secrets that encrypts/decrypts files with various backends including AWS KMS, GCP KMS, Azure Key Vault, age, and PGP.

### Why SOPS + age?

- **Simple & Modern**: Age is a simple, modern alternative to OpenPGP with small explicit keys and no config options
- **Strong Encryption**: Values are encrypted using AES256_GCM, the strongest symmetric encryption algorithm known today
- **Partial Encryption**: Only encrypts secret values, keeping keys visible for easy identification
- **Version Control Friendly**: Encrypted files can be safely committed to Git
- **CI/CD Compatible**: Seamless integration with GitHub Actions and other CI/CD systems
- **Multi-Format Support**: Supports YAML, JSON, ENV, INI, and BINARY formats

### Project Goals

1. Migrate from plaintext `.env` files to SOPS-encrypted `.env` files
2. Implement secure secret management for development, testing, and production environments
3. Integrate SOPS decryption into GitHub Actions CI/CD pipeline
4. Establish developer workflows for managing encrypted secrets
5. Ensure secrets are never exposed in logs, Git history, or CI/CD artifacts

---

## SOPS + Age Encryption Overview

### What is SOPS?

[SOPS (Secrets OPerationS)](https://github.com/getsops/sops) is an editor of encrypted files that supports YAML, JSON, ENV, INI and BINARY formats. It encrypts the values of a file but leaves the keys unencrypted, making it easy to:

- Search for specific keys in encrypted files
- Use version control diffs to track changes
- Maintain file structure and readability
- Support multiple master keys for redundancy

### What is age?

[Age (Actually Good Encryption)](https://github.com/FiloSottile/age) is a simple, modern and secure encryption tool (and Go library) with:

- Small explicit keys (no configuration required)
- X25519-based key pair format
- Support for SSH key pairs for encryption
- Post-quantum hybrid key support (with `-pq` flag)
- UNIX-style composability

### How SOPS Works with age

```
┌─────────────────────────────────────────────────────────────┐
│  SOPS Encryption/Decryption Flow with age                  │
└─────────────────────────────────────────────────────────────┘

1. ENCRYPTION:
   Plaintext .env → SOPS (age public key) → Encrypted .env.enc

   - SOPS generates a random data encryption key (DEK)
   - DEK encrypts each value using AES256_GCM
   - age public key encrypts the DEK
   - Result: .env.enc with encrypted values, plaintext keys

2. DECRYPTION:
   Encrypted .env.enc → SOPS (age private key) → Plaintext .env

   - age private key decrypts the DEK
   - DEK decrypts each value
   - Result: Original plaintext .env file
```

### Key Characteristics

- **Partial File Encryption**: Only secret values are encrypted, not keys
- **Multiple Master Keys**: Supports multiple age keys for redundancy
- **Key Groups**: Can require multiple keys for decryption (enhanced security)
- **Encryption Context**: Supports AWS KMS encryption contexts for fine-grained access control
- **FIFO-based Decryption**: Uses FIFOs by default to keep secrets in memory (no disk touch)

---

## Best Practices for Node.js/TypeScript Projects

### 1. Use age Over PGP

**Recommendation**: Prefer age over OpenPGP for new projects.

**Rationale**:
- Simpler key management (single file)
- Modern cryptography (X25519)
- Zero configuration required
- Better performance
- Optional post-quantum support

**Reference**: [SOPS Best Practices](https://blog.gitguardian.com/a-comprehensive-guide-to-sops/)

### 2. Store Keys Securely

**Development**:
```bash

# Store age private key in standard location

~/.config/sops/age/keys.txt
```

**CI/CD**:
```bash

# Store as GitHub Secret

SOPS_AGE_KEY=<age-private-key>
```

**Production**:
- Use environment variables (never commit keys)
- Consider AWS Secrets Manager or HashiCorp Vault for production key storage
- Rotate keys regularly (recommended: every 90 days)

### 3. Multiple Master Keys for Redundancy

**Best Practice**: Use at least 2 age keys in different locations/accounts.

```yaml

# .sops.yaml

creation_rules:
  - age: >-
      age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx,
      age1yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

**Benefits**:
- File can be decrypted if any one master key is available
- Prevents single point of failure
- Allows key rotation without re-encrypting files immediately

**Reference**: [GitGuardian SOPS Guide](https://blog.gitguardian.com/a-comprehensive-guide-to-sops/)

### 4. Use encrypted-regex for Selective Encryption

**Strategy**: Only encrypt sensitive fields in YAML/JSON files.

```yaml

# .sops.yaml

creation_rules:
  - path_regex: \.env$
    age: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  - path_regex: \.yaml$
    encrypted_regex: '^(data|stringData|password|secret|token|key)$'
    age: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Benefits**:
- Keeps file structure readable
- Reduces encryption overhead
- Makes diffs more meaningful

**Reference**: [SOPS Documentation](https://getsops.io/docs/)

### 5. Node.js/TypeScript Integration Libraries

#### Option 1: sops-age (Recommended for TypeScript)

[sops-age](https://github.com/humphd/sops-age/) is a TypeScript library for decrypting SOPS files:

```typescript
import { decrypt } from 'sops-age';

const decryptedConfig = await decrypt('/path/to/.env.enc', {
  ageKeyPath: '~/.config/sops/age/keys.txt'
});
```

#### Option 2: sops-decoder-node (Lightweight)

[sops-decoder-node](https://github.com/koblas/sops-decoder-node) is lightweight and ideal for AWS Lambda:

```typescript
import { decode } from 'sops-decoder-node';

const secrets = decode(encryptedFileContent);
```

#### Option 3: CLI-based approach (Most Common)

Use SOPS CLI directly in your application startup:

```typescript
// scripts/decrypt-env.ts
import { execSync } from 'child_process';
import fs from 'fs';

export function decryptEnv() {
  try {
    execSync('sops -d .env.enc > .env', { stdio: 'inherit' });
    console.log('✅ Environment variables decrypted successfully');
  } catch (error) {
    console.error('❌ Failed to decrypt environment variables:', error);
    process.exit(1);
  }
}
```

**Reference**: [Setup SOPS GitHub Action](https://github.com/nhedger/setup-sops)

---

## File Structure and Configuration

### Recommended Directory Structure

```
birthday-message-scheduler/
├── .sops.yaml                    # SOPS configuration
├── .gitignore                    # Ignore decrypted files
├── .env.example                  # Template (no secrets)
├── .env                          # Decrypted (git-ignored)
├── secrets/
│   ├── .env.enc                  # Encrypted (committed to Git)
│   ├── .env.development.enc      # Dev environment
│   ├── .env.test.enc             # Test environment
│   ├── .env.production.enc       # Production environment
│   └── age/
│       └── .gitkeep              # Keep directory in Git
├── scripts/
│   ├── encrypt-env.sh            # Helper script to encrypt .env
│   ├── decrypt-env.sh            # Helper script to decrypt .env
│   └── rotate-keys.sh            # Key rotation script
└── package.json
```

### .sops.yaml Configuration

Create a `.sops.yaml` file in the project root:

```yaml

# .sops.yaml - SOPS Configuration for Birthday Message Scheduler

creation_rules:
  # Development environment
  - path_regex: secrets/\.env\.development\.enc$
    age: >-
      age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY|.*_TOKEN|DATABASE_URL|RABBITMQ_URL|REDIS_URL|EMAIL_SERVICE_URL).*'

  # Test environment
  - path_regex: secrets/\.env\.test\.enc$
    age: >-
      age1yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY|.*_TOKEN|DATABASE_URL|RABBITMQ_URL|REDIS_URL|EMAIL_SERVICE_URL).*'

  # Production environment (multiple keys for redundancy)
  - path_regex: secrets/\.env\.production\.enc$
    age: >-
      age1zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz,
      age1wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY|.*_TOKEN|DATABASE_URL|RABBITMQ_URL|REDIS_URL|EMAIL_SERVICE_URL).*'

  # Generic .env files (fallback)
  - path_regex: \.env\..*\.enc$
    age: >-
      age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### .gitignore Updates

```gitignore

# Environment files - CRITICAL: Never commit plaintext secrets

.env
.env.*
!.env.example
!.env.*.example

# Allow encrypted files

!*.enc

# SOPS age keys - NEVER commit private keys

secrets/age/keys.txt
age/keys.txt
~/.config/sops/age/keys.txt

# Temporary decrypted files

*.dec
*.decrypted
tmp/

# SOPS metadata

.sops.pub
```

### Environment File Template (.env.example)

```bash

# .env.example - Template for environment variables
# Copy to .env and fill in values, or decrypt from secrets/.env.enc

# Application

NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=<REPLACE_WITH_SECURE_PASSWORD>
DATABASE_NAME=birthday_app
DATABASE_POOL_SIZE=20
DATABASE_SSL=false

# Redis

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=<REPLACE_WITH_SECURE_PASSWORD>

# RabbitMQ

RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=admin
RABBITMQ_PASSWORD=<REPLACE_WITH_SECURE_PASSWORD>
RABBITMQ_VHOST=/

# Email Service

EMAIL_SERVICE_URL=https://email-service.digitalenvision.com.au/send-email
EMAIL_SERVICE_TIMEOUT=10000
EMAIL_SERVICE_API_KEY=<REPLACE_WITH_API_KEY>

# Queue Configuration

QUEUE_NAME=birthday-messages
QUEUE_CONCURRENCY=5
QUEUE_MAX_RETRIES=5
QUEUE_BACKOFF_DELAY=2000
QUEUE_BACKOFF_TYPE=exponential

# Circuit Breaker

CIRCUIT_BREAKER_TIMEOUT=10000
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=30000
CIRCUIT_BREAKER_VOLUME_THRESHOLD=10
```

---

## GitHub Actions Integration

### 1. GitHub Secrets Setup

Store the age private key as a GitHub Secret:

```bash

# Get your age private key

cat ~/.config/sops/age/keys.txt

# Store in GitHub Secrets as SOPS_AGE_KEY
# Navigate to: Repository > Settings > Secrets and variables > Actions
# Click "New repository secret"
# Name: SOPS_AGE_KEY
# Value: <paste-age-private-key-content>

```

**Important**: The key should look like:
```

# created: 2025-12-30T12:00:00Z
# public key: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

AGE-SECRET-KEY-1YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY
```

### 2. Setup SOPS Action in Workflow

Update `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  decrypt-and-test:
    name: Decrypt Secrets and Run Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # Install SOPS
      - name: Setup SOPS
        uses: nhedger/setup-sops@v2
        with:
          version: '3.8.1'  # or 'latest'

      # Install age
      - name: Setup age
        run: |
          AGE_VERSION=1.1.1
          curl -Lo age.tar.gz "https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz"
          tar xf age.tar.gz
          sudo mv age/age /usr/local/bin/
          sudo mv age/age-keygen /usr/local/bin/
          rm -rf age age.tar.gz

      # Create age key file from GitHub Secret
      - name: Setup age key
        run: |
          mkdir -p ~/.config/sops/age
          echo "${{ secrets.SOPS_AGE_KEY }}" > ~/.config/sops/age/keys.txt
          chmod 600 ~/.config/sops/age/keys.txt

      # Decrypt environment file
      - name: Decrypt secrets
        run: |
          sops -d secrets/.env.test.enc > .env.test
          echo "✅ Secrets decrypted successfully"
        env:
          SOPS_AGE_KEY_FILE: ~/.config/sops/age/keys.txt

      # Verify decryption (optional)
      - name: Verify decryption
        run: |
          if [ ! -f .env.test ]; then
            echo "❌ Failed to decrypt .env.test"
            exit 1
          fi
          echo "✅ .env.test exists and is ready"

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:integration
        env:
          NODE_ENV: test

      # CRITICAL: Clean up decrypted files
      - name: Cleanup secrets
        if: always()
        run: |
          rm -f .env.test
          rm -f ~/.config/sops/age/keys.txt
          echo "🧹 Cleaned up decrypted secrets"
```

**Reference**: [Setup SOPS GitHub Action](https://github.com/marketplace/actions/setup-sops)

### 3. Alternative: Using exec-env for In-Memory Secrets

For enhanced security, use `sops exec-env` to keep secrets in memory:

```yaml
- name: Run tests with encrypted secrets
  run: |
    sops exec-env secrets/.env.test.enc 'npm run test:integration'
  env:
    SOPS_AGE_KEY_FILE: ~/.config/sops/age/keys.txt
```

**Benefits**:
- Secrets never touch disk (uses FIFOs)
- Automatic cleanup
- No manual file deletion needed

**Reference**: [SOPS CLI Documentation](https://github.com/getsops/sops)

### 4. Multi-Environment CI/CD

```yaml
strategy:
  matrix:
    environment: [development, test, production]

steps:
  - name: Decrypt ${{ matrix.environment }} secrets
    run: |
      sops -d secrets/.env.${{ matrix.environment }}.enc > .env.${{ matrix.environment }}
    env:
      SOPS_AGE_KEY_FILE: ~/.config/sops/age/keys.txt
```

### 5. Docker Build with Encrypted Secrets

```yaml
- name: Build Docker image with secrets
  run: |
    # Decrypt secrets for Docker build
    sops -d secrets/.env.production.enc > .env.production

    # Build Docker image
    docker build \
      --secret id=env,src=.env.production \
      -t birthday-scheduler:latest \
      .

    # Clean up
    rm -f .env.production
```

---

## Multi-Environment Strategy

### Environment-Specific Keys

**Recommendation**: Use separate age keys for each environment.

#### Development Environment

- **Key Storage**: Developer's local machine (`~/.config/sops/age/keys.txt`)
- **Access**: All developers
- **Rotation**: Every 90 days or when developer leaves team
- **Risk Level**: Low (non-production data)

#### Test/Staging Environment

- **Key Storage**: GitHub Secrets (`SOPS_AGE_KEY_TEST`)
- **Access**: CI/CD system, QA team
- **Rotation**: Every 90 days
- **Risk Level**: Medium

#### Production Environment

- **Key Storage**: GitHub Secrets (`SOPS_AGE_KEY_PROD`) + AWS Secrets Manager (backup)
- **Access**: CI/CD system, DevOps team only
- **Rotation**: Every 30-60 days
- **Risk Level**: High (production credentials)

### .sops.yaml Multi-Environment Configuration

```yaml

# .sops.yaml - Multi-environment configuration

creation_rules:
  # Development: Single key, relaxed encryption
  - path_regex: secrets/\.env\.development\.enc$
    age: age1dev111111111111111111111111111111111111111111111111111

  # Test: Single key, moderate encryption
  - path_regex: secrets/\.env\.test\.enc$
    age: age1test222222222222222222222222222222222222222222222222222
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY|.*_TOKEN|DATABASE_URL).*'

  # Production: Multiple keys (redundancy), strict encryption
  - path_regex: secrets/\.env\.production\.enc$
    age: >-
      age1prod333333333333333333333333333333333333333333333333333,
      age1backup444444444444444444444444444444444444444444444444444
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY|.*_TOKEN|.*_URL|.*_HOST).*'

  # Kubernetes secrets (different pattern)
  - path_regex: k8s/.*\.yaml$
    encrypted_regex: '^(data|stringData)$'
    age: age1k8s555555555555555555555555555555555555555555555555555
```

### Key Rotation Strategy

```bash

#!/bin/bash
# scripts/rotate-keys.sh - Rotate age keys for an environment

ENVIRONMENT=$1  # development, test, or production
OLD_KEY_FILE="secrets/age/keys-${ENVIRONMENT}-old.txt"
NEW_KEY_FILE="secrets/age/keys-${ENVIRONMENT}.txt"

echo "🔄 Rotating age key for ${ENVIRONMENT} environment"

# Generate new age key

echo "1. Generating new age key..."
age-keygen -o "${NEW_KEY_FILE}"

# Extract public key

NEW_PUBLIC_KEY=$(grep "public key:" "${NEW_KEY_FILE}" | cut -d: -f2 | tr -d ' ')
echo "✅ New public key: ${NEW_PUBLIC_KEY}"

# Update .sops.yaml

echo "2. Update .sops.yaml with new public key"
echo "   Replace old key with: ${NEW_PUBLIC_KEY}"

# Re-encrypt all files for this environment

echo "3. Re-encrypting secrets for ${ENVIRONMENT}..."
for encrypted_file in secrets/.env.${ENVIRONMENT}.enc; do
  echo "   Re-encrypting ${encrypted_file}..."
  sops updatekeys -y "${encrypted_file}"
done

echo "✅ Key rotation complete for ${ENVIRONMENT}"
echo "⚠️  Don't forget to:"
echo "   1. Update GitHub Secret SOPS_AGE_KEY_${ENVIRONMENT^^}"
echo "   2. Notify team members to update their local keys"
echo "   3. Archive old key securely for 30 days before deletion"
```

---

## Migration Plan

### Phase 1: Setup and Preparation (Day 1)

#### 1.1 Install SOPS and age

```bash

# macOS

brew install sops age

# Linux
# SOPS

SOPS_VERSION=3.8.1
curl -Lo sops "https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64"
chmod +x sops
sudo mv sops /usr/local/bin/

# age

AGE_VERSION=1.1.1
curl -Lo age.tar.gz "https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz"
tar xf age.tar.gz
sudo mv age/age /usr/local/bin/
sudo mv age/age-keygen /usr/local/bin/

# Verify installation

sops --version
age --version
```

#### 1.2 Generate age Keys

```bash

# Create age directory

mkdir -p ~/.config/sops/age

# Generate development key

age-keygen -o ~/.config/sops/age/keys.txt

# Output will show:
# Public key: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

```

**Save the public key** - you'll need it for `.sops.yaml` configuration.

#### 1.3 Create Project Structure

```bash

# Create secrets directory

mkdir -p secrets/age

# Create .gitkeep to track directory

touch secrets/age/.gitkeep

# Create helper scripts directory

mkdir -p scripts
```

#### 1.4 Create .sops.yaml Configuration

See [File Structure and Configuration](#file-structure-and-configuration) section.

#### 1.5 Update .gitignore

```bash

# Add to .gitignore

cat >> .gitignore << 'EOF'

# SOPS - Decrypted files

.env
.env.*
!.env.example
!.env.*.example
!*.enc

# SOPS - Private keys

secrets/age/keys.txt
age/keys.txt
*.key
EOF
```

### Phase 2: Encrypt Existing Secrets (Day 1-2)

#### 2.1 Backup Current .env Files

```bash

# Create backup

cp .env .env.backup
cp .env.test .env.test.backup
cp .env.development .env.development.backup
```

#### 2.2 Encrypt Development Environment

```bash

# Encrypt .env.development

sops -e .env.development > secrets/.env.development.enc

# Verify encryption

sops -d secrets/.env.development.enc | head -n 5
```

#### 2.3 Encrypt Test Environment

```bash

# Encrypt .env.test

sops -e .env.test > secrets/.env.test.enc

# Verify

sops -d secrets/.env.test.enc | head -n 5
```

#### 2.4 Encrypt Production Environment

```bash

# Generate production keys (separate from development)

age-keygen -o secrets/age/keys-production.txt

# Extract production public key

PROD_PUBLIC_KEY=$(grep "public key:" secrets/age/keys-production.txt | cut -d: -f2 | tr -d ' ')

# Update .sops.yaml with production key
# Then encrypt

SOPS_AGE_KEY_FILE=secrets/age/keys-production.txt sops -e .env.prod.example > secrets/.env.production.enc
```

#### 2.5 Commit Encrypted Files

```bash

# Add encrypted files to Git

git add secrets/.env.*.enc
git add .sops.yaml
git add .gitignore

# Commit

git commit -m "feat: Add SOPS encrypted environment files

- Add .sops.yaml configuration
- Encrypt .env files for dev, test, and production
- Update .gitignore to exclude plaintext secrets"

# Push

git push origin main
```

#### 2.6 Remove Plaintext Files

```bash

# CRITICAL: Only do this after confirming encrypted files work

rm .env .env.development .env.test

# Keep backups in a secure location (not in Git)

mkdir -p ~/secure-backups/birthday-app
mv .env*.backup ~/secure-backups/birthday-app/
```

### Phase 3: Create Helper Scripts (Day 2)

#### 3.1 Encryption Script

```bash

# scripts/encrypt-env.sh
#!/bin/bash

set -e

ENVIRONMENT=${1:-development}
SOURCE_FILE=".env.${ENVIRONMENT}"
ENCRYPTED_FILE="secrets/.env.${ENVIRONMENT}.enc"

if [ ! -f "${SOURCE_FILE}" ]; then
  echo "❌ Source file ${SOURCE_FILE} not found"
  exit 1
fi

echo "🔒 Encrypting ${SOURCE_FILE} → ${ENCRYPTED_FILE}"
sops -e "${SOURCE_FILE}" > "${ENCRYPTED_FILE}"

echo "✅ Encryption complete"
echo "📝 Don't forget to delete ${SOURCE_FILE} and commit ${ENCRYPTED_FILE}"
```

#### 3.2 Decryption Script

```bash

# scripts/decrypt-env.sh
#!/bin/bash

set -e

ENVIRONMENT=${1:-development}
ENCRYPTED_FILE="secrets/.env.${ENVIRONMENT}.enc"
OUTPUT_FILE=".env.${ENVIRONMENT}"

if [ ! -f "${ENCRYPTED_FILE}" ]; then
  echo "❌ Encrypted file ${ENCRYPTED_FILE} not found"
  exit 1
fi

echo "🔓 Decrypting ${ENCRYPTED_FILE} → ${OUTPUT_FILE}"
sops -d "${ENCRYPTED_FILE}" > "${OUTPUT_FILE}"

echo "✅ Decryption complete"
echo "⚠️  Remember: ${OUTPUT_FILE} is git-ignored and should not be committed"
```

#### 3.3 Make Scripts Executable

```bash
chmod +x scripts/encrypt-env.sh
chmod +x scripts/decrypt-env.sh
```

### Phase 4: Update npm Scripts (Day 2)

Add to `package.json`:

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

    "dev": "npm run secrets:decrypt:dev && tsx watch src/index.ts",
    "test": "npm run secrets:decrypt:test && vitest",
    "test:integration": "npm run secrets:decrypt:test && vitest run --config vitest.config.integration.ts"
  }
}
```

### Phase 5: Configure GitHub Secrets (Day 2-3)

#### 5.1 Store Development Key

```bash

# Get development age key

cat ~/.config/sops/age/keys.txt

# Store in GitHub Secrets:
# Name: SOPS_AGE_KEY_DEV
# Value: <paste-full-key-content-including-comments>

```

#### 5.2 Store Test Key

```bash

# If using same key as dev
# Name: SOPS_AGE_KEY_TEST
# Value: <same-as-dev>

# If using separate test key

cat secrets/age/keys-test.txt
```

#### 5.3 Store Production Key

```bash
cat secrets/age/keys-production.txt

# Store in GitHub Secrets:
# Name: SOPS_AGE_KEY_PROD
# Value: <paste-production-key>

```

### Phase 6: Update CI/CD Workflows (Day 3)

See [GitHub Actions Integration](#github-actions-integration) section for complete workflow examples.

### Phase 7: Team Onboarding (Day 3-5)

#### 7.1 Create Developer Setup Guide

```markdown

# Developer Setup for SOPS Encrypted Secrets

## Prerequisites

- Install SOPS: `brew install sops` (macOS) or see installation docs
- Install age: `brew install age` (macOS) or see installation docs

## First-Time Setup

1. Get the team's age private key from a team lead (via secure channel)

2. Store the key:
   ```bash
   mkdir -p ~/.config/sops/age
   # Paste key content into:
   nano ~/.config/sops/age/keys.txt
   chmod 600 ~/.config/sops/age/keys.txt
```

3. Clone repository and decrypt secrets:
   ```bash
   git clone <repo-url>
   cd birthday-message-scheduler
   npm install
   npm run secrets:decrypt:dev
```

4. Start development:
   ```bash
   npm run dev
```

## Daily Workflow

- **No changes to secrets**: Just run `npm run dev` (auto-decrypts)
- **Changed secrets**:
  1. Edit decrypted `.env.development`
  2. Run `npm run secrets:encrypt:dev`
  3. Commit `secrets/.env.development.enc`
  4. Delete plaintext `.env.development`

## Troubleshooting

- **"no key found" error**: Check `~/.config/sops/age/keys.txt` exists
- **"failed to decrypt" error**: Ask team lead for updated key
```

#### 7.2 Distribute Keys Securely

**DO NOT**:
- Email keys
- Slack/chat keys
- Commit keys to Git
- Store in plaintext on shared drives

**DO**:
- Use password managers (1Password, LastPass) with secure sharing
- Use secure file transfer (encrypted ZIP with separate password)
- Meet in person for highly sensitive production keys
- Use temporary secure sharing services (e.g., OneTimeSecret.com)

### Phase 8: Validation and Testing (Day 5-7)

#### 8.1 Test Encryption/Decryption

```bash

# Create test file

echo "TEST_SECRET=my-secret-value" > .env.test-validation

# Encrypt

sops -e .env.test-validation > .env.test-validation.enc

# Decrypt

sops -d .env.test-validation.enc

# Compare

diff .env.test-validation <(sops -d .env.test-validation.enc)

# Clean up

rm .env.test-validation .env.test-validation.enc
```

#### 8.2 Test CI/CD Pipeline

```bash

# Push a test PR

git checkout -b test/sops-integration
git push origin test/sops-integration

# Create PR and verify:
# - SOPS installation succeeds
# - Secrets decrypt successfully
# - Tests pass with decrypted secrets
# - No secrets leaked in logs

```

#### 8.3 Verify Secret Cleanup

```bash

# In CI logs, check for cleanup step
# Should see:
# 🧹 Cleaned up decrypted secrets

# Verify no plaintext secrets in artifacts
# Download artifacts and check contents

```

### Phase 9: Documentation and Rollout (Day 7)

#### 9.1 Update Project README

Add section to `README.md`:

```markdown

## Secret Management with SOPS

This project uses [SOPS](https://github.com/getsops/sops) with [age](https://github.com/FiloSottile/age) encryption for managing secrets.

### Quick Start

1. Install dependencies:
   ```bash
   npm install
```

2. Get age key from team lead and save to `~/.config/sops/age/keys.txt`

3. Decrypt development secrets:
   ```bash
   npm run secrets:decrypt:dev
```

4. Start development:
   ```bash
   npm run dev
```

### Available Commands

- `npm run secrets:decrypt:dev` - Decrypt development secrets
- `npm run secrets:encrypt:dev` - Encrypt development secrets
- `npm run secrets:decrypt:test` - Decrypt test secrets
- `npm run secrets:encrypt:test` - Encrypt test secrets

See [DEVELOPER_SETUP.md](docs/DEVELOPER_SETUP.md) for detailed instructions.
```

#### 9.2 Announce to Team

Send team announcement:

```
Subject: 🔒 New Secret Management System - SOPS + age

Hi Team,

We've implemented SOPS (Secrets OPerationS) with age encryption for secure secret management.

What changes:
✅ No more plaintext .env files in Git
✅ Secrets encrypted before commit
✅ Automatic decryption in CI/CD
✅ Better security and compliance

Action required:
1. Install SOPS and age (see setup guide)
2. Get team age key (ping me on Slack)
3. Follow setup instructions in DEVELOPER_SETUP.md
4. Delete any local plaintext .env files

Timeline:
- Today: Development environment
- Next week: Test environment
- Following week: Production environment

Resources:
- Setup guide: docs/DEVELOPER_SETUP.md (includes SOPS setup and troubleshooting)
- Runbook: docs/RUNBOOK.md (includes operational troubleshooting)
- Questions: GitHub issues

Thanks!
```

### Phase 10: Monitoring and Maintenance (Ongoing)

#### 10.1 Key Rotation Schedule

```
Development: Every 90 days
Test: Every 90 days
Production: Every 30-60 days
```

#### 10.2 Audit Encrypted Files

```bash

# Monthly audit: Check which files are encrypted

find secrets -name "*.enc" -exec sops -d {} \; 2>&1 | grep -i "error"

# Should return no errors

```

#### 10.3 Monitor CI/CD Logs

- Check for secret exposure in logs
- Verify cleanup steps execute
- Monitor for failed decryptions

---

## Security Considerations

### 1. Never Commit Private Keys

**CRITICAL**: Private age keys must NEVER be committed to Git.

```bash

# Triple-check .gitignore includes:

*.key
keys.txt
secrets/age/keys.txt
~/.config/sops/age/keys.txt
```

**Verify**:
```bash

# Check Git history for leaked keys

git log --all --full-history --source -- "*keys*" "*age*" "*.key"

# Should return no results

```

### 2. Use FIFOs to Avoid Disk Writes

SOPS uses FIFOs (named pipes) by default to keep decrypted secrets in memory:

```bash

# This keeps secrets in memory (recommended)

sops exec-env secrets/.env.production.enc 'npm start'

# This writes to disk (avoid if possible)

sops -d secrets/.env.production.enc > .env.production
```

**Windows**: FIFOs not supported - use `--no-fifo` flag and ensure cleanup.

### 3. Cleanup Decrypted Files

**Always** clean up decrypted files:

```bash

# Good: Use trap to ensure cleanup

trap 'rm -f .env.production' EXIT
sops -d secrets/.env.production.enc > .env.production
npm start

# Better: Use exec-env (automatic cleanup)

sops exec-env secrets/.env.production.enc 'npm start'
```

### 4. Limit Key Access

**Principle of Least Privilege**:

- **Development keys**: All developers
- **Test keys**: Developers + QA + CI/CD
- **Production keys**: DevOps team + CI/CD only

**Access Control**:
```yaml

# Use GitHub Environment Secrets for production
# Settings > Environments > production > Secrets
# Add: SOPS_AGE_KEY_PROD
# Configure protection rules: Require reviewers

```

### 5. Rotate Keys Regularly

**Schedule**:
- Development: Every 90 days
- Test: Every 90 days
- Production: Every 30-60 days
- **Immediate rotation**: When team member with key access leaves

**Rotation Process**: See `scripts/rotate-keys.sh` in [Multi-Environment Strategy](#multi-environment-strategy).

### 6. Use Multiple Master Keys

**Redundancy**: Use at least 2 age keys for production:

```yaml
creation_rules:
  - path_regex: secrets/\.env\.production\.enc$
    age: >-
      age1prod_primary_key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx,
      age1prod_backup_key_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

**Benefits**:
- Decrypt with either key
- Allows key rotation without downtime
- Prevents single point of failure

### 7. Protect Against Log Exposure

**CI/CD Logs**:
```yaml

# GitHub Actions: Mask secrets in logs

- name: Decrypt secrets
  run: |
    sops -d secrets/.env.test.enc > .env.test
    echo "::add-mask::$(cat .env.test | grep PASSWORD | cut -d= -f2)"
```

**Application Logs**:
```typescript
// Redact secrets in logs
const redactSecrets = (obj: any) => {
  const redacted = { ...obj };
  const secretKeys = ['password', 'secret', 'token', 'key'];

  for (const key in redacted) {
    if (secretKeys.some(sk => key.toLowerCase().includes(sk))) {
      redacted[key] = '[REDACTED]';
    }
  }

  return redacted;
};

logger.info('Config loaded', redactSecrets(config));
```

### 8. Encryption Context for AWS KMS

If using AWS KMS (alternative to age):

```yaml
creation_rules:
  - path_regex: secrets/\.env\.production\.enc$
    kms: arn:aws:kms:us-east-1:123456789:key/abc-def
    encryption_context:
      Environment: production
      Application: birthday-scheduler
```

**Benefits**:
- Fine-grained IAM policies
- Audit trail in CloudTrail
- Conditional key usage

### 9. Use Key Groups for Multi-Signature

**High-Security Scenario**: Require multiple keys to decrypt:

```yaml
creation_rules:
  - path_regex: secrets/\.env\.production\.enc$
    key_groups:
      - age:
          - age1devops_lead_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
      - age:
          - age1security_lead_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

**Result**: File can only be decrypted if BOTH keys are available.

### 10. Regular Security Audits

**Monthly Checklist**:
- [ ] Verify no plaintext secrets in Git history
- [ ] Check .gitignore includes all secret patterns
- [ ] Audit team member access to keys
- [ ] Review CI/CD logs for secret exposure
- [ ] Test key rotation process
- [ ] Verify backup keys work
- [ ] Check for outdated/unused keys
- [ ] Scan dependencies for vulnerabilities

---

## Developer Workflow Guide

### Initial Setup (One-Time)

```bash

# 1. Install SOPS

brew install sops  # macOS

# or download from https://github.com/getsops/sops/releases

# 2. Install age

brew install age  # macOS

# or download from https://github.com/FiloSottile/age/releases

# 3. Verify installation

sops --version
age --version

# 4. Create age directory

mkdir -p ~/.config/sops/age

# 5. Get team's age key from team lead (securely!)
# Save to: ~/.config/sops/age/keys.txt
# Set permissions:

chmod 600 ~/.config/sops/age/keys.txt

# 6. Clone repository

git clone <repo-url>
cd birthday-message-scheduler

# 7. Install dependencies

npm install

# 8. Decrypt development secrets

npm run secrets:decrypt:dev
```

### Daily Development Workflow

#### Scenario 1: No Secret Changes (Most Common)

```bash

# Start development (auto-decrypts if needed)

npm run dev

# Work on features
# ...

# Commit and push

git add .
git commit -m "feat: Add new feature"
git push
```

#### Scenario 2: View Current Secrets

```bash

# Decrypt and view

sops secrets/.env.development.enc

# Or decrypt to file

npm run secrets:decrypt:dev
cat .env.development
```

#### Scenario 3: Add New Secret

```bash

# 1. Decrypt current secrets

npm run secrets:decrypt:dev

# 2. Edit .env.development

echo "NEW_SECRET=my-new-value" >> .env.development

# 3. Re-encrypt

npm run secrets:encrypt:dev

# 4. Commit encrypted file

git add secrets/.env.development.enc
git commit -m "chore: Add NEW_SECRET to development config"
git push

# 5. Clean up plaintext

rm .env.development

# 6. Notify team
# Post in Slack: "Added NEW_SECRET, please run: npm run secrets:decrypt:dev"

```

#### Scenario 4: Update Existing Secret

```bash

# 1. Edit encrypted file directly with SOPS

sops secrets/.env.development.enc

# SOPS will open in your default editor (vim/nano)
# 2. Change value, save and quit
# 3. SOPS automatically re-encrypts

# 4. Commit

git add secrets/.env.development.enc
git commit -m "chore: Update DATABASE_PASSWORD"
git push
```

#### Scenario 5: Switch Environments

```bash

# Development

npm run secrets:decrypt:dev
npm run dev

# Test

npm run secrets:decrypt:test
npm run test

# Production (rarely needed locally)

npm run secrets:decrypt:prod
```

### Code Review Workflow

#### Reviewing PRs with Secret Changes

```bash

# 1. Checkout PR branch

git fetch origin pull/123/head:pr-123
git checkout pr-123

# 2. Decrypt and review secrets

sops secrets/.env.development.enc | diff .env.development.backup -

# 3. Check for sensitive data
# - Passwords should be strong
# - No hardcoded production secrets in dev
# - No API keys from personal accounts

# 4. Verify encryption

sops secrets/.env.development.enc > /dev/null
echo $?  # Should be 0 (success)

# 5. Approve or request changes

```

### Troubleshooting Common Issues

See [Troubleshooting Guide](#troubleshooting-guide) section.

---

## Troubleshooting Guide

### Issue 1: "no key found" Error

**Error**:
```
Failed to get the data key required to decrypt the SOPS file.

Group 0: FAILED
  age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx: FAILED
    - | no age key found
```

**Cause**: SOPS can't find your age private key.

**Solutions**:

1. **Check key file exists**:
```
   ls -la ~/.config/sops/age/keys.txt
   # Should show the file with 600 permissions
   ```

2. **Check key file contents**:
```
   cat ~/.config/sops/age/keys.txt
   # Should show:
   # # created: 2025-12-30T12:00:00Z
   # # public key: age1xxxxx...
   # AGE-SECRET-KEY-1xxxxx...
   ```

3. **Set SOPS_AGE_KEY_FILE environment variable**:
```
   export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt
   sops -d secrets/.env.development.enc
   ```

4. **Add to shell profile** (.bashrc, .zshrc):
```
   echo 'export SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt' >> ~/.zshrc
   source ~/.zshrc
   ```

### Issue 2: "failed to decrypt" Error

**Error**:
```
Failed to decrypt: MAC mismatch
```

**Cause**: Wrong private key or corrupted file.

**Solutions**:

1. **Verify you have the correct key**:
```
   # Extract public key from your private key
   grep "public key:" ~/.config/sops/age/keys.txt

   # Compare with .sops.yaml
   grep "age:" .sops.yaml
   ```

2. **Try backup key** (if configured):
```
   # If .sops.yaml has multiple keys, try second key
   SOPS_AGE_KEY_FILE=~/.config/sops/age/keys-backup.txt sops -d secrets/.env.development.enc
   ```

3. **Check file integrity**:
```
   # View file metadata
   sops -d --extract '["sops"]["age"]' secrets/.env.development.enc
   ```

4. **Re-encrypt file**:
```
   # If you have access to plaintext version
   sops -e .env.development > secrets/.env.development.enc
   ```

### Issue 3: Encrypted File Not Updating

**Symptom**: Changes not reflected after editing with SOPS.

**Solutions**:

1. **Check in-place editing**:
```
   # Wrong (creates new file)
   sops secrets/.env.development.enc > secrets/.env.development.enc.new

   # Right (updates in-place)
   sops secrets/.env.development.enc
   # Edit, save, quit - changes auto-saved
   ```

2. **Use --in-place flag** for non-interactive:
```
   sops -d secrets/.env.development.enc | sed 's/OLD/NEW/' | sops -e --in-place secrets/.env.development.enc
   ```

3. **Verify Git sees changes**:
```bash
   git status
   git diff secrets/.env.development.enc
   ```

### Issue 4: CI/CD Decryption Fails

**Error in GitHub Actions**:
```
Error: Failed to decrypt secrets
```

**Solutions**:

1. **Check GitHub Secret exists**:
   - Go to: Repository > Settings > Secrets and variables > Actions
   - Verify `SOPS_AGE_KEY` or `SOPS_AGE_KEY_TEST` exists

2. **Check secret format**:
```
   # Should include comments and private key
   # created: 2025-12-30T12:00:00Z
   # public key: age1xxxxx...
   AGE-SECRET-KEY-1xxxxx...
   ```

3. **Check workflow uses secret correctly**:
```
   - name: Setup age key
     run: |
       mkdir -p ~/.config/sops/age
       echo "${{ secrets.SOPS_AGE_KEY }}" > ~/.config/sops/age/keys.txt
       chmod 600 ~/.config/sops/age/keys.txt
   ```

4. **Debug: Print public key** (safe to log):
```
   - name: Debug age key
     run: |
       grep "public key:" ~/.config/sops/age/keys.txt || echo "Key file issue"
   ```

### Issue 5: "sops: command not found"

**Cause**: SOPS not installed or not in PATH.

**Solutions**:

1. **Install SOPS**:
```
   # macOS
   brew install sops

   # Linux
   curl -Lo sops https://github.com/getsops/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64
   chmod +x sops
   sudo mv sops /usr/local/bin/
   ```

2. **Verify installation**:
```
   which sops
   sops --version
   ```

3. **Check PATH**:
```
   echo $PATH
   # Should include /usr/local/bin
   ```

### Issue 6: Permission Denied

**Error**:
```
permission denied: ~/.config/sops/age/keys.txt
```

**Solutions**:

1. **Fix permissions**:
```
   chmod 600 ~/.config/sops/age/keys.txt
   ```

2. **Check ownership**:
```
   ls -la ~/.config/sops/age/keys.txt
   # Should be owned by you, not root

   # If owned by root, fix:
   sudo chown $USER:$USER ~/.config/sops/age/keys.txt
   ```

### Issue 7: Secrets in Git History

**Symptom**: Accidentally committed plaintext .env file.

**Solutions**:

1. **Immediate action**:
```
   # Remove from latest commit
   git rm .env
   git commit --amend -m "Remove accidentally committed .env"
   git push --force origin <branch>
   ```

2. **Remove from entire Git history**:
```
   # Use git-filter-repo (safer than filter-branch)
   pip install git-filter-repo

   git filter-repo --path .env --invert-paths
   git push --force origin --all
   ```

3. **Rotate all secrets**:
```
   # All secrets in the committed file are now considered compromised
   # 1. Change all passwords, API keys, tokens
   # 2. Update encrypted files with new values
   # 3. Notify security team
   ```

### Issue 8: Multiple age Keys Conflict

**Symptom**: Different public keys in `.sops.yaml` vs your key file.

**Solutions**:

1. **Check which key you have**:
```
   grep "public key:" ~/.config/sops/age/keys.txt
   ```

2. **Check which key is configured**:
```
   grep "age:" .sops.yaml
   ```

3. **If keys don't match**:
```
   # Option A: Get correct key from team lead
   # Option B: Update .sops.yaml with your public key
   # Option C: Re-encrypt with your key (if you have plaintext)
   ```

### Issue 9: Windows-Specific Issues

**Issue**: FIFOs not supported on Windows.

**Solution**:

```bash

# Use --no-fifo flag

sops -d --no-fifo secrets/.env.development.enc > .env.development

# Ensure cleanup

del .env.development
```

**Better**: Use WSL2 or Docker for development on Windows.

### Issue 10: Large File Performance

**Symptom**: Slow encryption/decryption of large files.

**Solutions**:

1. **Use binary format** for large files:
```
   sops -e --input-type binary --output-type binary large-file.bin > large-file.bin.enc
   ```

2. **Split large config files**:
```
   # Instead of one huge .env, split by service
   secrets/.env.database.enc
   secrets/.env.rabbitmq.enc
   secrets/.env.redis.enc
   ```

3. **Use encrypted-regex** to limit scope:
```
   creation_rules:
     - encrypted_regex: '^(SECRET_|PASSWORD_|TOKEN_).*'
       # Only encrypts variables starting with SECRET_, PASSWORD_, TOKEN_
   ```

---

## References

### Official Documentation

1. [SOPS GitHub Repository](https://github.com/getsops/sops) - Official SOPS source code and documentation
2. [SOPS Official Website](https://getsops.io/) - SOPS documentation and guides
3. [age GitHub Repository](https://github.com/FiloSottile/age) - age encryption tool
4. [SOPS Best Practices (GitGuardian)](https://blog.gitguardian.com/a-comprehensive-guide-to-sops/) - Comprehensive guide to SOPS

### GitHub Actions Integration

5. [Setup SOPS GitHub Action](https://github.com/nhedger/setup-sops) - Official SOPS setup action for GitHub Actions
6. [SOPS Utilities GitHub Action](https://github.com/marketplace/actions/sops-utilities) - Additional SOPS utilities for CI/CD
7. [Integrating SOPS with GitHub Actions (Medium)](https://medium.com/opsops/integrating-sops-with-github-actions-3c4c15eac6cc) - Integration guide

### Node.js/TypeScript Libraries

8. [sops-age (TypeScript)](https://github.com/humphd/sops-age/) - TypeScript library for SOPS + age
9. [sops-decoder-node](https://github.com/koblas/sops-decoder-node) - Lightweight SOPS decoder for Node.js

### Tutorials and Guides

10. [SOPS with age Encryption Tutorial (Techno Tim)](https://technotim.live/posts/secret-encryption-sops/) - Comprehensive tutorial
11. [Using SOPS with age and Git (Datenkollektiv)](https://devops.datenkollektiv.de/using-sops-with-age-and-git-like-a-pro.html) - Git workflow guide
12. [Secure Environment Files with SOPS and age](https://blog.cmmx.de/2025/08/27/secure-your-environment-files-with-git-sops-and-age/) - Environment file encryption guide
13. [Kubernetes Secrets with SOPS (Flux)](https://fluxcd.io/flux/guides/mozilla-sops/) - Kubernetes-specific guide
14. [age Encryption Cookbook](https://blog.sandipb.net/2023/07/06/age-encryption-cookbook/) - age encryption recipes

### Security Best Practices

15. [Cryptographic Key Lifecycle Best Practices](https://emudhra.com/en/blog/cryptographic-key-lifecycle-management-best-practices-for-secure-key-generation) - Key management guidelines
16. [Encryption Key Management Best Practices (Thales)](https://cpl.thalesgroup.com/blog/encryption/10-best-practices-for-centralized-encryption-key-management) - Enterprise key management

### Advanced Topics

17. [SOPS Configuration Examples](https://github.com/getsops/sops/blob/main/README.rst) - Official README with examples
18. [SOPS Cheat Sheet](https://lzone.de/cheat-sheet/sops) - Quick reference guide
19. [SOPS Security Zines](https://blog.gitguardian.com/sops-security-zines/) - Visual security guide

### Alternative Approaches

20. [Sealed Secrets vs SOPS (DEV Community)](https://dev.to/docteurrs/goodbye-sealed-secrets-hello-sops-1ken) - Comparison of secret management tools

---

## Appendix A: Quick Reference Commands

### Installation

```bash

# macOS

brew install sops age

# Linux - SOPS

curl -Lo sops https://github.com/getsops/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64
chmod +x sops && sudo mv sops /usr/local/bin/

# Linux - age

curl -Lo age.tar.gz https://github.com/FiloSottile/age/releases/download/v1.1.1/age-v1.1.1-linux-amd64.tar.gz
tar xf age.tar.gz && sudo mv age/age* /usr/local/bin/
```

### Key Generation

```bash

# Generate new age key

age-keygen -o ~/.config/sops/age/keys.txt

# Generate post-quantum key

age-keygen -pq -o ~/.config/sops/age/keys-pq.txt

# View public key

grep "public key:" ~/.config/sops/age/keys.txt
```

### Encryption/Decryption

```bash

# Encrypt file

sops -e .env > secrets/.env.enc

# Decrypt file

sops -d secrets/.env.enc > .env

# Edit encrypted file in-place

sops secrets/.env.enc

# Decrypt to stdout

sops -d secrets/.env.enc

# Exec with decrypted env

sops exec-env secrets/.env.enc 'npm start'
```

### Configuration

```bash

# Create .sops.yaml

cat > .sops.yaml << 'EOF'
creation_rules:
  - path_regex: \.env\..*\.enc$
    age: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY).*'
EOF

# Update keys in encrypted file

sops updatekeys secrets/.env.enc
```

### Verification

```bash

# Verify encryption

sops -d secrets/.env.enc > /dev/null && echo "✅ Valid" || echo "❌ Invalid"

# Check which keys can decrypt

sops -d --extract '["sops"]["age"]' secrets/.env.enc

# Compare decrypted vs original

diff <(sops -d secrets/.env.enc) .env.backup
```

---

## Appendix B: Sample Files

### Sample .sops.yaml (Multi-Environment)

```yaml

# .sops.yaml - Birthday Message Scheduler

creation_rules:
  # Development environment
  - path_regex: secrets/\.env\.development\.enc$
    age: age1dev111111111111111111111111111111111111111111111111111

  # Test environment
  - path_regex: secrets/\.env\.test\.enc$
    age: age1test222222222222222222222222222222222222222222222222222
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY|.*_TOKEN|DATABASE_URL|RABBITMQ_URL|REDIS_URL).*'

  # Production environment (multiple keys)
  - path_regex: secrets/\.env\.production\.enc$
    age: >-
      age1prod333333333333333333333333333333333333333333333333333,
      age1backup444444444444444444444444444444444444444444444444444
    encrypted_regex: '^(.*_PASSWORD|.*_SECRET|.*_KEY|.*_TOKEN|.*_URL|.*_HOST).*'

  # Fallback for any .env files
  - path_regex: \.env.*$
    age: age1default555555555555555555555555555555555555555555555555
```

### Sample Encrypted .env File

```bash

# After encryption with SOPS, file looks like:

NODE_ENV=production
PORT=3000
DATABASE_HOST=ENC[AES256_GCM,data:abcd1234...,iv:xyz789...,tag:...==,type:str]
DATABASE_PASSWORD=ENC[AES256_GCM,data:secret123...,iv:789xyz...,tag:...==,type:str]
sops_version=3.8.1
sops_age__list_0__map_recipient=age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
sops_age__list_0__map_enc=...
sops_lastmodified=2025-12-30T12:00:00Z
sops_mac=ENC[AES256_GCM,data:...,iv:...,tag:...,type:str]
```

---

## Appendix C: CI/CD Workflow Templates

### Complete GitHub Actions Workflow

```yaml
name: CI with SOPS Secrets

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    name: Test with Encrypted Secrets
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # Setup SOPS
      - name: Setup SOPS
        uses: nhedger/setup-sops@v2
        with:
          version: '3.8.1'

      # Setup age
      - name: Setup age
        run: |
          AGE_VERSION=1.1.1
          curl -Lo age.tar.gz "https://github.com/FiloSottile/age/releases/download/v${AGE_VERSION}/age-v${AGE_VERSION}-linux-amd64.tar.gz"
          tar xf age.tar.gz
          sudo mv age/age /usr/local/bin/
          sudo mv age/age-keygen /usr/local/bin/

      # Configure age key
      - name: Setup age key
        run: |
          mkdir -p ~/.config/sops/age
          echo "${{ secrets.SOPS_AGE_KEY_TEST }}" > ~/.config/sops/age/keys.txt
          chmod 600 ~/.config/sops/age/keys.txt

      # Decrypt secrets
      - name: Decrypt environment secrets
        run: |
          sops -d secrets/.env.test.enc > .env.test
          echo "✅ Secrets decrypted"

      # Install and test
      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:integration
        env:
          NODE_ENV: test

      # Cleanup (always runs)
      - name: Cleanup secrets
        if: always()
        run: |
          rm -f .env.test
          rm -f ~/.config/sops/age/keys.txt
          echo "🧹 Secrets cleaned up"
```

---

**Document Version**: 1.0
**Last Updated**: 2025-12-30
**Next Review**: 2026-03-30

---

## Document Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-12-30 | 1.0 | Initial comprehensive research document | Research Team |

---

**End of Document**
