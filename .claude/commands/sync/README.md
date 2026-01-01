# Sync Commands

Commands for synchronizing and maintaining documentation and plan files.

## Available Commands

| Command | Description |
|---------|-------------|
| [gap-analysis](./gap-analysis.md) | Generate gap analysis comparing plans with actual implementation |
| [docs-sync](./docs-sync.md) | Synchronize and maintain documentation files |
| [docs-organize](./docs-organize.md) | Organize, restructure, and refactor documentation |

## Quick Start

### Generate Gap Analysis
```bash
/sync:gap-analysis all
/sync:gap-analysis testing
/sync:gap-analysis architecture
```

### Synchronize Documentation
```bash
/sync:docs-sync all
/sync:docs-sync docs
/sync:docs-sync plan
```

### Organize Documentation
```bash
/sync:docs-organize all
/sync:docs-organize docs
/sync:docs-organize plan
```

## What These Commands Do

### Gap Analysis
- Compares plan files with actual codebase
- Identifies completed, in-progress, and remaining items
- Removes unfeasible checklists (videos, blogs, deployment, etc.)
- Generates detailed progress report

### Docs Sync
- Updates documentation to reflect current code state
- Marks completed checklists
- Removes outdated references
- Adds implementation file references

### Docs Organize
- Restructures files for better organization
- Consolidates duplicate content
- Archives outdated files
- Improves file naming conventions
- Removes empty or redundant files
