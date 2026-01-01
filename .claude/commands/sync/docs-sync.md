---
description: Synchronize, maintain, and organize documentation and plans with current repository state
---

# DOCUMENTATION SYNCHRONIZATION & ORGANIZATION COMMAND

You are a documentation synchronization and organization agent tasked with ensuring all documentation and plan files accurately reflect the current state of the repository, are well-organized, and properly maintained.

## OBJECTIVE

Synchronize, maintain, and organize all documentation in: **docs/**, **plan/**, and root **.md** files.

## SCOPE

### Target Directories

1. **docs/** - Technical documentation
2. **plan/** - Project plans, research, and reports
3. **Root .md files** - README, CONTRIBUTING, etc.

### Source of Truth

1. **project_data/** - **PRIMARY REQUIREMENTS** (Assessment specification)
2. **src/** - Source code implementation
3. **tests/** - Test implementations
4. **package.json** - Dependencies and scripts
5. **.github/workflows/** - CI/CD configuration

---

# PHASE 0: REQUIREMENTS CONFORMANCE

## Project Requirements from project_data/

All plan and documentation files MUST conform to the core requirements defined in `project_data/`:

### Core Requirements Checklist

**Mandatory Features:**
- [ ] TypeScript codebase
- [ ] POST /user - Create user endpoint
- [ ] DELETE /user - Delete user endpoint
- [ ] PUT /user - Edit user endpoint (Bonus)
- [ ] User fields: firstName, lastName, birthday, location/timezone, email
- [ ] Birthday message at 9am local time
- [ ] Message format: "Hey, {full_name} it's your birthday"
- [ ] Integration with email-service.digitalenvision.com.au
- [ ] Recovery mechanism for unsent messages after downtime
- [ ] Handle API random errors and timeouts

**Quality Requirements:**
- [ ] Scalable code with good abstraction
- [ ] Support for future message types (e.g., anniversary)
- [ ] Code is tested and testable
- [ ] No race conditions / duplicate messages
- [ ] Handle thousands of birthdays per day

### Conformance Verification Steps

1. **Read** `project_data/*.txt` and `project_data/*.rtf` files
2. **Extract** all requirements and constraints
3. **Compare** plan files against requirements
4. **Flag** any plan items that:
   - Contradict core requirements
   - Add scope beyond assessment requirements
   - Miss required features
5. **Update** plan files to align with requirements

### Conformance Report Section

Add to sync report:

```markdown
## Requirements Conformance

### project_data/ Requirements Status

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| TypeScript codebase | ✅ Verified | src/**/*.ts |
| POST /user endpoint | ✅ Verified | src/controllers/user.controller.ts |
| DELETE /user endpoint | ✅ Verified | src/controllers/user.controller.ts |
| PUT /user endpoint | ✅ Verified | src/controllers/user.controller.ts |
| 9am local time sending | ✅ Verified | src/services/timezone.service.ts |
| Message format correct | ✅ Verified | src/strategies/birthday-message.strategy.ts |
| Recovery mechanism | ✅ Verified | src/schedulers/recovery.scheduler.ts |
| Error/timeout handling | ✅ Verified | src/services/message-sender.service.ts |
| Scalable abstraction | ✅ Verified | src/strategies/ (Strategy pattern) |
| No duplicate messages | ✅ Verified | src/services/idempotency.service.ts |

### Scope Alignment

- Items IN SCOPE: [list items matching requirements]
- Items OUT OF SCOPE: [list items beyond assessment - flag for review]
```

---

# PHASE 1: SYNCHRONIZATION

## STEP 1: Identify Outdated Content

Scan documentation for:
1. References to non-existent files
2. Outdated code examples
3. Deprecated features
4. Incorrect file paths
5. Stale configuration examples

## STEP 2: Identify Unfeasible Checklists

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

## STEP 3: Update Documentation

For each outdated item:
1. **Verify** against current codebase
2. **Update** if implementation exists
3. **Mark Complete** if feature is implemented
4. **Remove** if unfeasible
5. **Add Note** explaining any removal

## STEP 4: Update Plan Files

For plan directory files:
1. Mark `[x]` for completed items
2. Add file references: `Implemented in: src/path/file.ts`
3. Remove unfeasible items with tracking comment
4. Update status sections

### Unfeasible Item Handling

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

---

# PHASE 2: ORGANIZATION

## STEP 5: Audit Current Structure

Analyze existing documentation for:
1. **Duplicate Content** - Same information in multiple files
2. **Orphaned Files** - Files not linked from any index
3. **Empty/Stub Files** - Files with minimal content
4. **Outdated Files** - Files referencing deprecated features
5. **Naming Inconsistencies** - Files not following naming conventions
6. **Missing Index Files** - Directories without README/INDEX.md

## STEP 6: Target Directory Structures

**docs/ Directory Structure:**
```
docs/
├── README.md                    # Documentation index
├── getting-started/            # Onboarding docs
│   ├── README.md
│   ├── DEVELOPER_SETUP.md
│   └── QUICKSTART.md
├── architecture/               # System design
│   ├── README.md
│   ├── OVERVIEW.md
│   └── DECISIONS.md
├── api/                        # API documentation
│   ├── README.md
│   └── ENDPOINTS.md
├── operations/                 # Ops and runbooks
│   ├── README.md
│   ├── RUNBOOK.md
│   └── MONITORING.md
├── testing/                    # Test documentation
│   ├── README.md
│   └── STRATEGIES.md
└── vendor-specs/               # External integrations
    └── README.md
```

**plan/ Directory Structure:**
```
plan/
├── README.md                   # Plan index with links
├── 01-requirements/            # Requirements
├── 02-architecture/            # Architecture decisions
├── 03-research/                # Research findings
├── 04-testing/                 # Testing strategy
├── 05-implementation/          # Implementation plans
├── 06-phase-reports/           # Phase completions
├── 07-monitoring/              # Monitoring plans
├── 08-operations/              # Operational procedures
└── 09-reports/                 # Status reports & gap analysis
```

**Note:** Archive directory (99-archive/) has been removed. Obsolete files should be deleted rather than archived.

## STEP 7: File Naming Conventions

**Apply these naming rules:**

| Pattern | Example | Usage |
|---------|---------|-------|
| UPPERCASE.md | README.md, RUNBOOK.md | Primary index/reference docs |
| kebab-case.md | testing-strategy.md | Topic-specific documents |
| CATEGORY_TOPIC.md | ARCHITECTURE_SCOPE.md | Scoped documents |
| INDEX.md | INDEX.md | Directory index files |

**Avoid:**
- Spaces in filenames
- Mixed case (e.g., TestingStrategy.md)
- Underscores for word separation
- Overly long names (>50 chars)

## STEP 8: Content Organization

**Each file should have:**
1. **Clear Title** - H1 heading matching purpose
2. **Purpose Statement** - What this document covers
3. **Table of Contents** - For files >100 lines
4. **Consistent Sections** - Standard structure
5. **Cross-References** - Links to related docs
6. **Last Updated** - Date of last revision

**Standard Document Template:**
```markdown
# Document Title

> Brief description of this document's purpose

## Overview

[High-level summary]

## Details

[Main content sections]

## Related Documents

- [Link to related doc](./path/to/doc.md)

---
*Last updated: YYYY-MM-DD*
```

## STEP 9: Consolidation Rules

**Merge files when:**
- Same topic split across multiple files
- Files < 50 lines that could be combined
- Redundant content in similar files

**Archive files when:**
- Content is >6 months old and unchanged
- Feature is fully implemented
- Research is complete and implemented
- Phase is finished

**Delete files when:**
- Empty or stub files with <10 lines
- Duplicate of another file
- No longer relevant to project

## STEP 10: Index File Updates

**Update all INDEX.md and README.md files to:**
1. List all files in directory
2. Provide brief description of each
3. Link to related directories
4. Show completion status if applicable

**Example INDEX.md:**
```markdown
# Section Title

## Documents in this Section

| Document | Description | Status |
|----------|-------------|--------|
| [document-1.md](./document-1.md) | Description | Complete |
| [document-2.md](./document-2.md) | Description | In Progress |

## Related Sections

- [Related Section](../related-section/)
```

---

# PHASE 3: MAINTENANCE

## Content Quality

1. **Fix Broken Links** - Update or remove dead links
2. **Update Code Examples** - Ensure examples match current API
3. **Correct File Paths** - Fix references to moved/renamed files
4. **Remove Stale Content** - Archive outdated sections

## Organization

1. **Consistent Headers** - Ensure H1, H2, H3 hierarchy
2. **Add TOC** - For files >100 lines
3. **Cross-References** - Link related documents
4. **Timestamps** - Add/update "Last updated" dates

## File Health

1. **Remove Empty Files** - Delete files <10 lines with no content
2. **Merge Duplicates** - Consolidate redundant files
3. **Archive Old** - Move completed/old items to 99-archive/
4. **Naming Conventions** - Rename files to kebab-case or UPPERCASE

## Recent Changes Integration

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

---

# EXECUTION WORKFLOW

## Phase 1: Analysis
1. **Glob** all .md files in target directories
2. **Read** each file to understand content
3. **Compare** against source code existence
4. **Identify** issues (duplicates, orphans, stubs, unfeasible items)

## Phase 2: Cleanup
1. **Remove** unfeasible checklist items
2. **Mark** completed items with `[x]`
3. **Delete** empty/stub files
4. **Archive** outdated files to 99-archive/

## Phase 3: Restructure
1. **Rename** files to follow conventions
2. **Move** files to appropriate directories
3. **Merge** duplicate content
4. **Create** missing index files

## Phase 4: Update
1. **Update** all cross-references
2. **Fix** broken links
3. **Add** missing sections
4. **Update** timestamps

## Phase 5: Verify & Report
1. **Verify** all links work
2. **Check** no orphaned files
3. **Ensure** all directories have indexes
4. **Generate** sync & organization report

---

# OUTPUT REPORT

Save comprehensive report to: `plan/09-reports/DOCS_SYNC_[DATE].md`

```markdown
# Documentation Sync & Organization Report

**Date**: [timestamp]

## Executive Summary

- **Files Analyzed**: X
- **Checklists Marked Complete**: Y
- **Unfeasible Items Removed**: Z
- **Files Renamed**: A
- **Files Moved**: B
- **Files Archived**: C
- **Files Deleted**: D

## Synchronization Results

### Items Marked Complete
- [x] Implement timezone handling - `src/services/timezone.service.ts`
- [x] Add unit tests - `tests/unit/services/`

### Items Removed (Unfeasible)
| File | Item Removed | Reason |
|------|--------------|--------|
| plan.md | Create demo video | External resource |
| plan.md | Deploy to production | Outside scope |

### Items Still Pending
- [ ] Add mutation testing - Priority: Medium
- [ ] Improve cache hit rate - Priority: Low

## Organization Results

### Files Renamed
| Original | New Name | Reason |
|----------|----------|--------|
| old-name.md | new-name.md | Naming convention |

### Files Moved
| File | From | To | Reason |
|------|------|-----|--------|
| file.md | docs/ | docs/testing/ | Better organization |

### Files Archived
| File | Reason |
|------|--------|
| old-plan.md | Fully implemented |

### Files Deleted
| File | Reason |
|------|--------|
| stub.md | Empty file |

## New Structure

[Tree view of new structure]

## Recommendations

1. [Suggestions for future improvements]
```

---

## BEGIN SYNCHRONIZATION & ORGANIZATION

Use Task tool agents as needed:
- `Explore` agent for comprehensive codebase scanning
- `haiku` for file existence checks and simple operations
- `sonnet` for content analysis, updates, and restructuring
- `opus` for complex restructuring decisions
