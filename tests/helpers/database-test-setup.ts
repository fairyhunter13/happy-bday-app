/**
 * Database Test Setup Helper
 * DRY: Eliminates duplicated test container setup across repository tests
 *
 * Usage:
 * ```typescript
 * import { setupDatabaseTest, teardownDatabaseTest, cleanupBetweenTests } from '../../helpers/database-test-setup';
 *
 * describe('MyRepository', () => {
 *   let context: DatabaseTestContext<MyRepository>;
 *
 *   beforeAll(async () => {
 *     context = await setupDatabaseTest(MyRepository);
 *   });
 *
 *   afterAll(async () => {
 *     await teardownDatabaseTest(context);
 *   });
 *
 *   beforeEach(async () => {
 *     await cleanupBetweenTests(context);
 *   });
 *
 *   it('should work', async () => {
 *     const result = await context.repository.findById(1);
 *     expect(result).toBeDefined();
 *   });
 * });
 * ```
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { PostgresTestContainer, cleanDatabase } from './testcontainers.js';

const { Pool } = pg;

/**
 * Type-safe test context containing all necessary test resources
 */
export interface DatabaseTestContext<T = unknown> {
  testContainer: PostgresTestContainer;
  pool: pg.Pool;
  db: ReturnType<typeof drizzle>;
  repository: T;
}

/**
 * Configuration options for database test setup
 */
export interface DatabaseTestSetupOptions {
  migrationsFolder?: string;
  skipMigrations?: boolean;
}

/**
 * Setup a database test environment with the specified repository
 *
 * @param RepositoryClass - The repository class to instantiate
 * @param options - Optional configuration
 * @returns DatabaseTestContext with initialized repository
 *
 * @example
 * ```typescript
 * const context = await setupDatabaseTest(UserRepository);
 * const user = await context.repository.findById(1);
 * ```
 */
export async function setupDatabaseTest<T>(
  RepositoryClass: new (db: ReturnType<typeof drizzle>) => T,
  options: DatabaseTestSetupOptions = {}
): Promise<DatabaseTestContext<T>> {
  const { migrationsFolder = './drizzle', skipMigrations = false } = options;

  const testContainer = new PostgresTestContainer();
  const { connectionString, pool } = await testContainer.start();

  if (!skipMigrations) {
    await testContainer.runMigrations(migrationsFolder);
  }

  const db = drizzle(pool);
  const repository = new RepositoryClass(db);

  return {
    testContainer,
    pool,
    db,
    repository,
  };
}

/**
 * Setup a database test environment without a repository
 * Useful for testing services that need direct database access
 *
 * @param options - Optional configuration
 * @returns DatabaseTestContext without repository
 */
export async function setupDatabaseTestWithoutRepository(
  options: DatabaseTestSetupOptions = {}
): Promise<Omit<DatabaseTestContext, 'repository'>> {
  const { migrationsFolder = './drizzle', skipMigrations = false } = options;

  const testContainer = new PostgresTestContainer();
  const { connectionString, pool } = await testContainer.start();

  if (!skipMigrations) {
    await testContainer.runMigrations(migrationsFolder);
  }

  const db = drizzle(pool);

  return {
    testContainer,
    pool,
    db,
  };
}

/**
 * Teardown a database test environment
 *
 * @param context - The test context to teardown
 *
 * @example
 * ```typescript
 * afterAll(async () => {
 *   await teardownDatabaseTest(context);
 * });
 * ```
 */
export async function teardownDatabaseTest<T>(context: DatabaseTestContext<T>): Promise<void> {
  if (context.pool) {
    await context.pool.end();
  }
  if (context.testContainer) {
    await context.testContainer.stop();
  }
}

/**
 * Clean up database between tests
 * Truncates all tables to ensure test isolation
 *
 * @param context - The test context
 *
 * @example
 * ```typescript
 * beforeEach(async () => {
 *   await cleanupBetweenTests(context);
 * });
 * ```
 */
export async function cleanupBetweenTests<T>(context: DatabaseTestContext<T>): Promise<void> {
  await cleanDatabase(context.pool);
}

/**
 * Create multiple repositories for the same test context
 * Useful when testing interactions between repositories
 *
 * @param context - The base test context
 * @param RepositoryClass - Additional repository class
 * @returns Instance of the additional repository
 *
 * @example
 * ```typescript
 * const context = await setupDatabaseTest(UserRepository);
 * const messageLogRepo = createAdditionalRepository(context, MessageLogRepository);
 * ```
 */
export function createAdditionalRepository<T, R>(
  context: DatabaseTestContext<T>,
  RepositoryClass: new (db: ReturnType<typeof drizzle>) => R
): R {
  return new RepositoryClass(context.db);
}
