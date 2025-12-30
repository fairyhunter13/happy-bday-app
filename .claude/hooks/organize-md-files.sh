#!/bin/bash
# MD File Organization Hook
# Automatically organizes unintended *.md files from project root to plan directory
# Usage: Called automatically or manually to clean up documentation

# Load shared utilities (DRY principle)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/shared-utils.sh"

# Initialize hook (sets up colors and error handling)
init_hook

# ═══════════════════════════════════════════════════
# Main Execution
# ═══════════════════════════════════════════════════

print_header "MD File Organization"

PROJECT_ROOT=$(get_project_root)
PLAN_DIR=$(get_plan_dir)

# Ensure plan directories exist
ensure_plan_directories

# ═══════════════════════════════════════════════════
# Step 1: Organize Root MD Files
# ═══════════════════════════════════════════════════

print_section "[1/3] Organizing MD files from project root"
moved_count=$(organize_root_md_files)

# ═══════════════════════════════════════════════════
# Step 2: Check for Duplicates
# ═══════════════════════════════════════════════════

print_section "[2/3] Checking for duplicate files"
find_duplicate_files

# ═══════════════════════════════════════════════════
# Step 3: Update INDEX.md files
# ═══════════════════════════════════════════════════

print_section "[3/3] Updating INDEX.md files"

update_index_file "$PLAN_DIR/01-requirements" "Requirements Documentation"
update_index_file "$PLAN_DIR/02-architecture" "Architecture Documentation"
update_index_file "$PLAN_DIR/03-research" "Research Documentation"
update_index_file "$PLAN_DIR/04-testing" "Testing Documentation"
update_index_file "$PLAN_DIR/05-implementation" "Implementation Documentation"
update_index_file "$PLAN_DIR/06-phase-reports" "Phase Reports"

# ═══════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════

print_summary "$moved_count" "$PLAN_DIR"
verify_directory_structure

echo ""
print_success "MD file organization complete!"
