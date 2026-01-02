#!/bin/bash
# Hive Resume Wrapper
# Runs 'npx claude-flow hive-mind resume' and links the session for Claude Code
#
# Usage: .claude/hooks/hive-resume.sh [session-id]
#
# If session-id is provided, resumes that specific session
# Otherwise, shows interactive session selector

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION_ID="$1"

# Run the resume command
echo "Resuming hive-mind session..."
if [ -n "$SESSION_ID" ]; then
    npx claude-flow@alpha hive-mind resume --session "$SESSION_ID"
else
    npx claude-flow@alpha hive-mind resume
fi

# Check if resume was successful
if [ $? -eq 0 ]; then
    echo ""
    # Link the resumed session
    if [ -n "$SESSION_ID" ]; then
        "$SCRIPT_DIR/hive-session-link.sh" "$SESSION_ID"
    else
        "$SCRIPT_DIR/hive-session-link.sh"
    fi
fi
