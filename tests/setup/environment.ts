/**
 * Test Environment Setup
 *
 * Global setup for all tests to ensure consistent, deterministic behavior:
 * - Enforce UTC timezone for all date operations
 * - Set consistent environment variables
 * - Provide global test utilities
 *
 * This file is loaded before all tests via vitest setupFiles configuration.
 */

/**
 * CRITICAL: Enforce UTC timezone for all tests
 *
 * Many tests depend on date/time calculations. To prevent flakiness from
 * timezone differences between local development and CI:
 * - All tests run in UTC timezone
 * - DateTime operations use UTC explicitly
 * - Database stores timestamps in UTC
 *
 * This prevents race conditions where:
 * - Test creates message for "9am today" in local timezone (PST)
 * - Scheduler processes it at "9am UTC" (different time)
 * - Tests fail because of timezone mismatch
 */
process.env.TZ = 'UTC';

// Verify timezone is set correctly
if (new Date().getTimezoneOffset() !== 0) {
  console.warn(
    `⚠️  WARNING: Timezone offset is ${new Date().getTimezoneOffset()} minutes. Expected 0 (UTC).`
  );
  console.warn(`   Tests may be flaky. Ensure TZ=UTC is set before starting test process.`);
}

/**
 * Set consistent NODE_ENV for all tests
 */
process.env.NODE_ENV = 'test';

/**
 * Log test environment information
 */
console.log('🧪 Test Environment Setup:');
console.log(`   - Timezone: ${process.env.TZ} (offset: ${new Date().getTimezoneOffset()} min)`);
console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   - CI: ${process.env.CI || 'false'}`);
console.log(`   - Platform: ${process.platform} (${process.arch})`);

/**
 * Increase timeout for CI environments
 * CI environments are often slower due to resource constraints
 */
if (process.env.CI === 'true') {
  console.log('   - CI detected: Using increased timeouts');
}

/**
 * Export for verification in tests
 */
export const testEnvironment = {
  timezone: process.env.TZ,
  nodeEnv: process.env.NODE_ENV,
  isCI: process.env.CI === 'true',
  platform: process.platform,
};
