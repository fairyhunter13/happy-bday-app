#!/bin/bash
# Hive Wizard Wrapper
# Runs 'npx claude-flow hive-mind wizard' and links the session for Claude Code
#
# Usage: .claude/hooks/hive-wizard.sh [options]
#
# All arguments are passed to the underlying wizard command

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the wizard command
echo "Starting hive-mind wizard..."
npx claude-flow@alpha hive-mind wizard "$@"

# Check if wizard created/selected a session
if [ $? -eq 0 ]; then
    echo ""
    # Link the active session (wizard may have created or switched to one)
    "$SCRIPT_DIR/hive-session-link.sh"
fi
