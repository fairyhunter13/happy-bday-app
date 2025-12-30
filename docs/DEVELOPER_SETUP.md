# Developer Setup Guide

This guide will help you set up your local development environment for the Birthday Message Scheduler project.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [SOPS Secret Management](#sops-secret-management)
4. [Running the Application](#running-the-application)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** and **Docker Compose**
- **PostgreSQL** client (for local development)
- **SOPS** (for secret management)
- **age** (encryption tool used by SOPS)

### Installing SOPS and age

#### macOS

```bash
# Install SOPS
brew install sops

# Install age
brew install age

# Verify installations
sops --version
age --version
```

#### Linux

```bash
# Install SOPS
wget https://github.com/getsops/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64
sudo mv sops-v3.8.1.linux.amd64 /usr/local/bin/sops
sudo chmod +x /usr/local/bin/sops

# Install age
sudo apt install age  # Debian/Ubuntu
# OR
wget https://github.com/FiloSottile/age/releases/download/v1.1.1/age-v1.1.1-linux-amd64.tar.gz
tar xzf age-v1.1.1-linux-amd64.tar.gz
sudo mv age/age /usr/local/bin/
sudo mv age/age-keygen /usr/local/bin/

# Verify installations
sops --version
age --version
```

---

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd happy-bday-app
```

### 2. Install Dependencies

```bash
npm ci
```

### 3. Set Up SOPS Age Keys

You have two options:

#### Option A: For New Developers (Request Keys from Team Lead)

Contact your team lead to get the `SOPS_AGE_KEY`. Then:

```bash
# Create SOPS config directory
mkdir -p ~/.config/sops/age

# Save the key provided by your team lead
# The key should be saved to ~/.config/sops/age/keys.txt
# IMPORTANT: Ensure proper permissions
chmod 600 ~/.config/sops/age/keys.txt
```

#### Option B: For Team Leads (Generate New Keys)

⚠️ **WARNING**: Only do this if you're setting up a new project or rotating keys!

```bash
# Create SOPS config directory
mkdir -p ~/.config/sops/age

# Generate new age key pair
age-keygen -o ~/.config/sops/age/keys.txt

# Display the public key (needed for .sops.yaml)
grep '^# public key:' ~/.config/sops/age/keys.txt

# Set proper permissions
chmod 600 ~/.config/sops/age/keys.txt
```

**Important**: If you generate new keys:
1. Update `.sops.yaml` with the new public key
2. Re-encrypt all environment files
3. Update the `SOPS_AGE_KEY` GitHub secret
4. Share the private key securely with your team

---

## SOPS Secret Management

### Understanding SOPS Files

This project uses SOPS (Secrets OPerationS) with age encryption to manage secrets:

- **Encrypted files** (committed to git): `.env.development.enc`, `.env.test.enc`, `.env.production.enc`
- **Decrypted files** (gitignored): `.env.development`, `.env.test`, `.env.production`

### Decrypting Secrets

#### Decrypt All Environments

```bash
npm run secrets:decrypt
```

#### Decrypt Specific Environment

```bash
# Development
npm run secrets:decrypt:dev

# Test
npm run secrets:decrypt:test

# Production
npm run secrets:decrypt:prod
```

Or use the script directly:

```bash
# Decrypt all
./scripts/sops/decrypt.sh

# Decrypt specific environment
./scripts/sops/decrypt.sh development
./scripts/sops/decrypt.sh test
./scripts/sops/decrypt.sh production
```

### Viewing Secrets (Read-Only)

View decrypted secrets without creating a file:

```bash
# View development secrets
npm run secrets:view development

# View test secrets
npm run secrets:view test

# View production secrets
npm run secrets:view production
```

### Editing Secrets

To edit secrets securely (auto-encrypt on save):

```bash
# Edit development secrets
npm run secrets:edit development

# Edit test secrets
npm run secrets:edit test

# Edit production secrets
npm run secrets:edit production
```

This will:
1. Decrypt the file temporarily
2. Open it in your default editor
3. Re-encrypt it when you save and close
4. No plaintext file remains on disk

### Encrypting Secrets

After making changes to plaintext `.env` files:

```bash
# Encrypt all environments
npm run secrets:encrypt

# Encrypt specific environment
npm run secrets:encrypt:dev
npm run secrets:encrypt:test
npm run secrets:encrypt:prod
```

**Remember to commit the encrypted files:**

```bash
git add .env.*.enc
git commit -m "Update encrypted secrets"
```

---

## Running the Application

### 1. Decrypt Environment Files

```bash
npm run secrets:decrypt:dev
```

### 2. Start Infrastructure Services

```bash
# Start PostgreSQL, RabbitMQ, Redis
docker-compose -f docker-compose.test.yml up -d
```

### 3. Run Database Migrations

```bash
npm run db:migrate
```

### 4. Start the Application

```bash
# Development mode with hot reload
npm run dev

# Or start API, scheduler, and worker separately:
npm run dev                    # API server
npm run scheduler              # CRON scheduler
npm run worker                 # Message queue worker
```

### 5. Access the Application

- **API**: http://localhost:3000
- **Swagger UI**: http://localhost:3000/docs
- **Metrics**: http://localhost:9090/metrics
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

---

## Running Tests

### Decrypt Test Secrets First

```bash
npm run secrets:decrypt:test
```

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage
```

---

## Performance Testing

### Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Run Performance Tests

```bash
# API load test
npm run perf:k6:api

# Scheduler load test
npm run perf:k6:scheduler

# Worker throughput test
npm run perf:k6:worker-throughput

# E2E load test
npm run perf:k6:e2e

# All performance tests
npm run perf:all
```

---

## Troubleshooting

### SOPS Decryption Fails

**Error**: `failed to get the data key required to decrypt the SOPS file`

**Solution**:
1. Verify age keys are present:
   ```bash
   ls -la ~/.config/sops/age/keys.txt
   ```
2. Check file permissions:
   ```bash
   chmod 600 ~/.config/sops/age/keys.txt
   ```
3. Verify you have the correct key (ask your team lead)

### Age Keys Not Found

**Error**: `Age keys not found at ~/.config/sops/age/keys.txt`

**Solution**:
1. Create the directory:
   ```bash
   mkdir -p ~/.config/sops/age
   ```
2. Request the SOPS_AGE_KEY from your team lead
3. Save it to `~/.config/sops/age/keys.txt`
4. Set permissions:
   ```bash
   chmod 600 ~/.config/sops/age/keys.txt
   ```

### Database Connection Failed

**Error**: `ECONNREFUSED` or `connection refused`

**Solution**:
1. Ensure Docker services are running:
   ```bash
   docker-compose -f docker-compose.test.yml ps
   ```
2. Check if ports are already in use:
   ```bash
   lsof -i :5432  # PostgreSQL
   lsof -i :5672  # RabbitMQ
   lsof -i :6379  # Redis
   ```
3. Restart services:
   ```bash
   docker-compose -f docker-compose.test.yml down -v
   docker-compose -f docker-compose.test.yml up -d
   ```

### Environment Variables Not Loaded

**Error**: Missing required environment variables

**Solution**:
1. Decrypt the appropriate environment file:
   ```bash
   npm run secrets:decrypt:dev
   ```
2. Verify the file exists:
   ```bash
   ls -la .env.development
   ```
3. Check NODE_ENV matches the environment:
   ```bash
   echo $NODE_ENV
   ```

### SOPS Command Not Found

**Error**: `sops: command not found`

**Solution**:
- macOS: `brew install sops`
- Linux: Download from [SOPS releases](https://github.com/getsops/sops/releases)

### Age Command Not Found

**Error**: `age: command not found`

**Solution**:
- macOS: `brew install age`
- Linux: `sudo apt install age` or download from [age releases](https://github.com/FiloSottile/age/releases)

---

## Security Best Practices

### DO

✅ Always decrypt secrets to `.env.development`, `.env.test`, `.env.production` (gitignored)
✅ Use `npm run secrets:edit` to modify secrets (auto-encrypts)
✅ Commit encrypted `.env.*.enc` files to git
✅ Keep your age keys in `~/.config/sops/age/keys.txt` with `600` permissions
✅ Share age keys securely (1Password, encrypted email, secure chat)

### DON'T

❌ Never commit plaintext `.env.development`, `.env.test`, `.env.production` files
❌ Never commit age private keys to git
❌ Never share age keys over unsecured channels (Slack, email, etc.)
❌ Never decrypt production secrets on your local machine unless absolutely necessary
❌ Never disable SOPS encryption for convenience

---

## Getting Help

- **Documentation**: Check the project README and this guide
- **Team Lead**: Contact your team lead for age keys or setup issues
- **SOPS Documentation**: https://github.com/getsops/sops
- **Age Documentation**: https://github.com/FiloSottile/age

---

## Quick Reference

### Common Commands

```bash
# Decrypt development secrets
npm run secrets:decrypt:dev

# View secrets (read-only)
npm run secrets:view development

# Edit secrets (auto-encrypts)
npm run secrets:edit development

# Encrypt secrets after manual changes
npm run secrets:encrypt:dev

# Start local development
npm run dev

# Run tests
npm test

# Run performance tests
npm run perf:all
```

### File Locations

- **Age keys**: `~/.config/sops/age/keys.txt`
- **SOPS config**: `.sops.yaml`
- **Encrypted secrets**: `.env.*.enc` (committed to git)
- **Decrypted secrets**: `.env.development`, `.env.test`, `.env.production` (gitignored)
- **Helper scripts**: `scripts/sops/`

---

**Happy coding!** 🎉
