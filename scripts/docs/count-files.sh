#!/bin/bash
# Count Files and Update INDEX Files
# Counts markdown files in directories and updates "Total Files:" or "Total Documents:" in INDEX files
#
# Usage: ./count-files.sh [directory]
#   directory: Directory to process (default: current directory)

set -e

TARGET_DIR="${1:-.}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Counting Files and Updating INDEX Files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to count markdown files in a directory (excluding INDEX.md and README.md)
count_md_files() {
  local dir=$1
  find "$dir" -maxdepth 1 -type f -name "*.md" ! -name "INDEX.md" ! -name "README.md" | wc -l | tr -d ' '
}

# Function to update INDEX file with file count
update_index_count() {
  local index_file=$1
  local count=$2

  if [ ! -f "$index_file" ]; then
    return 1
  fi

  # Check if file contains "Total Files:" or "Total Documents:"
  if grep -q "Total Files:" "$index_file" 2>/dev/null; then
    # Update Total Files
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/\*\*Total Files:\*\* [0-9]*/\*\*Total Files:\*\* $count/g" "$index_file"
      sed -i '' "s/Total Files: [0-9]*/Total Files: $count/g" "$index_file"
    else
      sed -i "s/\*\*Total Files:\*\* [0-9]*/\*\*Total Files:\*\* $count/g" "$index_file"
      sed -i "s/Total Files: [0-9]*/Total Files: $count/g" "$index_file"
    fi
    return 0
  elif grep -q "Total Documents:" "$index_file" 2>/dev/null; then
    # Update Total Documents
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/\*\*Total Documents:\*\* [0-9]*/\*\*Total Documents:\*\* $count/g" "$index_file"
      sed -i '' "s/Total Documents: [0-9]*/Total Documents: $count/g" "$index_file"
    else
      sed -i "s/\*\*Total Documents:\*\* [0-9]*/\*\*Total Documents:\*\* $count/g" "$index_file"
      sed -i "s/Total Documents: [0-9]*/Total Documents: $count/g" "$index_file"
    fi
    return 0
  fi

  return 1
}

FILES_UPDATED=0
DIRS_PROCESSED=0

# Process target directory if it has an INDEX file
if [ -f "$TARGET_DIR/INDEX.md" ]; then
  FILE_COUNT=$(count_md_files "$TARGET_DIR")
  echo "Processing: $TARGET_DIR"
  echo "  Files found: $FILE_COUNT"

  if update_index_count "$TARGET_DIR/INDEX.md" "$FILE_COUNT"; then
    echo "  ✅ Updated INDEX.md with count: $FILE_COUNT"
    FILES_UPDATED=$((FILES_UPDATED + 1))
  else
    echo "  ⊘  INDEX.md has no count field to update"
  fi
  DIRS_PROCESSED=$((DIRS_PROCESSED + 1))
  echo ""
fi

# Process all subdirectories with INDEX.md files
find "$TARGET_DIR" -type f -name "INDEX.md" ! -path "*/node_modules/*" ! -path "*/.git/*" | while IFS= read -r index_file; do
  dir=$(dirname "$index_file")

  # Skip if we already processed this directory
  if [ "$dir" = "$TARGET_DIR" ]; then
    continue
  fi

  FILE_COUNT=$(count_md_files "$dir")
  echo "Processing: $dir"
  echo "  Files found: $FILE_COUNT"

  if update_index_count "$index_file" "$FILE_COUNT"; then
    echo "  ✅ Updated INDEX.md with count: $FILE_COUNT"
    FILES_UPDATED=$((FILES_UPDATED + 1))
  else
    echo "  ⊘  INDEX.md has no count field to update"
  fi
  DIRS_PROCESSED=$((DIRS_PROCESSED + 1))
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary:"
echo "  Directories processed: $DIRS_PROCESSED"
echo "  INDEX files updated:   $FILES_UPDATED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
