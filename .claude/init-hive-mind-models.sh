#!/bin/bash

###############################################################################
# Hive Mind Model Configuration Initializer
#
# This script automatically enforces the permanent model selection strategy:
# - Coordinator: ALWAYS Opus 4.5
# - Workers: Intelligent Sonnet/Haiku routing based on complexity
#
# This script runs automatically when hive-mind initializes
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/hive-mind-config.json"
SETTINGS_FILE="${SCRIPT_DIR}/settings.json"

echo "🧠 Initializing Hive Mind Model Configuration..."
echo ""

# Verify configuration file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ ERROR: hive-mind-config.json not found!"
    echo "   Expected: $CONFIG_FILE"
    exit 1
fi

# Load and validate configuration
echo "✅ Loading configuration from: hive-mind-config.json"

COORDINATOR_MODEL=$(jq -r '.coordinator_config.model' "$CONFIG_FILE")
COORDINATOR_MODEL_ID=$(jq -r '.coordinator_config.model_id' "$CONFIG_FILE")
WORKER_ROUTING=$(jq -r '.worker_agent_config.intelligent_model_routing.enabled' "$CONFIG_FILE")
ENFORCEMENT=$(jq -r '.permanent_model_strategy.enforce_across_sessions' "$CONFIG_FILE")

echo ""
echo "📋 Configuration Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Coordinator Model: $(echo "$COORDINATOR_MODEL" | tr '[:lower:]' '[:upper:]')"
echo "   Model ID: $COORDINATOR_MODEL_ID"
echo "   Worker Routing: $([ "$WORKER_ROUTING" = "true" ] && echo "INTELLIGENT (Sonnet/Haiku)" || echo "DISABLED")"
echo "   Enforcement: $([ "$ENFORCEMENT" = "true" ] && echo "PERMANENT" || echo "TEMPORARY")"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Validate configuration
if [ "$COORDINATOR_MODEL" != "opus" ]; then
    echo "❌ ERROR: Coordinator must use 'opus' model!"
    echo "   Current: $COORDINATOR_MODEL"
    exit 1
fi

if [ "$WORKER_ROUTING" != "true" ]; then
    echo "⚠️  WARNING: Worker intelligent routing is disabled!"
    echo "   Workers should use intelligent Sonnet/Haiku routing"
fi

if [ "$ENFORCEMENT" != "true" ]; then
    echo "⚠️  WARNING: Permanent enforcement is disabled!"
    echo "   Configuration may not persist across sessions"
fi

# Store in collective memory
echo "💾 Storing configuration in collective memory..."

# Create memory payload
MEMORY_PAYLOAD=$(cat <<EOF
{
  "version": "2.0.0",
  "coordinator_model": "$COORDINATOR_MODEL",
  "coordinator_model_id": "$COORDINATOR_MODEL_ID",
  "worker_intelligent_routing": $WORKER_ROUTING,
  "enforce_across_sessions": $ENFORCEMENT,
  "initialized_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "active",
  "description": "PERMANENT: Coordinator always uses Opus 4.5, workers use Sonnet/Haiku based on complexity"
}
EOF
)

# Store via claude-flow if available
if command -v npx &> /dev/null; then
    echo "$MEMORY_PAYLOAD" | npx claude-flow@alpha memory store \
        --namespace "hive-mind-model-config" \
        --key "permanent-model-strategy" \
        --stdin 2>/dev/null || echo "⚠️  Note: Memory storage via CLI not available (will use API)"
fi

echo ""
echo "✅ Configuration initialized successfully!"
echo ""
echo "🎯 Model Selection Strategy:"
echo "   • YOU (Coordinator): Always Opus 4.5 for strategic planning"
echo "   • Workers: Intelligent routing"
echo "     - Complexity 0-30:   Haiku (simple tasks)"
echo "     - Complexity 31-100: Sonnet (moderate to complex)"
echo ""
echo "📊 Expected Usage Distribution:"
echo "   • Opus:   5-10%  (coordinator only)"
echo "   • Sonnet: 60-70% (most worker tasks)"
echo "   • Haiku:  20-30% (simple worker tasks)"
echo ""
echo "💰 Cost Optimization: 60-70% savings vs all-Opus approach"
echo ""
echo "📚 Documentation: .claude/HIVE_MIND_MODEL_STRATEGY.md"
echo ""
echo "🚀 You're ready to start your hive-mind session!"
echo ""

# Export configuration as environment variables
export HIVE_MIND_COORDINATOR_MODEL="$COORDINATOR_MODEL"
export HIVE_MIND_COORDINATOR_MODEL_ID="$COORDINATOR_MODEL_ID"
export HIVE_MIND_WORKER_ROUTING="$WORKER_ROUTING"
export HIVE_MIND_ENFORCEMENT="$ENFORCEMENT"

exit 0
