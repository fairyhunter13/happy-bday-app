# Service Level Agreement (SLA)

## Overview

This document defines the Service Level Agreement for the Birthday Message Scheduler application, outlining availability targets, performance expectations, support response times, and operational commitments.

**Effective Date:** 2025-01-01
**Review Period:** Quarterly
**Version:** 1.0.0

---

## 1. Service Availability

### 1.1 Uptime Commitment

**Target:** 99.9% monthly uptime

**Calculation:**
```
Monthly Uptime % = (Total Minutes in Month - Downtime Minutes) / Total Minutes in Month × 100
```

**Expected Downtime:**
- **Per Month:** Maximum 43.8 minutes
- **Per Week:** Maximum 10.1 minutes
- **Per Day:** Maximum 1.4 minutes

### 1.2 Uptime Exclusions

The following are **NOT** counted as downtime:
- Scheduled maintenance (with 7-day notice)
- Third-party service outages (external message API)
- Customer's network/infrastructure issues
- Force majeure events
- Issues caused by customer's misuse

### 1.3 Scheduled Maintenance

**Windows:**
- **Frequency:** Monthly maximum
- **Duration:** 2 hours maximum
- **Timing:** Sundays 02:00-04:00 UTC (low-traffic period)
- **Notice:** Minimum 7 days advance notice
- **Communication:** Email + status page update

**Emergency Maintenance:**
- May occur without 7-day notice for critical security patches
- Notification: 2 hours advance notice when possible
- Target duration: <1 hour

---

## 2. Performance Targets

### 2.1 API Response Times

| Metric | Target | Threshold |
|--------|--------|-----------|
| **P50 (Median)** | <100ms | <200ms |
| **P95** | <300ms | <500ms |
| **P99** | <500ms | <1000ms |

**Measurement:**
- Measured from server perspective
- Excludes network latency between client and server
- Applies to all API endpoints under normal load

### 2.2 Message Throughput

| Metric | Target | Minimum |
|--------|--------|---------|
| **Messages per Second** | >10 msg/s | >5 msg/s |
| **Daily Message Capacity** | >100,000 messages | >50,000 messages |
| **Peak Burst Handling** | >50 msg/s (1 min) | >25 msg/s (1 min) |

### 2.3 Message Delivery

| Metric | Target | Threshold |
|--------|--------|-----------|
| **Success Rate** | >99% | >95% |
| **Delivery Time (from queue)** | <5 seconds (P95) | <30 seconds (P95) |
| **Retry Attempts** | 3 automatic retries | N/A |
| **Dead Letter Queue** | Messages preserved 7 days | N/A |

**Note:** Success rate excludes failures caused by:
- Invalid external API credentials
- External message service downtime
- Invalid recipient information

---

## 3. Support Response Times

### 3.1 Support Tiers

| Severity | Description | Response Time | Resolution Target |
|----------|-------------|---------------|-------------------|
| **P1 - Critical** | Service completely down, data loss risk | 15 minutes | 4 hours |
| **P2 - High** | Major feature broken, severe degradation | 1 hour | 8 hours |
| **P3 - Medium** | Non-critical feature impaired | 4 hours | 2 business days |
| **P4 - Low** | Minor issue, cosmetic, question | 1 business day | 5 business days |

### 3.2 Severity Definitions

**P1 - Critical:**
- Complete service outage
- Database corruption/data loss
- Security breach
- >50% of users affected

**P2 - High:**
- Major functionality impaired
- Significant performance degradation (>100% slower)
- 10-50% of users affected
- Workaround not available

**P3 - Medium:**
- Non-critical feature not working
- Minor performance issues
- <10% of users affected
- Workaround available

**P4 - Low:**
- Cosmetic issues
- Feature requests
- Documentation updates
- General questions

### 3.3 Support Hours

**Standard Support:**
- **Hours:** Monday-Friday, 09:00-17:00 UTC
- **Channels:** Email, Slack
- **Tiers Covered:** P2-P4

**24/7 Support (Critical Only):**
- **Hours:** 24/7/365
- **Channels:** PagerDuty, Phone
- **Tiers Covered:** P1 only

---

## 4. Monitoring & Reporting

### 4.1 Real-Time Monitoring

**Public Status Page:** https://status.example.com

**Components Monitored:**
- ✅ API Availability
- ✅ Message Queue Health
- ✅ Database Connectivity
- ✅ External Service Integration
- ✅ Response Times
- ✅ Error Rates

**Update Frequency:**
- Automated checks: Every 30 seconds
- Status page updates: Real-time
- Incident notifications: Immediate

### 4.2 Monthly SLA Reports

**Provided By:** 5th business day of following month

**Report Contents:**
1. **Availability Summary**
   - Monthly uptime percentage
   - Total downtime minutes
   - Downtime breakdown by incident

2. **Performance Summary**
   - P50, P95, P99 response times
   - Average throughput
   - Message delivery success rate

3. **Incident Summary**
   - Total incidents by severity
   - MTTR (Mean Time To Recovery)
   - Root causes and resolutions

4. **Trend Analysis**
   - Month-over-month comparisons
   - Performance trends
   - Capacity forecasting

**Example Report:**
```
=== January 2025 SLA Report ===

Availability: 99.95% ✅ (Target: 99.9%)
- Total Minutes: 44,640
- Downtime: 22.3 minutes
- Incidents: 2 (1 × P2, 1 × P3)

Performance:
- P50 Response Time: 78ms ✅ (Target: <100ms)
- P95 Response Time: 245ms ✅ (Target: <300ms)
- P99 Response Time: 456ms ✅ (Target: <500ms)

Message Delivery:
- Success Rate: 99.7% ✅ (Target: >99%)
- Average Throughput: 12.3 msg/s ✅ (Target: >10 msg/s)
- Total Messages: 32,456,789

Incidents:
1. [P2] Database connection pool exhaustion - 15 min
   - Resolution: Increased pool size
2. [P3] Slow query on users table - 7 min
   - Resolution: Added index

Trends:
- Uptime improved 0.02% vs. December
- Response times improved 12% vs. December
- Message volume increased 23% vs. December
```

---

## 5. Service Credits

### 5.1 SLA Credit Policy

If monthly uptime falls below 99.9%, customers are entitled to service credits:

| Monthly Uptime | Service Credit |
|----------------|----------------|
| 99.0% - 99.9% | 10% of monthly fee |
| 95.0% - 98.99% | 25% of monthly fee |
| <95.0% | 50% of monthly fee |

### 5.2 Credit Claim Process

1. **Claim Window:** Within 30 days of incident
2. **Method:** Email to billing@example.com
3. **Required Info:**
   - Account identifier
   - Date/time of outage
   - Description of impact
   - Supporting evidence (logs, screenshots)

4. **Processing:** Credits applied within 1 billing cycle
5. **Application:** Credits apply to future invoices only (no cash refunds)

### 5.3 Credit Limitations

- Maximum credit: 50% of monthly fee
- Credits do not apply during excluded downtime
- Credits are sole remedy for SLA violations

---

## 6. Capacity & Scaling

### 6.1 Capacity Commitments

**Current Capacity:**
- **Users:** Up to 1 million registered users
- **Messages:** Up to 10 million messages/month
- **API Requests:** Up to 1 million requests/day
- **Concurrent Workers:** Auto-scales 1-20 workers
- **Database Connections:** Up to 100 concurrent connections

**Scaling Notice:**
- **Proactive Monitoring:** Team monitors capacity usage
- **80% Threshold:** Automatic alerts to operations team
- **95% Threshold:** Scaling action initiated
- **Customer Communication:** Notified if approaching limits

### 6.2 Scaling Procedure

**Horizontal Scaling (Auto):**
- API servers: Auto-scales based on CPU (3-20 instances)
- Workers: Auto-scales based on queue depth (1-20 instances)

**Vertical Scaling (Manual):**
- Database: Requires maintenance window (2 hours)
- Notice: 7 days for scheduled scaling

**Capacity Increase Requests:**
- Contact: capacity@example.com
- Lead Time: 14 days for significant increases
- No additional charge for reasonable growth

---

## 7. Data Management

### 7.1 Backup Policy

**Frequency:**
- **Database:** Daily automated backups
- **Timing:** 02:00 UTC daily
- **Retention:** 30 days

**Backup Verification:**
- **Automated Tests:** Weekly restore test
- **Manual Tests:** Monthly restore drill

### 7.2 Data Retention

| Data Type | Retention Period |
|-----------|------------------|
| User Records | Indefinite (until deletion requested) |
| Message Logs | 90 days |
| System Logs | 30 days |
| Metrics | 1 year |
| Backups | 30 days |

### 7.3 Data Recovery

**Recovery Point Objective (RPO):** 24 hours
- Maximum data loss: Last 24 hours of data

**Recovery Time Objective (RTO):** 4 hours
- Maximum time to restore service: 4 hours

**Restore Process:**
1. Declare disaster recovery scenario
2. Spin up infrastructure
3. Restore latest backup
4. Verify data integrity
5. Update DNS/routing
6. Verify functionality
7. Monitor for 24 hours

---

## 8. Security & Compliance

### 8.1 Security Commitments

**Practices:**
- ✅ Data encrypted at rest (AES-256)
- ✅ Data encrypted in transit (TLS 1.3)
- ✅ Regular security audits (quarterly)
- ✅ Penetration testing (annually)
- ✅ Vulnerability scanning (weekly)
- ✅ Security patches applied within:
  - Critical: 24 hours
  - High: 7 days
  - Medium: 30 days

**Access Control:**
- ✅ Multi-factor authentication required
- ✅ Role-based access control (RBAC)
- ✅ Audit logging of all access
- ✅ Regular access reviews (quarterly)

### 8.2 Incident Response

**Security Incident Response Times:**
- **Detection:** <1 hour (automated monitoring)
- **Assessment:** <2 hours
- **Containment:** <4 hours
- **Notification:** <24 hours (if customer data affected)
- **Resolution:** Variable (based on severity)

**Breach Notification:**
- Email notification within 72 hours
- Incident report within 7 days
- Remediation plan provided

---

## 9. Change Management

### 9.1 Release Schedule

**Regular Releases:**
- **Frequency:** Bi-weekly (every other Tuesday)
- **Timing:** 14:00 UTC
- **Notice:** 3 business days
- **Method:** Email + changelog

**Hotfix Releases:**
- **Frequency:** As needed for critical fixes
- **Notice:** Best effort (may be immediate)
- **Communication:** Real-time via status page

### 9.2 Breaking Changes

**Notice Period:** Minimum 30 days

**Process:**
1. **T-30 days:** Announcement via email
2. **T-14 days:** Reminder + migration guide
3. **T-7 days:** Final reminder
4. **T-0:** Change deployed
5. **T+30 days:** Deprecated features removed

---

## 10. Service Limitations

### 10.1 Known Limitations

**Rate Limits:**
- **API Requests:** 100 requests/minute per client
- **Message Queue:** 10,000 messages/hour per user

**Size Limits:**
- **User Record:** 10 KB max
- **Message Payload:** 64 KB max
- **API Request Body:** 1 MB max

**Concurrency:**
- **API Connections:** 1,000 concurrent per instance
- **Database Connections:** 100 total
- **Worker Concurrency:** 10 messages/worker

### 10.2 Fair Use Policy

Service is intended for automated birthday message scheduling. Prohibited uses:
- Spam or unsolicited messages
- Excessive API polling (>1 req/second sustained)
- Attempts to circumvent rate limits
- Malicious traffic or abuse

**Violation Response:**
1. **First Offense:** Warning email
2. **Second Offense:** Temporary suspension (24 hours)
3. **Third Offense:** Account termination

---

## 11. Communication Channels

### 11.1 Status Updates

**Status Page:** https://status.example.com
- Real-time service status
- Incident history
- Maintenance schedule
- Subscribe to updates

**Email Notifications:**
- Maintenance announcements
- Incident notifications
- Monthly SLA reports
- Security bulletins

**Slack Integration:**
- #status-updates channel
- Real-time incident updates
- Automated alerts

### 11.2 Support Channels

**Email:** support@example.com
- Response time per SLA tier
- 24-hour monitoring (P1 escalation)

**Slack:** #support (for customers)
- Business hours support
- Faster response for urgent issues

**PagerDuty:** (P1 Critical Only)
- 24/7/365 emergency hotline
- Automatic escalation

**Documentation:** https://docs.example.com
- Comprehensive guides
- API reference
- Troubleshooting
- FAQs

---

## 12. SLA Review & Updates

### 12.1 Review Schedule

**Frequency:** Quarterly

**Review Process:**
1. Analyze previous quarter metrics
2. Identify improvement opportunities
3. Gather customer feedback
4. Update targets if needed
5. Communicate changes (30-day notice)

### 12.2 Customer Feedback

**Feedback Channels:**
- Quarterly satisfaction surveys
- Feature request portal
- Regular customer meetings
- Support ticket trends

**Continuous Improvement:**
- Monthly performance reviews
- Bi-annual architecture reviews
- Annual capacity planning
- Ongoing training and certification

---

## 13. Definitions

**Availability:** Percentage of time service is accessible and functional

**Downtime:** Period when service returns HTTP 5xx errors or no response

**Response Time:** Time from request receipt to response sent (server-side)

**Business Day:** Monday-Friday, excluding public holidays (UTC timezone)

**Critical Issue:** Service completely unavailable or data loss risk

**Maintenance Window:** Scheduled period for updates/maintenance

**Service Credit:** Financial compensation for SLA violations

---

## 14. Contact Information

**Support Team:**
- Email: support@example.com
- Slack: #support
- PagerDuty: +1-650-989-2974 (P1 only)

**Account Management:**
- Email: accounts@example.com
- Phone: +1-555-0100

**Billing:**
- Email: billing@example.com

**Security:**
- Email: security@example.com
- PGP Key: https://example.com/pgp

---

**Last Updated:** 2025-12-30
**Version:** 1.0.0
**Approved By:** VP Engineering, VP Operations
**Next Review:** 2025-03-31
