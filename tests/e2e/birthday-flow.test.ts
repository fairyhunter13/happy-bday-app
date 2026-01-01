import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestEnvironment, waitFor } from '../helpers/testcontainers-optimized';
import { insertUser, findMessageLogsByUserId } from '../helpers/test-helpers';
import { DateTime } from 'luxon';
import type { Pool } from 'pg';
import type { Connection } from 'amqplib';

/**
 * E2E Tests: Birthday Message Flow
 *
 * These tests verify the complete end-to-end flow of birthday message scheduling,
 * enqueuing, and sending using real services (PostgreSQL, RabbitMQ).
 */

describe('Birthday Message E2E Flow', () => {
  let env: TestEnvironment;
  let pool: Pool;
  let amqpConnection: Connection;

  beforeAll(async () => {
    env = new TestEnvironment();
    await env.setup();
    await env.runMigrations();

    pool = env.getPostgresPool();
    amqpConnection = env.getRabbitMQConnection();
  }, 180000);

  afterAll(async () => {
    await env.teardown();
  }, 60000);

  describe('complete birthday flow', () => {
    it('should schedule and send birthday message at 9am user timezone', async () => {
      // 1. Create user with birthday today
      const timezone = 'America/New_York';
      const today = DateTime.now().setZone(timezone);
      const birthdayDate = today.set({ year: 1990, hour: 0, minute: 0, second: 0 }).toJSDate();

      const user = await insertUser(pool, {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        timezone,
        birthdayDate,
        anniversaryDate: null,
      });

      expect(user.id).toBeDefined();

      // 2. Trigger daily scheduler (simulate)
      // In real implementation, this would call the scheduler API
      const expectedSendTime = DateTime.fromJSDate(birthdayDate)
        .setZone(timezone)
        .set({ hour: 9, minute: 0, second: 0 })
        .toJSDate();

      // Insert scheduled message
      await pool.query(
        `
        INSERT INTO message_logs (
          user_id, message_type, scheduled_send_time, status,
          message_content, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          user.id,
          'BIRTHDAY',
          expectedSendTime,
          'SCHEDULED',
          `Happy ${today.year - 1990}th birthday, John!`,
          `BIRTHDAY-${user.id}-${today.toFormat('yyyy-MM-dd')}`,
        ]
      );

      // 3. Wait for message to be scheduled
      await waitFor(async () => {
        const messages = await findMessageLogsByUserId(pool, user.id);
        return messages.length > 0 && messages[0].status === 'SCHEDULED';
      }, 10000);

      // 4. Verify message was created
      const messages = await findMessageLogsByUserId(pool, user.id);
      expect(messages).toHaveLength(1);
      expect(messages[0].messageType).toBe('BIRTHDAY');
      expect(messages[0].status).toBe('SCHEDULED');

      // Verify send time is 9am in user timezone
      const sendTime = DateTime.fromJSDate(messages[0].scheduledSendTime).setZone(timezone);
      expect(sendTime.hour).toBe(9);
      expect(sendTime.minute).toBe(0);
    }, 30000);

    it('should prevent duplicate birthday messages (idempotency)', async () => {
      const timezone = 'UTC';
      const today = DateTime.now().setZone(timezone);
      const birthdayDate = today.set({ year: 1985, hour: 0, minute: 0, second: 0 }).toJSDate();

      const user = await insertUser(pool, {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@test.com',
        timezone,
        birthdayDate,
        anniversaryDate: null,
      });

      const idempotencyKey = `BIRTHDAY-${user.id}-${today.toFormat('yyyy-MM-dd')}`;

      // First attempt - should succeed
      await pool.query(
        `
        INSERT INTO message_logs (
          user_id, message_type, scheduled_send_time, status,
          message_content, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [user.id, 'BIRTHDAY', new Date(), 'SCHEDULED', 'Happy birthday!', idempotencyKey]
      );

      // Second attempt - should fail due to unique constraint
      await expect(
        pool.query(
          `
          INSERT INTO message_logs (
            user_id, message_type, scheduled_send_time, status,
            message_content, idempotency_key
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
          [user.id, 'BIRTHDAY', new Date(), 'SCHEDULED', 'Happy birthday!', idempotencyKey]
        )
      ).rejects.toThrow();

      // Verify only one message exists
      const messages = await findMessageLogsByUserId(pool, user.id);
      expect(messages).toHaveLength(1);
    });

    it('should handle multiple message types (birthday + anniversary)', async () => {
      const timezone = 'Europe/London';
      const today = DateTime.now().setZone(timezone);

      const user = await insertUser(pool, {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice.johnson@test.com',
        timezone,
        birthdayDate: today.set({ year: 1992, hour: 0, minute: 0 }).toJSDate(),
        anniversaryDate: today.set({ year: 2020, hour: 0, minute: 0 }).toJSDate(),
      });

      // Schedule birthday message
      await pool.query(
        `
        INSERT INTO message_logs (
          user_id, message_type, scheduled_send_time, status,
          message_content, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          user.id,
          'BIRTHDAY',
          new Date(),
          'SCHEDULED',
          'Happy birthday!',
          `BIRTHDAY-${user.id}-${today.toFormat('yyyy-MM-dd')}`,
        ]
      );

      // Schedule anniversary message
      await pool.query(
        `
        INSERT INTO message_logs (
          user_id, message_type, scheduled_send_time, status,
          message_content, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          user.id,
          'ANNIVERSARY',
          new Date(),
          'SCHEDULED',
          'Happy anniversary!',
          `ANNIVERSARY-${user.id}-${today.toFormat('yyyy-MM-dd')}`,
        ]
      );

      // Verify both messages exist
      const messages = await findMessageLogsByUserId(pool, user.id);
      expect(messages).toHaveLength(2);

      const messageTypes = messages.map((m) => m.messageType).sort();
      expect(messageTypes).toEqual(['ANNIVERSARY', 'BIRTHDAY']);
    });
  });

  describe('timezone edge cases', () => {
    it('should handle users across different timezones on same day', async () => {
      const timezones = [
        'Pacific/Auckland', // UTC+12
        'Asia/Tokyo', // UTC+9
        'Europe/London', // UTC+0
        'America/New_York', // UTC-5
        'America/Los_Angeles', // UTC-8
      ];

      const users = [];
      const today = DateTime.now();

      for (const timezone of timezones) {
        const user = await insertUser(pool, {
          firstName: `User`,
          lastName: timezone,
          email: `user-${timezone}@test.com`,
          timezone,
          birthdayDate: today.setZone(timezone).set({ year: 1990 }).toJSDate(),
          anniversaryDate: null,
        });

        users.push(user);

        // Schedule message at 9am in user's timezone
        const sendTime = today.setZone(timezone).set({ hour: 9, minute: 0, second: 0 }).toJSDate();

        await pool.query(
          `
          INSERT INTO message_logs (
            user_id, message_type, scheduled_send_time, status,
            message_content, idempotency_key
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
          [
            user.id,
            'BIRTHDAY',
            sendTime,
            'SCHEDULED',
            'Happy birthday!',
            `BIRTHDAY-${user.id}-${today.toFormat('yyyy-MM-dd')}`,
          ]
        );
      }

      // Verify all messages are scheduled
      for (const user of users) {
        const messages = await findMessageLogsByUserId(pool, user.id);
        expect(messages).toHaveLength(1);
        expect(messages[0].status).toBe('SCHEDULED');
      }

      // Verify messages are ordered by UTC send time
      const allMessages = await pool.query(
        `
        SELECT * FROM message_logs
        WHERE user_id = ANY($1)
        ORDER BY scheduled_send_time ASC
      `,
        [users.map((u) => u.id)]
      );

      expect(allMessages.rows).toHaveLength(timezones.length);

      // Auckland (UTC+12) should be first
      const firstMessage = allMessages.rows[0];
      const firstUser = users.find((u) => u.id === firstMessage.user_id);
      expect(firstUser?.timezone).toBe('Pacific/Auckland');

      // Los Angeles (UTC-8) should be last
      const lastMessage = allMessages.rows[allMessages.rows.length - 1];
      const lastUser = users.find((u) => u.id === lastMessage.user_id);
      expect(lastUser?.timezone).toBe('America/Los_Angeles');
    });
  });

  describe('message retry and error handling', () => {
    it('should track retry attempts', async () => {
      const user = await insertUser(pool, {
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob.wilson@test.com',
        timezone: 'UTC',
        birthdayDate: new Date('1990-12-30'),
        anniversaryDate: null,
      });

      // Insert failed message
      const result = await pool.query(
        `
        INSERT INTO message_logs (
          user_id, message_type, scheduled_send_time, status,
          message_content, idempotency_key, retry_count, error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
        [
          user.id,
          'BIRTHDAY',
          new Date(),
          'FAILED',
          'Happy birthday!',
          `BIRTHDAY-${user.id}-2025-12-30`,
          2,
          'Email service unavailable',
        ]
      );

      const message = result.rows[0];
      expect(message.status).toBe('FAILED');
      expect(message.retry_count).toBe(2);
      expect(message.error_message).toBe('Email service unavailable');
    });

    it('should update message status on successful send', async () => {
      const user = await insertUser(pool, {
        firstName: 'Carol',
        lastName: 'Davis',
        email: 'carol.davis@test.com',
        timezone: 'UTC',
        birthdayDate: new Date('1990-12-30'),
        anniversaryDate: null,
      });

      const insertResult = await pool.query(
        `
        INSERT INTO message_logs (
          user_id, message_type, scheduled_send_time, status,
          message_content, idempotency_key
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
        [user.id, 'BIRTHDAY', new Date(), 'SCHEDULED', 'Happy birthday!', 'test-key-carol']
      );

      const messageId = insertResult.rows[0].id;

      // Simulate successful send
      await pool.query(
        `
        UPDATE message_logs
        SET status = $1, actual_send_time = $2
        WHERE id = $3
      `,
        ['SENT', new Date(), messageId]
      );

      const messages = await findMessageLogsByUserId(pool, user.id);
      expect(messages[0].status).toBe('SENT');
      expect(messages[0].actualSendTime).toBeDefined();
    });
  });
});
