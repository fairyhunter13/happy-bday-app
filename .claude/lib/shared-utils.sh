#!/bin/bash
# Shared Utilities for Claude Hooks
# DRY principle: Common functions used across multiple hooks
# Version: 1.0.0

# ═══════════════════════════════════════════════════
# Color Output Configuration
# ═══════════════════════════════════════════════════

setup_colors() {
    export GREEN='\033[0;32m'
    export BLUE='\033[0;34m'
    export YELLOW='\033[1;33m'
    export RED='\033[0;31m'
    export NC='\033[0m' # No Color
}

# ═══════════════════════════════════════════════════
# Project Paths
# ═══════════════════════════════════════════════════

get_project_root() {
    echo "/Users/hafizputraludyanto/git/github.com/fairyhunter13/happy-bday-app"
}

get_plan_dir() {
    echo "$(get_project_root)/plan"
}

# ═══════════════════════════════════════════════════
# Output Formatting
# ═══════════════════════════════════════════════════

print_header() {
    local title="$1"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $title${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
}

print_section() {
    local section="$1"
    echo -e "\n${BLUE}$section${NC}"
}

print_success() {
    local message="$1"
    echo -e "${GREEN}✓${NC} $message"
}

print_warning() {
    local message="$1"
    echo -e "${YELLOW}⚠${NC} $message"
}

print_error() {
    local message="$1"
    echo -e "${RED}✗${NC} $message"
}

# ═══════════════════════════════════════════════════
# Directory Management
# ═══════════════════════════════════════════════════

ensure_directory() {
    local dir="$1"
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        print_success "Created directory: $dir"
    fi
}

ensure_plan_directories() {
    local plan_dir=$(get_plan_dir)
    ensure_directory "$plan_dir/01-requirements"
    ensure_directory "$plan_dir/02-architecture"
    ensure_directory "$plan_dir/03-research"
    ensure_directory "$plan_dir/04-testing"
    ensure_directory "$plan_dir/05-implementation"
    ensure_directory "$plan_dir/06-phase-reports"
}

# ═══════════════════════════════════════════════════
# File Operations
# ═══════════════════════════════════════════════════

move_files_by_pattern() {
    local source_dir="$1"
    local target_dir="$2"
    local pattern="$3"
    local label="${4:-File}"
    local moved=0

    files=($source_dir/$pattern)
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            mv "$file" "$target_dir/"
            print_success "$label: $(basename $file)"
            ((moved++))
        fi
    done

    echo $moved
}

move_file_with_check() {
    local file="$1"
    local target_dir="$2"
    local label="${3:-File}"

    if [ -f "$file" ]; then
        mv "$file" "$target_dir/"
        print_success "$label: $(basename $file)"
        return 0
    fi
    return 1
}

# ═══════════════════════════════════════════════════
# INDEX.md Generation
# ═══════════════════════════════════════════════════

create_index_file() {
    local directory="$1"
    local title="$2"
    local index_file="$directory/INDEX.md"

    # Create header
    cat > "$index_file" << EOF
# $title

**Last Updated**: $(date '+%Y-%m-%d %H:%M:%S')
**Generated**: Automatically by Claude hooks

## Files in this directory

EOF

    # List all markdown files except INDEX.md
    for file in $directory/*.md; do
        if [ -f "$file" ] && [ "$(basename $file)" != "INDEX.md" ]; then
            filename=$(basename $file)
            # Try to extract title from first # heading
            title=$(grep -m 1 "^# " "$file" 2>/dev/null | sed 's/^# //' || echo "")

            if [ -n "$title" ]; then
                echo "- [$filename](./$filename) - $title" >> "$index_file"
            else
                echo "- [$filename](./$filename)" >> "$index_file"
            fi
        fi
    done

    print_success "Created INDEX.md in $(basename $directory)"
}

update_index_file() {
    local directory="$1"
    local title="$2"

    if [ -d "$directory" ]; then
        create_index_file "$directory" "$title"
    fi
}

# ═══════════════════════════════════════════════════
# Phase Detection
# ═══════════════════════════════════════════════════

detect_current_phase() {
    local project_root=$(get_project_root)

    if ls $project_root/PHASE*.md >/dev/null 2>&1; then
        # Extract phase number from PHASE*.md files
        local phase_file=$(ls $project_root/PHASE*.md | head -n 1 | xargs basename)
        echo $(echo $phase_file | grep -oP 'PHASE\K[0-9]+')
    else
        echo ""
    fi
}

get_phase_directory() {
    local phase_num="$1"
    local plan_dir=$(get_plan_dir)
    echo "$plan_dir/06-phase-reports/phase${phase_num}"
}

# ═══════════════════════════════════════════════════
# Summary Output
# ═══════════════════════════════════════════════════

print_summary() {
    local moved_count="$1"
    local target_dir="$2"

    echo ""
    print_header "Summary"

    if [ $moved_count -gt 0 ]; then
        print_success "Documentation organization complete"
        echo -e "  Moved: $moved_count files"
    else
        print_warning "No files to organize"
    fi

    if [ -n "$target_dir" ]; then
        echo -e "  Target: $target_dir"
    fi

    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
}

# ═══════════════════════════════════════════════════
# Conditional File Moving
# ═══════════════════════════════════════════════════

move_if_contains_phase() {
    local file="$1"
    local phase_num="$2"
    local target_dir="$3"

    if [ -f "$file" ]; then
        if grep -q "Phase ${phase_num}" "$file" 2>/dev/null ||
           grep -q "PHASE ${phase_num}" "$file" 2>/dev/null; then
            mv "$file" "$target_dir/"
            print_success "Moved: $(basename $file)"
            return 0
        fi
    fi
    return 1
}

# ═══════════════════════════════════════════════════
# Verification
# ═══════════════════════════════════════════════════

verify_directory_structure() {
    local plan_dir=$(get_plan_dir)

    print_section "Directory Structure Verification:"

    local dirs=(
        "$plan_dir/01-requirements"
        "$plan_dir/02-architecture"
        "$plan_dir/03-research"
        "$plan_dir/04-testing"
        "$plan_dir/05-implementation"
        "$plan_dir/06-phase-reports"
    )

    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_success "$(basename $dir)/"
        else
            print_warning "Missing: $(basename $dir)/"
        fi
    done
}

# ═══════════════════════════════════════════════════
# Unintended MD File Organization
# ═══════════════════════════════════════════════════

# List of MD files that SHOULD be in project root
ALLOWED_ROOT_MD_FILES=(
    "README.md"
    "CHANGELOG.md"
    "CONTRIBUTING.md"
    "LICENSE.md"
    "CODE_OF_CONDUCT.md"
)

is_allowed_root_md() {
    local filename="$1"
    for allowed in "${ALLOWED_ROOT_MD_FILES[@]}"; do
        if [ "$filename" == "$allowed" ]; then
            return 0
        fi
    done
    return 1
}

categorize_md_file() {
    local filename="$1"
    local content="$2"

    # Check filename patterns first
    case "$filename" in
        *REQUIREMENT*|*SPEC*|*FLOW*)
            echo "01-requirements"
            return
            ;;
        *ARCHITECTURE*|*DESIGN*|*SYSTEM*)
            echo "02-architecture"
            return
            ;;
        *RESEARCH*|*ANALYSIS*|*STRATEGY*|*AUDIT*|*COMPARISON*)
            echo "03-research"
            return
            ;;
        *TEST*|*EDGE*|*COVERAGE*|*CHAOS*)
            echo "04-testing"
            return
            ;;
        *IMPLEMENTATION*|*PLAN*|*GUIDE*|*SETUP*|*QUICKSTART*)
            echo "05-implementation"
            return
            ;;
        *PHASE*|*REPORT*|*SUMMARY*|*COMPLETION*|*AGENT*)
            echo "06-phase-reports"
            return
            ;;
        *HIVE*|*SESSION*|*SWARM*)
            echo "06-phase-reports"
            return
            ;;
        *PERFORMANCE*|*OPTIMIZATION*|*CONSTITUTION*)
            echo "03-research"
            return
            ;;
        *VERIFICATION*|*VALIDATION*)
            echo "04-testing"
            return
            ;;
    esac

    # Default to implementation if no match
    echo "05-implementation"
}

organize_root_md_files() {
    local project_root=$(get_project_root)
    local plan_dir=$(get_plan_dir)
    local moved_count=0

    print_section "Organizing MD files from project root"

    for file in "$project_root"/*.md; do
        [ -f "$file" ] || continue

        local filename=$(basename "$file")

        # Skip allowed files
        if is_allowed_root_md "$filename"; then
            print_warning "Skipping allowed root file: $filename"
            continue
        fi

        # Categorize and move
        local category=$(categorize_md_file "$filename" "")
        local target_dir="$plan_dir/$category"

        ensure_directory "$target_dir"
        mv "$file" "$target_dir/"
        print_success "Moved $filename → $category/"
        ((moved_count++))
    done

    echo $moved_count
}

# ═══════════════════════════════════════════════════
# Deduplication Helpers
# ═══════════════════════════════════════════════════

find_duplicate_files() {
    local plan_dir=$(get_plan_dir)

    print_section "Checking for duplicate files"

    # Find files with same name in different directories
    find "$plan_dir" -name "*.md" -type f | \
        xargs -I {} basename {} | \
        sort | uniq -d | while read duplicate; do
            print_warning "Duplicate found: $duplicate"
            find "$plan_dir" -name "$duplicate" -type f
        done
}

merge_duplicate_files() {
    local file1="$1"
    local file2="$2"
    local target="$3"

    # Keep newer file, archive older
    local archive_dir=$(get_plan_dir)/ARCHIVE

    ensure_directory "$archive_dir"

    # Compare modification times
    if [ "$file1" -nt "$file2" ]; then
        mv "$file2" "$archive_dir/"
        print_success "Archived older: $(basename $file2)"
    else
        mv "$file1" "$archive_dir/"
        print_success "Archived older: $(basename $file1)"
    fi
}

# ═══════════════════════════════════════════════════
# Initialize (called at script start)
# ═══════════════════════════════════════════════════

init_hook() {
    setup_colors
    set -e  # Exit on error
}
