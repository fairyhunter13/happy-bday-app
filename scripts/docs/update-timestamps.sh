#!/bin/bash
# Update Timestamps in INDEX Files
# Updates "Last Updated:" timestamps in all INDEX.md and README.md files
#
# Usage: ./update-timestamps.sh [base-dir]
#   base-dir: Base directory to search (default: current directory)

set -e

BASE_DIR="${1:-.}"
CURRENT_DATE=$(date +%Y-%m-%d)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📅 Updating Documentation Timestamps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Base directory: $BASE_DIR"
echo "Current date:   $CURRENT_DATE"
echo ""

# Find all INDEX.md and README.md files (excluding node_modules)
FILES_UPDATED=0
FILES_FOUND=0

while IFS= read -r file; do
  FILES_FOUND=$((FILES_FOUND + 1))

  # Check if file contains "Last Updated:" or "**Last Updated:**"
  if grep -q "Last Updated:" "$file" 2>/dev/null; then
    # Update the timestamp
    # Handle various formats:
    # - Last Updated: YYYY-MM-DD
    # - **Last Updated:** YYYY-MM-DD
    # - Last Updated: YYYY-MM-DD (Second Sync)

    # Use sed to update (macOS/Linux compatible)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS sed
      sed -i '' "s/Last Updated: [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}[^)]*/Last Updated: $CURRENT_DATE/g" "$file"
      sed -i '' "s/\*\*Last Updated:\*\* [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}[^)]*/\*\*Last Updated:\*\* $CURRENT_DATE/g" "$file"
    else
      # Linux sed
      sed -i "s/Last Updated: [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}[^)]*/Last Updated: $CURRENT_DATE/g" "$file"
      sed -i "s/\*\*Last Updated:\*\* [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}[^)]*/\*\*Last Updated:\*\* $CURRENT_DATE/g" "$file"
    fi

    echo "  ✅ Updated: $file"
    FILES_UPDATED=$((FILES_UPDATED + 1))
  else
    echo "  ⊘  Skipped: $file (no timestamp found)"
  fi
done < <(find "$BASE_DIR" -type f \( -name "INDEX.md" -o -name "README.md" \) ! -path "*/node_modules/*" ! -path "*/.git/*")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary:"
echo "  Files found:   $FILES_FOUND"
echo "  Files updated: $FILES_UPDATED"
echo "  Files skipped: $((FILES_FOUND - FILES_UPDATED))"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
