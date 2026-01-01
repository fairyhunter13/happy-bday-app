---
description: Synchronize, maintain, and organize documentation and plans with current repository state
argument-hint: [scope] - Optional scope (e.g., "docs", "plan", "all")
---

# DOCUMENTATION SYNCHRONIZATION & MAINTENANCE COMMAND

You are a documentation synchronization and maintenance agent tasked with ensuring all documentation and plan files accurately reflect the current state of the repository, are well-organized, and properly maintained.

## OBJECTIVE

Synchronize & Maintain: $ARGUMENTS (default: all)

## SYNCHRONIZATION SCOPE

### Target Directories

1. **docs/** - Technical documentation
2. **plan/** - Project plans and research
3. **README.md** - Root readme

### Source of Truth

1. **src/** - Source code implementation
2. **tests/** - Test implementations
3. **package.json** - Dependencies and scripts
4. **.github/workflows/** - CI/CD configuration

## SYNCHRONIZATION PROTOCOL

### STEP 1: Identify Outdated Content

Scan documentation for:
1. References to non-existent files
2. Outdated code examples
3. Deprecated features
4. Incorrect file paths
5. Stale configuration examples

### STEP 2: Identify Unfeasible Checklists

**REMOVE** any checklist items matching these patterns:

**External Resource Dependencies:**
- "Create demo video" / "Record tutorial"
- "Post to blog" / "Write article"
- "Create marketing materials"
- "Social media promotion"

**Infrastructure/Deployment:**
- "Deploy to production/staging"
- "Set up AWS/GCP/Azure"
- "Configure Kubernetes cluster"
- "Set up cloud databases"
- "Configure CDN"
- "Set up load balancer"
- "Purchase domain"
- "Obtain SSL certificates"

**Human Resource Dependencies:**
- "Hire developers"
- "Schedule meetings"
- "Get stakeholder approval"
- "Present to management"
- "Customer training"
- "User onboarding"

**External Services:**
- "Integrate with third-party API" (unless mock exists)
- "Set up payment processing"
- "Configure email service" (unless test mock exists)
- "Set up analytics"

### STEP 3: Update Documentation

For each outdated item:
1. **Verify** against current codebase
2. **Update** if implementation exists
3. **Mark Complete** if feature is implemented
4. **Remove** if unfeasible
5. **Add Note** explaining any removal

### STEP 4: Update Plan Files

For plan directory files:
1. Mark `[x]` for completed items
2. Add file references: `Implemented in: src/path/file.ts`
3. Remove unfeasible items with tracking comment
4. Update status sections

## UNFEASIBLE ITEM HANDLING

When removing unfeasible items:

```markdown
<!-- REMOVED: [original item text]
     Reason: [unfeasible category]
     Date: [removal date]
-->
```

Or replace with:

```markdown
- ~~[original item]~~ - Removed: Outside project scope
```

## CHECKLIST PATTERNS TO DETECT

### Completion Indicators
```markdown
# Already completed - update to [x]
- [ ] Implement timezone service  # Check if src/services/timezone.service.ts exists
- [ ] Add unit tests             # Check if tests/unit/... exists
- [ ] Configure CI/CD            # Check if .github/workflows/ exists
```

### Unfeasible Indicators
```markdown
# These should be REMOVED
- [ ] Create YouTube tutorial
- [ ] Deploy to AWS ECS
- [ ] Set up Datadog monitoring (external service)
- [ ] Purchase enterprise license
- [ ] Schedule demo with stakeholders
```

## OUTPUT ACTIONS

### Files to Update
Document all changes made:

```markdown
## Documentation Sync Summary

**Date**: [timestamp]
**Scope**: $ARGUMENTS

### Files Modified

| File | Changes | Items Updated |
|------|---------|---------------|
| plan/04-testing/testing-strategy.md | Marked 5 items complete | [list] |
| docs/DEVELOPER_SETUP.md | Updated paths | [list] |

### Items Marked Complete
- [x] Implement timezone handling - `src/services/timezone.service.ts`
- [x] Add unit tests - `tests/unit/services/`

### Items Removed (Unfeasible)
- ~~Create demo video~~ - External resource
- ~~Deploy to production~~ - Outside scope

### Items Still Pending
- [ ] Add mutation testing - Priority: Medium
- [ ] Improve cache hit rate - Priority: Low
```

## EXECUTION STEPS

1. **Scan** all docs/*.md and plan/**/*.md files
2. **Read** each file and identify checklists
3. **Compare** against source code existence
4. **Update** files with current status:
   - Mark completed items `[x]`
   - Add file references
   - Remove unfeasible items
5. **Generate** sync summary report

## AUTOMATION RULES

### Auto-Complete Detection

Check these paths to auto-mark items:
- Services: `src/services/*.ts`
- Controllers: `src/controllers/*.ts`
- Repositories: `src/repositories/*.ts`
- Schedulers: `src/schedulers/*.ts`
- Queue: `src/queue/*.ts`
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`
- Config: `src/config/*.ts`

### Never Auto-Complete

- Performance benchmarks (need human verification)
- Security audits
- Code review items
- Documentation review

## SYNC REPORT LOCATION

Save sync summary to: `plan/09-reports/DOCUMENTATION_SYNC_[DATE].md`

## MAINTENANCE OPERATIONS

### Content Quality

1. **Fix Broken Links** - Update or remove dead links
2. **Update Code Examples** - Ensure examples match current API
3. **Correct File Paths** - Fix references to moved/renamed files
4. **Remove Stale Content** - Archive outdated sections

### Organization

1. **Consistent Headers** - Ensure H1, H2, H3 hierarchy
2. **Add TOC** - For files >100 lines
3. **Cross-References** - Link related documents
4. **Timestamps** - Add/update "Last updated" dates

### File Health

1. **Remove Empty Files** - Delete files <10 lines with no content
2. **Merge Duplicates** - Consolidate redundant files
3. **Archive Old** - Move completed/old items to 99-archive/
4. **Naming Conventions** - Rename files to kebab-case or UPPERCASE

## RECENT CHANGES INTEGRATION

Track and incorporate recent changes from:

1. **Git Log** - Recent commits affecting src/, tests/
2. **User Prompts** - Changes discussed in current session
3. **CI/CD Results** - Test and build outcomes
4. **Code Reviews** - Comments and suggestions

Update documentation to reflect:
- New features implemented
- Bugs fixed
- Tests added
- Configuration changes
- API modifications

## BEGIN SYNCHRONIZATION

Start synchronizing: **$ARGUMENTS**

Use Task tool agents as needed:
- `haiku` for file existence checks
- `sonnet` for content analysis and updates
- `Explore` for codebase scanning
- `opus` for complex restructuring decisions
