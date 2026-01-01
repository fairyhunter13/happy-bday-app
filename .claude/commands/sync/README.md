# Sync Commands

Commands for synchronizing, organizing, and analyzing documentation and plan files.

## Available Commands

| Command | Description |
|---------|-------------|
| [gap-analysis](./gap-analysis.md) | Generate gap analysis comparing plans with actual implementation |
| [docs-sync](./docs-sync.md) | Synchronize, organize, and maintain documentation files |

## Quick Start

### Generate Gap Analysis
```bash
/sync:gap-analysis
```

### Synchronize & Organize Documentation
```bash
/sync:docs-sync
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
- Restructures files for better organization
- Consolidates duplicate content
- Archives outdated files
- Improves file naming conventions
- Removes empty or redundant files
