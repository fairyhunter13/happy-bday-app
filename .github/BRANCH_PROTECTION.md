# Branch Protection Rules

This document outlines the recommended branch protection rules for the Birthday Message Scheduler repository to maintain code quality, security, and stability.

## Overview

Branch protection rules help ensure that all code changes go through proper review and validation before being merged into protected branches. These rules are essential for maintaining high code quality and preventing accidental or malicious changes.

## Protected Branches

### Main Branch (`main`)

The `main` branch is the production branch and should have the most stringent protection rules.

#### Required Settings

**1. Require Pull Request Reviews**

- **Minimum number of approvals**: 1
- **Dismiss stale pull request approvals when new commits are pushed**: Enabled
- **Require review from Code Owners**: Enabled (if CODEOWNERS file exists)
- **Restrict who can dismiss pull request reviews**: Enabled
- **Allow specified actors to bypass required pull requests**: Disabled

**Rationale**: Ensures all code is reviewed by at least one other developer before merging, maintaining code quality and knowledge sharing.

**2. Require Status Checks to Pass**

- **Require branches to be up to date before merging**: Enabled
- **Required status checks**:
  - `lint-and-type-check`
  - `unit-tests`
  - `integration-tests`
  - `e2e-tests`
  - `build`
  - `security-scan`
  - `eslint`
  - `typescript-strict`

**Rationale**: Ensures all automated tests and quality checks pass before code can be merged, preventing broken code from entering the main branch.

**3. Require Conversation Resolution**

- **Require conversation resolution before merging**: Enabled

**Rationale**: Ensures all review comments and questions are addressed before merge, promoting thorough code review.

**4. Require Signed Commits**

- **Require signed commits**: Enabled

**Rationale**: Ensures commit authenticity and prevents commit forgery.

**5. Require Linear History**

- **Require linear history**: Enabled

**Rationale**: Maintains a clean, linear git history that's easy to understand and debug.

**6. Include Administrators**

- **Include administrators**: Enabled

**Rationale**: Even repository administrators must follow the same rules, ensuring consistent quality.

**7. Restrict Pushes**

- **Restrict who can push to matching branches**: Enabled
- **Allow force pushes**: Disabled
- **Allow deletions**: Disabled

**Rationale**: Prevents direct pushes and force pushes that could bypass review processes or damage history.

**8. Rules Applied to Everyone**

- **Do not allow bypassing the above settings**: Enabled

**Rationale**: Ensures rules are consistently applied to all contributors, including administrators.

### Development Branch (`develop`)

If using a development branch for integration before production:

#### Required Settings

**1. Require Pull Request Reviews**

- **Minimum number of approvals**: 1

**2. Require Status Checks to Pass**

- **Require branches to be up to date before merging**: Enabled
- **Required status checks**:
  - `lint-and-type-check`
  - `unit-tests`
  - `integration-tests`
  - `build`

**3. Require Linear History**

- **Require linear history**: Enabled

**4. Restrict Pushes**

- **Allow force pushes**: Disabled
- **Allow deletions**: Disabled

## Setting Up Branch Protection Rules

### Via GitHub Web Interface

1. Navigate to your repository on GitHub
2. Click on **Settings** → **Branches**
3. Under "Branch protection rules", click **Add rule**
4. Enter branch name pattern (e.g., `main`)
5. Configure the protection rules as described above
6. Click **Create** or **Save changes**

### Via GitHub CLI

```bash
# Install GitHub CLI if not already installed
# brew install gh (macOS)
# or download from https://cli.github.com/

# Authenticate
gh auth login

# Create branch protection rule for main
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["lint-and-type-check","unit-tests","integration-tests","e2e-tests","build","security-scan"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":true,"required_approving_review_count":1}' \
  --field restrictions=null \
  --field required_linear_history=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_conversation_resolution=true
```

### Via Terraform (Infrastructure as Code)

```hcl
resource "github_branch_protection" "main" {
  repository_id = github_repository.repo.node_id
  pattern       = "main"

  required_status_checks {
    strict   = true
    contexts = [
      "lint-and-type-check",
      "unit-tests",
      "integration-tests",
      "e2e-tests",
      "build",
      "security-scan",
      "eslint",
      "typescript-strict"
    ]
  }

  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    require_code_owner_reviews      = true
    required_approving_review_count = 1
  }

  enforce_admins                  = true
  require_linear_history          = true
  require_conversation_resolution = true
  require_signed_commits          = true
  allow_force_pushes             = false
  allow_deletions                = false
}
```

## CODEOWNERS File

Create a `.github/CODEOWNERS` file to automatically assign reviewers:

```
# Default owners for everything in the repo
*       @fairyhunter13

# Specific owners for different areas
/src/           @fairyhunter13
/tests/         @fairyhunter13
/.github/       @fairyhunter13
/docs/          @fairyhunter13

# Database migrations require extra scrutiny
/src/db/migrations/  @fairyhunter13

# CI/CD pipelines
/.github/workflows/  @fairyhunter13
```

## Workflow Status Checks

The following GitHub Actions workflows provide status checks:

1. **CI Workflow** (`.github/workflows/ci.yml`)
   - `lint-and-type-check`
   - `unit-tests`
   - `integration-tests`
   - `e2e-tests`
   - `build`
   - `security-scan`

2. **Code Quality Workflow** (`.github/workflows/code-quality.yml`)
   - `eslint`
   - `typescript-strict`
   - `complexity-analysis`
   - `code-duplication`

3. **Security Workflow** (`.github/workflows/security.yml`)
   - `npm-audit`
   - `snyk-scan`
   - `owasp-dependency-check`
   - `license-compliance`

## Bypass Scenarios

In rare emergency situations, you may need to bypass protection rules:

### Emergency Hotfix Process

1. **Create emergency branch**: `hotfix/emergency-description`
2. **Apply minimal fix**: Only fix the critical issue
3. **Create PR**: Even for emergencies, create a PR
4. **Fast-track review**: Get immediate review from available team member
5. **Merge with approval**: Follow normal process if possible
6. **Post-merge review**: If bypassed, conduct thorough review immediately after
7. **Backport to develop**: Ensure fix is in both main and develop

### When to Request Bypass

- Production is down and immediate fix is required
- Security vulnerability requires urgent patch
- Data loss is imminent

### How to Request Bypass

1. Document the emergency in issue/PR
2. Get approval from tech lead or manager
3. Apply temporary bypass
4. Re-enable protection immediately after merge
5. Conduct post-incident review

## Best Practices

### For Contributors

1. **Keep PRs small**: Easier to review and less likely to have issues
2. **Write descriptive PR descriptions**: Help reviewers understand changes
3. **Respond to review comments**: Address all feedback promptly
4. **Keep branch up to date**: Regularly merge main into your feature branch
5. **Run tests locally**: Before pushing, ensure all tests pass
6. **Use conventional commits**: Follow commit message guidelines

### For Reviewers

1. **Review promptly**: Don't let PRs sit for more than 24 hours
2. **Be constructive**: Provide helpful feedback, not just criticism
3. **Check tests**: Ensure adequate test coverage
4. **Verify CI**: All status checks should be green
5. **Look for edge cases**: Think about what could go wrong
6. **Security mindset**: Look for potential security issues

## Monitoring and Maintenance

### Regular Review

- **Quarterly**: Review and update protection rules
- **After incidents**: Analyze if rules could have prevented the issue
- **Team growth**: Adjust approval requirements based on team size

### Metrics to Track

- Average PR review time
- Number of failed status checks
- Number of reverted commits
- Security vulnerabilities caught in review

## Troubleshooting

### Common Issues

**Issue**: Status checks not showing up

**Solution**:
1. Ensure workflows are running on correct events (pull_request)
2. Check workflow YAML syntax
3. Verify branch is up to date with main

**Issue**: Can't merge even though all checks pass

**Solution**:
1. Check if conversations are resolved
2. Ensure required reviews are approved
3. Verify branch is up to date

**Issue**: Force push blocked

**Solution**:
1. This is intentional - use revert commits instead
2. If absolutely necessary, temporarily disable protection
3. Re-enable immediately after

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [CODEOWNERS Documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub CLI Documentation](https://cli.github.com/manual/)

## Support

For questions or issues with branch protection:

1. Check this documentation
2. Consult team lead
3. Open an issue with `question` label
4. Contact DevOps team

---

**Last Updated**: 2025-12-30
**Document Owner**: DevOps Team
**Review Frequency**: Quarterly
