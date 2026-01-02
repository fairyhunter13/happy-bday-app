# Vitest Process Management

## Problem Summary

Vitest test processes were accumulating and not terminating properly, causing:
- High memory usage (1GB+ per orphaned process)
- High CPU usage (97-101% per process)
- System crashes when multiple orphaned processes accumulated
- Device becoming unresponsive

## Root Cause

1. **Pre-push git hook** runs `npm run test:unit` before every push
2. Vitest spawns **multiple worker threads** (configured for parallel execution)
3. When git push is interrupted (CTRL+C, memory kill, etc.), the **parent vitest process dies but worker processes don't**
4. These **orphaned worker processes** continue running indefinitely at 100% CPU

## Implemented Solutions

### 1. Pre-Push Hook with Cleanup (`.husky/pre-push`)

**Changes:**
- Added cleanup trap to kill all vitest processes on exit/interruption
- Changed to single-fork mode (`--pool=forks --poolOptions.forks.singleFork=true`)
- Disabled coverage collection in pre-push (use `--no-coverage`)
- Added `--bail=5` to stop after 5 failures for faster feedback

**Benefits:**
- Processes terminate cleanly even if interrupted
- Uses single process (no parallel workers = no orphans)
- Faster test runs for pre-push checks
- Explicit cleanup before and after tests

### 2. Reduced Thread Count (`vitest.config.base.ts`)

**Changes:**
- Reduced `maxThreads` from 5 → 3
- Reduced `maxForks` from unlimited → 3
- Added forks pool configuration

**Benefits:**
- Lower memory footprint during normal test runs
- Fewer processes to manage
- Still allows parallelization when needed
- CI can override with more threads if needed

### 3. Cleanup Script (`scripts/cleanup-vitest-processes.sh`)

**Purpose:**
Kill any orphaned vitest processes manually or via automation.

**Usage:**
```bash
# Dry run (see what would be killed)
./scripts/cleanup-vitest-processes.sh --dry-run

# Interactive (asks for confirmation)
./scripts/cleanup-vitest-processes.sh

# Force cleanup (no confirmation)
./scripts/cleanup-vitest-processes.sh --force
```

**Automation (Optional):**
Add to crontab to run daily:
```bash
# Edit crontab
crontab -e

# Add this line (runs daily at midnight)
0 0 * * * /path/to/happy-bday-app/scripts/cleanup-vitest-processes.sh --force
```

## Monitoring Vitest Processes

### Check for orphaned processes:

**macOS (Activity Monitor):**
1. Open Activity Monitor
2. Search for "vitest"
3. Look for multiple `node (vitest X)` processes
4. Check memory usage (orphans typically use 1GB+)

**Command line:**
```bash
# List all vitest processes
ps aux | grep vitest | grep -v grep

# Count vitest processes
ps aux | grep -E "vitest" | grep -v grep | wc -l

# Show memory usage
ps aux | grep -E "vitest" | grep -v grep | awk '{print $4}' | awk '{sum+=$1} END {print "Total: " sum "%"}'
```

### Manual cleanup:
```bash
# Kill all vitest processes immediately
pkill -f "vitest"

# Force kill if regular kill doesn't work
pkill -9 -f "vitest"

# Use the cleanup script
./scripts/cleanup-vitest-processes.sh --force
```

## Test Configuration Options

### When to use different modes:

**Single-Fork (Pre-push, Local Quick Tests):**
```bash
vitest run --pool=forks --poolOptions.forks.singleFork=true --no-coverage
```
- ✅ Guaranteed clean termination
- ✅ Lower memory usage
- ✅ No orphaned processes
- ❌ Slower (sequential execution)
- Use for: Git hooks, quick local tests, debugging

**Multi-Thread (CI, Full Test Runs):**
```bash
vitest run --pool=threads --poolOptions.threads.maxThreads=3
```
- ✅ Faster parallel execution
- ✅ Better CI performance
- ❌ Risk of orphaned processes if interrupted
- ❌ Higher memory usage
- Use for: CI/CD pipelines, full test suites

**Watch Mode (Development):**
```bash
vitest watch --pool=forks --poolOptions.forks.maxForks=2
```
- ✅ Hot reload during development
- ✅ Limited forks prevent memory issues
- Use for: Active development, TDD workflow

## Troubleshooting

### Issue: Still seeing orphaned processes

**Solution 1:** Run cleanup script
```bash
./scripts/cleanup-vitest-processes.sh --force
```

**Solution 2:** Check if tests are actually running
```bash
# If you see vitest processes but no activity:
lsof -i -P | grep vitest  # Check network connections
top -pid $(pgrep -f vitest)  # Monitor resource usage
```

**Solution 3:** Force kill and restart
```bash
pkill -9 -f "vitest"
# Wait a few seconds
sleep 3
# Verify cleanup
ps aux | grep vitest | grep -v grep
```

### Issue: Pre-push hook still creates multiple processes

**Check hook configuration:**
```bash
cat .husky/pre-push
# Should have --poolOptions.forks.singleFork=true
```

**Test manually:**
```bash
npx vitest run --config vitest.config.unit.ts \
  --pool=forks \
  --poolOptions.forks.singleFork=true \
  --no-coverage
```

### Issue: System still slowing down

**Monitor system resources:**
```bash
# Check total memory usage
top -o MEM | head -20

# Check all node processes
ps aux | grep node | grep -v grep

# Check for other test processes
ps aux | grep -E "(jest|mocha|vitest|stryker)" | grep -v grep
```

**Nuclear option (kill all node processes):**
```bash
# ⚠️ WARNING: This kills ALL node processes
pkill -f "node"

# Safer: Kill only test-related processes
pkill -f "vitest"
pkill -f "stryker"
```

## Best Practices

### 1. Always use cleanup script after interrupted tests
```bash
# After CTRL+C during test run:
./scripts/cleanup-vitest-processes.sh --force
```

### 2. Monitor processes periodically
```bash
# Add to your shell rc file (.zshrc, .bashrc)
alias vitest-check='ps aux | grep vitest | grep -v grep | wc -l'
alias vitest-clean='pkill -f "vitest"'
```

### 3. Use appropriate pool mode for task
- **Pre-commit/pre-push:** `--pool=forks --poolOptions.forks.singleFork=true`
- **CI/CD:** `--pool=threads` (controlled environment)
- **Watch mode:** `--pool=forks --poolOptions.forks.maxForks=2`

### 4. Set up automated cleanup (optional)
```bash
# Add to crontab
0 */6 * * * /path/to/scripts/cleanup-vitest-processes.sh --force
```

## Configuration Reference

### Vitest Pool Options

**Threads Pool (Default):**
- Uses worker threads (share memory with parent)
- Faster but harder to kill
- Risk of orphaned processes

**Forks Pool (Recommended for hooks):**
- Uses child processes (isolated memory)
- Easier to kill and cleanup
- Better process isolation

### Pre-Push Hook Configuration

```bash
# Optimal pre-push configuration:
vitest run \
  --config vitest.config.unit.ts \
  --pool=forks \
  --poolOptions.forks.singleFork=true \
  --reporter=basic \
  --bail=5 \
  --no-coverage
```

**Flags explained:**
- `--pool=forks`: Use process forks instead of threads
- `--poolOptions.forks.singleFork=true`: Single process (no parallelization)
- `--reporter=basic`: Minimal output for speed
- `--bail=5`: Stop after 5 failures
- `--no-coverage`: Skip coverage collection (faster)

## Related Issues

- Original issue: 29 agents instead of 9
- Orphaned vitest processes consuming 1GB+ each
- System crashes due to memory pressure
- Fixed in commit: `[hash]` - fix: prevent vitest process leaks

## Additional Resources

- [Vitest Pool Options](https://vitest.dev/config/#pool)
- [Vitest CLI](https://vitest.dev/guide/cli.html)
- [Process Management on macOS](https://ss64.com/osx/pkill.html)
