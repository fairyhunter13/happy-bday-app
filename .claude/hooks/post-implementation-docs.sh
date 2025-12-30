#!/bin/bash
# Post-Implementation Documentation Organization Hook
# Automatically organizes implementation docs into plan directory
# Usage: Called after implementation work to keep repository organized

# Load shared utilities (DRY principle)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/shared-utils.sh"

# Initialize hook (sets up colors and error handling)
init_hook

# ═══════════════════════════════════════════════════
# Main Execution
# ═══════════════════════════════════════════════════

print_header "Documentation Organization Hook"

PROJECT_ROOT=$(get_project_root)
PLAN_DIR=$(get_plan_dir)

moved_count=0

# Ensure necessary directories exist
ensure_plan_directories
ensure_directory "$PROJECT_ROOT/docs/vendor-specs"

# 1. Move research documents
print_section "[1/6] Organizing Research Documents"
for pattern in "*-research.md" "*-analysis.md" "RESEARCH*.md"; do
    count=$(move_files_by_pattern "$PROJECT_ROOT" "$PLAN_DIR/03-research/" "$pattern" "Research")
    moved_count=$((moved_count + count))
done

# 2. Move implementation plans
print_section "[2/6] Organizing Implementation Plans"
for pattern in "*-implementation-plan.md" "*-plan.md" "PLAN*.md"; do
    files=($PROJECT_ROOT/$pattern)
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            # Skip if already in plan directory
            if [[ "$file" != "$PLAN_DIR"* ]]; then
                if move_file_with_check "$file" "$PLAN_DIR/05-implementation/" "Plan"; then
                    ((moved_count++))
                fi
            fi
        fi
    done
done

# 3. Move implementation summaries
print_section "[3/6] Organizing Implementation Summaries"
for pattern in "*IMPLEMENTATION_SUMMARY.md" "*_IMPLEMENTATION.md" "*CHANGES.md"; do
    files=($PROJECT_ROOT/$pattern)
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            # Detect if it's for a specific feature
            if [[ $(basename "$file") =~ SOPS|sops ]]; then
                mv "$file" "$PLAN_DIR/05-implementation/"
                print_success "SOPS Summary: $(basename $file)"
                ((moved_count++))
            elif [[ $(basename "$file") =~ OPENAPI|openapi ]]; then
                mv "$file" "$PLAN_DIR/05-implementation/"
                print_success "OpenAPI Summary: $(basename $file)"
                ((moved_count++))
            else
                mv "$file" "$PLAN_DIR/06-phase-reports/"
                print_success "Summary: $(basename $file)"
                ((moved_count++))
            fi
        fi
    done
done

# 4. Organize vendor specifications
print_section "[4/6] Organizing Vendor Specifications"
if [ -d "$PROJECT_ROOT/docs/vendor-specs" ]; then
    count=$(find "$PROJECT_ROOT/docs/vendor-specs" -type f | wc -l)
    print_success "Vendor specs organized: $count files"
fi

# 5. Move phase-specific documents
print_section "[5/6] Organizing Phase Documents"
if ls $PROJECT_ROOT/PHASE*.md >/dev/null 2>&1; then
    for file in $PROJECT_ROOT/PHASE*.md; do
        PHASE_NUM=$(basename "$file" | grep -oP 'PHASE\K[0-9]+' || echo "")
        if [ -n "$PHASE_NUM" ]; then
            PHASE_DIR=$(get_phase_directory "$PHASE_NUM")
            ensure_directory "$PHASE_DIR"
            mv "$file" "$PHASE_DIR/"
            print_success "Phase $PHASE_NUM: $(basename $file)"
            ((moved_count++))
        fi
    done
fi

# 6. Organize standalone guide documents
print_section "[6/6] Organizing Guide Documents"
for pattern in "*_GUIDE.md" "GUIDE*.md"; do
    files=($PROJECT_ROOT/$pattern)
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            # CI/CD guides go to implementation
            if [[ $(basename "$file") =~ CI_CD|CICD|ci-cd ]]; then
                if move_file_with_check "$file" "$PLAN_DIR/05-implementation/" "CI/CD Guide"; then
                    ((moved_count++))
                fi
            fi
        fi
    done
done

# Create or update INDEX files
print_section "Updating Index Files"

update_index_file "$PLAN_DIR/03-research" "Research Documentation Index"
update_index_file "$PLAN_DIR/05-implementation" "Implementation Plans Index"

# Print summary
print_summary "$moved_count" "$PLAN_DIR"

# Verify directory structure
verify_directory_structure

exit 0
