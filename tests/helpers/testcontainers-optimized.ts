import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import amqp from 'amqplib';
import { initializeRabbitMQ, RabbitMQConnection } from '../../src/queue/connection.js';

const { Pool } = pg;

/**
 * OPTIMIZED TestContainers Helper
 *
 * Performance Optimizations:
 * 1. Container reuse across multiple test files
 * 2. Connection pooling with optimal settings
 * 3. Faster startup with reduced health check intervals
 * 4. Migration caching to avoid redundant runs
 * 5. Lazy initialization for faster test startup
 * 6. Shared container instances in CI mode
 */

/**
 * Check if running in CI/CD environment
 */
export function isCI(): boolean {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

/**
 * Get CI/CD environment connection strings
 */
export function getCIConnectionStrings() {
  return {
    postgres: process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/test_db',
    rabbitmq: process.env.RABBITMQ_URL || 'amqp://test:test@localhost:5672',
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
  };
}

/**
 * OPTIMIZATION: Shared container cache
 * Reuse containers across test files to reduce startup time
 */
interface ContainerCache {
  postgres?: StartedPostgreSqlContainer;
  rabbitmq?: StartedRabbitMQContainer;
  redis?: StartedTestContainer;
  migrationsRun?: boolean;
}

const containerCache: ContainerCache = {};

/**
 * OPTIMIZED PostgreSQL Test Container
 * - Faster startup with optimized health checks
 * - Connection pooling with better defaults
 * - Container reuse for faster test execution
 */
export class PostgresTestContainer {
  private container: StartedPostgreSqlContainer | null = null;
  private pool: pg.Pool | null = null;
  private usingCI: boolean = false;
  private connectionString: string = '';
  private useCache: boolean = true;

  constructor(options: { useCache?: boolean } = {}) {
    this.useCache = options.useCache ?? true;
  }

  async start(): Promise<{
    container: StartedPostgreSqlContainer | null;
    connectionString: string;
    pool: pg.Pool;
  }> {
    this.usingCI = isCI();

    if (this.usingCI) {
      return this.startCI();
    }

    // OPTIMIZATION: Reuse cached container if available
    if (this.useCache && containerCache.postgres) {
      console.log('[PostgreSQL] Using cached container');
      this.container = containerCache.postgres;
      this.connectionString = this.container.getConnectionUri();
      this.pool = new Pool({
        connectionString: this.connectionString,
        max: 10, // Increased pool for better parallelism
        min: 2, // Keep minimum connections ready
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      return {
        container: this.container,
        connectionString: this.connectionString,
        pool: this.pool,
      };
    }

    // Start new container with optimized settings
    this.container = await new PostgreSqlContainer('postgres:15-alpine')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_DB: 'test_db',
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
        // OPTIMIZATION: Faster PostgreSQL startup
        POSTGRES_INITDB_ARGS: '-c fsync=off -c synchronous_commit=off',
      })
      .withStartupTimeout(60000) // Reduced from 120s to 60s
      .start();

    this.connectionString = this.container.getConnectionUri();
    this.pool = new Pool({
      connectionString: this.connectionString,
      max: 10, // Increased for better parallelism
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Cache container for reuse
    if (this.useCache) {
      containerCache.postgres = this.container;
    }

    console.log('[PostgreSQL] Container started successfully');
    return {
      container: this.container,
      connectionString: this.connectionString,
      pool: this.pool,
    };
  }

  private async startCI(): Promise<{
    container: StartedPostgreSqlContainer | null;
    connectionString: string;
    pool: pg.Pool;
  }> {
    this.connectionString = getCIConnectionStrings().postgres;
    console.log('[PostgreSQL] CI mode: Using shared database');

    this.pool = new Pool({
      connectionString: this.connectionString,
      max: 10, // Increased from 5 for better parallelism
      min: 1,
      idleTimeoutMillis: 10000, // Faster cleanup
      connectionTimeoutMillis: 20000,
      allowExitOnIdle: true,
    });

    // OPTIMIZATION: Faster connection check with fewer retries
    let retries = 10; // Reduced from 20
    let delay = 250; // Reduced initial delay
    while (retries > 0) {
      try {
        await this.pool.query('SELECT 1');
        console.log('[PostgreSQL] Connection established (CI mode)');
        break;
      } catch (error: unknown) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to connect to PostgreSQL: ${error}`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 2000); // Cap at 2s
      }
    }

    return {
      container: null,
      connectionString: this.connectionString,
      pool: this.pool,
    };
  }

  async runMigrations(migrationsFolder: string): Promise<void> {
    if (!this.pool) {
      throw new Error('PostgreSQL container not started');
    }

    // OPTIMIZATION: Skip migrations if already run on cached container
    if (this.useCache && containerCache.migrationsRun) {
      console.log('[PostgreSQL] Using cached migrations');
      return;
    }

    if (this.usingCI) {
      console.log('[PostgreSQL] CI mode: Skipping migrations (pre-run)');
      return;
    }

    const db = drizzle(this.pool);
    await migrate(db, { migrationsFolder });
    containerCache.migrationsRun = true;
    console.log('[PostgreSQL] Migrations completed');
  }

  async stop(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    // Don't stop cached containers - they'll be cleaned up at process exit
    if (!this.useCache && this.container && !this.usingCI) {
      await this.container.stop();
      this.container = null;
    }
  }

  getPool(): pg.Pool {
    if (!this.pool) {
      throw new Error('PostgreSQL container not started');
    }
    return this.pool;
  }

  getConnectionString(): string {
    return this.connectionString;
  }
}

/**
 * OPTIMIZED RabbitMQ Test Container
 */
export class RabbitMQTestContainer {
  private container: StartedRabbitMQContainer | null = null;
  private connection: amqp.Connection | null = null;
  private useCache: boolean = true;

  constructor(options: { useCache?: boolean } = {}) {
    this.useCache = options.useCache ?? true;
  }

  async start(): Promise<{
    container: StartedRabbitMQContainer;
    connectionString: string;
    connection: amqp.Connection;
  }> {
    // OPTIMIZATION: Reuse cached container
    if (this.useCache && containerCache.rabbitmq) {
      console.log('[RabbitMQ] Using cached container');
      this.container = containerCache.rabbitmq;
      const host = this.container.getHost();
      const port = this.container.getMappedPort(5672);
      const connectionString = `amqp://test:test@${host}:${port}`;
      this.connection = await amqp.connect(connectionString);

      return {
        container: this.container,
        connectionString,
        connection: this.connection,
      };
    }

    this.container = await new RabbitMQContainer('rabbitmq:3.12-management-alpine')
      .withExposedPorts(5672)
      .withEnvironment({
        RABBITMQ_DEFAULT_USER: 'test',
        RABBITMQ_DEFAULT_PASS: 'test',
      })
      .withStartupTimeout(60000) // Reduced from 120s
      .start();

    const host = this.container.getHost();
    const port = this.container.getMappedPort(5672);
    const connectionString = `amqp://test:test@${host}:${port}`;

    // OPTIMIZATION: Faster connection with fewer retries
    let retries = 5; // Reduced from 10
    while (retries > 0) {
      try {
        this.connection = await amqp.connect(connectionString);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500)); // Reduced from 1s
      }
    }

    if (!this.connection) {
      throw new Error('Failed to connect to RabbitMQ');
    }

    // Cache container for reuse
    if (this.useCache) {
      containerCache.rabbitmq = this.container;
    }

    console.log('[RabbitMQ] Container started successfully');
    return {
      container: this.container,
      connectionString,
      connection: this.connection,
    };
  }

  async stop(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    // Don't stop cached containers
    if (!this.useCache && this.container) {
      await this.container.stop();
      this.container = null;
    }
  }

  getConnection(): amqp.Connection {
    if (!this.connection) {
      throw new Error('RabbitMQ container not started');
    }
    return this.connection;
  }
}

/**
 * OPTIMIZED Test Environment
 * - Parallel container startup
 * - Container caching
 * - Faster initialization
 */
export class TestEnvironment {
  private postgres: PostgresTestContainer;
  private rabbitmq: RabbitMQTestContainer;
  private usingCI: boolean = false;

  public postgresConnectionString: string = '';
  public rabbitmqConnectionString: string = '';
  public pool: pg.Pool | null = null;
  public amqpConnection: amqp.Connection | null = null;

  constructor(options: { useCache?: boolean } = {}) {
    const useCache = options.useCache ?? true;
    this.postgres = new PostgresTestContainer({ useCache });
    this.rabbitmq = new RabbitMQTestContainer({ useCache });
    this.usingCI = isCI();
  }

  async setup(): Promise<void> {
    console.log(
      `[TestEnvironment] Starting (CI: ${this.usingCI}, cached: ${containerCache.postgres ? 'yes' : 'no'})`
    );

    if (this.usingCI) {
      await this.setupCIEnvironment();
    } else {
      await this.setupLocalEnvironment();
    }

    console.log('[TestEnvironment] Ready');
  }

  private async setupCIEnvironment(): Promise<void> {
    const ciStrings = getCIConnectionStrings();
    this.postgresConnectionString = ciStrings.postgres;
    this.rabbitmqConnectionString = ciStrings.rabbitmq;

    this.pool = new Pool({
      connectionString: this.postgresConnectionString,
      max: 10, // Increased for better parallelism
      min: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 20000,
      allowExitOnIdle: true,
    });

    // OPTIMIZATION: Parallel connection checks
    await Promise.all([this.waitForPostgres(this.pool), this.connectToRabbitMQ()]);
  }

  private async waitForPostgres(pool: pg.Pool): Promise<void> {
    let retries = 10;
    while (retries > 0) {
      try {
        await pool.query('SELECT 1');
        console.log('[TestEnvironment] PostgreSQL ready');
        return;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  private async connectToRabbitMQ(): Promise<void> {
    let retries = 10;
    while (retries > 0) {
      try {
        this.amqpConnection = await amqp.connect(this.rabbitmqConnectionString);
        console.log('[TestEnvironment] RabbitMQ raw connection ready');

        // IMPORTANT: Also initialize the RabbitMQ singleton used by MessagePublisher
        // Set environment variable and initialize singleton
        process.env.RABBITMQ_URL = this.rabbitmqConnectionString;
        await initializeRabbitMQ();
        console.log('[TestEnvironment] RabbitMQ singleton initialized');

        return;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  private async setupLocalEnvironment(): Promise<void> {
    // OPTIMIZATION: Start containers in parallel
    const [postgresResult, rabbitmqResult] = await Promise.all([
      this.postgres.start(),
      this.rabbitmq.start(),
    ]);

    this.postgresConnectionString = postgresResult.connectionString;
    this.pool = postgresResult.pool;

    this.rabbitmqConnectionString = rabbitmqResult.connectionString;
    this.amqpConnection = rabbitmqResult.connection;

    // IMPORTANT: Also initialize the RabbitMQ singleton used by MessagePublisher
    process.env.RABBITMQ_URL = this.rabbitmqConnectionString;
    await initializeRabbitMQ();
    console.log('[TestEnvironment] RabbitMQ singleton initialized (local)');
  }

  async runMigrations(migrationsFolder: string = './drizzle'): Promise<void> {
    if (this.usingCI) {
      console.log('[TestEnvironment] CI: Skipping migrations');
      return;
    }
    await this.postgres.runMigrations(migrationsFolder);
  }

  async teardown(): Promise<void> {
    console.log('[TestEnvironment] Cleanup');

    // Close and reset the RabbitMQ singleton
    try {
      const rabbitMQ = RabbitMQConnection.getInstance();
      await rabbitMQ.close();
      RabbitMQConnection.resetInstance();
      console.log('[TestEnvironment] RabbitMQ singleton closed and reset');
    } catch (e) {
      // Ignore close errors - singleton may not be initialized
      // Still try to reset the instance
      try {
        RabbitMQConnection.resetInstance();
      } catch {
        // Ignore
      }
    }

    if (this.amqpConnection) {
      try {
        await this.amqpConnection.close();
      } catch (e) {
        // Ignore close errors
      }
      this.amqpConnection = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    // Containers are cached and not stopped
  }

  getPostgresPool(): pg.Pool {
    if (!this.pool) {
      throw new Error('PostgreSQL not ready');
    }
    return this.pool;
  }

  getRabbitMQConnection(): amqp.Connection {
    if (!this.amqpConnection) {
      throw new Error('RabbitMQ not ready');
    }
    return this.amqpConnection;
  }

  isUsingCI(): boolean {
    return this.usingCI;
  }
}

/**
 * Helper function to wait for a condition (optimized)
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 250 // Reduced from 500ms
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * OPTIMIZED database cleanup with batch operations
 */
export async function cleanDatabase(pool: pg.Pool): Promise<void> {
  try {
    // OPTIMIZATION: Use TRUNCATE CASCADE for faster cleanup
    await pool.query('TRUNCATE TABLE message_logs, users CASCADE');
  } catch (error) {
    console.warn('Database cleanup error:', error);
    // Don't fail tests on cleanup errors
  }
}

/**
 * Clear Redis cache for birthdays/anniversaries today
 * This is important for E2E tests that create users with specific birthdays
 * and expect them to be found by the scheduler
 */
export async function clearBirthdayCache(): Promise<void> {
  try {
    // Import cacheService dynamically to avoid circular dependencies
    const { cacheService } = await import('../../src/services/cache.service.js');

    // Delete all birthday and anniversary cache keys
    await cacheService.deletePattern('birthdays:*');
    await cacheService.deletePattern('anniversaries:*');

    console.log('[Cache] Cleared birthday and anniversary cache');
  } catch (error) {
    // Don't fail tests on cache clear errors - cache might not be initialized
    console.warn('Cache clear warning:', (error as Error).message);
  }
}

/**
 * Reset circuit breaker to closed state
 * This is important for E2E tests that test retry behavior
 * since the circuit breaker state persists across tests
 */
export async function resetCircuitBreaker(): Promise<void> {
  try {
    const { emailServiceClient } = await import('../../src/clients/email-service.client.js');
    emailServiceClient.resetCircuitBreaker();
    console.log('[CircuitBreaker] Reset to closed state');
  } catch (error) {
    console.warn('Circuit breaker reset warning:', (error as Error).message);
  }
}

/**
 * Helper to purge all RabbitMQ queues
 * Uses checkQueue to avoid precondition_failed errors from mismatched queue arguments
 * (e.g., quorum queues with x-dead-letter-exchange)
 */
export async function purgeQueues(connection: amqp.Connection, queues: string[]): Promise<void> {
  const channel = await connection.createChannel();
  try {
    // OPTIMIZATION: Check and purge queues in parallel
    // Use checkQueue instead of assertQueue to avoid precondition_failed errors
    await Promise.all(
      queues.map(async (queue) => {
        try {
          // checkQueue only verifies the queue exists without asserting its properties
          await channel.checkQueue(queue);
          await channel.purgeQueue(queue);
        } catch (error) {
          // Queue doesn't exist or other error - skip silently
          // This is expected for queues that haven't been created yet
        }
      })
    );
  } finally {
    await channel.close();
  }
}

/**
 * Cleanup cached containers on process exit
 */
process.on('exit', async () => {
  if (containerCache.postgres) {
    try {
      await containerCache.postgres.stop();
    } catch (e) {
      // Ignore
    }
  }
  if (containerCache.rabbitmq) {
    try {
      await containerCache.rabbitmq.stop();
    } catch (e) {
      // Ignore
    }
  }
});
