import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import amqp from 'amqplib';

const { Pool } = pg;

/**
 * Check if running in CI/CD environment
 * CI/CD uses docker-compose for services, not testcontainers
 */
export function isCI(): boolean {
  return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

/**
 * Get CI/CD environment connection strings
 * These match the docker-compose.test.yml configuration
 */
export function getCIConnectionStrings() {
  return {
    postgres: process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/test_db',
    rabbitmq: process.env.RABBITMQ_URL || 'amqp://test:test@localhost:5672',
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
  };
}

/**
 * Test container manager for PostgreSQL
 * Supports both testcontainers (local) and CI/CD (docker-compose) modes
 */
export class PostgresTestContainer {
  private container: StartedPostgreSqlContainer | null = null;
  private pool: pg.Pool | null = null;
  private usingCI: boolean = false;
  private connectionString: string = '';

  async start(): Promise<{
    container: StartedPostgreSqlContainer | null;
    connectionString: string;
    pool: pg.Pool;
  }> {
    this.usingCI = isCI();

    if (this.usingCI) {
      // CI mode: connect to docker-compose services
      // Use minimal pool to avoid connection exhaustion when multiple test files run in parallel
      this.connectionString = getCIConnectionStrings().postgres;
      console.log('[PostgreSQL] CI mode: Initializing connection...');
      console.log(
        `[PostgreSQL] Connection string: ${this.connectionString.replace(/:[^:@]+@/, ':***@')}`
      );

      this.pool = new Pool({
        connectionString: this.connectionString,
        max: 5, // Increased pool size for CI mode to handle concurrent tests
        min: 0, // Don't keep idle connections
        idleTimeoutMillis: 5000, // Release idle connections quickly
        connectionTimeoutMillis: 30000, // 30 second timeout per attempt (increased for CI)
        allowExitOnIdle: true, // Allow process to exit when pool is idle
      });

      // Wait for database to be ready with exponential backoff
      let retries = 20; // Increased retry count for CI reliability
      let delay = 500;
      while (retries > 0) {
        try {
          await this.pool.query('SELECT 1');
          console.log('[PostgreSQL] Connection established successfully (CI mode)');
          break;
        } catch (error: unknown) {
          retries--;
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (retries === 0) {
            throw new Error(`Failed to connect to PostgreSQL: ${errorMessage}`);
          }
          console.log(
            `[PostgreSQL] Waiting for connection... (${retries} retries left, error: ${errorMessage})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * 1.5, 5000); // Exponential backoff up to 5s (increased for CI)
        }
      }

      console.log('[PostgreSQL] Container initialization completed successfully');
      return {
        container: null,
        connectionString: this.connectionString,
        pool: this.pool,
      };
    }

    // Local mode: use testcontainers
    this.container = await new PostgreSqlContainer('postgres:15-alpine')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_DB: 'test_db',
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
      })
      .withStartupTimeout(120000)
      .start();

    this.connectionString = this.container.getConnectionUri();
    this.pool = new Pool({ connectionString: this.connectionString });

    return {
      container: this.container,
      connectionString: this.connectionString,
      pool: this.pool,
    };
  }

  async runMigrations(migrationsFolder: string): Promise<void> {
    if (!this.pool) {
      throw new Error('PostgreSQL container not started');
    }

    // In CI mode, migrations are already run by the workflow before tests
    // Skip to avoid "relation already exists" errors
    if (this.usingCI) {
      console.log('CI mode: skipping migrations (already run by CI workflow)');
      return;
    }

    const db = drizzle(this.pool);
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed (local mode)');
  }

  async stop(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.container && !this.usingCI) {
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
 * Test container manager for RabbitMQ
 */
export class RabbitMQTestContainer {
  private container: StartedRabbitMQContainer | null = null;
  private connection: amqp.Connection | null = null;

  async start(): Promise<{
    container: StartedRabbitMQContainer;
    connectionString: string;
    connection: amqp.Connection;
  }> {
    this.container = await new RabbitMQContainer('rabbitmq:3.12-management-alpine')
      .withExposedPorts(5672, 15672)
      .withEnvironment({
        RABBITMQ_DEFAULT_USER: 'test',
        RABBITMQ_DEFAULT_PASS: 'test',
      })
      .withStartupTimeout(120000)
      .start();

    const host = this.container.getHost();
    const port = this.container.getMappedPort(5672);
    const connectionString = `amqp://test:test@${host}:${port}`;

    // Wait for RabbitMQ to be ready
    let retries = 10;
    while (retries > 0) {
      try {
        this.connection = await amqp.connect(connectionString);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!this.connection) {
      throw new Error('Failed to connect to RabbitMQ');
    }

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
    if (this.container) {
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
 * Test container manager for Redis (optional, for caching)
 */
export class RedisTestContainer {
  private container: StartedTestContainer | null = null;

  async start(): Promise<{
    container: StartedTestContainer;
    connectionString: string;
    host: string;
    port: number;
  }> {
    this.container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withStartupTimeout(60000)
      .start();

    const host = this.container.getHost();
    const port = this.container.getMappedPort(6379);
    const connectionString = `redis://${host}:${port}`;

    return {
      container: this.container,
      connectionString,
      host,
      port,
    };
  }

  async stop(): Promise<void> {
    if (this.container) {
      await this.container.stop();
      this.container = null;
    }
  }
}

/**
 * Complete test environment with all required services
 * Supports both:
 * - Local development: Uses testcontainers to start containers
 * - CI/CD: Connects to docker-compose managed containers
 */
export class TestEnvironment {
  private postgres: PostgresTestContainer;
  private rabbitmq: RabbitMQTestContainer;
  private redis: RedisTestContainer;
  private usingCI: boolean = false;

  public postgresConnectionString: string = '';
  public rabbitmqConnectionString: string = '';
  public redisConnectionString: string = '';
  public pool: pg.Pool | null = null;
  public amqpConnection: amqp.Connection | null = null;

  constructor() {
    this.postgres = new PostgresTestContainer();
    this.rabbitmq = new RabbitMQTestContainer();
    this.redis = new RedisTestContainer();
    this.usingCI = isCI();
  }

  async setup(): Promise<void> {
    console.log(`[TestEnvironment] Starting test environment... (CI mode: ${this.usingCI})`);

    if (this.usingCI) {
      // In CI/CD, connect to external docker-compose services
      await this.setupCIEnvironment();
    } else {
      // Local development: start testcontainers
      await this.setupLocalEnvironment();
    }

    console.log('[TestEnvironment] Test environment started successfully');
  }

  /**
   * Setup for CI/CD environment using docker-compose services
   */
  private async setupCIEnvironment(): Promise<void> {
    console.log('[TestEnvironment] Configuring CI environment...');
    const ciStrings = getCIConnectionStrings();

    this.postgresConnectionString = ciStrings.postgres;
    this.rabbitmqConnectionString = ciStrings.rabbitmq;
    this.redisConnectionString = ciStrings.redis;

    console.log(
      `[TestEnvironment] PostgreSQL: ${this.postgresConnectionString.replace(/:[^:@]+@/, ':***@')}`
    );
    console.log(
      `[TestEnvironment] RabbitMQ: ${this.rabbitmqConnectionString.replace(/:[^:@]+@/, ':***@')}`
    );
    console.log(`[TestEnvironment] Redis: ${this.redisConnectionString}`);

    // Create pool for CI database with minimal connections
    // to avoid exhausting the shared PostgreSQL instance when multiple test files run in parallel
    this.pool = new Pool({
      connectionString: this.postgresConnectionString,
      max: 1, // Single connection per pool - multiple test files share the same PostgreSQL
      min: 0, // Don't keep idle connections
      idleTimeoutMillis: 5000, // Release idle connections quickly
      connectionTimeoutMillis: 30000, // Wait longer for connection when pool is exhausted
      allowExitOnIdle: true, // Allow process to exit when pool is idle
    });

    // Wait for database to be ready
    console.log('[TestEnvironment] Connecting to PostgreSQL...');
    let retries = 30;
    while (retries > 0) {
      try {
        await this.pool.query('SELECT 1');
        console.log('[TestEnvironment] PostgreSQL connection established successfully');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to connect to PostgreSQL: ${error}`);
        }
        console.log(`[TestEnvironment] Waiting for PostgreSQL... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Connect to RabbitMQ
    console.log('[TestEnvironment] Connecting to RabbitMQ...');
    retries = 30;
    while (retries > 0) {
      try {
        this.amqpConnection = await amqp.connect(this.rabbitmqConnectionString);
        console.log('[TestEnvironment] RabbitMQ connection established successfully');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to connect to RabbitMQ: ${error}`);
        }
        console.log(`[TestEnvironment] Waiting for RabbitMQ... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log('[TestEnvironment] CI environment setup completed successfully');
  }

  /**
   * Setup for local development using testcontainers
   */
  private async setupLocalEnvironment(): Promise<void> {
    // Start all containers in parallel
    const [postgresResult, rabbitmqResult, redisResult] = await Promise.all([
      this.postgres.start(),
      this.rabbitmq.start(),
      this.redis.start(),
    ]);

    this.postgresConnectionString = postgresResult.connectionString;
    this.pool = postgresResult.pool;

    this.rabbitmqConnectionString = rabbitmqResult.connectionString;
    this.amqpConnection = rabbitmqResult.connection;

    this.redisConnectionString = redisResult.connectionString;
  }

  async runMigrations(migrationsFolder: string = './drizzle'): Promise<void> {
    if (this.usingCI) {
      // In CI, migrations are already run by the workflow before tests
      // Skip to avoid "relation already exists" errors
      console.log('CI mode: skipping migrations (already run by CI workflow)');
      return;
    }
    await this.postgres.runMigrations(migrationsFolder);
  }

  async teardown(): Promise<void> {
    console.log('Stopping test environment...');

    if (this.usingCI) {
      // In CI, just close connections (don't stop containers)
      if (this.amqpConnection) {
        try {
          await this.amqpConnection.close();
        } catch (e) {
          console.warn('Error closing RabbitMQ connection:', e);
        }
        this.amqpConnection = null;
      }
      if (this.pool) {
        try {
          await this.pool.end();
        } catch (e) {
          console.warn('Error closing PostgreSQL pool:', e);
        }
        this.pool = null;
      }
    } else {
      // Local: Stop all containers in parallel
      await Promise.all([this.postgres.stop(), this.rabbitmq.stop(), this.redis.stop()]);
    }

    console.log('Test environment stopped');
  }

  getPostgresPool(): pg.Pool {
    if (this.usingCI && this.pool) {
      return this.pool;
    }
    return this.postgres.getPool();
  }

  getRabbitMQConnection(): amqp.Connection {
    if (this.usingCI && this.amqpConnection) {
      return this.amqpConnection;
    }
    return this.rabbitmq.getConnection();
  }

  /**
   * Check if using CI environment
   */
  isUsingCI(): boolean {
    return this.usingCI;
  }
}

/**
 * Helper function to wait for a condition
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 500
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
 * Helper to clean up database between tests
 */
export async function cleanDatabase(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE message_logs, users CASCADE');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Helper to purge all RabbitMQ queues
 * Creates a new channel for each queue to handle checkQueue failures gracefully
 * (checkQueue closes the channel if the queue doesn't exist)
 */
export async function purgeQueues(connection: amqp.Connection, queues: string[]): Promise<void> {
  for (const queue of queues) {
    try {
      // Create a new channel for each queue operation
      // This is necessary because checkQueue closes the channel on 404 errors
      const channel = await connection.createChannel();
      try {
        // Use checkQueue to verify queue exists without asserting properties
        await channel.checkQueue(queue);
        // If queue exists, purge it
        await channel.purgeQueue(queue);
        await channel.close();
      } catch (error) {
        // Queue doesn't exist or other error - channel is already closed by RabbitMQ
        // This is expected for queues that haven't been created yet
      }
    } catch (error) {
      // Ignore connection errors for individual queues
    }
  }
}
