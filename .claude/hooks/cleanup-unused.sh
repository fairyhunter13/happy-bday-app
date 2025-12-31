#!/bin/bash
# Unused Files Cleanup Hook
# Identifies and reports unused/unreferenced files

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Protected directories - NEVER delete files from these
PROTECTED_DIRS=("project_data")

echo "🧹 Unused Files Cleanup Hook"
echo "🔒 Protected directories: ${PROTECTED_DIRS[*]}"
echo "============================="

# Build exclusion pattern for find command
EXCLUDE_PATTERN="-path */node_modules/* -prune"
for dir in "${PROTECTED_DIRS[@]}"; do
  EXCLUDE_PATTERN="$EXCLUDE_PATTERN -o -path */$dir/* -prune"
done

# 1. Check for files marked as deleted in git
echo "🔍 Checking git status for deleted files..."
DELETED_FILES=$(cd "$PROJECT_DIR" && git status --porcelain 2>/dev/null | grep "^D " | wc -l | tr -d ' ')
echo "   Files marked for deletion: $DELETED_FILES"

# 2. Check for empty directories (excluding protected dirs)
echo "📁 Checking for empty directories..."
EMPTY_DIRS=$(find "$PROJECT_DIR/src" "$PROJECT_DIR/tests" "$PROJECT_DIR/docs" \( $EXCLUDE_PATTERN \) -o -type d -empty -print 2>/dev/null | wc -l | tr -d ' ')
echo "   Empty directories: $EMPTY_DIRS"

# 3. Check for backup files (excluding protected dirs)
echo "💾 Checking for backup/temp files..."
BACKUP_FILES=$(find "$PROJECT_DIR" \( $EXCLUDE_PATTERN \) -o \( -name "*.bak" -o -name "*.tmp" -o -name "*~" -o -name "*.swp" \) -print 2>/dev/null | wc -l | tr -d ' ')
echo "   Backup/temp files: $BACKUP_FILES"

# 4. Check for .DS_Store files (excluding protected dirs)
echo "🍎 Checking for .DS_Store files..."
DS_STORE=$(find "$PROJECT_DIR" \( $EXCLUDE_PATTERN \) -o -name ".DS_Store" -print 2>/dev/null | wc -l | tr -d ' ')
echo "   .DS_Store files: $DS_STORE"

# 5. Auto-cleanup safe files (excluding protected dirs)
if [ "$DS_STORE" -gt 0 ]; then
  echo "   🗑️  Removing .DS_Store files (excluding protected directories)..."
  find "$PROJECT_DIR" \( $EXCLUDE_PATTERN \) -o -name ".DS_Store" -delete 2>/dev/null || true
  echo "   ✅ .DS_Store files removed"
fi

# 6. Summary
echo ""
echo "📊 Cleanup Status Summary:"
echo "   - Git deleted files: $DELETED_FILES"
echo "   - Empty directories: $EMPTY_DIRS"
echo "   - Backup files: $BACKUP_FILES"
echo "   - .DS_Store removed: $DS_STORE"
echo ""
echo "✅ Cleanup check complete"
