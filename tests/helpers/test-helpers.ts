import { faker } from '@faker-js/faker';
import { DateTime } from 'luxon';
import type { Pool } from 'pg';
import type { Connection, Channel } from 'amqplib';

/**
 * User data for testing
 */
export interface TestUser {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  timezone: string;
  birthdayDate: Date;
  anniversaryDate?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

/**
 * Message log data for testing
 */
export interface TestMessageLog {
  id?: string;
  userId: string;
  messageType: 'BIRTHDAY' | 'ANNIVERSARY' | string;
  scheduledSendTime: Date;
  actualSendTime?: Date | null;
  status: 'SCHEDULED' | 'SENT' | 'FAILED' | 'CANCELLED';
  messageContent: string;
  idempotencyKey: string;
  errorMessage?: string | null;
  retryCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Create a test user with sensible defaults
 */
export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  const timezone = faker.location.timeZone();
  const birthdayDate = faker.date.birthdate();

  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    timezone,
    birthdayDate,
    anniversaryDate: Math.random() > 0.5 ? faker.date.past() : null,
    ...overrides,
  };
}

/**
 * Create multiple test users
 */
export function createTestUsers(count: number, overrides?: Partial<TestUser>): TestUser[] {
  return Array.from({ length: count }, () => createTestUser(overrides));
}

/**
 * Create a test user with birthday today
 */
export function createUserWithBirthdayToday(timezone: string = 'UTC'): TestUser {
  const today = DateTime.now().setZone(timezone);
  const birthdayDate = DateTime.fromObject({
    year: today.year - 30, // 30 years old
    month: today.month,
    day: today.day,
  }).toJSDate();

  return createTestUser({
    timezone,
    birthdayDate,
  });
}

/**
 * Create a test user with anniversary today
 */
export function createUserWithAnniversaryToday(timezone: string = 'UTC'): TestUser {
  const today = DateTime.now().setZone(timezone);
  const anniversaryDate = DateTime.fromObject({
    year: today.year - 5, // 5 years ago
    month: today.month,
    day: today.day,
  }).toJSDate();

  return createTestUser({
    timezone,
    anniversaryDate,
  });
}

/**
 * Create a test message log
 */
export function createTestMessageLog(overrides?: Partial<TestMessageLog>): TestMessageLog {
  return {
    userId: faker.string.uuid(),
    messageType: 'BIRTHDAY',
    scheduledSendTime: faker.date.future(),
    status: 'SCHEDULED',
    messageContent: `Happy ${faker.number.int({ min: 20, max: 90 })}th birthday, ${faker.person.firstName()}!`,
    idempotencyKey: `${faker.string.uuid()}-${Date.now()}`,
    retryCount: 0,
    ...overrides,
  };
}

/**
 * Database helper for inserting test users
 */
export async function insertUser(pool: Pool, user: TestUser): Promise<TestUser & { id: string }> {
  const result = await pool.query(
    `
    INSERT INTO users (first_name, last_name, email, timezone, birthday_date, anniversary_date)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `,
    [
      user.firstName,
      user.lastName,
      user.email,
      user.timezone,
      user.birthdayDate,
      user.anniversaryDate,
    ]
  );

  return {
    ...user,
    id: result.rows[0].id,
    createdAt: result.rows[0].created_at,
    updatedAt: result.rows[0].updated_at,
  };
}

/**
 * Database helper for inserting test message logs
 */
export async function insertMessageLog(
  pool: Pool,
  messageLog: TestMessageLog
): Promise<TestMessageLog & { id: string }> {
  const result = await pool.query(
    `
    INSERT INTO message_logs (
      user_id, message_type, scheduled_send_time, status,
      message_content, idempotency_key, retry_count
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `,
    [
      messageLog.userId,
      messageLog.messageType,
      messageLog.scheduledSendTime,
      messageLog.status,
      messageLog.messageContent,
      messageLog.idempotencyKey,
      messageLog.retryCount || 0,
    ]
  );

  return {
    ...messageLog,
    id: result.rows[0].id,
    createdAt: result.rows[0].created_at,
    updatedAt: result.rows[0].updated_at,
  };
}

/**
 * Find a user by email
 */
export async function findUserByEmail(pool: Pool, email: string): Promise<TestUser | null> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    timezone: row.timezone,
    birthdayDate: row.birthday_date,
    anniversaryDate: row.anniversary_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Find message logs by user ID
 */
export async function findMessageLogsByUserId(
  pool: Pool,
  userId: string
): Promise<TestMessageLog[]> {
  const result = await pool.query('SELECT * FROM message_logs WHERE user_id = $1', [userId]);

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    messageType: row.message_type,
    scheduledSendTime: row.scheduled_send_time,
    actualSendTime: row.actual_send_time,
    status: row.status,
    messageContent: row.message_content,
    idempotencyKey: row.idempotency_key,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * RabbitMQ helper to publish a test message
 */
export async function publishTestMessage(
  connection: Connection,
  queue: string,
  message: object
): Promise<void> {
  const channel = await connection.createChannel();
  try {
    await channel.assertQueue(queue, { durable: true });
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
  } finally {
    await channel.close();
  }
}

/**
 * RabbitMQ helper to consume messages from a queue
 */
export async function consumeMessages(
  connection: Connection,
  queue: string,
  maxMessages: number = 10,
  timeout: number = 5000
): Promise<any[]> {
  const channel = await connection.createChannel();
  const messages: any[] = [];

  try {
    await channel.assertQueue(queue, { durable: true });

    return await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        channel.close().then(() => resolve(messages));
      }, timeout);

      channel.consume(
        queue,
        (msg) => {
          if (msg) {
            messages.push(JSON.parse(msg.content.toString()));
            channel.ack(msg);

            if (messages.length >= maxMessages) {
              clearTimeout(timeoutId);
              channel.close().then(() => resolve(messages));
            }
          }
        },
        { noAck: false }
      );
    });
  } catch (error) {
    await channel.close();
    throw error;
  }
}

/**
 * Get message count in a queue
 */
export async function getQueueMessageCount(connection: Connection, queue: string): Promise<number> {
  const channel = await connection.createChannel();
  try {
    const queueInfo = await channel.checkQueue(queue);
    return queueInfo.messageCount;
  } finally {
    await channel.close();
  }
}

/**
 * Sleep helper for async tests
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function until it succeeds or max retries is reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Mock logger for tests
 */
export const mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => mockLogger,
};

/**
 * Get current time in a specific timezone
 */
export function getTimeInTimezone(timezone: string): DateTime {
  return DateTime.now().setZone(timezone);
}

/**
 * Calculate 9am in a specific timezone for a given date
 */
export function getNineAmInTimezone(timezone: string, date: Date = new Date()): Date {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  return dt.set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).toJSDate();
}

/**
 * Check if two dates are on the same day (ignoring time)
 */
export function isSameDay(date1: Date, date2: Date, timezone: string = 'UTC'): boolean {
  const dt1 = DateTime.fromJSDate(date1).setZone(timezone);
  const dt2 = DateTime.fromJSDate(date2).setZone(timezone);

  return dt1.hasSame(dt2, 'day');
}

/**
 * Format date for database comparison
 */
export function formatDateForDb(date: Date): string {
  return DateTime.fromJSDate(date).toISO() || '';
}
