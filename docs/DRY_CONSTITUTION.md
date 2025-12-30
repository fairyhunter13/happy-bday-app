# DRY Principle Constitution

**Repository**: Birthday Message Scheduler
**Established**: December 30, 2025
**Version**: 1.0
**Authority**: Project Constitution - **MANDATORY COMPLIANCE**

---

## 🏛️ Preamble

This document establishes the **DRY (Don't Repeat Yourself) Principle** as the **foundational constitution** of the Birthday Message Scheduler repository. All code, configuration, documentation, and infrastructure **MUST** adhere to these principles.

**Violations of this constitution are considered critical defects and MUST be remediated immediately.**

---

## 📜 Article I: Core Principle

### Section 1.1: DRY Definition

**Every piece of knowledge must have a single, unambiguous, authoritative representation within a system.**

This applies to:
- Source code (functions, classes, methods)
- Configuration (CI/CD, Docker, environment)
- Documentation (guides, READMEs, comments)
- Tests (test setup, fixtures, mocks)
- Infrastructure (scripts, workflows, hooks)

### Section 1.2: Scope

The DRY principle applies to **ALL aspects** of the repository:
- ✅ TypeScript/JavaScript code
- ✅ GitHub Actions workflows
- ✅ Shell scripts and hooks
- ✅ Docker and docker-compose files
- ✅ Documentation markdown files
- ✅ Test files and test utilities
- ✅ Configuration files (JSON, YAML, TOML)
- ✅ Database schemas and migrations

**No exceptions unless explicitly documented and approved.**

---

## 📏 Article II: Standards and Thresholds

### Section 2.1: Acceptable Duplication Threshold

**Maximum Allowed Duplication**: **5%**

Measured by:
- **jscpd** (Copy-Paste Detector)
- Lines of duplicated code / total lines of code
- Automatically enforced in CI/CD

### Section 2.2: Violation Severity

| Duplication % | Severity | Action Required |
|---------------|----------|-----------------|
| 0-5% | ✅ GOOD | Continue monitoring |
| 5-10% | ⚠️ WARNING | Create remediation plan (1 week) |
| 10-15% | 🔴 ERROR | Block PRs, immediate fix required (3 days) |
| 15%+ | 🚨 CRITICAL | Emergency remediation, all-hands (24 hours) |

### Section 2.3: Code Clone Types

**Type 1 - Exact Clones**: 0% tolerance (100% identical)
**Type 2 - Renamed Clones**: 0% tolerance (identical logic, different names)
**Type 3 - Near-Miss Clones**: 5% tolerance (similar structure, minor differences)
**Type 4 - Semantic Clones**: Acceptable if abstraction cost > duplication cost

---

## ⚖️ Article III: Enforcement

### Section 3.1: DRY Compliance Officer

**Role**: Dedicated agent/team member responsible for DRY enforcement
**Authority**: Can block PRs, require refactoring, enforce standards
**Reporting**: Weekly duplication reports to project lead

**Responsibilities**:
1. Daily code review for DRY violations
2. Automated duplication monitoring
3. Remediation plan tracking
4. DRY education and training
5. Exception approval process

### Section 3.2: Automated Enforcement

**Pre-Commit Hook**: Block commits with >5% duplication
```bash
# .husky/pre-commit
npx jscpd --threshold 5 --exitCode 1
```

**CI/CD Gate**: Block PRs with >5% duplication
```yaml
# .github/workflows/dry-check.yml
- name: Check DRY compliance
  run: npx jscpd --threshold 5 --exitCode 1
```

**Pull Request Review**: Mandatory DRY compliance check
- Automated comment on duplicated code
- Required approval from DRY Compliance Officer if duplication >3%

### Section 3.3: Metrics and Monitoring

**Dashboard**: Real-time duplication tracking
- Current duplication percentage
- Trend graph (weekly)
- Top violators (files with most duplication)
- Historical remediation progress

**Weekly Report**: Email to team with duplication status

---

## 🛠️ Article IV: Implementation Guidelines

### Section 4.1: Code Duplication

**Rule**: If code is repeated **2+ times**, extract to shared utility

**Good Example**:
```typescript
// ❌ VIOLATION - Repeated error handling
try {
  await sendEmail();
} catch (error) {
  logger.error('Failed to send email', error);
  metricsService.recordError('email_send_failed');
  throw error;
}

try {
  await saveToDatabase();
} catch (error) {
  logger.error('Failed to save to database', error);
  metricsService.recordError('database_save_failed');
  throw error;
}

// ✅ COMPLIANT - Extracted utility
async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorType: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(`Failed: ${errorType}`, error);
    metricsService.recordError(errorType);
    throw error;
  }
}

await withErrorHandling(() => sendEmail(), 'email_send_failed');
await withErrorHandling(() => saveToDatabase(), 'database_save_failed');
```

### Section 4.2: Configuration Duplication

**Rule**: Extract common configuration to base files with inheritance

**Good Example**:
```typescript
// ❌ VIOLATION - Repeated Vitest config
// vitest.config.unit.ts - 100 lines
// vitest.config.integration.ts - 100 lines (80% duplicate)
// vitest.config.e2e.ts - 100 lines (80% duplicate)

// ✅ COMPLIANT - Base config with merging
// vitest.config.base.ts - 90 lines
export default defineConfig({ /* shared config */ });

// vitest.config.unit.ts - 15 lines
import baseConfig from './vitest.config.base';
export default mergeConfig(baseConfig, { /* unit-specific */ });

// vitest.config.integration.ts - 15 lines
import baseConfig from './vitest.config.base';
export default mergeConfig(baseConfig, { /* integration-specific */ });
```

### Section 4.3: CI/CD Workflow Duplication

**Rule**: Use composite actions or reusable workflows

**Good Example**:
```yaml
# ❌ VIOLATION - Repeated SOPS setup in 6 workflows (240 lines)
- name: Install SOPS
  run: |
    sudo wget -O /usr/local/bin/sops \
      https://github.com/mozilla/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64
    sudo chmod +x /usr/local/bin/sops
- name: Setup age keys
  run: |
    mkdir -p ~/.config/sops/age
    echo "${{ secrets.SOPS_AGE_KEY }}" > ~/.config/sops/age/keys.txt
    chmod 600 ~/.config/sops/age/keys.txt

# ✅ COMPLIANT - Composite action
# .github/actions/setup-sops/action.yml
name: Setup SOPS
runs:
  using: composite
  steps:
    - name: Install SOPS
      run: ...
    - name: Setup age keys
      run: ...

# Usage in workflows (1 line)
- uses: ./.github/actions/setup-sops
```

### Section 4.4: Test Duplication

**Rule**: Use test fixtures, factories, and shared utilities

**Good Example**:
```typescript
// ❌ VIOLATION - Repeated test setup in 40 files
beforeEach(async () => {
  const dbContainer = await new PostgreSqlContainer().start();
  const db = drizzle(dbContainer.getConnectionString());
  const repository = new UserRepository(db);
  // ... 20 more lines
});

// ✅ COMPLIANT - Test fixture factory
// tests/helpers/test-fixtures.ts
export async function createTestContext() {
  const dbContainer = await new PostgreSqlContainer().start();
  const db = drizzle(dbContainer.getConnectionString());
  const repository = new UserRepository(db);
  // ... all setup logic
  return { db, repository, ... };
}

// Usage in tests (1 line)
beforeEach(async () => {
  testContext = await createTestContext();
});
```

### Section 4.5: Documentation Duplication

**Rule**: Use includes, links, and single source of truth

**Good Example**:
```markdown
<!-- ❌ VIOLATION - Same API documentation in 3 files -->
<!-- README.md has full API docs -->
<!-- docs/API.md has full API docs (duplicate) -->
<!-- docs/DEPLOYMENT.md has full API docs (duplicate) -->

<!-- ✅ COMPLIANT - Single source with links -->
<!-- README.md -->
See [API Documentation](docs/API.md) for complete API reference.

<!-- docs/DEPLOYMENT.md -->
See [API Documentation](./API.md) for endpoints.

<!-- docs/API.md - SINGLE SOURCE OF TRUTH -->
# API Documentation
...
```

---

## 🎓 Article V: Education and Best Practices

### Section 5.1: When to Abstract

**Abstract when**:
- Code repeated 2+ times
- Similar logic with minor variations
- Pattern likely to be reused in future

**Don't abstract when**:
- Only 1 occurrence
- Abstraction more complex than duplication
- Temporary code (prototypes, experiments)

### Section 5.2: Abstraction Levels

**Good abstraction ladder**:
1. **Copy-paste** (1st occurrence) - OK
2. **Extract function** (2nd occurrence) - Required
3. **Extract class** (3+ occurrences with state) - Recommended
4. **Extract library** (used across projects) - Optional

### Section 5.3: Common Patterns

**Shared Utilities**:
- `src/utils/` - Pure utility functions
- `src/lib/` - Reusable libraries
- `tests/helpers/` - Test utilities
- `.github/actions/` - Reusable workflow actions

**Configuration**:
- `*.base.*` - Base configuration files
- `*.common.*` - Common configuration
- Merge/extend patterns for specialization

**Templates**:
- `templates/` - File templates
- Snippet libraries for common patterns

---

## 🔍 Article VI: Exception Process

### Section 6.1: Requesting Exceptions

**When exceptions are allowed**:
1. **Generated code** (OpenAPI clients, Prisma models)
2. **Third-party code** (node_modules)
3. **Temporary duplication** during refactoring (max 1 sprint)
4. **Performance-critical** where abstraction has overhead
5. **Legacy code** with documented deprecation plan

**Exception Request Process**:
1. Create GitHub issue with template `DRY_EXCEPTION_REQUEST`
2. Provide justification and alternatives considered
3. Get approval from DRY Compliance Officer + Tech Lead
4. Document in `.dry-exceptions.yml`
5. Set expiration date (max 3 months)
6. Review exceptions monthly

### Section 6.2: Exception Documentation

**File**: `.dry-exceptions.yml`
```yaml
exceptions:
  - file: src/generated/email-client.ts
    reason: Auto-generated from OpenAPI spec
    expires: never
    approved_by: tech-lead
    approved_date: 2025-12-30

  - file: src/legacy/old-api.ts
    reason: Legacy code, scheduled for removal Q2 2026
    expires: 2026-06-30
    approved_by: dry-officer
    approved_date: 2025-12-30
```

---

## 📊 Article VII: Metrics and Reporting

### Section 7.1: Key Metrics

**Primary Metric**: Overall Duplication Percentage
- **Current**: 12.5% ❌
- **Target**: <5% ✅
- **Measured by**: jscpd

**Secondary Metrics**:
- Duplicate lines of code (absolute)
- Files with duplication
- Largest duplicated blocks
- Duplication trend (week-over-week)

### Section 7.2: Reporting Schedule

**Daily**: Automated duplication check in CI/CD
**Weekly**: Duplication report emailed to team
**Monthly**: Comprehensive audit by DRY Compliance Officer
**Quarterly**: Constitution review and updates

### Section 7.3: Success Criteria

**Individual PR**: <5% duplication, or reduced from previous
**Repository**: <5% overall duplication
**Remediation**: All critical violations fixed within 24 hours
**Compliance**: 100% of new code follows DRY principles

---

## 🔄 Article VIII: Remediation Process

### Section 8.1: Violation Discovery

**How violations are found**:
1. Automated jscpd scans (daily)
2. Manual code review
3. Pull request checks
4. Developer reporting

**Violation Reporting**:
- Create GitHub issue with template `DRY_VIOLATION`
- Tag: `type:dry-violation`, `priority:high`
- Assign to: Original author + DRY Compliance Officer

### Section 8.2: Remediation Timeline

| Severity | Response Time | Fix Deadline |
|----------|---------------|--------------|
| Critical (15%+) | 1 hour | 24 hours |
| High (10-15%) | 4 hours | 3 days |
| Medium (5-10%) | 1 day | 1 week |
| Low (<5%) | 1 week | 1 month |

### Section 8.3: Remediation Strategies

**Strategy 1: Extract Function/Class**
- Identify common code
- Create shared utility
- Replace all occurrences
- Add tests for utility
- Estimated time: 1-4 hours

**Strategy 2: Configuration Merging**
- Create base configuration
- Extract common parts
- Merge/extend in specific configs
- Estimated time: 2-6 hours

**Strategy 3: Composite Actions/Reusable Workflows**
- Extract common workflow steps
- Create composite action
- Update all workflows
- Estimated time: 2-8 hours

---

## ✅ Article IX: Compliance Checklist

### Section 9.1: Pre-Commit Checklist

Before every commit:
- [ ] No code repeated 2+ times
- [ ] Shared utilities used for common patterns
- [ ] Configuration inherits from base where applicable
- [ ] jscpd check passes (<5% duplication)
- [ ] No Type 1 or Type 2 clones

### Section 9.2: Pre-PR Checklist

Before creating pull request:
- [ ] Overall duplication <5% or improved from baseline
- [ ] New code follows DRY principles
- [ ] Refactored existing violations found during work
- [ ] Updated shared utilities if new patterns emerged
- [ ] Documentation follows single-source-of-truth

### Section 9.3: Code Review Checklist

During code review:
- [ ] Check for duplicated code
- [ ] Verify utilities used instead of copy-paste
- [ ] Ensure configuration properly inherits
- [ ] Validate abstractions are appropriate
- [ ] Confirm jscpd passes

---

## 📚 Article X: Resources and Tools

### Section 10.1: Tools

**Required**:
- **jscpd**: Copy-paste detector
  ```bash
  npm install -D jscpd
  npx jscpd --threshold 5
  ```

- **ESLint**: Pattern enforcement
  ```bash
  npm install -D eslint @typescript-eslint/eslint-plugin
  ```

**Optional**:
- **SonarQube/SonarCloud**: Advanced code quality
- **Simian**: Alternative duplication detector
- **PMD CPD**: Java/multi-language duplication detection

### Section 10.2: Configuration Files

**jscpd Configuration** (`.jscpd.json`):
```json
{
  "threshold": 5,
  "reporters": ["html", "console", "badge"],
  "ignore": [
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "**/src/generated/**"
  ],
  "format": ["typescript", "javascript", "yaml", "markdown"],
  "minLines": 5,
  "minTokens": 50
}
```

### Section 10.3: Training Resources

**Internal**:
- This constitution (mandatory reading)
- `plan/03-research/dry-principle-audit.md` - Audit findings
- `plan/03-research/DRY-COMPLIANCE-OFFICER.md` - Officer procedures

**External**:
- "The Pragmatic Programmer" by Hunt & Thomas (original DRY principle)
- Martin Fowler's "Refactoring" (refactoring patterns)
- Clean Code by Robert C. Martin (code quality)

---

## 🎖️ Article XI: Recognition and Penalties

### Section 11.1: Recognition

**DRY Champions**: Team members who consistently follow DRY
- Monthly recognition in team meetings
- "DRY Champion" badge in GitHub profile
- Highlighted in project documentation

**Refactoring Heroes**: Those who fix significant violations
- Special recognition for >5% reduction
- Added to project CONTRIBUTORS.md

### Section 11.2: Accountability

**Repeated Violations**:
- 1st violation: Warning + education
- 2nd violation: Required DRY training session
- 3rd violation: Code review by Tech Lead
- 4th+ violations: Escalation to management

**Blocking Consequences**:
- PRs with >10% duplication: Blocked until fixed
- Commits with violations: Reverted if discovered
- Persistent violators: Removed from repository write access

---

## 📝 Article XII: Amendment Process

### Section 12.1: Proposing Amendments

**Who can propose**: Any team member
**Process**:
1. Create GitHub issue with template `DRY_CONSTITUTION_AMENDMENT`
2. Discuss in team meeting
3. Vote (require 75% approval)
4. Update this document
5. Communicate changes to all team members

### Section 12.2: Review Schedule

**Quarterly Review**: Every 3 months
- Assess effectiveness
- Update thresholds if needed
- Add new patterns/guidelines
- Remove obsolete sections

---

## 🔒 Article XIII: Signature and Enforcement

### Section 13.1: Acknowledgment

By contributing to this repository, all contributors acknowledge:
1. They have read and understood this DRY Constitution
2. They agree to comply with all articles and sections
3. They will report violations when discovered
4. They will support remediation efforts

### Section 13.2: Effective Date

**Effective Date**: January 1, 2026
**Retroactive Application**: Current violations must be remediated by February 1, 2026

### Section 13.3: Authority

This constitution has the **highest authority** in code quality matters.
In case of conflict with other guidelines, **DRY principles take precedence**.

---

## 📞 Contact

**DRY Compliance Officer**: [Assigned team member or automated bot]
**Questions**: Create issue with tag `question:dry`
**Violations**: Create issue with tag `type:dry-violation`
**Amendments**: Create issue with tag `dry-constitution:amendment`

---

**Ratified**: December 30, 2025
**Version**: 1.0
**Next Review**: March 30, 2026

---

*"Every piece of knowledge must have a single, unambiguous, authoritative representation within a system."*

**— The DRY Principle, The Pragmatic Programmer**

✅ **MANDATORY COMPLIANCE - NO EXCEPTIONS WITHOUT APPROVAL**
