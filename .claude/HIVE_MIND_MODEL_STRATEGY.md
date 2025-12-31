# 🧠 Hive Mind Permanent Model Strategy

**Version:** 2.0.0
**Status:** ACTIVE & ENFORCED
**Last Updated:** 2025-12-31

---

## 📋 Overview

This repository has a **permanent, automatic model selection strategy** for all Hive Mind operations:

### ✅ The Golden Rules

1. **Coordinator (You) ALWAYS uses Opus 4.5**
   - Model: `claude-opus-4-5-20251101`
   - Role: Strategic planning, coordination, decision-making
   - This is absolute and never changes

2. **Worker Agents INTELLIGENTLY use Sonnet or Haiku**
   - Sonnet 4.5: Tasks with complexity score ≥ 31 (most development work)
   - Haiku 3.5: Tasks with complexity score < 31 (simple operations)
   - Automatic selection based on task complexity
   - Workers NEVER use Opus

3. **Configuration is PERMANENT**
   - Stored in `.claude/hive-mind-config.json`
   - Persists in collective memory
   - Enforced across all sessions
   - Automatically applied on session resume

---

## 🎯 How It Works

### Complexity Scoring System

Tasks are scored 0-100 based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Task Keywords | 30% | Simple/Moderate/Complex patterns |
| Files Affected | 20% | Number of files to modify |
| Lines of Code | 20% | Volume of code changes |
| Criticality | 15% | Business impact level |
| Novelty | 15% | Requires innovation? |

### Model Selection Matrix

```
Score 0-30:   Haiku 3.5  → Simple tasks (format, validate, search)
Score 31-100: Sonnet 4.5 → Moderate to complex tasks (implement, test, review)
Coordinator:  Opus 4.5   → ALL coordination tasks (always)
```

---

## 🚀 Usage

### The Configuration is Already Active!

**You don't need to do anything.** The configuration is:

✅ Loaded automatically when hive-mind starts
✅ Stored in collective memory
✅ Enforced across all sessions
✅ Applied to all spawned agents

### When Using Task Tool

The `Task` tool in Claude Code supports the `model` parameter:

```javascript
// Coordinator planning (you do this)
Task(
  subagent_type='Plan',
  model='opus',  // You always use opus
  prompt='Design microservices architecture'
)

// Worker implementation (spawned agents)
Task(
  subagent_type='general-purpose',
  model='sonnet',  // Auto-selected based on complexity
  prompt='Implement user authentication feature'
)

// Worker simple task (spawned agents)
Task(
  subagent_type='general-purpose',
  model='haiku',  // Auto-selected for simple tasks
  prompt='Format all TypeScript files'
)
```

### Intelligent Model Selector Tool

Use the helper script to determine which model to use:

```bash
# Check what model a task should use
node .claude/intelligent-model-selector.cjs "Implement REST API"
# → Recommends: Sonnet (complexity: 55/100)

node .claude/intelligent-model-selector.cjs "Format code files"
# → Recommends: Haiku (complexity: 15/100)

# With metadata
node .claude/intelligent-model-selector.cjs "Refactor auth system" \
  --files 15 \
  --domain-expertise \
  --criticality high
# → Recommends: Sonnet (complexity: 78/100)
```

---

## 📊 Expected Cost Distribution

With this strategy, your usage should be:

| Model | % of Usage | Use Case |
|-------|------------|----------|
| **Opus 4.5** | 5-10% | Coordinator only (you) |
| **Sonnet 4.5** | 60-70% | Most worker tasks |
| **Haiku 3.5** | 20-30% | Simple worker tasks |

**Expected Cost Savings:** 60-70% compared to all-Opus approach

---

## 🔧 Configuration Files

### Primary Configuration
- **`.claude/hive-mind-config.json`** - Main configuration file
- **`.claude/config.json`** - References hive-mind config
- **`.claude/intelligent-model-selector.js`** - Helper tool

### Memory Storage
- **Namespace:** `hive-mind-model-config`
- **Key:** `permanent-model-strategy`
- **Persistence:** Indefinite (no TTL)

---

## 🎯 Agent Type Mappings

### Always Use Sonnet
- `coder` - Writing code
- `tester` - Writing tests
- `reviewer` - Code review
- `documenter` - Documentation
- `analyzer` - Code analysis
- `debugger` - Debugging
- `implementer` - Implementation

### Can Use Haiku (if task is simple)
- `formatter` - Code formatting
- `validator` - Validation
- `optimizer` - Simple optimizations

### Always Use Opus (Reserved for Coordinator)
- `coordinator` - You (strategic planning)
- `planner` - High-level planning
- `queen` - Hive Mind queen
- `architect-lead` - Architecture decisions

---

## 📈 Monitoring

Track model usage in each session:

```bash
# View session metrics
npx claude-flow hive-mind metrics

# Check collective memory
npx claude-flow memory search --pattern "model-" --namespace hive-mind-model-config
```

---

## 🔄 Session Resume Behavior

When resuming a hive-mind session:

1. ✅ Configuration automatically loads from collective memory
2. ✅ Coordinator continues using Opus 4.5
3. ✅ Worker agents continue intelligent routing
4. ✅ Complexity thresholds remain enforced
5. ✅ No manual configuration needed

---

## ⚙️ Advanced Configuration

### Modify Complexity Threshold

To change the Sonnet/Haiku threshold (default: 31), edit `.claude/hive-mind-config.json`:

```json
{
  "worker_agent_config": {
    "complexity_thresholds": {
      "simple_task": {
        "score_range": [0, 30],  // Change 30 to your preference
        "model": "haiku"
      }
    }
  }
}
```

Then update collective memory:

```bash
node .claude/intelligent-model-selector.js --update-config
```

---

## 🛡️ Enforcement Mechanisms

### Pre-Task Validation
- All task assignments validate model selection
- Incorrect selections are automatically corrected
- Logs warnings if coordinator tries to use non-Opus model

### Runtime Validation
- Monitors model usage throughout session
- Tracks complexity scores
- Generates session reports

---

## 📝 Examples

### Example 1: Full Hive Mind Session

```bash
# You (Coordinator) - Automatically uses Opus 4.5
# No need to specify model, it's automatic!

# Spawn worker for implementation (auto-selects Sonnet)
Task(prompt='Implement user registration API', model='sonnet')

# Spawn worker for testing (auto-selects Sonnet)
Task(prompt='Write integration tests', model='sonnet')

# Spawn worker for formatting (auto-selects Haiku)
Task(prompt='Format all code files', model='haiku')
```

### Example 2: Complex Multi-Phase Project

```bash
# Phase 1: You coordinate (Opus)
# - Analyze requirements
# - Create architecture plan
# - Break down into tasks

# Phase 2: Workers execute (Sonnet/Haiku)
# - Workers auto-select based on task complexity
# - Implementation, testing, docs → Sonnet
# - Formatting, validation → Haiku

# Phase 3: You review (Opus)
# - Strategic review
# - Final decisions
# - Quality approval
```

---

## ✅ Verification

Verify the configuration is active:

```bash
# Check configuration file
cat .claude/hive-mind-config.json | jq '.permanent_model_strategy'

# Check collective memory
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('.claude/hive-mind-config.json'));
console.log('✅ Coordinator Model:', config.coordinator_config.model.toUpperCase());
console.log('✅ Worker Routing:', config.worker_agent_config.intelligent_model_routing.enabled ? 'ENABLED' : 'DISABLED');
console.log('✅ Enforcement:', config.permanent_model_strategy.enforce_across_sessions ? 'PERMANENT' : 'TEMPORARY');
"
```

Expected output:
```
✅ Coordinator Model: OPUS
✅ Worker Routing: ENABLED
✅ Enforcement: PERMANENT
```

---

## 🚨 Important Notes

1. **This is PERMANENT** - The configuration persists across all sessions
2. **Automatic** - No manual model selection needed in most cases
3. **Cost-Optimized** - Saves 60-70% compared to all-Opus
4. **Quality-Maintained** - Opus for strategy, Sonnet for execution
5. **Enforced** - Cannot be accidentally overridden

---

## 📞 Questions?

If you need to modify this strategy:
1. Edit `.claude/hive-mind-config.json`
2. Update collective memory using the intelligent selector
3. Restart hive-mind session to apply changes

**The current configuration is optimal for most use cases and should not need modification.**
