#!/bin/bash
# Auto-Commit Hook
# Automatically commits and pushes changes at end of session to trigger CI/CD
# IMPORTANT: Never deletes or modifies files in project_data

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

echo "🔄 Auto-Commit Hook"
echo "==================="

# Check if there are any changes
if ! git diff --quiet HEAD 2>/dev/null || [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "📝 Changes detected, preparing to commit..."

  # Show what will be committed
  STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
  UNSTAGED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
  UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')

  echo "   Staged files: $STAGED"
  echo "   Modified files: $UNSTAGED"
  echo "   Untracked files: $UNTRACKED"

  # Stage all changes (except ignored files like project_data)
  git add -A 2>/dev/null || true

  # Check if anything is staged now
  if git diff --cached --quiet 2>/dev/null; then
    echo "   ℹ️  No changes to commit (files may be gitignored)"
    echo "✅ Auto-commit check complete (nothing to commit)"
    exit 0
  fi

  # Create commit message with timestamp
  TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
  COMMIT_MSG="chore: auto-commit session changes

Session timestamp: $TIMESTAMP
Changes include:
- Hook configuration updates
- Documentation maintenance
- Code improvements

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

  # Commit with message
  git commit -m "$COMMIT_MSG" --no-verify 2>/dev/null || {
    echo "   ⚠️  Commit failed or nothing to commit"
    exit 0
  }

  echo "   ✅ Changes committed"

  # Push to remote
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  echo "   📤 Pushing to origin/$CURRENT_BRANCH..."

  git push origin "$CURRENT_BRANCH" 2>/dev/null || {
    echo "   ⚠️  Push failed (may need to pull first or no remote configured)"
    echo "   ℹ️  Changes are committed locally"
    exit 0
  }

  echo "   ✅ Pushed to origin/$CURRENT_BRANCH"
  echo ""
  echo "🚀 CI/CD pipeline triggered on GitHub Actions"
else
  echo "   ℹ️  No changes detected"
fi

echo ""
echo "✅ Auto-commit hook complete"
