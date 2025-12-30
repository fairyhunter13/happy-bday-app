# GitHub Configuration

This directory contains all GitHub-specific configuration for the Birthday Message Scheduler project.

## 📁 Structure

```
.github/
├── workflows/                      # GitHub Actions workflows
│   ├── ci.yml                     # Main CI pipeline
│   ├── performance.yml            # Performance testing (weekly)
│   ├── security.yml              # Security scanning (daily)
│   ├── docker-build.yml          # Docker image builds
│   ├── release.yml               # Release automation
│   └── code-quality.yml          # Code quality checks
│
├── ISSUE_TEMPLATE/                # Issue templates
│   ├── bug_report.yml            # Bug report form
│   ├── feature_request.yml       # Feature request form
│   ├── performance_issue.yml     # Performance issue form
│   └── config.yml                # Issue template config
│
├── pull_request_template.md      # PR template
├── dependabot.yml                # Automated dependency updates
├── BRANCH_PROTECTION.md          # Branch protection guide
└── README.md                     # This file
```

## 🚀 Workflows

### Main CI Workflow
**File**: `workflows/ci.yml`
- Runs on: PR, push to main/develop
- Jobs: Lint, Type Check, Unit Tests (5 shards), Integration Tests, E2E Tests, Coverage, Build
- Duration: ~15-20 minutes
- Coverage requirement: 80%

### Performance Testing
**File**: `workflows/performance.yml`
- Runs on: Weekly (Sunday 2 AM UTC), manual trigger
- Tests: Sustained load (24h), Peak load, Worker scaling
- Features: Baseline comparison
- Duration: Up to 25 hours (sustained load)

### Security Scanning
**File**: `workflows/security.yml`
- Runs on: PR, push to main, daily schedule
- Scans: npm audit, Snyk, OWASP, Trivy, License check, CodeQL
- Integration: GitHub Security tab
- Duration: ~15-20 minutes

### Docker Build
**File**: `workflows/docker-build.yml`
- Runs on: Push to main, version tags, PRs
- Platforms: linux/amd64, linux/arm64
- Features: Multi-platform builds, SBOM generation, vulnerability scanning
- Registry: GitHub Container Registry
- Duration: ~20 minutes (multi-platform)

### Release
**File**: `workflows/release.yml`
- Trigger: Version tags (v*.*.*)
- Steps: Validate → Test → Build → Release → Deploy Staging → Deploy Production
- Features: Automated changelog, GitHub releases, staged deployments
- Duration: ~40 minutes (excluding manual approval)

### Code Quality
**File**: `workflows/code-quality.yml`
- Runs on: PR, push to main
- Checks: ESLint, TypeScript strict, Complexity, Duplication, SonarCloud
- Features: PR comments with quality report
- Duration: ~10-15 minutes

## 📝 Templates

### Pull Request Template
**File**: `pull_request_template.md`

Comprehensive PR template with sections for:
- Description and type of change
- Testing checklist
- Documentation updates
- Breaking changes
- Security considerations
- Deployment notes
- Rollback plan

### Issue Templates

**Bug Report** (`ISSUE_TEMPLATE/bug_report.yml`)
- Structured bug reporting form
- Severity classification
- Environment details
- Steps to reproduce

**Feature Request** (`ISSUE_TEMPLATE/feature_request.yml`)
- Feature proposal form
- Use cases and acceptance criteria
- Priority and technical details
- Breaking change assessment

**Performance Issue** (`ISSUE_TEMPLATE/performance_issue.yml`)
- Performance problem reporting
- Metrics and load conditions
- Profiling data
- Business impact assessment

## 🔄 Dependabot

**File**: `dependabot.yml`

Automated dependency updates for:
- npm packages (weekly, Monday 3 AM UTC)
- GitHub Actions (weekly)
- Docker images (weekly)

Features:
- Grouped minor/patch updates
- Immediate security updates
- Auto-assign reviewers
- Conventional commit messages

## 🛡️ Branch Protection

**File**: `BRANCH_PROTECTION.md`

Complete guide for setting up branch protection rules:
- Required status checks
- Pull request reviews
- Linear history requirement
- Signed commits
- No force pushes

See the full guide for detailed setup instructions.

## 📚 Documentation

Main CI/CD documentation: `../CI_CD_GUIDE.md`

Comprehensive guide covering:
- All workflow details
- Configuration requirements
- Secrets and environment setup
- Pull request process
- Release process
- Troubleshooting
- Best practices

## 🔑 Required Secrets

Configure in repository settings → Secrets and variables → Actions:

### Essential
- `GITHUB_TOKEN` - Auto-provided by GitHub
- `CODECOV_TOKEN` - For coverage reporting

### Security Scanning
- `SNYK_TOKEN` - Vulnerability scanning (required)
- `SONAR_TOKEN` - Code quality (optional)

## 🌍 Environments

Create in repository settings → Environments:

### staging
- URL: https://staging.birthday-scheduler.example.com
- Deployment: Automatic on release
- Reviewers: None required

### production
- URL: https://birthday-scheduler.example.com
- Deployment: Manual approval required
- Reviewers: 1+ required

## 🎯 Quick Start

### For New Contributors

1. Read `BRANCH_PROTECTION.md` to understand merge requirements
2. Read `../CI_CD_GUIDE.md` for workflow details
3. Use PR template when creating pull requests
4. Ensure all CI checks pass before requesting review

### For Maintainers

1. Configure required secrets (see above)
2. Set up GitHub environments
3. Apply branch protection rules (see `BRANCH_PROTECTION.md`)
4. Enable Dependabot alerts and security updates

## 📊 Monitoring

### Workflow Status
- Actions tab → All workflows
- Workflow badges (add to README)
- Email notifications (configure in GitHub settings)

### Security
- Security tab → Dependabot alerts
- Security tab → Code scanning alerts
- Weekly security scan results

### Performance
- Weekly performance test artifacts
- Baseline comparison results

## 🔧 Maintenance

### Regular Tasks

**Weekly**:
- Review Dependabot PRs
- Check workflow run times
- Monitor failure rates

**Monthly**:
- Review and update workflows
- Update documentation
- Audit secrets and permissions

**Quarterly**:
- Review branch protection rules
- Audit security findings
- Update GitHub Actions versions

## 📞 Support

For issues with CI/CD:
1. Check `../CI_CD_GUIDE.md`
2. Review workflow logs in Actions tab
3. Consult with DevOps team
4. Open issue with `ci/cd` label

---

**Last Updated**: 2025-12-30
**Maintained By**: DevOps Team
