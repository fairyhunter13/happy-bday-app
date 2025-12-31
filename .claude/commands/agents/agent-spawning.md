# agent-spawning

Guide to spawning agents with Claude Code's Task tool.

## Model Selection: Full Reasoning Mode

**The coordinator (you, Opus 4.5) decides which model to use for each spawned agent.**

No algorithmic enforcement - use your judgment based on:
- Task complexity and nuance
- Cost implications (Opus ~$15/MTok, Sonnet ~$3/MTok, Haiku ~$1/MTok)
- Whether the task requires coordinator-level reasoning
- Confidence that a lower model will succeed

**Default to Sonnet unless you have specific reasons for Opus or Haiku.**

## Model Selection Guidelines

| Model | Cost | When to Use |
|-------|------|-------------|
| **Haiku** | ~$1/MTok | Simple/mechanical: format, search, list, validate |
| **Sonnet** | ~$3/MTok | Standard dev work: implement, test, debug, docs **(DEFAULT)** |
| **Opus** | ~$15/MTok | Complex reasoning: architecture, security, cross-domain |

## Using Claude Code's Task Tool

**CRITICAL**: Always use Claude Code's Task tool for actual agent execution:

```javascript
// Spawn ALL agents in ONE message with model selection
Task(
  subagent_type='general-purpose',
  model='sonnet',  // YOU decide: sonnet, haiku, or opus
  prompt='Implement the user registration API'
)

Task(
  subagent_type='general-purpose',
  model='haiku',  // Simple task = haiku
  prompt='Format all TypeScript files in src/'
)

Task(
  subagent_type='general-purpose',
  model='opus',  // Complex architecture = opus
  prompt='Design distributed event system for birthday notifications'
)
```

## MCP Coordination Setup (Optional)

MCP tools are ONLY for coordination:
```javascript
mcp__claude-flow__swarm_init { topology: "mesh" }
mcp__claude-flow__agent_spawn { type: "researcher" }
```

## Best Practices
1. Always spawn agents concurrently in ONE message
2. Use Task tool for execution
3. YOU (coordinator) decide the model for each agent
4. Default to Sonnet, justify Opus/Haiku choices
5. Batch all operations for maximum parallelism
