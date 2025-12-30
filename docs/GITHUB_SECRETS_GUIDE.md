# GitHub Secrets Setup Guide

**Last Updated**: December 30, 2025

This guide explains all GitHub Secrets required for the Birthday Message Scheduler and how to set them up automatically using `gh` CLI.

---

## 📋 Required Secrets

### 1. SOPS_AGE_KEY (Already Configured ✅)

**Purpose**: Decrypt encrypted environment files in CI/CD

**Value Source**: Your local age encryption key
```bash
cat ~/.config/sops/age/keys.txt
```

**How to Set**:
```bash
gh secret set SOPS_AGE_KEY < ~/.config/sops/age/keys.txt
```

**Status**: ✅ Already set on 2025-12-30T15:15:52Z

---

## 🚫 Removed Secrets (Not Used)

### SLACK_WEBHOOK_URL (Removed)

**Reason**: You mentioned not using Slack

**Action Required**: None - already removed from workflows

---

## 🤖 Automated Secret Setup Script

Create a script to automatically set up all required secrets:

**File**: `scripts/setup-github-secrets.sh`

```bash
#!/bin/bash
# Setup GitHub Secrets for Birthday Message Scheduler
# Usage: ./scripts/setup-github-secrets.sh

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
```

---

## 📝 Manual Setup (Alternative)

If you prefer manual setup:

### Using gh CLI:

```bash
# 1. SOPS Age Key
gh secret set SOPS_AGE_KEY < ~/.config/sops/age/keys.txt

# Verify
gh secret list
```

### Using GitHub Web UI:

1. Go to: `https://github.com/fairyhunter13/happy-bday-app/settings/secrets/actions`
2. Click **"New repository secret"**
3. Name: `SOPS_AGE_KEY`
4. Value: Paste the contents of `~/.config/sops/age/keys.txt`
5. Click **"Add secret"**

---

## 🔍 How to Get Secret Values

### SOPS_AGE_KEY

**Location**: `~/.config/sops/age/keys.txt`

**Get Value**:
```bash
cat ~/.config/sops/age/keys.txt
```

**If File Doesn't Exist**:
```bash
# Generate new age key
age-keygen -o ~/.config/sops/age/keys.txt

# View the public key (needed for .sops.yaml)
age-keygen -y ~/.config/sops/age/keys.txt
```

**Important**:
- The private key (entire file) goes into GitHub Secrets
- The public key (age1...) goes into `.sops.yaml`

---

## ✅ Verification

After setting up secrets, verify they're accessible:

```bash
# List all secrets
gh secret list

# Expected output:
# SOPS_AGE_KEY  Updated 2025-12-30
```

---

## 🔒 Security Best Practices

1. **Never commit secret values** to git
2. **Rotate secrets every 90 days** (recommended)
3. **Use different keys** for dev/staging/production (if applicable)
4. **Audit secret access** regularly
5. **Remove unused secrets** immediately

---

## 🔄 Secret Rotation

When rotating secrets (every 90 days):

```bash
# 1. Generate new age key
age-keygen -o ~/.config/sops/age/new-keys.txt

# 2. Re-encrypt all secrets with new key
# (See docs/SOPS_IMPLEMENTATION_SUMMARY.md for key rotation procedure)

# 3. Update GitHub secret
gh secret set SOPS_AGE_KEY < ~/.config/sops/age/new-keys.txt

# 4. Test in CI/CD
# Push a commit and verify workflows pass

# 5. Archive old key
mv ~/.config/sops/age/keys.txt ~/.config/sops/age/keys.txt.backup-$(date +%Y%m%d)
mv ~/.config/sops/age/new-keys.txt ~/.config/sops/age/keys.txt
```

---

## 🆘 Troubleshooting

### Issue: "gh: command not found"
**Solution**: Install GitHub CLI
```bash
# macOS
brew install gh

# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

### Issue: "Could not create secret: HTTP 403"
**Solution**: Authenticate with proper permissions
```bash
gh auth login
# Choose: GitHub.com
# Choose: HTTPS
# Authenticate in browser
# Choose: Yes to configure Git
```

### Issue: "age key file not found"
**Solution**: Generate age key first
```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
chmod 600 ~/.config/sops/age/keys.txt
```

### Issue: "SOPS decryption fails in CI/CD"
**Solution**: Verify secret is set correctly
```bash
# Check secret exists
gh secret list | grep SOPS_AGE_KEY

# Re-set the secret
gh secret set SOPS_AGE_KEY < ~/.config/sops/age/keys.txt
```

---

## 📚 Related Documentation

- **SOPS Setup**: `docs/DEVELOPER_SETUP.md`
- **SOPS Implementation**: `docs/SOPS_IMPLEMENTATION_SUMMARY.md`
- **Key Rotation**: `docs/SOPS_IMPLEMENTATION_SUMMARY.md#key-rotation`
- **CI/CD Integration**: `.github/workflows/ci.yml`

---

## ✨ Quick Setup (TL;DR)

```bash
# One command to set up all secrets:
gh secret set SOPS_AGE_KEY < ~/.config/sops/age/keys.txt

# Verify:
gh secret list
```

**That's it!** 🎉

All GitHub Secrets are now configured and your CI/CD workflows will work properly.
