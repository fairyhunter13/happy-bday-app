import { DateTime } from 'luxon';
import type { TestUser } from '../helpers/test-helpers';

/**
 * Predefined test users with specific timezones and birthdays
 */
export const testUsers = {
  /**
   * User in UTC with birthday today
   */
  johnUtc: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    timezone: 'UTC',
    birthdayDate: DateTime.now()
      .setZone('UTC')
      .set({ year: 1990, hour: 0, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
    anniversaryDate: null,
  } as TestUser,

  /**
   * User in New York with birthday today
   */
  janeNewYork: {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    timezone: 'America/New_York',
    birthdayDate: DateTime.now()
      .setZone('America/New_York')
      .set({ year: 1985, hour: 0, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
    anniversaryDate: null,
  } as TestUser,

  /**
   * User in Tokyo with birthday today
   */
  bobTokyo: {
    firstName: 'Bob',
    lastName: 'Johnson',
    email: 'bob.johnson@example.com',
    timezone: 'Asia/Tokyo',
    birthdayDate: DateTime.now()
      .setZone('Asia/Tokyo')
      .set({ year: 1992, hour: 0, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
    anniversaryDate: null,
  } as TestUser,

  /**
   * User in London with both birthday and anniversary today
   */
  aliceLondon: {
    firstName: 'Alice',
    lastName: 'Williams',
    email: 'alice.williams@example.com',
    timezone: 'Europe/London',
    birthdayDate: DateTime.now()
      .setZone('Europe/London')
      .set({ year: 1988, hour: 0, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
    anniversaryDate: DateTime.now()
      .setZone('Europe/London')
      .set({ year: 2020, hour: 0, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
  } as TestUser,

  /**
   * User with birthday tomorrow (should not receive message)
   */
  charlieTomorrow: {
    firstName: 'Charlie',
    lastName: 'Brown',
    email: 'charlie.brown@example.com',
    timezone: 'UTC',
    birthdayDate: DateTime.now()
      .setZone('UTC')
      .plus({ days: 1 })
      .set({ year: 1995, hour: 0, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
    anniversaryDate: null,
  } as TestUser,

  /**
   * User with birthday yesterday (should not receive message)
   */
  dianaYesterday: {
    firstName: 'Diana',
    lastName: 'Davis',
    email: 'diana.davis@example.com',
    timezone: 'UTC',
    birthdayDate: DateTime.now()
      .setZone('UTC')
      .minus({ days: 1 })
      .set({ year: 1993, hour: 0, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
    anniversaryDate: null,
  } as TestUser,

  /**
   * User in Sydney (UTC+10) with birthday today
   */
  eveSydney: {
    firstName: 'Eve',
    lastName: 'Anderson',
    email: 'eve.anderson@example.com',
    timezone: 'Australia/Sydney',
    birthdayDate: DateTime.now()
      .setZone('Australia/Sydney')
      .set({ year: 1991, hour: 0, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
    anniversaryDate: null,
  } as TestUser,

  /**
   * User in Los Angeles (UTC-8) with birthday today
   */
  frankLosAngeles: {
    firstName: 'Frank',
    lastName: 'Martinez',
    email: 'frank.martinez@example.com',
    timezone: 'America/Los_Angeles',
    birthdayDate: DateTime.now()
      .setZone('America/Los_Angeles')
      .set({ year: 1987, hour: 0, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
    anniversaryDate: null,
  } as TestUser,

  /**
   * User with invalid timezone (for error testing)
   */
  graceInvalidTimezone: {
    firstName: 'Grace',
    lastName: 'Lee',
    email: 'grace.lee@example.com',
    timezone: 'Invalid/Timezone',
    birthdayDate: DateTime.now()
      .setZone('UTC')
      .set({ year: 1994, hour: 0, minute: 0, second: 0, millisecond: 0 })
      .toJSDate(),
    anniversaryDate: null,
  } as TestUser,
};

/**
 * Batch of users for performance testing
 */
export function generateBatchUsers(count: number, timezone: string = 'UTC'): TestUser[] {
  const users: TestUser[] = [];
  const today = DateTime.now().setZone(timezone);

  for (let i = 0; i < count; i++) {
    users.push({
      firstName: `User${i}`,
      lastName: `Test${i}`,
      email: `user${i}@example.com`,
      timezone,
      birthdayDate: today
        .set({ year: 1990 + (i % 30), hour: 0, minute: 0, second: 0, millisecond: 0 })
        .toJSDate(),
      anniversaryDate:
        i % 3 === 0
          ? today
              .set({ year: 2020 + (i % 5), hour: 0, minute: 0, second: 0, millisecond: 0 })
              .toJSDate()
          : null,
    });
  }

  return users;
}

/**
 * Users distributed across all timezones
 */
export function generateUsersAcrossTimezones(usersPerTimezone: number = 10): TestUser[] {
  const timezones = [
    'America/New_York', // UTC-5
    'America/Chicago', // UTC-6
    'America/Denver', // UTC-7
    'America/Los_Angeles', // UTC-8
    'Europe/London', // UTC+0
    'Europe/Paris', // UTC+1
    'Europe/Moscow', // UTC+3
    'Asia/Dubai', // UTC+4
    'Asia/Kolkata', // UTC+5:30
    'Asia/Singapore', // UTC+8
    'Asia/Tokyo', // UTC+9
    'Australia/Sydney', // UTC+10
    'Pacific/Auckland', // UTC+12
  ];

  const users: TestUser[] = [];

  timezones.forEach((timezone, tzIndex) => {
    for (let i = 0; i < usersPerTimezone; i++) {
      const today = DateTime.now().setZone(timezone);
      users.push({
        firstName: `User${tzIndex}-${i}`,
        lastName: `TZ${timezone.replace(/\//g, '-')}`,
        email: `user-${tzIndex}-${i}@example.com`,
        timezone,
        birthdayDate: today
          .set({ year: 1990 + (i % 30), hour: 0, minute: 0, second: 0, millisecond: 0 })
          .toJSDate(),
        anniversaryDate: null,
      });
    }
  });

  return users;
}
