#!/bin/bash
# Post-Phase Documentation Organization Hook
# Automatically moves phase implementation docs from root to plan directory
# Usage: Called automatically after each phase completion

# Load shared utilities (DRY principle)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/shared-utils.sh"

# Initialize hook (sets up colors and error handling)
init_hook

# ═══════════════════════════════════════════════════
# Main Execution
# ═══════════════════════════════════════════════════

print_header "Post-Phase Documentation Organization"

PROJECT_ROOT=$(get_project_root)
PLAN_DIR=$(get_plan_dir)

# Detect current phase
CURRENT_PHASE=$(detect_current_phase)

if [ -z "$CURRENT_PHASE" ]; then
    print_warning "No phase documentation found"
    exit 0
fi

print_success "Detected Phase $CURRENT_PHASE documentation"

# Create phase directory structure
PHASE_DIR=$(get_phase_directory "$CURRENT_PHASE")
ensure_directory "$PHASE_DIR"

# Move phase-specific documentation
moved_count=0

# Phase implementation docs
print_section "[1/5] Moving Phase Implementation Docs"
for pattern in "PHASE${CURRENT_PHASE}*.md" "*PHASE${CURRENT_PHASE}*.md"; do
    count=$(move_files_by_pattern "$PROJECT_ROOT" "$PHASE_DIR" "$pattern" "Phase doc")
    moved_count=$((moved_count + count))
done

# Agent reports for this phase
print_section "[2/5] Moving Agent Reports"
for file in $PROJECT_ROOT/*AGENT*REPORT*.md $PROJECT_ROOT/*COMPLETION*.md; do
    if move_file_with_check "$file" "$PHASE_DIR" "Agent report"; then
        ((moved_count++))
    fi
done

# General implementation docs (only if phase-related)
print_section "[3/5] Moving Phase-Related Implementation Docs"
for file in $PROJECT_ROOT/IMPLEMENTATION*.md $PROJECT_ROOT/*SUMMARY*.md $PROJECT_ROOT/*GUIDE*.md; do
    if move_if_contains_phase "$file" "$CURRENT_PHASE" "$PHASE_DIR"; then
        ((moved_count++))
    fi
done

# Setup/quickstart docs (only move on Phase 1)
if [ "$CURRENT_PHASE" = "1" ]; then
    print_section "[4/5] Moving Phase 1 Setup Docs"
    for file in $PROJECT_ROOT/SETUP.md $PROJECT_ROOT/QUICKSTART.md $PROJECT_ROOT/README-DATABASE.md; do
        if move_file_with_check "$file" "$PHASE_DIR" "Setup doc"; then
            ((moved_count++))
        fi
    done
fi

# Move architecture decision docs
print_section "[5/5] Moving Architecture Docs"
for file in $PROJECT_ROOT/ARCHITECTURE*.md $PROJECT_ROOT/*DECISION*.md; do
    if move_file_with_check "$file" "$PLAN_DIR/02-architecture/" "Architecture doc"; then
        ((moved_count++))
    fi
done

# Create index file for this phase
create_index_file "$PHASE_DIR" "Phase ${CURRENT_PHASE} Documentation Index"

# Print summary
print_summary "$moved_count" "$PHASE_DIR"

# Update plan README if needed
if [ -f "$PLAN_DIR/README.md" ]; then
    if ! grep -q "Phase ${CURRENT_PHASE}" "$PLAN_DIR/README.md"; then
        print_warning "Update plan/README.md to reference Phase ${CURRENT_PHASE} reports"
    fi
fi
