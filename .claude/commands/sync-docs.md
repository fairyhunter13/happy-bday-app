# sync-docs

Comprehensive documentation sync after code changes.

## When to Run
- After modifying source code in `src/`
- After adding/modifying tests
- After changing configuration files
- After updating dependencies
- Before ending a significant coding session

## Documentation Sync Tasks

### 1. README.md Updates
Check and update if changes affect:
- Project structure (directories changed)
- Test statistics (tests added/modified)
- Quick start commands (setup changed)
- Tech stack (dependencies changed)
- Key features (functionality changed)
- API endpoints (API changed)

### 2. docs/ Updates
Update relevant files if changes affect:
- `docs/RUNBOOK.md` - Operational procedures
- `docs/METRICS.md` - Metrics documentation
- `docs/DEPLOYMENT_GUIDE.md` - Deployment steps
- `docs/vendor-specs/` - API specifications

### 3. plan/ Updates
Update relevant files if changes affect:
- `plan/01-requirements/*.md` - Requirements changes
- `plan/02-architecture/*.md` - Architecture changes
- `plan/03-research/*.md` - Research findings
- `plan/04-testing/*.md` - Test approach changes
- `plan/05-implementation/master-plan.md` - Implementation status
- `plan/09-reports/GAP_ANALYSIS_REPORT.md` - Gap status

### 4. INDEX.md Updates
- Update `plan/*/INDEX.md` files to list all files in each directory
- Ensure `docs/README.md` index is current

## Protocol
1. IDENTIFY modified files this session (use git status/diff)
2. DETERMINE which docs need updates based on changes
3. UPDATE each affected file comprehensively
4. VERIFY cross-references are valid

## Execution
Analyze the recent changes and update all affected documentation. Be thorough but focused - only update docs that are actually affected by the changes made.
