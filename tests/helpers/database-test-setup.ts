/**
 * Database Test Setup Utilities
 *
 * Factory functions and setup utilities to eliminate test boilerplate.
 * Replaces 1000+ lines of duplicated setup code across 40+ test files.
 *
 * @example Basic repository test setup
 * ```typescript
 * import { setupDatabaseTest } from '../helpers/database-test-setup.js';
 * import { UserRepository } from '../../src/repositories/user.repository.js';
 *
 * const dbTest = setupDatabaseTest(() => new UserRepository(db));
 * // Use dbTest.repository, dbTest.db, etc. in your tests
 * ```
 *
 * @example Service test setup with multiple repositories
 * ```typescript
 * const dbTest = setupDatabaseTest((db) => ({
 *   userRepo: new UserRepository(db),
 *   messageRepo: new MessageRepository(db),
 *   service: new UserService(new UserRepository(db)),
 * }));
 * ```
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { PostgresTestContainer, cleanDatabase, isCI } from './testcontainers.js';

/**
 * Test context with database connection and optional repository/service instances
 */
export interface DatabaseTestContext<T = unknown> {
  testContainer: PostgresTestContainer;
  queryClient: ReturnType<typeof postgres>;
  db: PostgresJsDatabase;
  repository?: T;
  [key: string]: unknown;
}

/**
 * Options for database test setup
 */
export interface DatabaseTestOptions {
  /**
   * Migrations folder path (default: './drizzle')
   */
  migrationsFolder?: string;
  /**
   * Maximum number of connections in pool (default: 10 local, 2 CI)
   */
  maxConnections?: number;
  /**
   * Idle timeout in seconds (default: 10)
   */
  idleTimeout?: number;
  /**
   * Connect timeout in seconds (default: 10)
   */
  connectTimeout?: number;
  /**
   * Clean database before each test (default: true)
   */
  cleanBeforeEach?: boolean;
}

/**
 * Setup database test environment with automatic lifecycle management
 *
 * This factory function eliminates the need for repetitive beforeAll/afterAll/beforeEach
 * setup code across test files. It automatically:
 * - Starts PostgreSQL container (or connects to CI database)
 * - Runs migrations
 * - Creates database connection and Drizzle instance
 * - Initializes repository/service instances
 * - Cleans database before each test
 * - Tears down connections and containers after tests
 *
 * @param factory - Factory function to create repository/service instances
 * @param options - Configuration options
 * @returns Test context with database and instances
 *
 * @example Repository test
 * ```typescript
 * describe('UserRepository', () => {
 *   const dbTest = setupDatabaseTest((db) => new UserRepository(db));
 *
 *   it('should create user', async () => {
 *     const user = await dbTest.repository.create({ ... });
 *     expect(user).toBeDefined();
 *   });
 * });
 * ```
 *
 * @example Service test with multiple dependencies
 * ```typescript
 * const dbTest = setupDatabaseTest((db) => ({
 *   userRepo: new UserRepository(db),
 *   messageRepo: new MessageRepository(db),
 *   scheduler: new SchedulerService(db),
 * }));
 *
 * it('should schedule message', async () => {
 *   await dbTest.repository.scheduler.scheduleMessage(...);
 * });
 * ```
 */
export function setupDatabaseTest<T>(
  factory: (db: PostgresJsDatabase) => T,
  options: DatabaseTestOptions = {}
): DatabaseTestContext<T> {
  const {
    migrationsFolder = './drizzle',
    maxConnections = isCI() ? 2 : 10,
    idleTimeout = 10,
    connectTimeout = 10,
    cleanBeforeEach = true,
  } = options;

  const context: DatabaseTestContext<T> = {
    testContainer: null!,
    queryClient: null!,
    db: null!,
    repository: undefined,
  };

  beforeAll(async () => {
    // Start PostgreSQL container
    context.testContainer = new PostgresTestContainer();
    const result = await context.testContainer.start();

    // Run migrations
    await context.testContainer.runMigrations(migrationsFolder);

    // Create Drizzle instance
    // In CI mode, use connection string from environment
    // In local mode, use testcontainer connection string
    const connectionString = isCI()
      ? process.env.DATABASE_URL || result.connectionString
      : result.connectionString;

    // Use limited connection pool in CI to prevent exhaustion
    context.queryClient = postgres(connectionString, {
      max: maxConnections,
      idle_timeout: idleTimeout,
      connect_timeout: connectTimeout,
    });

    context.db = drizzle(context.queryClient);

    // Initialize repository/service instances using factory
    context.repository = factory(context.db);
  });

  afterAll(async () => {
    if (context.queryClient) {
      await context.queryClient.end();
    }
    if (context.testContainer) {
      await context.testContainer.stop();
    }
  });

  if (cleanBeforeEach) {
    beforeEach(async () => {
      // Clean database before each test
      await cleanDatabase(context.testContainer.getPool());
    });
  }

  return context;
}

/**
 * Setup database test with custom initialization and teardown
 *
 * Use this when you need more control over the setup/teardown process,
 * such as starting additional services or custom initialization logic.
 *
 * @param setup - Custom setup function called in beforeAll
 * @param teardown - Custom teardown function called in afterAll
 * @param options - Configuration options
 * @returns Test context with database
 *
 * @example Custom setup with additional services
 * ```typescript
 * const dbTest = setupDatabaseTestWithHooks(
 *   async (db) => {
 *     const cache = await CacheService.create();
 *     const queue = await QueueService.create();
 *     return {
 *       cache,
 *       queue,
 *       service: new MyService(db, cache, queue),
 *     };
 *   },
 *   async (context) => {
 *     await context.cache?.close();
 *     await context.queue?.close();
 *   }
 * );
 * ```
 */
export function setupDatabaseTestWithHooks<T>(
  setup: (db: PostgresJsDatabase) => Promise<T>,
  teardown?: (context: T) => Promise<void>,
  options: DatabaseTestOptions = {}
): DatabaseTestContext<T> {
  const {
    migrationsFolder = './drizzle',
    maxConnections = isCI() ? 2 : 10,
    idleTimeout = 10,
    connectTimeout = 10,
    cleanBeforeEach = true,
  } = options;

  const context: DatabaseTestContext<T> = {
    testContainer: null!,
    queryClient: null!,
    db: null!,
    repository: undefined,
  };

  beforeAll(async () => {
    // Start PostgreSQL container
    context.testContainer = new PostgresTestContainer();
    const result = await context.testContainer.start();

    // Run migrations
    await context.testContainer.runMigrations(migrationsFolder);

    // Create Drizzle instance
    const connectionString = isCI()
      ? process.env.DATABASE_URL || result.connectionString
      : result.connectionString;

    context.queryClient = postgres(connectionString, {
      max: maxConnections,
      idle_timeout: idleTimeout,
      connect_timeout: connectTimeout,
    });

    context.db = drizzle(context.queryClient);

    // Run custom setup
    context.repository = await setup(context.db);
  });

  afterAll(async () => {
    // Run custom teardown first
    if (teardown && context.repository) {
      await teardown(context.repository);
    }

    if (context.queryClient) {
      await context.queryClient.end();
    }
    if (context.testContainer) {
      await context.testContainer.stop();
    }
  });

  if (cleanBeforeEach) {
    beforeEach(async () => {
      await cleanDatabase(context.testContainer.getPool());
    });
  }

  return context;
}

/**
 * Setup minimal database test (no repository/service initialization)
 *
 * Use this when you only need a database connection without any
 * repository or service instances.
 *
 * @param options - Configuration options
 * @returns Test context with database connection only
 *
 * @example Raw database queries
 * ```typescript
 * const dbTest = setupMinimalDatabaseTest();
 *
 * it('should query database', async () => {
 *   const result = await dbTest.db.select().from(users);
 *   expect(result).toBeDefined();
 * });
 * ```
 */
export function setupMinimalDatabaseTest(
  options: DatabaseTestOptions = {}
): Omit<DatabaseTestContext, 'repository'> {
  return setupDatabaseTest(() => undefined, options);
}

/**
 * Create test data factory for common entity creation patterns
 *
 * Use this to reduce duplication in test data setup.
 *
 * @example User data factory
 * ```typescript
 * const createUser = testDataFactory({
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   email: 'john@example.com',
 *   timezone: 'America/New_York',
 * });
 *
 * const user1 = createUser(); // Uses defaults
 * const user2 = createUser({ email: 'jane@example.com' }); // Override email
 * ```
 */
export function testDataFactory<T extends Record<string, unknown>>(
  defaults: T
): (overrides?: Partial<T>) => T {
  return (overrides?: Partial<T>) => ({
    ...defaults,
    ...overrides,
  });
}

/**
 * Create unique test data by appending timestamp or counter
 *
 * Useful for generating unique emails, usernames, etc. in tests.
 *
 * @example Unique email generation
 * ```typescript
 * const email = uniqueTestData('user@example.com');
 * // => 'user-1234567890@example.com'
 * ```
 */
export function uniqueTestData(base: string, separator: string = '-'): string {
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000);
  return `${base}${separator}${timestamp}${separator}${randomSuffix}`;
}

/**
 * Create unique email for testing
 *
 * @example
 * ```typescript
 * const email = uniqueEmail('test');
 * // => 'test-1234567890-456@test.com'
 * ```
 */
export function uniqueEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${randomSuffix}@test.com`;
}

/**
 * Batch create test entities
 *
 * @example Create multiple users
 * ```typescript
 * const users = await batchCreate(
 *   5,
 *   (i) => dbTest.repository.create({
 *     email: uniqueEmail(`user${i}`),
 *     firstName: `User ${i}`,
 *   })
 * );
 * ```
 */
export async function batchCreate<T>(
  count: number,
  factory: (index: number) => Promise<T>
): Promise<T[]> {
  return Promise.all(Array.from({ length: count }, (_, i) => factory(i)));
}

/**
 * Wait for condition to be met (useful for async operations)
 *
 * @example Wait for message to be processed
 * ```typescript
 * await waitForCondition(
 *   () => dbTest.repository.findById(userId),
 *   (user) => user !== null,
 *   5000
 * );
 * ```
 */
export async function waitForCondition<T>(
  getter: () => Promise<T>,
  condition: (value: T) => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<T> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const value = await getter();
    if (condition(value)) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}
