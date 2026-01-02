# Agent Lifecycle Test Suite

Complete test suite for validating agent lifecycle management, protection mechanisms, cleanup processes, and safety protocols in the happy-bday-app hive-mind system.

## Overview

The Agent Lifecycle Test Suite (`tests/agent-lifecycle.test.sh`) provides comprehensive validation of:

- **Protection Mechanisms**: Ensuring permanent agents (queen + 8 workers) are never deleted
- **Cleanup Operations**: Verifying TTL-based and idle timeout cleanup works correctly
- **Integration Points**: Testing migration compatibility and lifecycle metadata handling
- **Safety Guarantees**: Validating rollback, corruption handling, and multi-instance safety

## Quick Start

### Run All Tests
```bash
bash tests/agent-lifecycle.test.sh
```

### Run Quick Test Suite (Faster)
```bash
bash tests/agent-lifecycle.test.sh --quick
```

### Run with Verbose Output
```bash
bash tests/agent-lifecycle.test.sh --verbose
```

### Run Specific Tests by Pattern
```bash
bash tests/agent-lifecycle.test.sh --filter "Cleanup"
bash tests/agent-lifecycle.test.sh --filter "Protection"
bash tests/agent-lifecycle.test.sh --filter "Safety"
```

## Test Structure

### Test Categories

#### 1. Protection Tests (4 tests)
Validates that permanent agents are never accidentally deleted:

- **Permanent agents (9) never deleted**
  - Creates 9 permanent agents (queen + 8 workers)
  - Verifies all are marked with protected flag
  - Confirms count verification works

- **Protected flag prevents deletion**
  - Tests that protected agents cannot be deleted
  - Tests that unprotected agents can be deleted
  - Verifies flag-based protection mechanism

- **Database trigger blocks protected deletion**
  - Validates SQLite trigger prevents protected agent deletion
  - Tests ABORT mechanism on delete attempts
  - Confirms trigger enforcement

- **Count verification works (9 permanent agents)**
  - Verifies count of permanent agents
  - Checks count among mixed protected/unprotected agents
  - Validates query accuracy

#### 2. Cleanup Tests (4 tests)
Validates cleanup processes work correctly without affecting active agents:

- **TTL-based cleanup (expired agents removed)**
  - Tests cleanup of agents exceeding TTL
  - Verifies fresh agents are NOT cleaned
  - Validates timestamp-based cleanup logic

- **Cleanup trigger matching works**
  - Tests cascading cleanup of task assignments
  - Verifies orphaned data removal
  - Validates trigger matching behavior

- **Idle timeout cleanup (>1 hour idle)**
  - Tests cleanup of idle agents (>1 hour)
  - Verifies recently active agents remain
  - Validates idle timeout threshold

- **Active/spawned agents NOT deleted**
  - Tests that 'busy' agents are NOT cleaned up
  - Tests that 'spawned' agents are NOT cleaned up
  - Tests that only 'idle' agents are cleaned
  - Validates selective cleanup by status

#### 3. Integration Tests (4 tests)
Validates integration with migration and cleanup systems:

- **Migration script compatibility**
  - Verifies database schema is created correctly
  - Checks for required tables (agents, tasks, task_assignments)
  - Validates protected column exists and is usable
  - Tests migration script creates proper indexes

- **Lifecycle metadata added to agents**
  - Tests agents can store lifecycle metadata as JSON
  - Verifies metadata structure
  - Validates nested objects in metadata
  - Tests TTL and expiration fields

- **Cleanup hooks integration**
  - Tests cleanup hook execution flow
  - Verifies permanent agents untouched during cleanup
  - Validates old temporary agents cleaned
  - Tests new temporary agents protected

- **Dry-run mode works**
  - Tests cleanup can count what would be deleted
  - Verifies dry-run doesn't actually delete agents
  - Validates non-destructive validation flow

#### 4. Safety Tests (3 tests)
Validates recovery and safety mechanisms:

- **Rollback on permanent agent loss**
  - Tests deletion prevention for protected agents
  - Verifies permanent agent count unchanged
  - Validates automatic protection mechanism

- **Cleanup with corrupted metadata**
  - Tests cleanup handles invalid JSON gracefully
  - Verifies process doesn't crash on corruption
  - Validates error resilience

- **Multi-instance safety**
  - Tests multiple instances can track agents
  - Verifies instance sessions are maintained
  - Validates agent isolation between instances

#### 5. Edge Case Tests (3 tests, full mode only)
Additional edge case scenarios:

- **Empty database**
  - Tests operations on empty database
  - Verifies graceful handling

- **Many agents (100+)**
  - Tests bulk cleanup with 100 agents
  - Verifies protected agents untouched
  - Tests cleanup of large sets

- **Concurrent operations**
  - Tests simultaneous updates and deletes
  - Verifies transaction handling
  - Validates data consistency

## Database Schema

The test suite creates a SQLite database with the following schema:

```sql
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL,
    name TEXT,
    type TEXT,
    role TEXT,
    metadata TEXT,
    status TEXT DEFAULT 'idle',
    protected INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
    last_active TEXT
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    swarm_id TEXT NOT NULL,
    agent_id TEXT,
    name TEXT,
    metadata TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE task_assignments (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    assigned_at TEXT,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE instance_sessions (
    instance_id TEXT PRIMARY KEY,
    session_id TEXT,
    pid INTEGER,
    status TEXT DEFAULT 'active',
    last_seen TEXT
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    swarm_id TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT
);
```

### Key Triggers

**prevent_protected_agent_deletion**: BEFORE DELETE trigger that prevents deletion of protected agents:
```sql
CREATE TRIGGER prevent_protected_agent_deletion
BEFORE DELETE ON agents
FOR EACH ROW
WHEN (OLD.protected = 1)
BEGIN
    SELECT RAISE(ABORT, 'Cannot delete protected agent');
END;
```

**cleanup_expired_agents**: AFTER UPDATE trigger that cascades cleanup of task assignments:
```sql
CREATE TRIGGER cleanup_expired_agents
AFTER UPDATE ON agents
FOR EACH ROW
WHEN (NEW.status = 'terminated' AND NEW.protected = 0)
BEGIN
    DELETE FROM task_assignments WHERE agent_id = NEW.id;
END;
```

## Test Output

### Summary Output
```
================================
Agent Lifecycle Test Suite
================================

Mode: Full Suite
Verbose: false
Start Time: 2026-01-02 11:23:35

[Tests run with color-coded output...]

================================
Test Execution Complete
================================

Total Tests:    18
Passed:        18
Failed:        0
Success Rate:  100.0%

================================
ALL TESTS PASSED
================================
```

### Detailed Report
A markdown report is generated for each test run:
```
tests/results/lifecycle/test-report-YYYYMMDD-HHMMSS.md
```

Report includes:
- Executive summary with pass/fail counts
- Test results table
- Category-wise breakdown
- Database schema validation
- Recommendations for production

## Test Options

### Flags

- `--verbose`: Show detailed test output and debug information
- `--quick`: Run abbreviated test suite (skips full mode, edge cases)
- `--filter PATTERN`: Only run tests matching regex pattern

### Examples

```bash
# Run only cleanup-related tests
bash tests/agent-lifecycle.test.sh --filter "Cleanup"

# Run full suite with verbose output
bash tests/agent-lifecycle.test.sh --verbose

# Quick mode for CI/CD
bash tests/agent-lifecycle.test.sh --quick
```

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

## Implementation Details

### Test Framework

The suite uses pure bash with:
- Assertion helpers (`assert_equals`, `assert_not_empty`, `assert_exists`)
- Database helpers (`db_init`, `db_exec`, `db_query`, `db_count`)
- Test runner with timing and result tracking
- Colored output for easy reading
- Comprehensive reporting

### Database Management

Each test:
1. Gets a fresh database instance (per-test isolation)
2. Runs test logic in a subshell
3. Cleans up database after completion

This ensures:
- Test independence (no test affects another)
- Reproducible results
- Clean database state

### Assertions

**assert_equals**: Compares two values (with whitespace trimming)
```bash
assert_equals "expected" "actual" "Error message"
```

**assert_not_empty**: Checks value is not empty
```bash
assert_not_empty "$value" "Value must not be empty"
```

**assert_exists**: Checks file/directory exists
```bash
assert_exists "/path/to/file" "File must exist"
```

**assert_not_exists**: Checks file/directory doesn't exist
```bash
assert_not_exists "/path/to/file" "File must not exist"
```

## Production Checklist

Before deploying agent lifecycle features to production:

- [ ] **Database Migration**: Verify `protected` column exists in agents table
- [ ] **Trigger Setup**: Confirm prevention trigger is installed
- [ ] **Permanent Agent Registration**: Mark queen and 8 workers with `protected = 1`
- [ ] **TTL Configuration**: Set appropriate cleanup thresholds
- [ ] **Monitoring**: Enable metrics tracking for protected vs temporary agents
- [ ] **Backup Strategy**: Verify backup includes agent metadata
- [ ] **Rollback Plan**: Document recovery procedure for agent loss
- [ ] **Load Testing**: Run full test suite under production load

## Troubleshooting

### Test Database Not Found
```
Error: unable to open database
```
**Solution**: Ensure `.test-hive` directory is writable:
```bash
mkdir -p .test-hive
chmod 755 .test-hive
```

### Assertion Failures
Enable verbose mode to see detailed output:
```bash
bash tests/agent-lifecycle.test.sh --verbose
```

### Specific Test Failures
Use filter to isolate the test:
```bash
bash tests/agent-lifecycle.test.sh --filter "test_name" --verbose
```

## Performance

- Full suite: ~5-10 seconds on modern hardware
- Quick mode: ~2-3 seconds
- Individual test: <1 second (most)

Times vary based on:
- System load
- Database size (edge case tests with 100+ agents slower)
- I/O performance

## Contributing

To add new tests:

1. Create test function: `test_my_new_test() { ... }`
2. Add assertion checks
3. Call with: `run_test "Test Name" "test_my_new_test"`
4. Update this documentation
5. Verify with: `bash tests/agent-lifecycle.test.sh`

## Related Files

- **Schema**: `/src/db/schema/`
- **Migrations**: `/src/db/migrations/`
- **Cleanup Hook**: `/.claude/hooks/agent-lifecycle-cleanup.sh`
- **Task Tracker**: `/.claude/hooks/task-agent-tracker.sh`
- **Test Results**: `/tests/results/lifecycle/`

## License

Same as happy-bday-app project
