import { DateTime } from 'luxon';
import type { TestMessageLog } from '../helpers/test-helpers';

/**
 * Predefined test message logs
 */
export const testMessageLogs = {
  /**
   * Scheduled birthday message
   */
  scheduledBirthday: {
    userId: '00000000-0000-0000-0000-000000000001',
    messageType: 'BIRTHDAY',
    scheduledSendTime: DateTime.now().plus({ hours: 1 }).toJSDate(),
    status: 'SCHEDULED',
    messageContent: 'Happy 35th birthday, John! Wishing you a wonderful day!',
    idempotencyKey: 'birthday-john-2025-12-30',
    retryCount: 0,
  } as TestMessageLog,

  /**
   * Sent birthday message
   */
  sentBirthday: {
    userId: '00000000-0000-0000-0000-000000000002',
    messageType: 'BIRTHDAY',
    scheduledSendTime: DateTime.now().minus({ hours: 2 }).toJSDate(),
    actualSendTime: DateTime.now().minus({ hours: 2, minutes: 5 }).toJSDate(),
    status: 'SENT',
    messageContent: 'Happy 40th birthday, Jane! Hope you have an amazing day!',
    idempotencyKey: 'birthday-jane-2025-12-30',
    retryCount: 0,
  } as TestMessageLog,

  /**
   * Failed birthday message
   */
  failedBirthday: {
    userId: '00000000-0000-0000-0000-000000000003',
    messageType: 'BIRTHDAY',
    scheduledSendTime: DateTime.now().minus({ hours: 3 }).toJSDate(),
    status: 'FAILED',
    messageContent: 'Happy birthday, Bob!',
    idempotencyKey: 'birthday-bob-2025-12-30',
    errorMessage: 'Email service unavailable',
    retryCount: 3,
  } as TestMessageLog,

  /**
   * Scheduled anniversary message
   */
  scheduledAnniversary: {
    userId: '00000000-0000-0000-0000-000000000004',
    messageType: 'ANNIVERSARY',
    scheduledSendTime: DateTime.now().plus({ hours: 2 }).toJSDate(),
    status: 'SCHEDULED',
    messageContent: 'Happy 5th anniversary, Alice!',
    idempotencyKey: 'anniversary-alice-2025-12-30',
    retryCount: 0,
  } as TestMessageLog,

  /**
   * Cancelled message
   */
  cancelledBirthday: {
    userId: '00000000-0000-0000-0000-000000000005',
    messageType: 'BIRTHDAY',
    scheduledSendTime: DateTime.now().plus({ hours: 1 }).toJSDate(),
    status: 'CANCELLED',
    messageContent: 'Happy birthday, Charlie!',
    idempotencyKey: 'birthday-charlie-2025-12-30',
    retryCount: 0,
  } as TestMessageLog,
};

/**
 * Generate batch message logs for performance testing
 */
export function generateBatchMessageLogs(
  count: number,
  messageType: 'BIRTHDAY' | 'ANNIVERSARY' = 'BIRTHDAY'
): TestMessageLog[] {
  const messages: TestMessageLog[] = [];
  const now = DateTime.now();

  for (let i = 0; i < count; i++) {
    messages.push({
      userId: `user-${i}`,
      messageType,
      scheduledSendTime: now.plus({ minutes: i % 60 }).toJSDate(),
      status: 'SCHEDULED',
      messageContent: `Happy ${messageType === 'BIRTHDAY' ? 'birthday' : 'anniversary'}, User${i}!`,
      idempotencyKey: `${messageType.toLowerCase()}-user${i}-${now.toISODate()}`,
      retryCount: 0,
    });
  }

  return messages;
}

/**
 * Message queue payloads for RabbitMQ testing
 */
export const queuePayloads = {
  birthdayMessage: {
    userId: '00000000-0000-0000-0000-000000000001',
    messageType: 'BIRTHDAY',
    messageContent: 'Happy birthday!',
    scheduledSendTime: new Date().toISOString(),
    idempotencyKey: 'test-birthday-001',
  },

  anniversaryMessage: {
    userId: '00000000-0000-0000-0000-000000000002',
    messageType: 'ANNIVERSARY',
    messageContent: 'Happy anniversary!',
    scheduledSendTime: new Date().toISOString(),
    idempotencyKey: 'test-anniversary-001',
  },

  invalidMessage: {
    userId: 'invalid-user-id',
    messageType: 'UNKNOWN',
    messageContent: '',
    scheduledSendTime: 'invalid-date',
    idempotencyKey: '',
  },
};
