#!/bin/bash
# Hive Spawn Wrapper
# Runs 'npx claude-flow hive-mind spawn' and links the session for Claude Code
#
# Usage: .claude/hooks/hive-spawn.sh "Build a REST API" [options]
#
# All arguments are passed to the underlying spawn command

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Run the spawn command
echo "Spawning hive-mind swarm..."
npx claude-flow@alpha hive-mind spawn "$@"

# Check if spawn was successful
if [ $? -eq 0 ]; then
    echo ""
    # Link the newly created session
    "$SCRIPT_DIR/hive-session-link.sh"
fi
