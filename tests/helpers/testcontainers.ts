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
      console.log(
        `CI mode: connecting to PostgreSQL at ${this.connectionString.replace(/:[^:@]+@/, ':***@')}`
      );

      this.pool = new Pool({
        connectionString: this.connectionString,
        max: 2, // Small pool - multiple test files share the same PostgreSQL
        min: 0, // Don't keep idle connections
        idleTimeoutMillis: 5000, // Release idle connections quickly
        connectionTimeoutMillis: 10000, // 10 second timeout per attempt
        allowExitOnIdle: true, // Allow process to exit when pool is idle
      });

      // Wait for database to be ready with exponential backoff
      let retries = 15;
      let delay = 500;
      while (retries > 0) {
        try {
          await this.pool.query('SELECT 1');
          console.log('PostgreSQL connection established (CI mode)');
          break;
        } catch (error: unknown) {
          retries--;
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (retries === 0) {
            throw new Error(`Failed to connect to PostgreSQL: ${errorMessage}`);
          }
          console.log(`Waiting for PostgreSQL... (${retries} retries left, error: ${errorMessage})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * 1.5, 3000); // Exponential backoff up to 3s
        }
      }

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

    const db = drizzle(this.pool);
    await migrate(db, { migrationsFolder });
    console.log(`Migrations completed (CI mode: ${this.usingCI})`);
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
    console.log(`Starting test environment... (CI mode: ${this.usingCI})`);

    if (this.usingCI) {
      // In CI/CD, connect to external docker-compose services
      await this.setupCIEnvironment();
    } else {
      // Local development: start testcontainers
      await this.setupLocalEnvironment();
    }

    console.log('Test environment started successfully');
  }

  /**
   * Setup for CI/CD environment using docker-compose services
   */
  private async setupCIEnvironment(): Promise<void> {
    const ciStrings = getCIConnectionStrings();

    this.postgresConnectionString = ciStrings.postgres;
    this.rabbitmqConnectionString = ciStrings.rabbitmq;
    this.redisConnectionString = ciStrings.redis;

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
    let retries = 30;
    while (retries > 0) {
      try {
        await this.pool.query('SELECT 1');
        console.log('PostgreSQL connection established');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to connect to PostgreSQL: ${error}`);
        }
        console.log(`Waiting for PostgreSQL... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Connect to RabbitMQ
    retries = 30;
    while (retries > 0) {
      try {
        this.amqpConnection = await amqp.connect(this.rabbitmqConnectionString);
        console.log('RabbitMQ connection established');
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to connect to RabbitMQ: ${error}`);
        }
        console.log(`Waiting for RabbitMQ... (${retries} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
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
      // In CI, run migrations using the pool directly
      if (!this.pool) {
        throw new Error('PostgreSQL pool not initialized');
      }
      const db = drizzle(this.pool);
      await migrate(db, { migrationsFolder });
      console.log('Migrations completed (CI mode)');
    } else {
      await this.postgres.runMigrations(migrationsFolder);
    }
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
 */
export async function purgeQueues(connection: amqp.Connection, queues: string[]): Promise<void> {
  const channel = await connection.createChannel();
  try {
    for (const queue of queues) {
      try {
        await channel.purgeQueue(queue);
      } catch (error) {
        // Queue might not exist, ignore error
        console.warn(`Failed to purge queue ${queue}:`, error);
      }
    }
  } finally {
    await channel.close();
  }
}
