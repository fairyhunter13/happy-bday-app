---
description: Organize, restructure, and refactor documentation and plan files
argument-hint: [scope] - Target scope (e.g., "docs", "plan", "all")
---

# DOCUMENTATION ORGANIZATION COMMAND

You are a documentation architect tasked with organizing, restructuring, and refactoring all documentation and plan files to ensure they are well-maintained, properly structured, and follow best practices.

## OBJECTIVE

Organize: $ARGUMENTS (default: all)

## ORGANIZATION SCOPE

### Target Directories

1. **docs/** - Technical documentation
2. **plan/** - Project plans, research, and reports
3. **Root .md files** - README, CONTRIBUTING, etc.

## ORGANIZATION PROTOCOL

### STEP 1: Audit Current Structure

Analyze existing documentation for:
1. **Duplicate Content** - Same information in multiple files
2. **Orphaned Files** - Files not linked from any index
3. **Empty/Stub Files** - Files with minimal content
4. **Outdated Files** - Files referencing deprecated features
5. **Naming Inconsistencies** - Files not following naming conventions
6. **Missing Index Files** - Directories without README/INDEX.md

### STEP 2: Define Target Structure

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
├── 09-reports/                 # Status reports
└── 99-archive/                 # Completed/deprecated
```

### STEP 3: File Naming Conventions

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

### STEP 4: Content Organization

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

### STEP 5: Remove Unfeasible Content

**Remove these checklist items from ALL files:**

```markdown
# REMOVE patterns like these:
- [ ] Create demo video
- [ ] Post to blog
- [ ] Deploy to production/staging
- [ ] Set up cloud infrastructure
- [ ] Configure DNS/domain
- [ ] Purchase licenses
- [ ] Contact external vendors
- [ ] Schedule stakeholder meetings
- [ ] Create marketing materials
- [ ] Hire team members
- [ ] User training sessions
- [ ] Customer onboarding
```

### STEP 6: Consolidation Rules

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

### STEP 7: Index File Updates

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

## EXECUTION STEPS

### Phase 1: Analysis
1. **Glob** all .md files in target directories
2. **Read** each file to understand content
3. **Identify** issues (duplicates, orphans, stubs)
4. **Create** reorganization plan

### Phase 2: Cleanup
1. **Remove** unfeasible checklist items
2. **Delete** empty/stub files
3. **Archive** outdated files to 99-archive/

### Phase 3: Restructure
1. **Rename** files to follow conventions
2. **Move** files to appropriate directories
3. **Merge** duplicate content
4. **Create** missing index files

### Phase 4: Update
1. **Update** all cross-references
2. **Fix** broken links
3. **Add** missing sections
4. **Update** timestamps

### Phase 5: Verify
1. **Verify** all links work
2. **Check** no orphaned files
3. **Ensure** all directories have indexes
4. **Generate** organization report

## OUTPUT REPORT

Generate report in `plan/09-reports/DOCS_ORGANIZATION_[DATE].md`:

```markdown
# Documentation Organization Report

**Date**: [timestamp]
**Scope**: $ARGUMENTS

## Summary

- **Files Analyzed**: X
- **Files Renamed**: Y
- **Files Moved**: Z
- **Files Archived**: A
- **Files Deleted**: B
- **Unfeasible Items Removed**: C

## Changes Made

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

### Unfeasible Items Removed
| File | Item Removed | Reason |
|------|--------------|--------|
| plan.md | Create demo video | External resource |

## New Structure

[Tree view of new structure]

## Recommendations

1. [Suggestions for future improvements]
```

## BEGIN ORGANIZATION

Start organizing: **$ARGUMENTS**

Use Task tool agents:
- `Explore` agent for comprehensive file analysis
- `haiku` for simple file operations
- `sonnet` for content analysis and restructuring
