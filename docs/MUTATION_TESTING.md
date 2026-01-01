# Mutation Testing Guide

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Reports](#reports)
5. [CI/CD Integration](#cicd-integration)
6. [Incremental Mode](#incremental-mode)
7. [Interpreting Results](#interpreting-results)
8. [Performance Tips](#performance-tips)
9. [Troubleshooting](#troubleshooting)
10. [Resources](#resources)

---

This document describes the mutation testing setup for the Birthday Message Scheduler project using [Stryker Mutator](https://stryker-mutator.io/).

## Overview

Mutation testing is a technique that evaluates the quality of your test suite by introducing small changes (mutations) to your source code and checking whether your tests detect them. A high mutation score indicates that your tests are effective at catching bugs.

## Quick Start

```bash

# Run mutation testing (full run)

npm run test:mutation

# Run mutation testing with incremental mode (faster for subsequent runs)

npm run test:mutation:incremental
```

## Configuration

The Stryker configuration is located in `stryker.config.mjs`. Key settings:

### Source Files

Files included for mutation:
- `src/**/*.ts` - All TypeScript source files

Files excluded from mutation:
- `src/**/*.d.ts` - Type declaration files
- `src/**/*.test.ts` - Test files
- `src/**/*.spec.ts` - Spec files
- `src/index.ts` - Application entry point
- `src/worker.ts` - Worker entry point
- `src/scheduler.ts` - Scheduler entry point
- `src/clients/generated/**/*.ts` - Auto-generated OpenAPI client code
- `src/db/migrate.ts` - Database migration script
- `src/db/seed.ts` - Database seeding script

### Test Runner

Uses Vitest as the test runner with the unit test configuration (`vitest.config.unit.ts`).

### Thresholds

| Threshold | Score | Description |
|-----------|-------|-------------|
| High      | 80%   | Excellent test quality |
| Low       | 60%   | Acceptable, but improvement needed |
| Break     | 50%   | CI pipeline fails below this score |

### Enabled Mutators

Stryker applies the following mutation types appropriate for TypeScript:

| Mutator | Description | Example |
|---------|-------------|---------|
| ArithmeticOperator | Arithmetic operations | `a + b` -> `a - b` |
| ArrayDeclaration | Array declarations | `[]` -> `["Stryker"]` |
| ArrowFunction | Arrow functions | `() => x` -> `() => undefined` |
| AssignmentOperator | Assignment operators | `a += b` -> `a -= b` |
| BlockStatement | Block contents | Removes block contents |
| BooleanLiteral | Boolean values | `true` -> `false` |
| ConditionalExpression | Ternary operators | `a ? b : c` -> `a ? c : b` |
| EqualityOperator | Equality checks | `===` -> `!==` |
| LogicalOperator | Logical operators | `&&` -> `\|\|` |
| MethodExpression | Array methods | `.filter()` -> `.slice()` |
| ObjectLiteral | Object declarations | `{}` mutations |
| OptionalChaining | Optional chaining | `?.` mutations |
| RegexMutator | Regular expressions | Pattern mutations |
| UnaryOperator | Unary operators | `!a` -> `a` |
| UpdateOperator | Update operators | `++` -> `--` |

### Excluded Mutators

- `StringLiteral` - String mutations often produce equivalent mutants

## Reports

### HTML Report

After running mutation tests, view the HTML report at:
```
reports/mutation/mutation-report.html
```

### JSON Report

Machine-readable JSON report at:
```
reports/mutation/mutation-report.json
```

## CI/CD Integration

Mutation testing runs automatically on:
- Pull requests
- Pushes to `main` and `develop` branches

### GitHub Actions Workflow

The workflow (`.github/workflows/mutation.yml`):
1. Runs unit tests first to ensure they pass
2. Executes mutation testing with incremental mode
3. Uploads mutation reports as artifacts
4. Comments mutation score on PRs
5. Fails if score drops below 50%

### PR Comments

The workflow automatically comments mutation testing results on PRs:
- Mutation score percentage
- Killed/Survived/Timeout/No Coverage counts
- Pass/Warn/Fail status based on thresholds

## Incremental Mode

Incremental mode is now **enabled by default** in `stryker.config.mjs` (`incremental: true`). Results are stored in `.stryker-tmp/incremental.json` and only re-test:
- Changed source files
- Changed test files
- Previously survived mutants

This significantly speeds up subsequent runs.

## Interpreting Results

### Mutation States

| State | Meaning |
|-------|---------|
| Killed | Test detected the mutation (good) |
| Survived | Mutation went undetected (test gap) |
| Timeout | Test took too long (often infinite loop) |
| No Coverage | Code not covered by any test |
| Error | Mutation caused compilation/runtime error |

### Improving Mutation Score

1. **Survived Mutants**: Add tests that would fail if the mutation was real
2. **No Coverage**: Add tests for uncovered code paths
3. **Focus on Business Logic**: Prioritize testing critical paths

### Example: Fixing a Survived Mutant

If Stryker reports a survived mutant like:
```
Mutant survived: ArithmeticOperator
  src/services/scheduler.service.ts:42:15
  - return count + 1
  + return count - 1
```

Add or improve a test:
```typescript
it('should increment count correctly', () => {
  const result = calculateCount(5);
  expect(result).toBe(6); // Would fail if mutation survived
});
```

## Performance Tips

1. **Use Incremental Mode**: For development, use `npm run test:mutation:incremental`
2. **Limit Scope**: During development, temporarily limit `mutate` patterns
3. **Parallel Execution**: Stryker runs with concurrency (default: 4)
4. **Coverage Analysis**: Uses `perTest` coverage for smarter test selection

## Troubleshooting

### Slow Performance

```javascript
// In stryker.config.mjs, increase concurrency
concurrency: 8,

// Or limit files during development
mutate: ['src/services/specific-service.ts'],
```

### Out of Memory

```bash

# Increase Node.js memory

NODE_OPTIONS="--max-old-space-size=4096" npm run test:mutation
```

### Tests Timing Out

```javascript
// In stryker.config.mjs
timeoutMS: 120000,  // Increase timeout
timeoutFactor: 3,   // Multiplier for slow tests
```

## Resources

- [Stryker Documentation](https://stryker-mutator.io/docs/)
- [Vitest Runner Plugin](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)
- [Mutation Testing Theory](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/)
