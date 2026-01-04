# Security Incident Response Playbook

**Last Updated:** 2026-01-04
**Version:** 1.0
**Owner:** Security Team
**Classification:** Internal Use Only

---

## Purpose

This playbook provides procedures for responding to security incidents in the Birthday Message Scheduler system. Use this guide to detect, contain, eradicate, and recover from security threats while preserving evidence for investigation.

⚠️ **IMPORTANT:** For incidents involving data breach or customer data exposure, immediately escalate to legal and compliance teams.

---

## Table of Contents

1. [Security Incident Types](#security-incident-types)
2. [Response Framework](#response-framework)
3. [Common Security Incidents](#common-security-incidents)
4. [Evidence Preservation](#evidence-preservation)
5. [Communication & Disclosure](#communication--disclosure)
6. [Post-Incident Actions](#post-incident-actions)

---

## Security Incident Types

### Classification

| Type | Severity | Examples |
|------|----------|----------|
| **Unauthorized Access** | High | Brute force attacks, credential stuffing, account takeover |
| **Injection Attacks** | Critical | SQL injection, command injection, XSS |
| **Denial of Service** | High | DDoS, resource exhaustion attacks |
| **Data Breach** | Critical | Unauthorized data access/exfiltration, database dump |
| **Malware** | High | Ransomware, backdoors, cryptominers |
| **Insider Threat** | High | Malicious employee, compromised credentials |
| **Supply Chain** | Critical | Compromised dependencies, malicious packages |

---

## Response Framework

### PICERL Model

1. **Preparation** - Tools, training, procedures in place
2. **Identification** - Detect and confirm security incident
3. **Containment** - Prevent further damage (short-term and long-term)
4. **Eradication** - Remove threat from environment
5. **Recovery** - Restore systems to normal operation
6. **Lessons Learned** - Document and improve

### Incident Severity

**Critical (P0):**
- Active data breach
- Ransomware encryption
- Root/admin access compromised
- Customer data exposed

**High (P1):**
- Suspected unauthorized access
- Repeated attack attempts
- Vulnerability being actively exploited
- DDoS affecting availability

**Medium (P2):**
- Successful intrusion detected (contained)
- Malware detected (not spreading)
- Security policy violation

**Low (P3):**
- Failed attack attempts (blocked)
- Security scan findings
- Policy violations (no data exposure)

---

## Common Security Incidents

### Incident 1: Unauthorized Access Attempts

**Detection:**

**Alert:** `UnauthorizedAccessAttempt` - Failed authentication > 50 attempts from single IP in 5 minutes

**Automated Monitoring:**
```bash
# Application logs (failed logins)
docker logs birthday-app-api | grep "authentication.*failed" | tail -50

# Nginx access logs (suspicious patterns)
docker logs nginx | grep -E "POST /api/auth|40[13]" | tail -100

# Rate limit violations
docker logs birthday-app-api | grep "rate limit exceeded"
```

**Investigation:**

1. **Identify attacker IP(s):**
   ```bash
   # Count failed auth by IP
   docker logs birthday-app-api --since 1h | \
     grep "authentication.*failed" | \
     jq -r '.ip' | \
     sort | uniq -c | sort -rn | head -20
   ```

2. **Analyze attack pattern:**
   ```bash
   # Get details of attack
   docker logs birthday-app-api --since 1h | \
     grep "authentication.*failed" | \
     jq '{time: .time, ip: .ip, email: .email, user_agent: .user_agent}'
   ```

3. **Check for successful compromises:**
   ```bash
   # Look for successful logins from attacker IPs
   docker logs birthday-app-api --since 1h | \
     grep "authentication.*success" | \
     jq 'select(.ip | IN("ATTACKER_IP_HERE"))'
   ```

**Containment:**

1. **Block attacker IP immediately:**
   ```bash
   # Option 1: Nginx level
   docker exec nginx sh -c "echo 'deny ATTACKER_IP;' >> /etc/nginx/conf.d/blocked-ips.conf"
   docker exec nginx nginx -s reload

   # Option 2: Firewall level (cloud provider)
   # AWS Security Group:
   aws ec2 authorize-security-group-ingress \
     --group-id sg-xxxxx \
     --ip-permissions IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges='[{CidrIp=ATTACKER_IP/32,Description="Blocked - brute force"}]'

   # Option 3: Application level (rate limiter)
   redis-cli SADD blocked_ips ATTACKER_IP
   ```

2. **Verify block effectiveness:**
   ```bash
   # Should see no new requests from blocked IP
   docker logs -f nginx | grep "ATTACKER_IP"
   ```

3. **Enable additional protections:**
   ```bash
   # Lower rate limits temporarily
   # Edit docker-compose.yml or .env:
   # RATE_LIMIT_MAX_REQUESTS=10 (from 100)
   docker-compose up -d api

   # Enable CAPTCHA for login (if available)
   # Update application configuration
   ```

**Eradication:**

1. **If any accounts compromised:**
   ```bash
   # Force password reset for affected accounts
   # Mark accounts as requiring password change on next login
   psql -U postgres -d birthday_app -c "
   UPDATE users
   SET require_password_reset = true
   WHERE email IN ('compromised1@example.com', 'compromised2@example.com');
   "
   ```

2. **Invalidate all sessions for compromised accounts:**
   ```bash
   # Redis session store
   redis-cli KEYS "session:user:COMPROMISED_USER_ID:*" | xargs redis-cli DEL
   ```

**Recovery:**

1. **Implement additional security measures:**
   - Enable 2FA/MFA for all users
   - Implement progressive delays on failed auth
   - Add IP reputation checking
   - Implement account lockout after N failed attempts

2. **Unblock IPs after verification:**
   ```bash
   # Only if confirmed false positive or attack stopped
   docker exec nginx sh -c "sed -i '/ATTACKER_IP/d' /etc/nginx/conf.d/blocked-ips.conf"
   docker exec nginx nginx -s reload
   ```

**Expected Response Time:** 5-15 minutes (containment), 1-4 hours (full remediation)

---

### Incident 2: SQL Injection Attempt

**Detection:**

**Alert:** `SQLInjectionDetected` - SQL keywords in unexpected parameters

**Manual Detection:**
```bash
# Check for SQL injection patterns in logs
docker logs nginx --since 1h | \
  grep -iE "(union.*select|drop.*table|'.*or.*'|admin'--)" | \
  head -20

# Application error logs for SQL errors
docker logs birthday-app-api --since 1h | \
  grep -i "sql.*error\|syntax.*error\|invalid.*query"
```

**Investigation:**

1. **Analyze attack payload:**
   ```bash
   # Extract full request with injection attempt
   docker logs nginx --since 1h | \
     grep -i "union.*select" | \
     jq '{time, method, path, query_string, user_agent, ip}'
   ```

2. **Check if injection was successful:**
   ```bash
   # Look for abnormal database queries
   docker exec birthday-app-postgres psql -U postgres -d birthday_app -c "
   SELECT
     query,
     calls,
     mean_exec_time,
     query_start
   FROM pg_stat_statements
   WHERE query LIKE '%UNION%' OR query LIKE '%DROP%'
   ORDER BY query_start DESC
   LIMIT 20;
   "
   ```

3. **Verify no data exfiltration:**
   ```sql
   -- Check for large result sets returned
   SELECT
     usename,
     query,
     state,
     query_start
   FROM pg_stat_activity
   WHERE state = 'active'
   ORDER BY query_start DESC;
   ```

**Containment:**

1. **Block attacker immediately:**
   ```bash
   # Same IP blocking as Incident 1
   redis-cli SADD blocked_ips ATTACKER_IP
   ```

2. **Enable WAF rules (if available):**
   ```bash
   # ModSecurity/Cloudflare WAF
   # Enable SQL injection rule set
   # Block requests containing SQL keywords
   ```

3. **Review affected code:**
   ```bash
   # Find vulnerable endpoint
   git grep -n "WHERE.*${.*}" src/

   # Check for string concatenation in SQL
   git grep -n "query.*+\|query.*\`\${" src/
   ```

**Eradication:**

1. **Fix vulnerable code:**
   ```typescript
   // BEFORE (vulnerable):
   const query = `SELECT * FROM users WHERE email = '${email}'`;

   // AFTER (safe - parameterized):
   const query = 'SELECT * FROM users WHERE email = $1';
   const result = await db.query(query, [email]);

   // Using Drizzle ORM (already safe):
   const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
   ```

2. **Deploy fix immediately:**
   ```bash
   git add src/vulnerable-file.ts
   git commit -m "fix(security): prevent SQL injection in user query"
   git push origin main

   # Deploy
   docker-compose build api
   docker-compose up -d api
   ```

**Recovery:**

1. **Verify fix:**
   ```bash
   # Test with injection payload (should fail safely)
   curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d '{"email": "admin'"'"' OR '"'"'1'"'"'='"'"'1"}'

   # Should return validation error, not SQL error
   ```

2. **Audit all SQL queries:**
   ```bash
   # Find potential SQL injection vulnerabilities
   git grep -E "query.*\+|query.*\`\$\{|\\.exec\(|raw\(" src/
   ```

**Expected Response Time:** Immediate (containment), 1-2 hours (fix + deploy)

---

### Incident 3: DDoS Attack

**Detection:**

**Alert:** `DDoSAttack` - Request rate > 10,000 req/s or abnormal traffic spike

**Indicators:**
- Sudden spike in traffic from multiple IPs
- High number of connections from single ASN/country
- Application slowness/unavailability
- Increased infrastructure costs

**Investigation:**

1. **Analyze traffic pattern:**
   ```bash
   # Top IPs by request count
   docker logs nginx --since 5m | \
     awk '{print $1}' | \
     sort | uniq -c | sort -rn | head -20

   # Geographic distribution
   # Correlate IPs with GeoIP database

   # User agent analysis
   docker logs nginx --since 5m | \
     awk -F'"' '{print $6}' | \
     sort | uniq -c | sort -rn | head -10
   ```

2. **Identify attack type:**
   - **Volumetric:** High bandwidth consumption (Gbps)
   - **Application layer:** HTTP flood, slowloris
   - **Protocol:** SYN flood, UDP amplification

**Containment:**

1. **Enable DDoS mitigation service:**
   ```bash
   # Option 1: Cloudflare "Under Attack Mode"
   # Enable from dashboard: Security → Settings → Security Level → I'm Under Attack

   # Option 2: AWS Shield
   # Enable from AWS Console or CLI

   # Option 3: Rate limiting at nginx
   docker exec nginx sh -c 'cat > /etc/nginx/conf.d/rate-limit.conf << EOF
   limit_req_zone \$binary_remote_addr zone=ddos_protection:10m rate=10r/s;
   limit_req zone=ddos_protection burst=20 nodelay;
   EOF'
   docker exec nginx nginx -s reload
   ```

2. **Block attacking ASN/country (if concentrated):**
   ```bash
   # Block entire country (use with caution)
   # Example: Block traffic from CN
   docker exec nginx sh -c "echo 'deny 1.0.0.0/8;' >> /etc/nginx/conf.d/geo-block.conf"
   docker exec nginx nginx -s reload
   ```

3. **Scale infrastructure (if volumetric):**
   ```bash
   # Horizontal scaling
   docker-compose up -d --scale api=10

   # Or use auto-scaling (cloud provider)
   ```

**Recovery:**

1. **Monitor attack cessation:**
   ```bash
   # Watch request rate
   watch -n 5 'docker logs nginx --since 1m | wc -l'
   ```

2. **Gradual relaxation of restrictions:**
   ```bash
   # Don't immediately remove all protections
   # Gradually increase rate limits over hours/days
   ```

3. **Post-DDoS analysis:**
   - Review attack vectors
   - Improve DDoS preparedness
   - Consider CDN/DDoS protection service

**Expected Response Time:** 15-60 minutes (mitigation varies by attack size)

---

### Incident 4: Data Breach / Unauthorized Data Access

**⚠️ CRITICAL - Immediate escalation required**

**Detection:**

**Indicators:**
- Unusual data export activity
- Large database queries from unexpected source
- File downloads of user data
- Third-party API keys compromised
- Database credentials leaked

**Investigation:**

1. **Determine scope:**
   ```sql
   -- Audit data access
   SELECT
     usename,
     query,
     state,
     query_start,
     client_addr
   FROM pg_stat_activity
   WHERE query LIKE '%users%' OR query LIKE '%message_logs%'
   ORDER BY query_start DESC;

   -- Check for bulk exports
   SELECT
     query,
     calls,
     total_exec_time,
     rows
   FROM pg_stat_statements
   WHERE query LIKE '%SELECT%' AND rows > 1000
   ORDER BY total_exec_time DESC;
   ```

2. **Identify compromised accounts/keys:**
   ```bash
   # Check for API key usage from unusual locations
   docker logs birthday-app-api | \
     grep "api_key_used" | \
     jq '{api_key_id, ip, endpoint, timestamp}'
   ```

3. **Determine data exposed:**
   ```sql
   -- What tables were accessed?
   -- What data was returned?
   -- How many records?
   ```

**Containment (IMMEDIATE):**

1. **Revoke compromised credentials:**
   ```bash
   # Rotate database password
   docker exec birthday-app-postgres psql -U postgres -c "ALTER USER postgres PASSWORD 'NEW_SECURE_PASSWORD';"

   # Update application .env
   # Restart services
   docker-compose restart

   # Revoke API keys
   # Mark as compromised in database
   psql -U postgres -d birthday_app -c "
   UPDATE api_keys
   SET revoked = true, revoked_reason = 'security_incident'
   WHERE id IN ('COMPROMISED_KEY_IDS');
   "
   ```

2. **Block unauthorized access:**
   ```bash
   # Firewall rules to allow only known IPs
   # Enable IP whitelist mode temporarily
   ```

3. **Enable audit logging:**
   ```sql
   -- PostgreSQL audit log (pgaudit extension)
   CREATE EXTENSION IF NOT EXISTS pgaudit;
   ALTER SYSTEM SET pgaudit.log = 'all';
   SELECT pg_reload_conf();
   ```

**Eradication:**

1. **Find and close vulnerability:**
   - Code review of affected endpoints
   - Security scan for vulnerabilities
   - Patch or disable vulnerable features

2. **Remove attacker access:**
   - Check for backdoors
   - Review system users
   - Scan for web shells or malware

**Recovery:**

1. **Notify affected users (if PII exposed):**
   - Draft communication with legal/compliance
   - Prepare user notification email
   - Offer credit monitoring (if applicable)

2. **Regulatory compliance:**
   - GDPR: Notify within 72 hours
   - CCPA: Notify without unreasonable delay
   - Document breach for regulators

3. **Enhanced monitoring:**
   ```bash
   # Enable detailed audit logging
   # Set up alerts for data export
   # Implement data loss prevention (DLP)
   ```

**Expected Response Time:** Immediate (containment <15min), Full remediation (hours to days)

**⚠️ LEGAL HOLD:** Preserve all logs and evidence. Do not delete anything.

---

### Incident 5: Compromised Secrets/Credentials

**Detection:**

**Sources:**
- GitHub secret scanning alert
- AWS GuardDuty finding
- Manual discovery (credentials in logs)
- Third-party notification (Shodan, HaveIBeenPwned)

**Investigation:**

1. **Identify exposed secret:**
   ```bash
   # What was exposed?
   # - Database password?
   # - API keys (SendGrid, etc.)?
   # - JWT signing secret?
   # - SSH keys?
   # - AWS access keys?
   ```

2. **Determine exposure window:**
   ```bash
   # When was secret committed?
   git log --all --full-history -- "*password*"

   # When was repository public?
   # When was secret leaked?
   ```

3. **Check for unauthorized usage:**
   ```bash
   # AWS CloudTrail (if AWS key compromised)
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=Username,AttributeValue=COMPROMISED_USER

   # SendGrid activity logs
   # Database access logs
   # Application audit logs
   ```

**Containment:**

1. **Immediately rotate secret:**
   ```bash
   # Example: SendGrid API key
   # 1. Create new API key in SendGrid dashboard
   # 2. Update application secret
   # 3. Delete old API key

   # Example: Database password
   docker exec birthday-app-postgres psql -U postgres -c "
   ALTER USER postgres PASSWORD 'NEW_SECURE_PASSWORD';
   "

   # Update .env or secrets manager
   echo "DATABASE_PASSWORD=NEW_SECURE_PASSWORD" > .env.production

   # Restart services
   docker-compose down
   docker-compose up -d
   ```

2. **Revoke exposed secret:**
   ```bash
   # Ensure old secret is completely disabled
   # Verify no services still using old secret
   ```

3. **Remove from git history (if in repository):**
   ```bash
   # Use BFG Repo-Cleaner or git-filter-repo
   git filter-repo --path-match 'PASSWORD' --invert-paths --force

   # Force push (coordinate with team)
   git push origin --force --all
   ```

**Prevention:**

1. **Implement secrets management:**
   ```bash
   # Use SOPS for encrypted secrets in git
   # Or AWS Secrets Manager / HashiCorp Vault
   ```

2. **Add pre-commit hooks:**
   ```bash
   # Install git-secrets or gitleaks
   npm install --save-dev @commitlint/config-conventional
   ```

3. **Enable secret scanning:**
   ```bash
   # GitHub: Settings → Security → Secret scanning
   # Enable push protection
   ```

**Expected Response Time:** Immediate (rotation <5min), Complete remediation (1-2 hours)

---

## Evidence Preservation

### DO NOT Destroy Evidence

**Before taking containment actions:**

1. **Capture system state:**
   ```bash
   # Take snapshots of containers
   docker commit birthday-app-api evidence-api-$(date +%s)
   docker commit birthday-app-postgres evidence-db-$(date +%s)

   # Save container logs
   docker logs birthday-app-api > evidence-api-logs-$(date +%s).log
   docker logs nginx > evidence-nginx-logs-$(date +%s).log

   # Database dump
   ./scripts/backup-database.sh evidence-before-remediation-$(date +%s)

   # Network connections
   docker exec birthday-app-api netstat -tupan > evidence-network-$(date +%s).txt
   ```

2. **Save all logs:**
   ```bash
   # Application logs
   cp -r /var/log/birthday-app evidence/logs-$(date +%s)/

   # System logs
   journalctl --since "1 hour ago" > evidence/syslog-$(date +%s).log

   # Audit logs
   docker exec birthday-app-postgres pg_dump -U postgres -d birthday_app -t audit_logs > evidence/audit-$(date +%s).sql
   ```

3. **Document timeline:**
   ```markdown
   # Incident Timeline

   ## Detection
   - 14:23 UTC: Alert fired
   - 14:25 UTC: Confirmed unauthorized access from IP 1.2.3.4

   ## Response
   - 14:27 UTC: Blocked attacker IP
   - 14:30 UTC: Revoked compromised API key
   - ...
   ```

### Evidence Chain of Custody

| Timestamp | Evidence | Action | Person |
|-----------|----------|--------|--------|
| 2026-01-04 14:30 | API logs | Collected | @oncall-engineer |
| 2026-01-04 14:35 | Database snapshot | Created | @oncall-engineer |
| 2026-01-04 15:00 | Evidence package | Transferred to security team | @security-lead |

---

## Communication & Disclosure

### Internal Communication

**Immediate notification (< 15 minutes):**
- Security team (#security-incidents)
- On-call engineer
- Engineering leadership
- Legal/compliance (if data breach)

**Incident template:**
```
🚨 SECURITY INCIDENT - [SEVERITY]

TYPE: [Unauthorized Access/Data Breach/DDoS/etc.]
DETECTED: [HH:MM UTC]
STATUS: [Investigating/Contained/Resolved]
IMPACT: [What systems/data affected]
DATA EXPOSURE: [Yes/No - details]
CONTAINMENT ACTIONS: [What we've done]
NEXT STEPS: [What we're doing next]
LEAD: @username
```

### External Communication

**When to notify:**
- Any suspected data breach (PII, credentials)
- Confirmed unauthorized access to customer data
- Service disruption >4 hours
- Regulatory requirement

**Notification timeline:**
- **Customers:** Within 24 hours (coordinate with legal)
- **Regulators:** GDPR: 72 hours, CCPA: without unreasonable delay
- **Public:** After customer notification (if required)

### Sample User Notification

```
Subject: Security Notice - Unauthorized Access Attempt

Dear [User],

We are writing to inform you of a security incident that may have affected your account.

What Happened:
On [DATE], we detected unauthorized access attempts to our system.
We immediately blocked the access and secured our systems.

What Information Was Involved:
[Specific data types: email addresses, names, etc. - NO passwords, payment info]

What We're Doing:
- Implemented additional security measures
- Conducting thorough investigation
- Working with security experts

What You Should Do:
- Change your password [LINK]
- Enable two-factor authentication [LINK]
- Monitor your account for suspicious activity
- Review our security tips [LINK]

We sincerely apologize for this incident and are committed to protecting your information.

For questions: security@birthday-app.com

Sincerely,
Security Team
```

---

## Post-Incident Actions

### Immediate (Within 24 Hours)

- [ ] Document full incident timeline
- [ ] Preserve all evidence
- [ ] Notify affected stakeholders
- [ ] Create incident report
- [ ] File regulatory notifications (if required)

### Short-term (Within 1 Week)

- [ ] Conduct postmortem meeting
- [ ] Implement immediate fixes
- [ ] Update security policies
- [ ] Provide security training to team
- [ ] Review and update this playbook

### Long-term (Within 1 Month)

- [ ] Complete root cause analysis
- [ ] Implement preventive measures
- [ ] Conduct security audit
- [ ] Update disaster recovery plan
- [ ] Schedule penetration testing
- [ ] Review incident response effectiveness

### Security Improvements Checklist

- [ ] Enable MFA for all users
- [ ] Implement IP whitelisting where possible
- [ ] Add web application firewall (WAF)
- [ ] Enable DDoS protection
- [ ] Implement secrets management
- [ ] Add security monitoring (SIEM)
- [ ] Conduct code security review
- [ ] Update dependencies (npm audit fix)
- [ ] Enable audit logging
- [ ] Implement intrusion detection (IDS)
- [ ] Schedule regular security training
- [ ] Conduct tabletop exercises

---

## Related Documentation

- [Disaster Recovery Playbook](./disaster-recovery.md)
- [Incident Response Playbook](./incident-response.md)
- [Security Best Practices](../SECURITY.md)
- [Compliance Documentation](../compliance/)

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-04 | 1.0 | Initial security incident playbook | Claude Code |

---

**Security Hotline:** [24/7 security team contact]

**Report Security Issues:** security@birthday-app.com (PGP key available)
