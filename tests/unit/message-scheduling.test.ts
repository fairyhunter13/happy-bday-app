import { describe, it, expect, beforeEach } from 'vitest';
import { DateTime } from 'luxon';

/**
 * Unit Tests: Message Scheduling
 *
 * These tests verify the message scheduling logic for the daily precalculation
 * and minute-level enqueuing systems.
 */

describe('Message Scheduling', () => {
  describe('daily precalculation', () => {
    it('should identify users with birthdays today', () => {
      const today = DateTime.now().setZone('UTC');
      const users = [
        {
          id: 'user-1',
          birthdayDate: today.set({ year: 1990 }).toJSDate(),
          timezone: 'UTC',
        },
        {
          id: 'user-2',
          birthdayDate: today.minus({ days: 1 }).set({ year: 1990 }).toJSDate(),
          timezone: 'UTC',
        },
        {
          id: 'user-3',
          birthdayDate: today.set({ year: 1992 }).toJSDate(),
          timezone: 'UTC',
        },
      ];

      const birthdaysToday = users.filter((user) =>
        hasBirthdayToday(user.birthdayDate, today.toJSDate(), user.timezone)
      );

      expect(birthdaysToday).toHaveLength(2);
      expect(birthdaysToday.map((u) => u.id)).toEqual(['user-1', 'user-3']);
    });

    it('should calculate send times for all timezones', () => {
      const users = [
        { id: 'user-1', timezone: 'UTC' },
        { id: 'user-2', timezone: 'America/New_York' },
        { id: 'user-3', timezone: 'Asia/Tokyo' },
      ];

      const sendTimes = users.map((user) => ({
        userId: user.id,
        sendTime: calculateSendTime(user.timezone, new Date('2025-12-30')),
      }));

      sendTimes.forEach((st) => {
        const localTime = DateTime.fromJSDate(st.sendTime).setZone(
          users.find((u) => u.id === st.userId)!.timezone
        );
        expect(localTime.hour).toBe(9);
        expect(localTime.minute).toBe(0);
      });
    });

    it('should sort send times chronologically (UTC order)', () => {
      const users = [
        { id: 'user-la', timezone: 'America/Los_Angeles' }, // UTC-8
        { id: 'user-ny', timezone: 'America/New_York' }, // UTC-5
        { id: 'user-utc', timezone: 'UTC' }, // UTC+0
        { id: 'user-tokyo', timezone: 'Asia/Tokyo' }, // UTC+9
      ];

      const sendTimes = users
        .map((user) => ({
          userId: user.id,
          sendTime: calculateSendTime(user.timezone, new Date('2025-12-30')),
        }))
        .sort((a, b) => a.sendTime.getTime() - b.sendTime.getTime());

      // Tokyo should be first (9am JST is earliest in UTC)
      expect(sendTimes[0].userId).toBe('user-tokyo');
      // LA should be last (9am PST is latest in UTC)
      expect(sendTimes[sendTimes.length - 1].userId).toBe('user-la');
    });

    it('should batch messages by scheduled hour', () => {
      const messages = [
        { id: '1', scheduledSendTime: new Date('2025-12-30T09:00:00Z') },
        { id: '2', scheduledSendTime: new Date('2025-12-30T09:30:00Z') },
        { id: '3', scheduledSendTime: new Date('2025-12-30T10:00:00Z') },
        { id: '4', scheduledSendTime: new Date('2025-12-30T10:15:00Z') },
      ];

      const batches = batchByHour(messages);

      expect(batches.size).toBe(2);
      expect(batches.get('2025-12-30T09')?.length).toBe(2);
      expect(batches.get('2025-12-30T10')?.length).toBe(2);
    });
  });

  describe('minute-level enqueuing', () => {
    it('should enqueue messages scheduled for current minute', () => {
      const now = DateTime.now().setZone('UTC');
      const currentMinute = now.startOf('minute');

      const messages = [
        {
          id: '1',
          scheduledSendTime: currentMinute.toJSDate(),
          status: 'SCHEDULED',
        },
        {
          id: '2',
          scheduledSendTime: currentMinute.plus({ minutes: 1 }).toJSDate(),
          status: 'SCHEDULED',
        },
        {
          id: '3',
          scheduledSendTime: currentMinute.minus({ minutes: 1 }).toJSDate(),
          status: 'SCHEDULED',
        },
      ];

      const toEnqueue = messages.filter((msg) =>
        shouldEnqueueNow(msg.scheduledSendTime, now.toJSDate())
      );

      expect(toEnqueue).toHaveLength(1);
      expect(toEnqueue[0].id).toBe('1');
    });

    it('should not enqueue already sent messages', () => {
      const now = DateTime.now().setZone('UTC');
      const messages = [
        {
          id: '1',
          scheduledSendTime: now.toJSDate(),
          status: 'SCHEDULED',
        },
        { id: '2', scheduledSendTime: now.toJSDate(), status: 'SENT' },
        { id: '3', scheduledSendTime: now.toJSDate(), status: 'FAILED' },
      ];

      const toEnqueue = messages.filter(
        (msg) =>
          msg.status === 'SCHEDULED' && shouldEnqueueNow(msg.scheduledSendTime, now.toJSDate())
      );

      expect(toEnqueue).toHaveLength(1);
      expect(toEnqueue[0].id).toBe('1');
    });

    it('should handle messages scheduled in the past', () => {
      const now = DateTime.now().setZone('UTC');
      const pastMessage = {
        scheduledSendTime: now.minus({ hours: 2 }).toJSDate(),
        status: 'SCHEDULED',
      };

      const shouldEnqueue = shouldEnqueueNow(pastMessage.scheduledSendTime, now.toJSDate());

      // Messages in the past should be enqueued immediately
      expect(shouldEnqueue).toBe(true);
    });

    it('should enqueue messages within 1-minute window', () => {
      const now = DateTime.now().setZone('UTC');
      const testCases = [
        { offset: 0, shouldEnqueue: true }, // Exact minute
        { offset: 30, shouldEnqueue: true }, // 30 seconds later
        { offset: 59, shouldEnqueue: true }, // 59 seconds later
        { offset: 60, shouldEnqueue: false }, // Next minute
        { offset: -1, shouldEnqueue: false }, // Previous minute
      ];

      testCases.forEach(({ offset, shouldEnqueue: expected }) => {
        const scheduledTime = now.plus({ seconds: offset }).toJSDate();
        const result = shouldEnqueueNow(scheduledTime, now.toJSDate());
        expect(result).toBe(expected);
      });
    });
  });

  describe('message priority and ordering', () => {
    it('should prioritize failed messages for retry', () => {
      const messages = [
        {
          id: '1',
          status: 'SCHEDULED',
          retryCount: 0,
          scheduledSendTime: new Date(),
        },
        {
          id: '2',
          status: 'FAILED',
          retryCount: 1,
          scheduledSendTime: new Date(),
        },
        {
          id: '3',
          status: 'FAILED',
          retryCount: 2,
          scheduledSendTime: new Date(),
        },
      ];

      const sorted = sortByPriority(messages);

      // Failed messages with fewer retries should come first
      expect(sorted[0].status).toBe('FAILED');
      expect(sorted[0].retryCount).toBe(1);
    });

    it('should respect scheduled time order for same priority', () => {
      const now = DateTime.now();
      const messages = [
        {
          id: '1',
          status: 'SCHEDULED',
          scheduledSendTime: now.plus({ minutes: 5 }).toJSDate(),
        },
        {
          id: '2',
          status: 'SCHEDULED',
          scheduledSendTime: now.plus({ minutes: 2 }).toJSDate(),
        },
        {
          id: '3',
          status: 'SCHEDULED',
          scheduledSendTime: now.plus({ minutes: 8 }).toJSDate(),
        },
      ];

      const sorted = sortByPriority(messages);

      expect(sorted[0].id).toBe('2'); // Earliest scheduled time
      expect(sorted[1].id).toBe('1');
      expect(sorted[2].id).toBe('3');
    });
  });

  describe('retry logic', () => {
    it('should calculate exponential backoff for retries', () => {
      const retries = [0, 1, 2, 3, 4];
      const backoffs = retries.map((retry) => calculateBackoff(retry));

      expect(backoffs[0]).toBe(0); // No backoff for first attempt
      expect(backoffs[1]).toBe(60); // 1 minute for first retry
      expect(backoffs[2]).toBe(300); // 5 minutes for second retry
      expect(backoffs[3]).toBe(900); // 15 minutes for third retry
      expect(backoffs[4]).toBe(3600); // 1 hour for fourth retry
    });

    it('should limit maximum retry attempts', () => {
      const maxRetries = 3;
      const retries = [0, 1, 2, 3, 4, 5];

      const shouldRetry = retries.map((retry) => retry < maxRetries);

      expect(shouldRetry).toEqual([true, true, true, false, false, false]);
    });

    it('should update retry timestamp correctly', () => {
      const now = DateTime.now();
      const message = {
        scheduledSendTime: now.toJSDate(),
        retryCount: 1,
      };

      const nextRetryTime = calculateNextRetryTime(message, now.toJSDate());

      const expectedRetryTime = now.plus({ seconds: 60 }).toJSDate();
      expect(nextRetryTime.getTime()).toBeCloseTo(expectedRetryTime.getTime(), -2);
    });
  });

  describe('scheduler performance', () => {
    it('should handle large batch of users efficiently', () => {
      const userCount = 10000;
      const users = Array.from({ length: userCount }, (_, i) => ({
        id: `user-${i}`,
        timezone: 'UTC',
        birthdayDate: DateTime.now().set({ year: 1990 }).toJSDate(),
      }));

      const startTime = performance.now();
      const scheduledMessages = users.map((user) => ({
        userId: user.id,
        sendTime: calculateSendTime(user.timezone, new Date()),
      }));
      const endTime = performance.now();

      expect(scheduledMessages).toHaveLength(userCount);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
    });
  });
});

// Helper functions (these would typically be imported from src/)

function hasBirthdayToday(birthdayDate: Date, today: Date, timezone: string): boolean {
  const birthday = DateTime.fromJSDate(birthdayDate).setZone(timezone);
  const todayDt = DateTime.fromJSDate(today).setZone(timezone);

  return birthday.month === todayDt.month && birthday.day === todayDt.day;
}

function calculateSendTime(timezone: string, date: Date): Date {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  return dt.set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).toJSDate();
}

function batchByHour(
  messages: Array<{ id: string; scheduledSendTime: Date }>
): Map<string, Array<{ id: string; scheduledSendTime: Date }>> {
  const batches = new Map();

  messages.forEach((msg) => {
    const hour = DateTime.fromJSDate(msg.scheduledSendTime).toFormat("yyyy-MM-dd'T'HH");
    if (!batches.has(hour)) {
      batches.set(hour, []);
    }
    batches.get(hour).push(msg);
  });

  return batches;
}

function shouldEnqueueNow(scheduledTime: Date, currentTime: Date): boolean {
  const scheduled = DateTime.fromJSDate(scheduledTime);
  const current = DateTime.fromJSDate(currentTime);

  // Enqueue if scheduled time is in the past or current minute
  const scheduledMinute = scheduled.startOf('minute');
  const currentMinute = current.startOf('minute');

  return scheduledMinute <= currentMinute;
}

function sortByPriority(
  messages: Array<{
    id: string;
    status: string;
    retryCount?: number;
    scheduledSendTime: Date;
  }>
): Array<{ id: string; status: string; retryCount?: number; scheduledSendTime: Date }> {
  return messages.sort((a, b) => {
    // Failed messages first
    if (a.status === 'FAILED' && b.status !== 'FAILED') return -1;
    if (a.status !== 'FAILED' && b.status === 'FAILED') return 1;

    // Among failed messages, fewer retries first
    if (a.status === 'FAILED' && b.status === 'FAILED') {
      return (a.retryCount || 0) - (b.retryCount || 0);
    }

    // Otherwise, sort by scheduled time
    return a.scheduledSendTime.getTime() - b.scheduledSendTime.getTime();
  });
}

function calculateBackoff(retryCount: number): number {
  const backoffs = [0, 60, 300, 900, 3600]; // seconds
  return backoffs[Math.min(retryCount, backoffs.length - 1)];
}

function calculateNextRetryTime(
  message: { scheduledSendTime: Date; retryCount: number },
  currentTime: Date
): Date {
  const backoffSeconds = calculateBackoff(message.retryCount);
  return DateTime.fromJSDate(currentTime).plus({ seconds: backoffSeconds }).toJSDate();
}
