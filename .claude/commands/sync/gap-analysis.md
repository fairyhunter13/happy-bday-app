---
description: Generate a comprehensive gap analysis comparing plan/docs with actual repository state
---

# GAP ANALYSIS GENERATOR

You are a specialized analyst tasked with generating a comprehensive gap analysis by comparing all research, plan, and target files in the `plan/` directory with the actual state of files in the repository.

## OBJECTIVE

Analyze all areas: requirements, architecture, testing, implementation, monitoring, and operations.

## ANALYSIS SCOPE

### Directories to Analyze

1. **Plan Directory** (`plan/`):
   - `01-requirements/` - Requirements and specifications
   - `02-architecture/` - Architecture decisions and designs
   - `03-research/` - Research findings and recommendations
   - `04-testing/` - Testing strategies and edge cases
   - `05-implementation/` - Implementation plans and guides
   - `06-phase-reports/` - Phase completion reports
   - `07-monitoring/` - Monitoring and alerting plans
   - `08-operations/` - Operational procedures
   - `09-reports/` - Status reports and summaries
   - `99-archive/` - Archived/completed items

2. **Documentation Directory** (`docs/`):
   - Technical documentation
   - API documentation
   - Setup guides
   - Runbooks

3. **Source Directory** (`src/`):
   - Actual implementation files
   - Compare against planned features

4. **Test Directory** (`tests/`):
   - Actual test files
   - Compare against testing strategy

## ANALYSIS PROTOCOL

### STEP 1: Gather Plan Files

Use Glob and Read tools to:
1. List all `.md` files in `plan/` directory and subdirectories
2. Identify checklists (lines starting with `- [ ]` or `- [x]`)
3. Extract planned features, requirements, and targets

### STEP 2: Gather Implementation Files

Use Glob to:
1. List all source files in `src/`
2. List all test files in `tests/`
3. List all config files
4. Map to planned features

### STEP 3: Compare and Analyze

For each plan file:
1. **Completed Items**: Mark with `[x]` - features that exist in codebase
2. **In Progress Items**: Features partially implemented
3. **Missing Items**: Planned but not yet implemented
4. **Unfeasible Items**: Items that should be removed (see criteria below)

### STEP 4: Identify Unfeasible/Impossible Checklists

**REMOVE** any checklist items that match these patterns:
- "Create demo video" / "Record video"
- "Post to blog" / "Write blog post"
- "Deploy to production/staging/environments"
- "Set up cloud infrastructure" (AWS, GCP, Azure)
- "Configure DNS" / "Set up domain"
- "Purchase licenses" / "Acquire certificates"
- "Contact vendor" / "Schedule meeting"
- "Hire team members" / "Recruit developers"
- "Present to stakeholders" / "Give presentation"
- "Get approval from management"
- "Marketing activities" / "Social media posts"
- "Customer onboarding" / "User training"
- Any external dependencies that require resources outside the codebase

## OUTPUT FORMAT

Generate a structured report with:

```markdown
# Gap Analysis Report

**Generated**: [timestamp]
**Focus Area**: All areas
**Analysis Scope**: plan/, docs/, src/, tests/

## Executive Summary

- **Total Planned Items**: X
- **Completed**: Y (Z%)
- **In Progress**: A
- **Remaining**: B
- **Removed (Unfeasible)**: C

## Completion by Category

| Category | Total | Completed | Remaining | % Complete |
|----------|-------|-----------|-----------|------------|
| Requirements | X | Y | Z | N% |
| Architecture | X | Y | Z | N% |
| Testing | X | Y | Z | N% |
| Implementation | X | Y | Z | N% |
| Monitoring | X | Y | Z | N% |
| Operations | X | Y | Z | N% |

## Detailed Analysis

### Completed Items
- [x] Item 1 - Verified in: `src/path/file.ts`
- [x] Item 2 - Verified in: `tests/path/file.test.ts`

### In Progress Items
- [ ] Item 1 - Partial: `src/partial/impl.ts`
- [ ] Item 2 - Started: `src/started/file.ts`

### Remaining Items (Actionable)
- [ ] Item 1 - Priority: High
- [ ] Item 2 - Priority: Medium

### Removed Items (Unfeasible)
- ~~Create demo video~~ - Removed: External resource required
- ~~Deploy to AWS~~ - Removed: Outside project scope
- ~~Post to blog~~ - Removed: Marketing activity

## Recommendations

1. **High Priority**: [items to focus on next]
2. **Quick Wins**: [easy items to complete]
3. **Technical Debt**: [items to address]

## Files Updated

List of plan/docs files that were modified to:
- Mark completed items
- Remove unfeasible items
- Update status
```

## EXECUTION INSTRUCTIONS

1. **Read** all plan files to understand targets
2. **Glob** source and test files to find implementations
3. **Compare** planned vs actual
4. **Generate** the gap analysis report
5. **Update** plan files by:
   - Marking completed items with `[x]`
   - Removing unfeasible items (with comment noting removal)
   - Adding implementation file references

## IMPORTANT NOTES

- Focus on actionable, code-related items only
- Preserve historical context in archive
- Be conservative when marking items complete
- When in doubt, mark as "in progress" rather than complete
- Create a summary report in `plan/09-reports/GAP_ANALYSIS_[DATE].md`

## BEGIN ANALYSIS

Start the gap analysis now for: **all areas**

Use the Task tool to spawn specialized agents if needed:
- `Explore` agent for codebase analysis
- `haiku` model for simple file searches
- `sonnet` model for comparison analysis
