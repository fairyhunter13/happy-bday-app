# 99. Archive - Index

This directory contains archived and superseded documentation for historical reference.

## Overview

Historical documents that have been superseded by newer versions or consolidated into other documentation. Kept for reference and audit trail purposes.

---

## Archived Documents

### Project Reports (2025-12-31)

| Document | Original Date | Reason for Archive |
|----------|--------------|-------------------|
| [`ARCHITECT_SCOPE_UPDATE_REPORT.md`](./ARCHITECT_SCOPE_UPDATE_REPORT.md) | 2025-12-31 | Scope update report - completed |
| [`CLEANUP_FINAL_REPORT.md`](./CLEANUP_FINAL_REPORT.md) | 2025-12-31 | Cleanup report - completed |
| [`FINAL_CLEANUP_VERIFICATION.md`](./FINAL_CLEANUP_VERIFICATION.md) | 2025-12-31 | Verification report - completed |
| [`GAP_ANALYSIS_CURRENT_STATE.md`](./GAP_ANALYSIS_CURRENT_STATE.md) | 2025-12-31 | Previous gap analysis - superseded |
| [`SCOPE_CHANGE_SUMMARY.md`](./SCOPE_CHANGE_SUMMARY.md) | 2025-12-31 | Scope changes - completed |

### Old Index Files

| Document | Original Date | Reason for Archive | Superseded By |
|----------|--------------|-------------------|---------------|
| [`INDEX.md`](./INDEX.md) | 2025-12-31 | Coverage trends-specific index | [`../04-testing/coverage-tracking/`](../04-testing/coverage-tracking/) |

---

## Why These Are Archived

### INDEX.md
- **Created:** 2025-12-31 (coverage trends implementation)
- **Archived:** 2025-12-31 (directory reorganization)
- **Reason:** Focused only on coverage trends; now part of broader testing documentation
- **New Location:** All coverage tracking docs in [`../04-testing/coverage-tracking/`](../04-testing/coverage-tracking/)

### REORGANIZATION_SUMMARY.md
- **Created:** 2025-12-30
- **Archived:** 2025-12-31
- **Reason:** Superseded by new reorganization
- **Details:** Previous attempt to organize plan directory, now replaced by more comprehensive structure

---

## Archive Policy

### When to Archive
Documents are archived when they:
1. Have been superseded by newer versions
2. Are no longer relevant to current implementation
3. Contain outdated information
4. Have been consolidated into other documents

### When NOT to Archive
Documents should NOT be archived if they:
1. Contain unique historical context
2. Are referenced by active documentation
3. Contain implementation decisions that inform current work
4. Are part of active phase reports

---

## Accessing Archived Documents

All archived documents remain accessible in git history and in this directory for reference purposes.

### Git History
```bash
# View document history
git log --follow plan/99-archive/<filename>

# View old version
git show <commit>:plan/<filename>

# Compare versions
git diff <commit1> <commit2> -- plan/<filename>
```

---

## Related Documentation

### Current Documentation Structure
- **Main Index:** [`../README.md`](../README.md)
- **Requirements:** [`../01-requirements/`](../01-requirements/)
- **Architecture:** [`../02-architecture/`](../02-architecture/)
- **Research:** [`../03-research/`](../03-research/)
- **Testing:** [`../04-testing/`](../04-testing/)
- **Implementation:** [`../05-implementation/`](../05-implementation/)
- **Phase Reports:** [`../06-phase-reports/`](../06-phase-reports/)
- **Monitoring:** [`../07-monitoring/`](../07-monitoring/)
- **Operations:** [`../08-operations/`](../08-operations/)
- **Reports:** [`../09-reports/`](../09-reports/)

---

**Last Updated:** 2025-12-31

**Archive Reason:** Historical reference only

**Total Archived Files:** 7
