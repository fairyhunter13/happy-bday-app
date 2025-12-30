# Secrets Management Guide

## Overview

This guide outlines best practices for managing sensitive configuration and secrets in the Birthday Message Scheduler application.

**Core Principle:** Never commit secrets to version control.

---

## 1. Local Development

### 1.1 Environment Files

**Structure:**
```
.env                  # Local secrets (GITIGNORED - never commit)
.env.example          # Template for required variables (committed)
.env.test             # Test environment (optional, gitignored)
.env.production       # NOT used - use secret manager instead
```

### 1.2 Required Environment Variables

**Database:**
```bash
# PostgreSQL connection
DATABASE_URL=postgresql://user:password@localhost:5432/birthday_scheduler
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_TIMEOUT_MS=2000
```

**Message Queue:**
```bash
# RabbitMQ connection
RABBITMQ_URL=amqp://user:password@localhost:5672
RABBITMQ_PREFETCH=10
RABBITMQ_HEARTBEAT=60
```

**Application:**
```bash
# Server configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=debug
```

**External Services:**
```bash
# Third-party API credentials
MESSAGE_SERVICE_API_KEY=your_api_key_here
MESSAGE_SERVICE_URL=https://api.example.com
```

### 1.3 Setting Up Local Secrets

**Step 1: Copy template**
```bash
cp .env.example .env
```

**Step 2: Fill in actual values**
```bash
# Edit .env with your local credentials
vim .env  # or your preferred editor
```

**Step 3: Verify gitignore**
```bash
# Ensure .env is gitignored
git check-ignore .env  # Should output: .env
```

**Step 4: Never commit**
```bash
# Double-check before committing
git status  # .env should NOT appear

# If accidentally staged:
git reset .env
git checkout -- .env
```

---

## 2. Secret Rotation Strategy

### 2.1 Rotation Schedule

| Secret Type | Rotation Frequency | Trigger |
|-------------|-------------------|---------|
| Database passwords | 90 days | Scheduled |
| API keys | 90 days | Scheduled |
| Service credentials | 90 days | Scheduled |
| Emergency rotation | Immediate | Security incident |

### 2.2 Rotation Process

**Database Credentials:**

```bash
# Step 1: Create new database user
psql -h localhost -U postgres
CREATE USER birthday_app_v2 WITH PASSWORD 'new_secure_password';
GRANT ALL PRIVILEGES ON DATABASE birthday_scheduler TO birthday_app_v2;

# Step 2: Update application configuration
# In secret manager or .env:
DATABASE_URL=postgresql://birthday_app_v2:new_secure_password@host:5432/db

# Step 3: Deploy updated configuration
# (Zero-downtime deployment)

# Step 4: Verify new credentials work
curl http://localhost:3000/health

# Step 5: Revoke old user (after 24-hour grace period)
psql -h localhost -U postgres
REVOKE ALL PRIVILEGES ON DATABASE birthday_scheduler FROM birthday_app_v1;
DROP USER birthday_app_v1;
```

**API Keys:**

```bash
# Step 1: Generate new key in provider dashboard
# Step 2: Update secret manager with new key
# Step 3: Deploy updated configuration
# Step 4: Verify functionality
# Step 5: Deactivate old key (after grace period)
```

### 2.3 Emergency Rotation

**Incident Response:**

```bash
# 1. Immediately revoke compromised credentials
# 2. Generate new credentials
# 3. Update secret manager
# 4. Deploy ASAP (skip grace period)
# 5. Verify all services functioning
# 6. Document incident
```

---

## 3. Production Secret Management

### 3.1 AWS Secrets Manager (Recommended)

**Setup:**

```bash
# Install AWS CLI
aws configure

# Create secret
aws secretsmanager create-secret \
  --name birthday-scheduler/production/database \
  --description "Production database credentials" \
  --secret-string '{"username":"dbuser","password":"SecurePassword123!"}'

# Create API key secret
aws secretsmanager create-secret \
  --name birthday-scheduler/production/api-keys \
  --secret-string '{"message_service":"api_key_here"}'
```

**Application Integration:**

```typescript
// src/config/secrets.ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'us-east-1' });

export async function getSecret(secretName: string): Promise<Record<string, string>> {
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error(`Secret ${secretName} not found`);
  }

  return JSON.parse(response.SecretString);
}

// Usage
const dbCredentials = await getSecret('birthday-scheduler/production/database');
const databaseUrl = `postgresql://${dbCredentials.username}:${dbCredentials.password}@host:5432/db`;
```

**Environment Configuration:**

```bash
# Production .env (minimal)
NODE_ENV=production
AWS_REGION=us-east-1
SECRET_NAME_PREFIX=birthday-scheduler/production
```

### 3.2 HashiCorp Vault (Alternative)

**Setup:**

```bash
# Install Vault
brew install vault  # or appropriate package manager

# Start Vault server (development)
vault server -dev

# Set environment
export VAULT_ADDR='http://127.0.0.1:8200'
export VAULT_TOKEN='dev-token'

# Store secrets
vault kv put secret/birthday-scheduler/database \
  url='postgresql://user:pass@host:5432/db'

vault kv put secret/birthday-scheduler/rabbitmq \
  url='amqp://user:pass@host:5672'
```

**Application Integration:**

```typescript
// src/config/vault.ts
import vault from 'node-vault';

const client = vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
});

export async function getVaultSecret(path: string): Promise<any> {
  const result = await client.read(`secret/data/${path}`);
  return result.data.data;
}

// Usage
const dbConfig = await getVaultSecret('birthday-scheduler/database');
```

### 3.3 Kubernetes Secrets (Container Deployment)

**Create Secret:**

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: birthday-scheduler-secrets
type: Opaque
stringData:
  database-url: postgresql://user:password@postgres:5432/db
  rabbitmq-url: amqp://user:password@rabbitmq:5672
  api-key: your-api-key-here
```

**Apply Secret:**

```bash
# Create from file
kubectl apply -f k8s/secrets.yaml

# Or create imperatively
kubectl create secret generic birthday-scheduler-secrets \
  --from-literal=database-url='postgresql://...' \
  --from-literal=rabbitmq-url='amqp://...'
```

**Use in Deployment:**

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: birthday-scheduler
spec:
  template:
    spec:
      containers:
      - name: app
        image: birthday-scheduler:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: birthday-scheduler-secrets
              key: database-url
        - name: RABBITMQ_URL
          valueFrom:
            secretKeyRef:
              name: birthday-scheduler-secrets
              key: rabbitmq-url
```

### 3.4 Docker Swarm Secrets

**Create Secret:**

```bash
# From file
echo "postgresql://user:pass@host:5432/db" | docker secret create db_url -

# From stdin
docker secret create rabbitmq_url < rabbitmq_credentials.txt
```

**Use in Stack:**

```yaml
# docker-stack.yml
version: '3.8'
services:
  app:
    image: birthday-scheduler:latest
    secrets:
      - db_url
      - rabbitmq_url
    environment:
      DATABASE_URL_FILE: /run/secrets/db_url
      RABBITMQ_URL_FILE: /run/secrets/rabbitmq_url

secrets:
  db_url:
    external: true
  rabbitmq_url:
    external: true
```

**Application Code:**

```typescript
// src/config/docker-secrets.ts
import fs from 'fs';

function getSecretFromFile(fileEnvVar: string, fallbackEnvVar: string): string {
  const filePath = process.env[fileEnvVar];

  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8').trim();
  }

  return process.env[fallbackEnvVar] || '';
}

export const config = {
  databaseUrl: getSecretFromFile('DATABASE_URL_FILE', 'DATABASE_URL'),
  rabbitmqUrl: getSecretFromFile('RABBITMQ_URL_FILE', 'RABBITMQ_URL'),
};
```

---

## 4. CI/CD Integration

### 4.1 GitHub Actions Secrets

**Add Secrets:**

```bash
# Via GitHub UI:
# Settings > Secrets and variables > Actions > New repository secret

# Required secrets:
DATABASE_URL
RABBITMQ_URL
API_KEY
AWS_ACCESS_KEY_ID (if using AWS)
AWS_SECRET_ACCESS_KEY
```

**Use in Workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run tests
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}
          RABBITMQ_URL: ${{ secrets.RABBITMQ_URL_TEST }}
        run: npm test

      - name: Deploy to production
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PROD }}
          RABBITMQ_URL: ${{ secrets.RABBITMQ_URL_PROD }}
          API_KEY: ${{ secrets.API_KEY }}
        run: ./scripts/deploy.sh
```

### 4.2 GitLab CI/CD Variables

**Add Variables:**

```bash
# Via GitLab UI:
# Settings > CI/CD > Variables

# Add variables:
DATABASE_URL (Protected, Masked)
RABBITMQ_URL (Protected, Masked)
API_KEY (Protected, Masked)
```

**Use in Pipeline:**

```yaml
# .gitlab-ci.yml
variables:
  NODE_ENV: production

test:
  script:
    - npm test
  variables:
    DATABASE_URL: $DATABASE_URL_TEST
    RABBITMQ_URL: $RABBITMQ_URL_TEST

deploy:
  script:
    - ./scripts/deploy.sh
  environment:
    name: production
  only:
    - main
```

---

## 5. Security Best Practices

### 5.1 Secrets Checklist

- [ ] **Never commit secrets to git**
  ```bash
  # Add to .gitignore
  .env
  .env.local
  .env.*.local
  *.pem
  *.key
  credentials.json
  ```

- [ ] **Use strong passwords**
  ```bash
  # Generate secure passwords
  openssl rand -base64 32

  # Or use password manager
  # Minimum: 16 characters, mixed case, numbers, symbols
  ```

- [ ] **Rotate secrets regularly**
  ```bash
  # Set calendar reminders
  # Automate with cron jobs if possible
  ```

- [ ] **Encrypt secrets at rest**
  ```bash
  # AWS Secrets Manager: Encrypted by default
  # Vault: Encrypted storage backend
  # K8s Secrets: Enable encryption at rest
  ```

- [ ] **Use least privilege**
  ```bash
  # Database user: Grant only necessary permissions
  GRANT SELECT, INSERT, UPDATE ON users TO app_user;
  # Not: GRANT ALL
  ```

- [ ] **Monitor secret access**
  ```bash
  # Enable audit logging in secret manager
  # Alert on unusual access patterns
  ```

### 5.2 Common Mistakes to Avoid

**❌ DON'T:**

```typescript
// Hardcoded secrets
const apiKey = 'sk_live_abcdef123456';

// Secrets in comments
// DB password: MySecretPassword123

// Secrets in error messages
throw new Error(`Failed to connect with password: ${password}`);

// Secrets in logs
logger.info(`Connecting to ${databaseUrl}`); // Contains password!

// Secrets in URLs
fetch(`https://api.example.com?api_key=${apiKey}`);
```

**✅ DO:**

```typescript
// Environment variables
const apiKey = process.env.API_KEY;

// Safe error messages
throw new Error('Failed to connect to database');

// Redacted logs
logger.info('Connecting to database', {
  host: dbHost,
  user: dbUser
  // password excluded
});

// Headers for authentication
fetch('https://api.example.com', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

### 5.3 Secret Scanning

**Pre-commit Hook:**

```bash
# .husky/pre-commit
#!/bin/sh

# Scan for potential secrets
if git diff --cached | grep -E '(password|secret|api_key|token).*=.*["\']' ; then
  echo "⚠️  Potential secret detected! Please review your changes."
  exit 1
fi
```

**Git-secrets:**

```bash
# Install git-secrets
brew install git-secrets

# Initialize
cd /path/to/repo
git secrets --install
git secrets --register-aws

# Scan repository
git secrets --scan

# Scan history (expensive)
git secrets --scan-history
```

**TruffleHog:**

```bash
# Install
pip install trufflehog

# Scan repository
trufflehog filesystem /path/to/repo

# Scan git history
trufflehog git https://github.com/user/repo
```

---

## 6. Incident Response

### 6.1 Leaked Secret Detection

**Signs of Compromise:**
- Secret appears in git history
- Secret found in logs
- Unusual API usage patterns
- Security alert from provider
- GitHub secret scanning alert

### 6.2 Response Procedure

**IMMEDIATE (0-1 hour):**

```bash
# 1. Revoke compromised secret
aws secretsmanager delete-secret --secret-id compromised-secret --force-delete

# 2. Generate new secret
aws secretsmanager create-secret --name new-secret --secret-string '...'

# 3. Update application configuration
kubectl set env deployment/app SECRET_NAME=new-secret

# 4. Verify application health
kubectl get pods
curl https://app.example.com/health

# 5. Document incident
echo "Incident: Secret leaked in commit abc123" >> incidents.log
```

**SHORT TERM (1-24 hours):**

```bash
# 1. Remove secret from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# Or use BFG Repo-Cleaner (faster)
bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 2. Force push (coordinate with team)
git push origin --force --all

# 3. Analyze impact
# Check logs for unauthorized access
# Review API usage metrics
# Check for data breaches

# 4. Notify stakeholders
# Inform security team
# Notify affected users if needed
```

**LONG TERM (1-7 days):**

```bash
# 1. Implement additional safeguards
# Add pre-commit hooks
# Enable secret scanning
# Set up monitoring alerts

# 2. Post-mortem
# Document what happened
# How it was detected
# How it was resolved
# Preventive measures

# 3. Team training
# Review secrets best practices
# Update documentation
# Conduct tabletop exercises
```

---

## 7. Compliance & Auditing

### 7.1 Audit Trail

**Track Secret Access:**

```typescript
// src/utils/secret-audit.ts
import { logger } from './logger';

export function auditSecretAccess(secretName: string, operation: string) {
  logger.info('Secret accessed', {
    secretName,
    operation,
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME,
    environment: process.env.NODE_ENV,
  });
}

// Usage
const secret = await getSecret('database-credentials');
auditSecretAccess('database-credentials', 'read');
```

**Review Access Logs:**

```bash
# AWS Secrets Manager
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=my-secret

# Vault
vault audit enable file file_path=/var/log/vault-audit.log
```

### 7.2 Compliance Requirements

**SOC 2:**
- ✅ Secrets encrypted at rest and in transit
- ✅ Access controls and audit logging
- ✅ Regular rotation and review
- ✅ Incident response procedures

**HIPAA:**
- ✅ Encryption for PHI-related credentials
- ✅ Access logging and monitoring
- ✅ Business associate agreements

**PCI DSS:**
- ✅ Strong cryptography for payment credentials
- ✅ Regular key rotation
- ✅ Restricted access to secrets

---

## 8. Tools & Resources

### 8.1 Recommended Tools

| Tool | Purpose | Link |
|------|---------|------|
| AWS Secrets Manager | Cloud secret storage | [AWS](https://aws.amazon.com/secrets-manager/) |
| HashiCorp Vault | Self-hosted secret management | [Vault](https://www.vaultproject.io/) |
| git-secrets | Prevent secret commits | [GitHub](https://github.com/awslabs/git-secrets) |
| TruffleHog | Find secrets in git | [GitHub](https://github.com/trufflesecurity/trufflehog) |
| dotenv | Load .env files | [NPM](https://www.npmjs.com/package/dotenv) |
| 1Password CLI | Password manager integration | [1Password](https://1password.com/downloads/command-line/) |

### 8.2 Learning Resources

- [OWASP Secret Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [12-Factor App: Config](https://12factor.net/config)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)

---

## 9. Quick Reference

### 9.1 Common Commands

```bash
# Check if secret in git
git log -S 'password' --all

# Generate secure password
openssl rand -base64 32

# Test database connection
psql "$DATABASE_URL" -c "SELECT 1"

# Test RabbitMQ connection
rabbitmqadmin -u user -p password list queues

# Verify environment variables loaded
node -e "console.log(process.env.DATABASE_URL ? 'Loaded' : 'Missing')"
```

### 9.2 Emergency Contacts

```bash
# Security team
security@example.com

# On-call engineer
oncall@example.com

# AWS Support
+1-206-266-4064

# Platform team
platform@example.com
```

---

**Last Updated:** 2025-12-30
**Owner:** DevOps/Security Team
**Review Frequency:** Quarterly
