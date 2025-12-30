import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import amqp from 'amqplib';

const { Pool } = pg;

/**
 * Test container manager for PostgreSQL
 */
export class PostgresTestContainer {
  private container: StartedPostgreSqlContainer | null = null;
  private pool: pg.Pool | null = null;

  async start(): Promise<{
    container: StartedPostgreSqlContainer;
    connectionString: string;
    pool: pg.Pool;
  }> {
    this.container = await new PostgreSqlContainer('postgres:15-alpine')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_DB: 'test_db',
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
      })
      .withStartupTimeout(120000)
      .start();

    const connectionString = this.container.getConnectionUri();
    this.pool = new Pool({ connectionString });

    return {
      container: this.container,
      connectionString,
      pool: this.pool,
    };
  }

  async runMigrations(migrationsFolder: string): Promise<void> {
    if (!this.pool) {
      throw new Error('PostgreSQL container not started');
    }

    const db = drizzle(this.pool);
    await migrate(db, { migrationsFolder });
  }

  async stop(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.container) {
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
 */
export class TestEnvironment {
  private postgres: PostgresTestContainer;
  private rabbitmq: RabbitMQTestContainer;
  private redis: RedisTestContainer;

  public postgresConnectionString: string = '';
  public rabbitmqConnectionString: string = '';
  public redisConnectionString: string = '';
  public pool: pg.Pool | null = null;
  public amqpConnection: amqp.Connection | null = null;

  constructor() {
    this.postgres = new PostgresTestContainer();
    this.rabbitmq = new RabbitMQTestContainer();
    this.redis = new RedisTestContainer();
  }

  async setup(): Promise<void> {
    console.log('Starting test environment...');

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

    console.log('Test environment started successfully');
  }

  async runMigrations(migrationsFolder: string = './drizzle'): Promise<void> {
    await this.postgres.runMigrations(migrationsFolder);
  }

  async teardown(): Promise<void> {
    console.log('Stopping test environment...');

    // Stop all containers in parallel
    await Promise.all([this.postgres.stop(), this.rabbitmq.stop(), this.redis.stop()]);

    console.log('Test environment stopped');
  }

  getPostgresPool(): pg.Pool {
    return this.postgres.getPool();
  }

  getRabbitMQConnection(): amqp.Connection {
    return this.rabbitmq.getConnection();
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
