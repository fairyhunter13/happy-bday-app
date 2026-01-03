# Sync-Docs Command Enhancement Plan

**Created:** 2026-01-03
**Purpose:** Comprehensive plan to enhance /sync:docs-sync to actively update ALL documentation
**Status:** Planning Phase

---

## Research Summary: All Documentation Locations

### Documentation Inventory (Complete)

**Root Level (7 files):**
1. `README.md` - Main project readme with 40 badges
2. `CONTRIBUTING.md` - Contribution guidelines
3. `CHANGES.md` - Change log
4. `QUICK_START.md` - Quick start guide
5. `FIX_SUMMARY.md` - Bug fix summary
6. `RATE_LIMIT_FIX_SUMMARY.md` - Rate limit fix summary
7. `PERFORMANCE_TEST_FIX_SUMMARY.md` - Performance test fix summary

**docs/ Directory (42+ markdown files + 6 HTML + 13 JSON):**
- `INDEX.md` - Master documentation index
- `README.md` - Docs directory readme
- 40+ technical documentation files
- **Subdirectories:**
  - `vendor-specs/` (README.md + 3 files)
  - `test-patterns/` (INDEX.md + 2 files)
  - `templates/` (2 HTML template files)
- **Generated Content:**
  - 6 HTML files (GitHub Pages)
  - 13 JSON files (badges + data)

**plan/ Directory (66+ markdown files in 9 subdirectories):**
- `README.md` - Master plan index
- **Subdirectories (each with INDEX.md):**
  - `01-requirements/` (4 files)
  - `02-architecture/` (6 files)
  - `03-research/` (14 files)
  - `04-testing/` (4 files + coverage-tracking/)
  - `05-implementation/` (6 files)
  - `06-phase-reports/` (1 file)
  - `07-monitoring/` (7 files)
  - `08-operations/` (4 files)
  - `09-reports/` (12 files)

**Other Documentation Directories:**
- `.github/README.md` - GitHub Actions documentation
- `grafana/dashboards/README.md` - Grafana dashboard docs
- `grafana/provisioning/README.md` - Grafana provisioning docs
- `prometheus/README.md` - Prometheus configuration docs
- `tests/README.md` - Test suite documentation
- `tests/chaos/README.md` - Chaos testing docs
- `tests/e2e/README.md` - E2E testing docs
- `tests/performance/README.md` - Performance testing docs

**Total Documentation Files:** 150+ files across 15+ directories

---

## Current Sync-Docs Command Analysis

### Existing Phases (0-7)

| Phase | Purpose | Current Status | Updates Docs? |
|-------|---------|----------------|---------------|
| 0 | Requirements Conformance | Assessment only | ❌ No |
| 1 | Synchronization (duplicates, outdated) | File moves/deletes | ✅ Yes (minimal) |
| 2 | Organization (structure, orphans) | Link checking | ❌ No |
| 3 | Maintenance (broken links, health) | Validation | ❌ No |
| 4 | Badge Management | Badge verification | ❌ No |
| 5 | GitHub Pages Content | HTML verification | ❌ No |
| 6 | Verify & Report | Report generation | ✅ Yes (report only) |
| 7 | Post-Sync Automation | CI/CD assessment | ❌ No |

**Problem:** Command is primarily READ-ONLY. It assesses and reports but doesn't actively UPDATE documentation.

---

## Enhancement Goals

### Primary Objectives

1. **Make sync-docs ACTIVELY UPDATE documentation**, not just assess
2. **Cover ALL documentation locations** (root, docs/, plan/, tests/, grafana/, prometheus/, .github/)
3. **Automate repetitive updates** (timestamps, file counts, cross-references, badges)
4. **Maintain link integrity** (auto-fix broken links where possible)
5. **Update INDEX files** (auto-generate file lists)
6. **Run automation scripts** (coverage, performance, health scoring)

### Success Criteria

- [ ] Sync-docs updates README.md badges with latest data
- [ ] Sync-docs updates all INDEX.md files with current file lists
- [ ] Sync-docs updates "Last Updated" timestamps
- [ ] Sync-docs fixes broken links (or reports them)
- [ ] Sync-docs runs health scoring and updates health badge
- [ ] Sync-docs generates/updates HTML pages
- [ ] Sync-docs commits changes with proper commit message
- [ ] Sync-docs covers 100% of documentation directories

---

## Proposed Enhancements by Phase

### PHASE 0: Requirements Conformance (No Changes)
- Keep as-is (assessment only)
- Verifies project_data/ conformance

### PHASE 1: Synchronization (Enhanced)

**Current:** Find duplicates, move misplaced files
**Add:**
1. **Root Directory Cleanup:**
   - Scan for `*_SUMMARY.md` files in root
   - Move to `docs/` if they're documentation
   - Move to `plan/09-reports/` if they're reports
   - Keep CONTRIBUTING.md, CHANGES.md, QUICK_START.md in root

2. **Auto-Archive Old Reports:**
   - Move reports older than 30 days to `plan/09-reports/archive/`
   - Keep only last 3 sync reports active

**Example Action:**
```bash
# Move fix summaries to appropriate locations
mv FIX_SUMMARY.md docs/fixes/
mv RATE_LIMIT_FIX_SUMMARY.md docs/fixes/
mv PERFORMANCE_TEST_FIX_SUMMARY.md docs/fixes/
```

### PHASE 2: Organization (Enhanced)

**Current:** Check structure, find orphans
**Add:**
1. **Auto-Link Orphaned Files:**
   - If file in docs/ isn't linked from INDEX.md, add it
   - Group by category (infer from filename/location)
   - Update INDEX.md table of contents

2. **Update INDEX Files in ALL Subdirectories:**
   - Scan each subdirectory (plan/01-requirements/, etc.)
   - Auto-generate file list in INDEX.md
   - Update file counts
   - Sort alphabetically

**Example Action:**
```bash
# Update plan/03-research/INDEX.md with current file list
Files=$(ls -1 plan/03-research/*.md | grep -v INDEX.md)
# Generate markdown table
# Update INDEX.md
```

### PHASE 3: Maintenance (Enhanced)

**Current:** Validate links, check health
**Add:**
1. **Auto-Fix Relative Links:**
   - Scan for broken relative links
   - Attempt to fix (search for file in nearby directories)
   - Update link if found
   - Report if unfixable

2. **Update "Last Updated" Timestamps:**
   - Find all INDEX.md files
   - Update "Last Updated: YYYY-MM-DD" line
   - Use current date

3. **Update File Counts:**
   - Count files in each directory
   - Update "Total Files: N" in INDEX files

**Example Action:**
```bash
# Update timestamp in docs/INDEX.md
sed -i "s/Last Updated: .*/Last Updated: $(date +%Y-%m-%d)/" docs/INDEX.md

# Update file count
FILE_COUNT=$(ls -1 docs/*.md | wc -l)
sed -i "s/Total Files: .*/Total Files: $FILE_COUNT/" docs/INDEX.md
```

### PHASE 4: Badge Management (Enhanced)

**Current:** Verify badges in README
**Add:**
1. **Run Badge Generation Scripts:**
   ```bash
   ./scripts/coverage/update-history.sh
   ./scripts/performance/generate-badges.sh perf-results docs
   ./scripts/docs/calculate-health.sh
   ```

2. **Update README.md Badge URLs:**
   - Verify all 40 badges point to correct URLs
   - Update endpoint URLs if GitHub Pages URL changed
   - Fix any broken badge links

3. **Add New Badges:**
   - Add health badge if not present
   - Add any missing performance badges

### PHASE 5: GitHub Pages Content (Enhanced)

**Current:** Verify HTML exists
**Add:**
1. **Regenerate HTML Files:**
   - Use templates in docs/templates/
   - Update navigation links
   - Update "Last Updated" timestamp in footer

2. **Update index.html:**
   - Ensure OpenAPI spec link is correct
   - Update navigation menu

3. **Verify JSON Endpoints:**
   - Check all badge JSON files exist
   - Validate JSON syntax
   - Update if invalid

### PHASE 6: Verify & Report (Enhanced)

**Current:** Generate sync report only
**Add:**
1. **Run Health Scoring:**
   ```bash
   ./scripts/docs/calculate-health.sh > health-report.txt
   ```

2. **Include in Report:**
   - Health score
   - Files updated count
   - Links fixed count
   - Badges updated count

3. **Git Commit All Changes:**
   ```bash
   git add docs/ plan/ README.md
   git commit -m "docs: sync documentation (automated via /sync:docs-sync)

   - Updated INDEX files with current file lists
   - Fixed broken links
   - Updated timestamps
   - Updated badges
   - Health score: XX/100"
   ```

### PHASE 7: Post-Sync Automation (COMPLETELY REWRITTEN)

**Current:** Assessment only
**New:** ACTIVE AUTOMATION

1. **Run All Automation Scripts:**
   ```bash
   # Coverage analysis
   ./scripts/coverage/analyze-trends.sh

   # Performance baseline tracking
   ./scripts/performance/track-baseline.sh

   # Documentation health
   ./scripts/docs/calculate-health.sh
   ```

2. **Update Cross-References:**
   - Scan for `../` relative links
   - Verify they resolve correctly
   - Update if moved

3. **Update tests/ Documentation:**
   - Count test files
   - Update tests/README.md with counts
   - Update test type breakdown

4. **Update .github/ Documentation:**
   - List all workflows
   - Update .github/README.md with workflow list
   - Include trigger information

5. **Update grafana/ Documentation:**
   - List all dashboards
   - Update grafana/dashboards/README.md
   - Include dashboard descriptions

---

## Implementation Strategy

### Step 1: Create Helper Scripts

Create reusable scripts for common tasks:

1. **scripts/docs/update-index.sh**
   - Updates INDEX.md files with current file lists
   - Usage: `./update-index.sh <directory>`

2. **scripts/docs/fix-links.sh**
   - Attempts to fix broken relative links
   - Usage: `./fix-links.sh <file>`

3. **scripts/docs/update-timestamps.sh**
   - Updates "Last Updated" timestamps in all INDEX files
   - Usage: `./update-timestamps.sh`

4. **scripts/docs/count-files.sh**
   - Counts files and updates INDEX files
   - Usage: `./count-files.sh <directory>`

### Step 2: Enhance Sync-Docs Command

Update `.claude/commands/sync/docs-sync.md`:

1. Add PHASE 7 active automation section
2. Add helper script calls to each phase
3. Add git commit step at end
4. Add validation checks

### Step 3: Test Implementation

1. Run sync-docs on test branch
2. Verify all files are updated correctly
3. Check git diff for correctness
4. Validate no broken links introduced
5. Confirm health score improves

### Step 4: Documentation

1. Update sync-docs command with new features
2. Document all helper scripts
3. Create examples
4. Add troubleshooting section

---

## Risk Analysis

### Potential Issues

1. **Over-aggressive Updates:**
   - Risk: Updating files that should remain static
   - Mitigation: Add exclusion list, ask before updating

2. **Git Conflicts:**
   - Risk: Sync-docs modifies files user is editing
   - Mitigation: Check for uncommitted changes first

3. **Broken Links After Auto-Fix:**
   - Risk: Link auto-fix breaks working links
   - Mitigation: Validate link before and after fix

4. **Large Commits:**
   - Risk: Sync-docs creates massive commits
   - Mitigation: Break into logical commits per phase

### Safety Measures

1. **Dry-Run Mode:**
   - Add `--dry-run` flag to preview changes
   - Show what would be updated without actually updating

2. **Backup Before Changes:**
   - Create git stash before sync
   - Allow rollback if needed

3. **Validation After Each Phase:**
   - Run health check after each phase
   - Abort if health score drops

---

## Timeline & Priorities

### Immediate (This Session)

1. ✅ Create helper scripts (update-index.sh, update-timestamps.sh, count-files.sh)
2. ✅ Enhance PHASE 7 in sync-docs command (active updates, not assessment)
3. ✅ Add git commit step to Phase 6
4. ✅ Test on current repository state

### Short-Term (Next Run)

1. Create fix-links.sh helper script
2. Add validation checks
3. Test all helper scripts
4. Document all changes

### Long-Term (Future Enhancements)

1. Add dry-run mode
2. Add interactive mode (ask before each update)
3. Create rollback mechanism
4. Add email/notification on sync completion

---

## Success Metrics

After implementation, sync-docs should:

- [ ] Update 100% of INDEX.md files
- [ ] Fix >90% of broken links
- [ ] Update all timestamps
- [ ] Update all badge JSON files
- [ ] Update README badges
- [ ] Generate health report
- [ ] Create clean git commit
- [ ] Complete in <5 minutes
- [ ] Achieve 100/100 health score

---

## Next Steps

1. Implement helper scripts
2. Update sync-docs command
3. Test implementation
4. Validate results
5. Document changes
6. Create usage guide

---

**Status:** Ready for Implementation
**Expected Completion:** This session
**Expected Impact:** Transform sync-docs from read-only assessment to active documentation maintenance tool
