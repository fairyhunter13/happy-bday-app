# 📋 Happy Birthday App - Planning Documentation

This directory contains all planning, architecture, research, and implementation documentation for the Happy Birthday Message Scheduler system.

---

## 📁 Directory Structure

```
plan/
├── 01-requirements/          # System requirements and specifications
├── 02-architecture/          # Architecture designs and decisions
├── 03-research/              # Research findings and analysis
├── 04-testing/               # Testing strategies and guides
├── 05-implementation/        # Implementation plans and roadmaps
└── ARCHIVE/                  # Historical summaries (for reference)
```

---

## 🚀 Quick Start Guides

### For Developers
1. **Understand the System:** [`01-requirements/system-flows.md`](./01-requirements/system-flows.md)
2. **Technical Specs:** [`01-requirements/technical-specifications.md`](./01-requirements/technical-specifications.md)
3. **Architecture:** [`02-architecture/architecture-overview.md`](./02-architecture/architecture-overview.md)
4. **Implementation Plan:** [`05-implementation/master-plan.md`](./05-implementation/master-plan.md)

### For Scale & Performance
1. **Scale Research:** [`03-research/scale-performance-1m-messages.md`](./03-research/scale-performance-1m-messages.md)
2. **High-Scale Architecture:** [`02-architecture/high-scale-design.md`](./02-architecture/high-scale-design.md)
3. **Performance Testing:** [`04-testing/performance-testing-guide.md`](./04-testing/performance-testing-guide.md)

### For DevOps/Infrastructure
1. **Docker Compose:** [`02-architecture/docker-compose.md`](./02-architecture/docker-compose.md)
2. **CI/CD Pipeline:** [`02-architecture/cicd-pipeline.md`](./02-architecture/cicd-pipeline.md)
3. **Testing Strategy:** [`04-testing/testing-strategy.md`](./04-testing/testing-strategy.md)

---

## 📖 Documentation Index

### 01. Requirements & Specifications

| Document | Description | Status |
|----------|-------------|--------|
| [`system-flows.md`](./01-requirements/system-flows.md) | System workflows and user flows | ✅ Final |
| [`technical-specifications.md`](./01-requirements/technical-specifications.md) | Detailed technical requirements | ✅ Final |

### 02. Architecture & Design

| Document | Description | Status |
|----------|-------------|--------|
| [`architecture-overview.md`](./02-architecture/architecture-overview.md) | Complete architecture overview (consolidated) | ✅ Final |
| [`high-scale-design.md`](./02-architecture/high-scale-design.md) | Architecture for 1M+ messages/day | ✅ Final |
| [`docker-compose.md`](./02-architecture/docker-compose.md) | Docker Compose setup (dev, test, prod) | ✅ Final |
| [`cicd-pipeline.md`](./02-architecture/cicd-pipeline.md) | CI/CD pipeline architecture | ✅ Final |

### 03. Research & Analysis

| Document | Description | Status |
|----------|-------------|--------|
| [`distributed-coordination.md`](./03-research/distributed-coordination.md) | Redis vs Redpanda vs etcd research | ✅ Final |
| [`scale-performance-1m-messages.md`](./03-research/scale-performance-1m-messages.md) | Scaling to 1M+ messages/day | ✅ Final |
| [`performance-consistency-analysis.md`](./03-research/performance-consistency-analysis.md) | Performance bottleneck analysis | ✅ Final |

### 04. Testing Strategies

| Document | Description | Status |
|----------|-------------|--------|
| [`testing-strategy.md`](./04-testing/testing-strategy.md) | Complete testing strategy (consolidated) | ✅ Final |
| [`performance-testing-guide.md`](./04-testing/performance-testing-guide.md) | k6 load testing and benchmarks | ✅ Final |

### 05. Implementation

| Document | Description | Status |
|----------|-------------|--------|
| [`master-plan.md`](./05-implementation/master-plan.md) | Master implementation roadmap | ✅ Final |

### ARCHIVE (Historical Reference)

| Document | Description |
|----------|-------------|
| `hive-mind-summaries/` | AI collaboration summaries |
| `analysis-summaries/` | Various analysis summaries |
| `index-files/` | Old navigation indexes |

---

## 🎯 Key Decisions & Recommendations

### Scale: 1M+ Messages/Day

**Critical Insight:** 1M messages/day = only **11.5 msg/sec sustained**, **100 msg/sec peak**

**Recommendation:**
- **Use RabbitMQ (Quorum Queues)** for zero data loss
- **Critical:** BullMQ has data loss risk (up to 1 second of jobs lost on Redis crash)
- **Worth the cost:** +$556/month prevents customer churn from missed birthdays

### Abstraction: Multiple Message Types

**Strategy Pattern** enables adding new message types (birthday, anniversary, etc.) with:
- 1 new TypeScript file (~50 lines)
- 1 line to register strategy
- 1 database migration (add column)
- **Zero changes to core workers/schedulers**

### Critical Components

1. **Database Partitioning** (mandatory for 1M+ scale)
   - Monthly partitions on `message_logs`
   - 10-100x query performance improvement

2. **Horizontal Worker Scaling**
   - Baseline: 10 workers (100 msg/sec capacity)
   - Auto-scale to 30 workers (300 msg/sec capacity)

3. **CI/CD Setup**
   - Simple E2E tests in GitHub Actions (4 containers, <5 min)
   - Scalable performance tests (24 containers, k6 load testing)

---

## 📊 System Overview

### Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                  Nginx Load Balancer                     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│            API Servers (5 replicas)                      │
│  POST /user  |  DELETE /user  |  PUT /user              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│         PostgreSQL (Primary + Read Replica)              │
│  Partitioned by month | Connection pool: 360             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│         RabbitMQ (Quorum Queues + DLQ)                   │
│  10K msg/sec | Zero data loss | Native persistence      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│         Workers (10 baseline, 30 max)                    │
│  Strategy pattern | Generic handlers                     │
└──────────────────────────────────────────────────────────┘
```

### Tech Stack

- **API:** Fastify + TypeScript
- **Database:** PostgreSQL 15 + Drizzle ORM
- **Queue:** RabbitMQ (Quorum Queues for zero data loss)
- **Workers:** Node.js with Strategy pattern
- **Testing:** Vitest (unit/integration) + k6 (performance)
- **CI/CD:** GitHub Actions + Docker Compose
- **Monitoring:** Prometheus + Grafana

---

## 🏃 Implementation Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1** | Week 1-2 | Message type abstraction (Strategy pattern) |
| **Phase 2** | Week 3 | Database schema migration (multi-type support) |
| **Phase 3** | Week 4 | Add Anniversary support (prove extensibility) |
| **Phase 4** | Week 5-6 | Database partitioning (1M+ scale) |
| **Phase 5** | Week 7-8 | Queue optimization (RabbitMQ configuration and monitoring) |
| **Phase 6** | Week 9-10 | Production deployment (monitoring + load testing) |

---

## 📝 Document Changelog

### 2025-12-30 - Documentation Reorganization
- Consolidated 32 markdown files into organized structure
- Removed duplicates and summaries
- Created clear navigation and quick start guides
- Archived historical AI collaboration summaries

---

## 🤝 Contributing

When adding new documentation:
1. Place it in the appropriate directory (01-05)
2. Update this README with links
3. Use clear, descriptive filenames
4. Include table of contents for long documents

---

## 📞 Questions?

Refer to:
- **System Design:** [`02-architecture/architecture-overview.md`](./02-architecture/architecture-overview.md)
- **Implementation:** [`05-implementation/master-plan.md`](./05-implementation/master-plan.md)
- **Testing:** [`04-testing/testing-strategy.md`](./04-testing/testing-strategy.md)
