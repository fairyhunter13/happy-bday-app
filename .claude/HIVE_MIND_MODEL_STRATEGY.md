# Hive Mind Model Strategy: Full Reasoning Mode

**Version:** 3.0.0
**Mode:** COORDINATOR REASONING
**Last Updated:** 2025-12-31

---

## Overview

This repository uses **Full Reasoning Mode** for model selection. The coordinator (Opus 4.5) uses its reasoning judgment to select models for all spawned agents - no algorithmic enforcement.

### The Core Principle

> **YOU (the coordinator) decide which model to use for each spawned agent based on your reasoning about the task.**

No keyword matching. No complexity scores. No automatic overrides. Your judgment is final.

---

## Model Selection Guidelines

When spawning agents, decide the model based on:

### 1. Task Complexity and Nuance
- Not just keywords - understand what the task actually requires
- Consider edge cases, domain knowledge needs, and reasoning depth

### 2. Cost Implications
| Model | Input Cost | Output Cost | Relative |
|-------|------------|-------------|----------|
| **Opus 4.5** | ~$15/MTok | ~$75/MTok | Baseline |
| **Sonnet 4.5** | ~$3/MTok | ~$15/MTok | ~5x cheaper |
| **Haiku 3.5** | ~$1/MTok | ~$5/MTok | ~15x cheaper |

### 3. Reasoning Capability Required
- Does this task need YOUR level of reasoning?
- Or can a capable but less expensive model handle it?

### 4. Confidence in Success
- How confident are you that the worker will succeed?
- Higher stakes = consider higher capability model

---

## Model Selection Matrix

| Model | When to Use | Examples |
|-------|-------------|----------|
| **Haiku** | Simple, mechanical, repetitive tasks | Format files, search/find, list items, validate syntax, simple refactoring |
| **Sonnet** | Standard development work (**DEFAULT**) | Implement features, write tests, debug issues, code review, documentation, API integration |
| **Opus** | Complex reasoning, novel problems, high stakes | Novel architecture design, security audits, cross-domain synthesis, critical system changes |

---

## Usage Examples

### Spawning with Model Selection

```javascript
// Simple task → Haiku
Task(
  subagent_type='general-purpose',
  model='haiku',
  prompt='Find all files that import the UserService class'
)

// Standard implementation → Sonnet (default)
Task(
  subagent_type='general-purpose',
  model='sonnet',
  prompt='Implement the birthday notification worker with timezone handling'
)

// Complex architecture → Opus
Task(
  subagent_type='general-purpose',
  model='opus',
  prompt='Design the distributed queue system with exactly-once delivery guarantees and failure recovery'
)
```

### Parallel Spawning with Mixed Models

```javascript
// In ONE message, spawn multiple agents with appropriate models
Task(model='sonnet', prompt='Implement user CRUD endpoints')
Task(model='sonnet', prompt='Write integration tests for user API')
Task(model='haiku', prompt='Format and lint all source files')
Task(model='opus', prompt='Review architecture for scalability issues')
```

---

## Decision Framework

Ask yourself before each spawn:

1. **Is this mechanical/repetitive?** → Haiku
2. **Is this standard dev work?** → Sonnet
3. **Does this require deep reasoning I would use?** → Opus
4. **Am I choosing Opus "just to be safe"?** → Probably use Sonnet instead
5. **What's the cost of failure?** → Higher cost = consider higher model

---

## What Changed from v2.0

| Aspect | v2.0 (Algorithmic) | v3.0 (Full Reasoning) |
|--------|-------------------|----------------------|
| Model selection | Keyword matching + complexity scores | Coordinator judgment |
| Enforcement | Automatic override of "wrong" selections | None - your choice is final |
| Worker Opus usage | Never allowed | Allowed if you decide it's needed |
| Flexibility | Rigid thresholds | Full flexibility |
| Cost control | Algorithmic | Your cost-aware reasoning |

---

## Configuration Files

- `.claude/hive-mind-config.json` - Main config (mode: coordinator_reasoning)
- `.claude/model-selection-config.json` - Enforcement disabled
- `.claude/config.json` - References full reasoning mode
- `CLAUDE.md` - Model selection guidance for coordinator

---

## Notes

- The `intelligent-model-selector.cjs` tool still exists but is now **advisory only**
- You can run it to see what the algorithm would suggest, but you're not bound by it
- Trust your reasoning - you understand task nuance better than keyword matching
