# CLAUDE.md - Project Intelligence for Claude Code

This file provides guidance for Claude Code when working on this project.

---

## Model Selection for Spawned Agents

**Mode: Full Reasoning**

When spawning agents, YOU (the coordinator) decide the model based on:

- **Task complexity and nuance** - not just keywords, understand what's actually needed
- **Cost implications** - Opus ~$15/MTok, Sonnet ~$3/MTok, Haiku ~$1/MTok
- **Whether the task requires your level of reasoning capability**
- **Confidence in the worker completing successfully**

**Default to Sonnet unless you have specific reasons for Opus or Haiku.**

### Quick Reference

| Model | Cost | Use When |
|-------|------|----------|
| **Haiku** | ~$1/MTok | Simple/mechanical: format, search, list, validate |
| **Sonnet** | ~$3/MTok | Standard dev work: implement, test, debug, docs **(DEFAULT)** |
| **Opus** | ~$15/MTok | Complex reasoning: architecture, security, cross-domain |

### Decision Checklist

Before spawning each agent, ask:
1. Is this mechanical/repetitive? → **Haiku**
2. Is this standard dev work? → **Sonnet**
3. Does this need deep reasoning I would apply? → **Opus**
4. Am I choosing Opus "just to be safe"? → Probably **Sonnet**

---

## Project Overview

Birthday notification service built with TypeScript, Node.js, and RabbitMQ.

### Core Requirements (from project_data/)
- TypeScript implementation
- POST/DELETE/PUT /user endpoints
- User fields: firstName, lastName, birthday, location
- Birthday messages at 9am local time via email-service.digitalenvision.com.au
- Message format: "Hey, {full_name} it's your birthday"
- Error handling, recovery for unsent messages
- Scalability: thousands of birthdays/day
- No duplicate messages

---

## Available Agents (54 total)

### SPARC Modes
- `sparc:architect` - System architecture design
- `sparc:coder` - Implementation
- `sparc:tester` - Test creation
- `sparc:reviewer` - Code review
- `sparc:debugger` - Debugging
- `sparc:optimizer` - Performance optimization
- `sparc:documenter` - Documentation
- `sparc:researcher` - Research tasks
- `sparc:analyzer` - Code analysis
- `sparc:designer` - UI/UX design
- `sparc:innovator` - Creative solutions
- `sparc:tdd` - Test-driven development
- `sparc:memory-manager` - Memory operations
- `sparc:batch-executor` - Batch operations
- `sparc:swarm-coordinator` - Swarm coordination
- `sparc:workflow-manager` - Workflow management

### Coordination
- `coordination:init` - Initialize coordination
- `coordination:spawn` - Spawn agents
- `coordination:orchestrate` - Task orchestration
- `coordination:swarm-init` - Initialize swarm
- `coordination:agent-spawn` - Spawn specific agent
- `coordination:task-orchestrate` - Orchestrate tasks

### Workflows
- `workflows:development` - Development workflow
- `workflows:research` - Research workflow
- `workflows:workflow-create` - Create workflows
- `workflows:workflow-execute` - Execute workflows
- `workflows:workflow-export` - Export workflows

### Monitoring
- `monitoring:status` - Check status
- `monitoring:agents` - List active agents
- `monitoring:swarm-monitor` - Monitor swarm
- `monitoring:agent-metrics` - Agent metrics
- `monitoring:real-time-view` - Real-time monitoring

### Memory
- `memory:memory-search` - Search memory
- `memory:memory-persist` - Persist memory
- `memory:memory-usage` - Memory usage stats
- `memory:neural` - Neural patterns

### Optimization
- `optimization:auto-topology` - Auto topology selection
- `optimization:parallel-execution` - Parallel execution
- `optimization:parallel-execute` - Execute in parallel
- `optimization:cache-manage` - Cache management
- `optimization:topology-optimize` - Optimize topology

### GitHub Integration
- `github:repo-analyze` - Analyze repository
- `github:code-review` - Code review
- `github:pr-enhance` - Enhance PRs
- `github:issue-triage` - Triage issues
- `github:github-swarm` - GitHub swarm

### Analysis
- `analysis:token-usage` - Token usage analysis
- `analysis:token-efficiency` - Token efficiency

### Swarm
- `swarm:swarm` - General swarm
- `swarm:swarm-init` - Initialize swarm
- `swarm:swarm-status` - Swarm status
- `swarm:swarm-monitor` - Monitor swarm
- `swarm:swarm-background` - Background swarm
- `swarm:swarm-modes` - Swarm modes

### Hive Mind
- `hive-mind:hive-mind-init` - Initialize hive mind
- `hive-mind:hive-mind-spawn` - Spawn hive mind agents
- `hive-mind:hive-mind-status` - Hive mind status
- `hive-mind:hive-mind-metrics` - Hive mind metrics
- `hive-mind:hive-mind-memory` - Hive mind memory
- `hive-mind:hive-mind-consensus` - Consensus mechanisms

---

## Golden Rules

### 1. One Message = All Operations
Spawn all agents in a SINGLE message for maximum parallelism:
```javascript
// GOOD - all in one message
Task(model='sonnet', prompt='Implement feature A')
Task(model='sonnet', prompt='Implement feature B')
Task(model='haiku', prompt='Format code')

// BAD - sequential messages
Task(...) // message 1
// wait
Task(...) // message 2
```

### 2. You Decide the Model
No algorithm overrides your choice. Use your judgment.

### 3. Default to Sonnet
Unless you have a specific reason for Opus or Haiku, use Sonnet.

### 4. Cost Awareness
Opus is ~15x more expensive than Haiku. Use it when the task genuinely needs it.

---

## Directory Structure

```
src/
├── api/          # REST endpoints
├── services/     # Business logic
├── workers/      # Background workers
├── models/       # Data models
└── utils/        # Utilities

tests/
├── unit/         # Unit tests
├── integration/  # Integration tests
└── e2e/          # End-to-end tests

docs/
├── vendor-specs/ # External API specs
├── RUNBOOK.md    # Operations guide
└── METRICS.md    # Metrics documentation

plan/
├── 01-requirements/
├── 02-architecture/
├── 03-research/
├── 04-testing/
├── 05-implementation/
└── 09-reports/
```

---

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.x
- **Framework**: Express.js
- **Queue**: RabbitMQ
- **Database**: PostgreSQL
- **Cache**: Redis
- **Testing**: Jest
- **Container**: Docker
