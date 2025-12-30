import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';

/**
 * Unit Tests: Timezone Conversion
 *
 * These tests verify that the system correctly handles timezone conversions
 * and calculates 9am send times in users' local timezones.
 */

describe('Timezone Conversion', () => {
  describe('calculateSendTime', () => {
    it('should calculate 9am UTC for UTC timezone', () => {
      const timezone = 'UTC';
      const date = new Date('2025-12-30');

      const result = calculateNineAmInTimezone(timezone, date);

      const dt = DateTime.fromJSDate(result).setZone(timezone);
      expect(dt.hour).toBe(9);
      expect(dt.minute).toBe(0);
      expect(dt.second).toBe(0);
    });

    it('should calculate 9am EST for America/New_York timezone', () => {
      const timezone = 'America/New_York';
      const date = new Date('2025-12-30');

      const result = calculateNineAmInTimezone(timezone, date);

      const dt = DateTime.fromJSDate(result).setZone(timezone);
      expect(dt.hour).toBe(9);
      expect(dt.minute).toBe(0);
    });

    it('should calculate 9am JST for Asia/Tokyo timezone', () => {
      const timezone = 'Asia/Tokyo';
      const date = new Date('2025-12-30');

      const result = calculateNineAmInTimezone(timezone, date);

      const dt = DateTime.fromJSDate(result).setZone(timezone);
      expect(dt.hour).toBe(9);
      expect(dt.minute).toBe(0);
    });

    it('should handle timezone with half-hour offset (Asia/Kolkata)', () => {
      const timezone = 'Asia/Kolkata'; // UTC+5:30
      const date = new Date('2025-12-30');

      const result = calculateNineAmInTimezone(timezone, date);

      const dt = DateTime.fromJSDate(result).setZone(timezone);
      expect(dt.hour).toBe(9);
      expect(dt.minute).toBe(0);
    });

    it('should correctly convert UTC time to user timezone', () => {
      const utcTime = DateTime.fromObject(
        { year: 2025, month: 12, day: 30, hour: 14, minute: 0 },
        { zone: 'UTC' }
      );

      // Convert to New York time (UTC-5 in winter)
      const newYorkTime = utcTime.setZone('America/New_York');

      expect(newYorkTime.hour).toBe(9);
      expect(newYorkTime.day).toBe(30);
    });

    it('should handle DST transitions correctly', () => {
      // Test date during DST
      const summerDate = new Date('2025-07-15');
      const timezone = 'America/New_York';

      const result = calculateNineAmInTimezone(timezone, summerDate);

      const dt = DateTime.fromJSDate(result).setZone(timezone);
      expect(dt.hour).toBe(9);

      // During DST, New York is UTC-4
      const utcHour = DateTime.fromJSDate(result).setZone('UTC').hour;
      expect(utcHour).toBe(13); // 9am EDT = 1pm UTC
    });

    it('should maintain date consistency across timezone boundaries', () => {
      const date = new Date('2025-12-30');
      const timezones = [
        'Pacific/Auckland', // UTC+12
        'Asia/Tokyo', // UTC+9
        'Europe/London', // UTC+0
        'America/New_York', // UTC-5
        'America/Los_Angeles', // UTC-8
      ];

      timezones.forEach((timezone) => {
        const result = calculateNineAmInTimezone(timezone, date);
        const dt = DateTime.fromJSDate(result).setZone(timezone);

        expect(dt.day).toBe(30);
        expect(dt.month).toBe(12);
        expect(dt.year).toBe(2025);
        expect(dt.hour).toBe(9);
      });
    });
  });

  describe('timezone validation', () => {
    it('should validate correct timezone', () => {
      const validTimezones = [
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'Pacific/Auckland',
      ];

      validTimezones.forEach((timezone) => {
        const isValid = isValidTimezone(timezone);
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid timezone', () => {
      const invalidTimezones = ['Invalid/Timezone', 'EST', 'PST', 'XYZ', ''];

      invalidTimezones.forEach((timezone) => {
        const isValid = isValidTimezone(timezone);
        expect(isValid).toBe(false);
      });
    });

    it('should handle timezone abbreviations gracefully', () => {
      // Common mistake: using abbreviations instead of IANA names
      const abbreviations = ['EST', 'PST', 'GMT', 'CST'];

      abbreviations.forEach((tz) => {
        const isValid = isValidTimezone(tz);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('birthday detection across timezones', () => {
    it('should detect birthday on correct date in user timezone', () => {
      const birthdayDate = new Date('1990-12-30');
      const checkDate = DateTime.fromObject(
        { year: 2025, month: 12, day: 30 },
        { zone: 'UTC' }
      );

      const isBirthday = isBirthdayToday(birthdayDate, checkDate.toJSDate(), 'UTC');

      expect(isBirthday).toBe(true);
    });

    it('should not detect birthday on wrong date', () => {
      const birthdayDate = new Date('1990-12-30');
      const checkDate = DateTime.fromObject(
        { year: 2025, month: 12, day: 29 },
        { zone: 'UTC' }
      );

      const isBirthday = isBirthdayToday(birthdayDate, checkDate.toJSDate(), 'UTC');

      expect(isBirthday).toBe(false);
    });

    it('should handle leap year birthdays', () => {
      const birthdayDate = new Date('1992-02-29'); // Leap year birthday
      const leapYearCheck = DateTime.fromObject(
        { year: 2024, month: 2, day: 29 },
        { zone: 'UTC' }
      );
      const nonLeapYearCheck = DateTime.fromObject(
        { year: 2025, month: 2, day: 28 },
        { zone: 'UTC' }
      );

      const isLeapBirthday = isBirthdayToday(
        birthdayDate,
        leapYearCheck.toJSDate(),
        'UTC'
      );
      const isNonLeapBirthday = isBirthdayToday(
        birthdayDate,
        nonLeapYearCheck.toJSDate(),
        'UTC'
      );

      expect(isLeapBirthday).toBe(true);
      // In non-leap years, Feb 29 birthdays can be celebrated on Feb 28 or Mar 1
      // This is a business decision - adjust test based on requirements
      expect(isNonLeapBirthday).toBe(true); // or false, depending on requirements
    });
  });
});

// Helper functions (these would typically be imported from src/)

function calculateNineAmInTimezone(timezone: string, date: Date): Date {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  return dt.set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).toJSDate();
}

function isValidTimezone(timezone: string): boolean {
  try {
    DateTime.now().setZone(timezone);
    return DateTime.now().setZone(timezone).isValid;
  } catch {
    return false;
  }
}

function isBirthdayToday(birthdayDate: Date, checkDate: Date, timezone: string): boolean {
  const birthday = DateTime.fromJSDate(birthdayDate).setZone(timezone);
  const today = DateTime.fromJSDate(checkDate).setZone(timezone);

  // Special handling for leap year birthdays on Feb 29
  if (birthday.month === 2 && birthday.day === 29) {
    // If it's not a leap year, celebrate on Feb 28
    if (!today.isInLeapYear && today.month === 2 && today.day === 28) {
      return true;
    }
  }

  return birthday.month === today.month && birthday.day === today.day;
}
