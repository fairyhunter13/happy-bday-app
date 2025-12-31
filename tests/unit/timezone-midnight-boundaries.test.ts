/**
 * Timezone Midnight Boundaries Tests
 *
 * Comprehensive tests for extreme timezone offsets and date boundaries including:
 * - UTC+14 (Pacific/Kiritimati) date wrapping
 * - UTC-12 (Etc/GMT+12) late messages
 * - 23:59 to 00:00 transitions across days
 * - International Date Line crossing scenarios
 *
 * Covers edge cases: EC-TZ-011, EC-TZ-012, EC-TZ-016 from edge-cases-catalog.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DateTime } from 'luxon';
import { TimezoneService } from '../../src/services/timezone.service.js';

describe('Timezone Midnight Boundaries', () => {
  let service: TimezoneService;

  beforeEach(() => {
    service = new TimezoneService();
  });

  describe('UTC+14 (Pacific/Kiritimati) - Furthest Ahead', () => {
    const timezone = 'Pacific/Kiritimati'; // Line Islands, UTC+14

    it('should validate Pacific/Kiritimati timezone', () => {
      const isValid = service.isValidTimezone(timezone);
      expect(isValid).toBe(true);
    });

    it('should calculate correct UTC offset for Kiritimati', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const offset = service.getUTCOffset(date, timezone);

      // UTC+14 = 840 minutes (14 * 60)
      expect(offset).toBe(840);
    });

    it('should handle December 31 birthday wrapping to December 30 UTC', () => {
      const birthdayDate = new Date('1990-12-31');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // 9am Dec 31 in UTC+14 = 7pm Dec 30 in UTC
      expect(localDt.hour).toBe(9);
      expect(localDt.day).toBe(31);
      expect(localDt.month).toBe(12);

      expect(utcDt.hour).toBe(19); // 7pm
      expect(utcDt.day).toBe(30); // Previous day in UTC
      expect(utcDt.month).toBe(12);
    });

    it('should handle January 1 birthday in UTC+14', () => {
      const birthdayDate = new Date('1990-01-01');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // 9am Jan 1 in UTC+14 = 7pm Dec 31 previous year in UTC
      expect(localDt.hour).toBe(9);
      expect(localDt.day).toBe(1);
      expect(localDt.month).toBe(1);

      expect(utcDt.hour).toBe(19);
      expect(utcDt.day).toBe(31);
      expect(utcDt.month).toBe(12);
      expect(utcDt.year).toBe(localDt.year - 1); // Previous year
    });

    it('should correctly convert 9am UTC+14 to UTC', () => {
      const birthdayDate = new Date('1990-06-15');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);

      // 9am UTC+14 = 7pm previous day UTC (9:00 - 14:00)
      expect(utcDt.hour).toBe(19);
      expect(utcDt.minute).toBe(0);
      expect(utcDt.day).toBe(14); // Previous day
    });

    it('should handle birthday detection at extreme eastern edge', () => {
      const birthdayDate = new Date('1990-12-30');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.day).toBe(30);
      expect(localDt.month).toBe(12);
      expect(localDt.hour).toBe(9);
    });
  });

  describe('UTC-12 (Etc/GMT+12) - Furthest Behind', () => {
    const timezone = 'Etc/GMT+12'; // Baker Island, UTC-12

    it('should validate Etc/GMT+12 timezone', () => {
      const isValid = service.isValidTimezone(timezone);
      expect(isValid).toBe(true);
    });

    it('should calculate correct UTC offset for GMT+12', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const offset = service.getUTCOffset(date, timezone);

      // UTC-12 = -720 minutes (-12 * 60)
      expect(offset).toBe(-720);
    });

    it('should handle January 1 birthday appearing as December 31 in UTC-12', () => {
      const birthdayDate = new Date('1990-01-01');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // 9am Jan 1 in UTC-12 = 9pm Jan 1 in UTC
      expect(localDt.hour).toBe(9);
      expect(localDt.day).toBe(1);
      expect(localDt.month).toBe(1);

      expect(utcDt.hour).toBe(21); // 9pm
      expect(utcDt.day).toBe(1); // Same day but late evening
      expect(utcDt.month).toBe(1);
    });

    it('should correctly convert 9am UTC-12 to UTC', () => {
      const birthdayDate = new Date('1990-06-15');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);

      // 9am UTC-12 = 9pm same day UTC (9:00 + 12:00)
      expect(utcDt.hour).toBe(21);
      expect(utcDt.minute).toBe(0);
      expect(utcDt.day).toBe(15); // Same day
    });

    it('should handle late message scheduling in UTC-12', () => {
      const birthdayDate = new Date('1990-12-30');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // Messages sent in UTC-12 appear very late in UTC
      expect(utcDt.hour).toBe(21);
      expect(utcDt.day).toBe(30);
    });
  });

  describe('23:59 to 00:00 Midnight Transitions', () => {
    it('should handle birthday at 23:59 transition in UTC', () => {
      const timezone = 'UTC';
      const birthdayDate = new Date('1990-12-31');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const dt = DateTime.fromJSDate(result).setZone(timezone);

      // Should be 9am on Dec 31, not affected by midnight
      expect(dt.hour).toBe(9);
      expect(dt.day).toBe(31);
      expect(dt.month).toBe(12);
    });

    it('should handle timezone where 9am message crosses midnight UTC', () => {
      // Pacific/Auckland is UTC+13 (standard) or UTC+12 (DST)
      const timezone = 'Pacific/Auckland';
      const birthdayDate = new Date('1990-01-01');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      expect(localDt.hour).toBe(9);
      expect(localDt.day).toBe(1);

      // 9am in Auckland = ~8pm previous day UTC (depending on DST)
      expect(utcDt.day).toBe(31); // Previous day in UTC
      expect(utcDt.month).toBe(12); // Previous month
    });

    it('should maintain correct date in user timezone across UTC midnight', () => {
      const timezones = [
        'Pacific/Kiritimati', // UTC+14
        'Pacific/Auckland', // UTC+13/12
        'Asia/Tokyo', // UTC+9
        'Australia/Sydney', // UTC+11/10
      ];

      const birthdayDate = new Date('1990-01-01');

      timezones.forEach((timezone) => {
        const result = service.calculateSendTime(birthdayDate, timezone);
        const localDt = DateTime.fromJSDate(result).setZone(timezone);

        // Local date should always be Jan 1
        expect(localDt.day).toBe(1);
        expect(localDt.month).toBe(1);
        expect(localDt.hour).toBe(9);
      });
    });

    it('should handle end-of-year transition (Dec 31 to Jan 1)', () => {
      const timezone = 'Pacific/Kiritimati'; // UTC+14

      const dec31 = new Date('1990-12-31');
      const jan1 = new Date('1990-01-01');

      const dec31Result = service.calculateSendTime(dec31, timezone);
      const jan1Result = service.calculateSendTime(jan1, timezone);

      const dec31Utc = DateTime.fromJSDate(dec31Result).setZone('UTC');
      const jan1Utc = DateTime.fromJSDate(jan1Result).setZone('UTC');

      // Both should be on Dec 30 and Dec 31 in UTC respectively
      expect(dec31Utc.day).toBe(30);
      expect(dec31Utc.month).toBe(12);

      expect(jan1Utc.day).toBe(31);
      expect(jan1Utc.month).toBe(12);
    });
  });

  describe('International Date Line Crossing', () => {
    it('should handle timezone pairs across date line', () => {
      // Baker Island (UTC-12) and Kiritimati (UTC+14) are 26 hours apart
      const easternTimezone = 'Pacific/Kiritimati'; // UTC+14
      const westernTimezone = 'Etc/GMT+12'; // UTC-12

      const birthdayDate = new Date('1990-06-15');

      const easternResult = service.calculateSendTime(birthdayDate, easternTimezone);
      const westernResult = service.calculateSendTime(birthdayDate, westernTimezone);

      const easternUtc = DateTime.fromJSDate(easternResult).setZone('UTC');
      const westernUtc = DateTime.fromJSDate(westernResult).setZone('UTC');

      // Eastern timezone sends first (earlier UTC time)
      expect(easternUtc.toMillis()).toBeLessThan(westernUtc.toMillis());

      // Time difference should be ~26 hours
      const diffHours = (westernUtc.toMillis() - easternUtc.toMillis()) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(26, 0);
    });

    it('should maintain chronological order across date line', () => {
      const timezones = [
        'Pacific/Kiritimati', // UTC+14 (earliest)
        'Pacific/Auckland', // UTC+13
        'Asia/Tokyo', // UTC+9
        'UTC', // UTC+0
        'America/New_York', // UTC-5
        'Etc/GMT+12', // UTC-12 (latest)
      ];

      const birthdayDate = new Date('1990-06-15');

      const sendTimes = timezones.map((timezone) => {
        const result = service.calculateSendTime(birthdayDate, timezone);
        return {
          timezone,
          utcTime: DateTime.fromJSDate(result).setZone('UTC'),
        };
      });

      // Verify chronological order
      for (let i = 1; i < sendTimes.length; i++) {
        expect(sendTimes[i].utcTime.toMillis()).toBeGreaterThan(
          sendTimes[i - 1].utcTime.toMillis()
        );
      }
    });

    it('should handle date change across Pacific Date Line', () => {
      // Samoa (UTC+13) and American Samoa (UTC-11) are on opposite sides of date line
      const samoaTimezone = 'Pacific/Apia'; // UTC+13
      const americanSamoaTimezone = 'Pacific/Pago_Pago'; // UTC-11

      const birthdayDate = new Date('1990-06-15');

      const samoaResult = service.calculateSendTime(birthdayDate, samoaTimezone);
      const americanSamoaResult = service.calculateSendTime(birthdayDate, americanSamoaTimezone);

      const samoaLocal = DateTime.fromJSDate(samoaResult).setZone(samoaTimezone);
      const americanSamoaLocal =
        DateTime.fromJSDate(americanSamoaResult).setZone(americanSamoaTimezone);

      // Both should be 9am on June 15 in their local time
      expect(samoaLocal.hour).toBe(9);
      expect(samoaLocal.day).toBe(15);

      expect(americanSamoaLocal.hour).toBe(9);
      expect(americanSamoaLocal.day).toBe(15);
    });
  });

  describe('Extreme Offset Edge Cases', () => {
    it('should handle birthday on February 28 in UTC+14 (wraps to Feb 27 UTC)', () => {
      const timezone = 'Pacific/Kiritimati';
      const birthdayDate = new Date('1990-02-28');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      expect(localDt.day).toBe(28);
      expect(localDt.month).toBe(2);

      expect(utcDt.day).toBe(27); // Previous day in UTC
      expect(utcDt.month).toBe(2);
    });

    it('should handle birthday on March 1 in UTC-12 (same day but late in UTC)', () => {
      const timezone = 'Etc/GMT+12';
      const birthdayDate = new Date('1990-03-01');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      expect(localDt.day).toBe(1);
      expect(localDt.month).toBe(3);

      expect(utcDt.day).toBe(1); // Same day
      expect(utcDt.month).toBe(3);
      expect(utcDt.hour).toBe(21); // Late evening
    });

    it('should format dates correctly in extreme timezones', () => {
      const eastTimezone = 'Pacific/Kiritimati';
      const westTimezone = 'Etc/GMT+12';
      const birthdayDate = new Date('1990-06-15');

      const eastResult = service.calculateSendTime(birthdayDate, eastTimezone);
      const westResult = service.calculateSendTime(birthdayDate, westTimezone);

      const eastFormatted = service.formatDateInTimezone(eastResult, eastTimezone);
      const westFormatted = service.formatDateInTimezone(westResult, westTimezone);

      // Use dynamic year pattern - year should match current year
      const currentYear = new Date().getFullYear();
      const yearPattern = new RegExp(`${currentYear}-06-15 09:00:00`);
      expect(eastFormatted).toMatch(yearPattern);
      expect(westFormatted).toMatch(yearPattern);
    });
  });

  describe('Year Boundary Transitions', () => {
    it('should handle New Year transition in UTC+14', () => {
      const timezone = 'Pacific/Kiritimati';
      const newYearBirthday = new Date('1990-01-01');

      const result = service.calculateSendTime(newYearBirthday, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // Jan 1 in UTC+14 - year should be current year
      const currentYear = new Date().getFullYear();
      expect(localDt.year).toBe(currentYear);
      expect(localDt.month).toBe(1);
      expect(localDt.day).toBe(1);

      // Previous year in UTC
      expect(utcDt.year).toBe(currentYear - 1);
      expect(utcDt.month).toBe(12);
      expect(utcDt.day).toBe(31);
    });

    it('should handle New Year Eve in UTC-12', () => {
      const timezone = 'Etc/GMT+12';
      const newYearEveBirthday = new Date('1990-12-31');

      const result = service.calculateSendTime(newYearEveBirthday, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // Dec 31 in UTC-12 - year should be current year
      const currentYear = new Date().getFullYear();
      expect(localDt.year).toBe(currentYear);
      expect(localDt.month).toBe(12);
      expect(localDt.day).toBe(31);

      // Same year in UTC (late evening)
      expect(utcDt.year).toBe(currentYear);
      expect(utcDt.month).toBe(12);
      expect(utcDt.day).toBe(31);
    });

    it('should handle Feb 28 (leap year boundary) in extreme timezones', () => {
      const eastTimezone = 'Pacific/Kiritimati';
      const westTimezone = 'Etc/GMT+12';
      const feb28Birthday = new Date('1990-02-28');

      const eastResult = service.calculateSendTime(feb28Birthday, eastTimezone);
      const westResult = service.calculateSendTime(feb28Birthday, westTimezone);

      const eastLocal = DateTime.fromJSDate(eastResult).setZone(eastTimezone);
      const westLocal = DateTime.fromJSDate(westResult).setZone(westTimezone);

      // Both should handle Feb 28 correctly
      expect(eastLocal.hour).toBe(9);
      expect(eastLocal.day).toBe(28);
      expect(eastLocal.month).toBe(2);
      expect(westLocal.hour).toBe(9);
      expect(westLocal.day).toBe(28);
      expect(westLocal.month).toBe(2);
    });
  });

  describe('Scheduler Edge Cases with Extreme Offsets', () => {
    it('should ensure no messages are lost at date boundaries', () => {
      const timezones = ['Pacific/Kiritimati', 'Etc/GMT+12'];
      const criticalDates = [
        new Date('1990-01-01'), // New Year
        new Date('1990-12-31'), // New Year Eve
        new Date('1990-06-30'), // Mid-year
        new Date('1990-02-28'), // End of Feb
      ];

      timezones.forEach((timezone) => {
        criticalDates.forEach((date) => {
          const result = service.calculateSendTime(date, timezone);
          const localDt = DateTime.fromJSDate(result).setZone(timezone);

          expect(localDt.isValid).toBe(true);
          expect(localDt.hour).toBe(9);
          expect(localDt.minute).toBe(0);
        });
      });
    });

    it('should maintain consistent UTC timestamps for scheduling', () => {
      const timezone = 'Pacific/Kiritimati';
      const birthdayDate = new Date('1990-12-31');

      const result1 = service.calculateSendTime(birthdayDate, timezone);
      const result2 = service.calculateSendTime(birthdayDate, timezone);

      // Should produce identical UTC timestamps
      expect(result1.getTime()).toBe(result2.getTime());
    });
  });
});
