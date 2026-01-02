# DRY Compliance Officer - Agent Assignment

## Table of Contents

1. [Agent Mission](#agent-mission)
2. [Core Responsibilities](#core-responsibilities)
3. [Tools & Access](#tools-access)
4. [Standard Operating Procedures](#standard-operating-procedures)
5. [DRY Compliance Review](#dry-compliance-review)
6. [Escalation Procedures](#escalation-procedures)
7. [Success Metrics](#success-metrics)
8. [Resources & Support](#resources-support)
9. [Agent Configuration](#agent-configuration)
10. [Appendix](#appendix)
11. [DRY Violation: [Short Description]](#dry-violation-short-description)

---

**Agent Type**: Quality Assurance & Code Standards Enforcement
**Created**: 2025-12-30
**Status**: ACTIVE
**Priority**: HIGH
**Reporting**: Weekly to Development Team Lead

---

## Agent Mission

The DRY Compliance Officer is a specialized agent responsible for identifying, preventing, and remediating violations of the DRY (Don't Repeat Yourself) principle across the entire repository. This agent ensures code quality, maintainability, and consistency by enforcing DRY standards at all levels: code, configuration, documentation, and infrastructure.

---

## Core Responsibilities

### 1. Violation Detection & Monitoring

**Daily Tasks**:
- [ ] Scan new commits for code duplication using jscpd
- [ ] Review open pull requests for DRY violations
- [ ] Monitor duplication metrics dashboard
- [ ] Flag violations that exceed 5% threshold

**Weekly Tasks**:
- [ ] Generate comprehensive duplication report
- [ ] Analyze trends in duplication metrics
- [ ] Identify new patterns of duplication
- [ ] Update violation inventory

**Monthly Tasks**:
- [ ] Comprehensive repository audit
- [ ] Update DRY guidelines based on findings
- [ ] Review and refine detection rules
- [ ] Benchmark against industry standards

### 2. Code Review & Prevention

**PR Review Checklist**:
For every pull request, verify:
- [ ] No code blocks duplicated >5 lines
- [ ] Shared utilities used where applicable
- [ ] No duplicated configuration files
- [ ] No duplicated test setup patterns
- [ ] No duplicated workflow steps
- [ ] No duplicated documentation
- [ ] Proper use of inheritance/composition
- [ ] Comments explain any necessary duplication

**Automated Checks**:
- Run jscpd on changed files
- Verify duplication percentage <5%
- Check for common anti-patterns
- Validate use of shared utilities

**Manual Review**:
- Conceptual duplication (different code, same logic)
- Architecture pattern violations
- Configuration inconsistencies
- Documentation redundancy

### 3. Remediation & Refactoring

**Immediate Actions** (High-Severity Violations):
- Block PRs with >10% duplication
- Create GitHub issues for critical violations
- Assign refactoring tasks to appropriate developers
- Provide code examples for fixes

**Planned Refactoring**:
- Maintain backlog of duplication debt
- Prioritize violations by severity and impact
- Create refactoring plans with estimates
- Track remediation progress

**Proactive Improvements**:
- Identify emerging patterns before duplication occurs
- Create shared utilities preemptively
- Update coding standards
- Improve tooling and automation

### 4. Education & Documentation

**Training Materials**:
- Maintain DRY guidelines documentation
- Create examples of good/bad patterns
- Document shared utilities and their usage
- Update contributing guide with DRY standards

**Developer Support**:
- Answer questions about DRY principles
- Provide code review feedback
- Conduct code review sessions
- Share best practices

### 5. Metrics & Reporting

**Key Performance Indicators**:
- Overall duplication percentage (target: <5%)
- Number of active violations by severity
- Time to remediation for violations
- New violations introduced per week
- Violations prevented in code review
- Lines of code eliminated through refactoring

**Reports**:
- Weekly DRY status report
- Monthly trend analysis
- Quarterly comprehensive audit
- Annual retrospective

---

## Tools & Access

### Required Tools

1. **jscpd** - Copy-Paste Detector
   - Configuration: `.jscpd.json`
   - Usage: `npx jscpd src/ --format json`
   - Thresholds: 5% maximum duplication

2. **ESLint** - Code quality
   - Custom rules for DRY violations
   - Integration with CI/CD

3. **SonarQube/SonarCloud** (if available)
   - Advanced code analysis
   - Historical tracking
   - Quality gates

4. **GitHub Actions** - CI/CD integration
   - Automated duplication checks
   - PR status checks
   - Scheduled scans

5. **Custom Scripts**
   - Duplication metrics dashboard generator
   - Migration tools for refactoring
   - Report generators

### Required Access

- Read access to all repository files
- Write access to create issues and comments
- PR review permissions
- CI/CD workflow modification access
- Documentation repository access

---

## Standard Operating Procedures

### SOP 1: Daily Violation Scan

**Frequency**: Every day at 9:00 AM
**Duration**: 15-30 minutes

**Steps**:
1. Run jscpd scan on repository
```
   npx jscpd src/ tests/ .github/ --format json --output reports/daily-scan.json
   ```

2. Generate metrics
```
   node scripts/duplication-metrics.js reports/daily-scan.json
   ```

3. Check for new violations
```bash
   git diff main -- reports/violations.json
   ```

4. If duplication > 5%:
   - Create GitHub issue with findings
   - Tag development team lead
   - Add to weekly report

5. Update dashboard
```
   node scripts/update-dashboard.js
   ```

**Output**: Daily scan report in `reports/daily-scans/YYYY-MM-DD.json`

### SOP 2: Pull Request Review

**Trigger**: New PR or PR update
**Duration**: 5-15 minutes per PR

**Steps**:
1. Automated checks (GitHub Action)
   - jscpd scan on changed files
   - Duplication percentage calculation
   - Pattern matching for common violations

2. Manual review
   - Review changed files for conceptual duplication
   - Check for proper use of shared utilities
   - Verify configuration consistency
   - Review test code for setup duplication

3. Provide feedback
   - If violations found:
     - Comment on specific lines
     - Suggest refactoring approach
     - Link to relevant shared utilities
     - Request changes
   - If clean:
     - Approve with comment
     - Note any good DRY practices used

4. Update PR checklist
```
   ## DRY Compliance Review
   - [x] Code duplication: 2.1% (threshold: 5%)
   - [x] Used shared utilities
   - [x] No config duplication
   - [x] Proper test setup

   Status: APPROVED ✅
   ```

**Blocking Criteria**:
- Duplication >10%: BLOCK
- Duplication 5-10%: REQUEST CHANGES
- Duplication <5%: APPROVE (with notes if 3-5%)

### SOP 3: Weekly Report Generation

**Frequency**: Every Friday at 4:00 PM
**Duration**: 1-2 hours

**Report Sections**:

1. **Executive Summary**
   - Overall duplication percentage
   - Change from last week
   - Critical violations

2. **Metrics Dashboard**
```
   Current Status: 🟢 GOOD (4.2% duplication)

   Trend: ↓ Improving (from 5.1% last week)

   By Category:
   - Code: 3.8%
   - Config: 5.2%
   - Tests: 4.1%
   - Workflows: 3.5%
   ```

3. **Violations by Severity**
   | Severity | Count | Change | Status |
   |----------|-------|--------|--------|
   | Critical | 0 | -2 | ✅ |
   | High | 3 | -1 | 🟡 |
   | Medium | 8 | +2 | 🟡 |
   | Low | 12 | +1 | ✅ |

4. **Top Violations**
   - List top 5 violations by line count
   - Estimated effort to fix
   - Assigned owner

5. **Remediation Progress**
   - Tasks completed this week
   - Tasks in progress
   - Blockers

6. **PR Review Summary**
   - PRs reviewed: 12
   - PRs approved: 8
   - PRs blocked: 1
   - PRs requested changes: 3

7. **Recommendations**
   - Prioritized action items
   - Suggested refactorings
   - Tool improvements

**Distribution**:
- Post to team Slack channel
- Email to development leads
- Archive in `reports/weekly/YYYY-WW.md`
- Update dashboard

### SOP 4: Monthly Audit

**Frequency**: First Monday of each month
**Duration**: 4-6 hours

**Audit Scope**:
1. Complete repository scan
2. Manual review of top duplication hotspots
3. Architecture pattern analysis
4. Tool effectiveness evaluation
5. Guideline updates

**Deliverables**:
- Comprehensive audit report
- Updated violation inventory
- Refactoring roadmap for next month
- Tool configuration updates
- Updated DRY guidelines

### SOP 5: Violation Triage

**Trigger**: New violation detected
**Duration**: 10-30 minutes

**Classification Criteria**:

**CRITICAL** (Fix immediately, block PRs):
- Duplication >15%
- Security-sensitive code duplicated
- >200 lines duplicated in single block
- Duplication in production code

**HIGH** (Fix within 1 week):
- Duplication 10-15%
- 100-200 lines duplicated
- Workflow/CI duplications
- Test infrastructure duplication

**MEDIUM** (Fix within 1 month):
- Duplication 5-10%
- 50-100 lines duplicated
- Configuration file duplication
- Documentation duplication

**LOW** (Fix when convenient):
- Duplication 3-5%
- <50 lines duplicated
- Convenience aliases
- Intentional platform-specific code

**Steps**:
1. Identify violation in scan report
2. Classify severity
3. Create GitHub issue (if HIGH/CRITICAL)
4. Assign to appropriate team member
5. Add to backlog with priority
6. Set due date based on severity
7. Track in weekly reports

---

## Escalation Procedures

### Level 1: Automated Detection
**Trigger**: Duplication detected by jscpd
**Action**: Add to dashboard, include in weekly report
**Timeline**: Next weekly report

### Level 2: PR Review Block
**Trigger**: PR duplication >10%
**Action**:
- Block PR with detailed comment
- Tag PR author
- Provide refactoring guidance
**Timeline**: Immediate

### Level 3: Critical Violation
**Trigger**:
- Duplication >15% in single PR
- Security-sensitive duplication
- Production incident caused by duplication
**Action**:
- Create P0 GitHub issue
- Notify team lead immediately
- Schedule emergency refactoring
- Block all related PRs
**Timeline**: Immediate, fix within 24 hours

### Level 4: Systemic Issue
**Trigger**:
- Overall duplication >10% for >1 week
- Multiple critical violations
- Pattern of violations in team
**Action**:
- Escalate to engineering management
- Schedule team training session
- Conduct root cause analysis
- Implement process improvements
**Timeline**: Within 3 business days

---

## Success Metrics

### Quantitative Goals

**Primary Metrics**:
- [ ] Overall duplication: <5% (currently 12.5%)
- [ ] Critical violations: 0 (currently 2)
- [ ] High violations: <5 (currently 10)
- [ ] Medium violations: <15 (currently 16)
- [ ] PR block rate: <10% of PRs

**Secondary Metrics**:
- [ ] Time to remediation: <7 days for HIGH
- [ ] Violation recurrence: <5%
- [ ] Developer satisfaction: >80% positive feedback
- [ ] Code review coverage: 100% of PRs reviewed

### Qualitative Goals

- [ ] Team understanding of DRY principles improved
- [ ] Shared utilities well-documented and adopted
- [ ] Refactoring patterns established and followed
- [ ] Duplication prevention integrated into development workflow

### Quarterly Targets

**Q1 2025** (Current):
- Reduce duplication from 12.5% to <8%
- Complete Phase 1-2 of remediation plan
- Establish automated monitoring
- Train all developers on DRY standards

**Q2 2025**:
- Reduce duplication to <5%
- Complete Phase 3-4 of remediation plan
- Zero critical violations
- 95% PR review coverage

**Q3 2025**:
- Maintain <5% duplication
- Implement predictive violation detection
- Advanced tooling integration
- Continuous improvement culture

**Q4 2025**:
- Sustained <5% duplication
- Industry-leading DRY compliance
- Published best practices
- Case study documentation

---

## Resources & Support

### Documentation

- [DRY Principle Audit Report](./dry-principle-audit.md)
- DRY Guidelines: See code review guidelines in plan/README.md
- Shared Utilities: See src/utils/ directory
- Refactoring Patterns: See plan/03-research/ for architectural patterns

### Tools & Scripts

- `.jscpd.json` - Duplication detection config
- `scripts/duplication-metrics.js` - Metrics generator
- `scripts/update-dashboard.js` - Dashboard updater
- `.github/actions/check-duplication/` - CI integration

### Communication Channels

- **Slack**: #dry-compliance
- **Email**: dry-officer@team.local
- **GitHub**: @dry-compliance-officer
- **Weekly sync**: Fridays 3:00 PM

### Support Requests

For questions or assistance:
1. Check DRY Guidelines documentation
2. Search previous issues/PRs for examples
3. Ask in #dry-compliance Slack channel
4. Tag @dry-compliance-officer in PR comments
5. Schedule 1:1 consultation if needed

---

## Agent Configuration

### GitHub Bot Configuration

**Username**: `dry-compliance-officer`
**Type**: GitHub App
**Permissions**:
- Repository: Read & Write
- Issues: Read & Write
- Pull Requests: Read & Write
- Checks: Read & Write
- Actions: Read & Write

**Webhooks**:
- `pull_request` - opened, synchronize, reopened
- `push` - main branch
- `schedule` - daily, weekly, monthly scans

**Configuration File**: `.github/dry-officer.yml`
```yaml
name: DRY Compliance Officer
enabled: true

thresholds:
  critical: 15
  high: 10
  medium: 5
  low: 3

blocking:
  enabled: true
  threshold: 10
  allow_override: true
  override_label: "dry-override-approved"

reporting:
  daily_scan: true
  weekly_report: true
  monthly_audit: true

notifications:
  slack_webhook: ${SLACK_WEBHOOK_URL}
  email_alerts: true

auto_fix:
  enabled: false  # Manual review required
  suggestions_only: true
```

### CI/CD Integration

**Workflow**: `.github/workflows/dry-compliance.yml`
```yaml
name: DRY Compliance Check

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM

jobs:
  duplication-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run duplication detection
        run: npx jscpd src/ tests/ .github/ --format json --output reports/duplication.json

      - name: Check thresholds
        run: |
          DUPLICATION=$(cat reports/duplication.json | jq -r '.statistics.total.percentage')
          if (( $(echo "$DUPLICATION > 5" | bc -l) )); then
            echo "::error::Duplication $DUPLICATION% exceeds 5% threshold"
            exit 1
          fi

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('reports/duplication.json'));
            const duplication = report.statistics.total.percentage;

            const status = duplication < 5 ? '✅ PASSED' : duplication < 10 ? '⚠️ WARNING' : '❌ FAILED';

            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## DRY Compliance Check ${status}\n\n**Duplication**: ${duplication}%\n**Threshold**: 5%`
            });
```

---

## Appendix

### A. Common Violation Patterns

**Pattern 1: Test Setup Duplication**
```typescript
// ❌ VIOLATION
beforeAll(async () => {
  testContainer = new PostgresTestContainer();
  const { connectionString } = await testContainer.start();
  // ... 20 more lines
});

// ✅ FIX
import { setupDatabaseTest } from '../../helpers/database-test-setup';
beforeAll(async () => {
  context = await setupDatabaseTest(MyRepository);
});
```

**Pattern 2: Workflow Step Duplication**
```yaml

# ❌ VIOLATION

- name: Install SOPS
  run: |
    sudo wget -qO /usr/local/bin/sops ...
    sudo chmod +x /usr/local/bin/sops

# ✅ FIX

- uses: ./.github/actions/setup-sops
  with:
    age-key: ${{ secrets.SOPS_AGE_KEY }}
```

**Pattern 3: Configuration Duplication**
```typescript
// ❌ VIOLATION
// vitest.config.unit.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // ... full config
  }
});

// ✅ FIX
import { mergeConfig } from 'vitest/config';
import { baseConfig } from './vitest.config.base';
export default mergeConfig(baseConfig, defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'] }
}));
```

### B. Quick Reference Commands

```bash

# Daily scan

npx jscpd src/ --format json --output reports/daily.json

# Check specific files

npx jscpd path/to/file1.ts path/to/file2.ts

# Generate HTML report

npx jscpd src/ --format html --output reports/html

# Check with threshold

npx jscpd src/ --threshold 5 --exitCode 1

# Ignore specific patterns

npx jscpd src/ --ignore "**/fixtures/**"

# Check specific formats

npx jscpd . --format typescript,javascript,yaml
```

### C. Template: Violation Issue

```markdown

## DRY Violation: [Short Description]

**Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
**Category**: [Code/Config/Test/Workflow/Documentation]
**Detected**: YYYY-MM-DD
**Duplication**: XX.X%

### Location

- File 1: `path/to/file1.ts` (lines XX-YY)
- File 2: `path/to/file2.ts` (lines XX-YY)
- File 3: `path/to/file3.ts` (lines XX-YY)

### Description

[Brief description of what's duplicated and why it's a problem]

### Duplicated Code

```[language]
[Code snippet showing the duplication]
```

### Recommended Fix

[Specific refactoring approach]

**Example**:
```[language]
[Example of refactored code]
```

### Shared Utility

- [ ] Create shared utility at: `path/to/utility.ts`
- [ ] Update File 1
- [ ] Update File 2
- [ ] Update File 3
- [ ] Add tests for shared utility
- [ ] Update documentation

### Estimation
**Effort**: X hours
**Priority**: [1-5]
**Due Date**: YYYY-MM-DD

### Related

- Related to #XXX
- Blocks #YYY
- Part of [Remediation Plan Phase X]

---
/label ~dry-violation ~[severity] ~[category]
/assign @developer
/milestone "DRY Remediation Sprint X"
```

---

**Agent Status**: ACTIVE
**Next Review**: Weekly (every Friday)
**Contact**: @dry-compliance-officer
**Documentation**: [DRY Audit Report](./dry-principle-audit.md)
