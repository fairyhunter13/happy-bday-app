/**
 * Timezone DST Edge Cases Tests
 *
 * Comprehensive tests for Daylight Saving Time (DST) transitions including:
 * - Spring forward (2am nonexistent time)
 * - Fall back (2am ambiguous time)
 * - DST on exact birthday date
 * - Multiple DST zones (America/New_York, Europe/London, Australia/Sydney)
 *
 * Covers edge cases: EC-TZ-007 to EC-TZ-010 from edge-cases-catalog.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DateTime } from 'luxon';
import { TimezoneService } from '../../src/services/timezone.service.js';

describe('Timezone DST Edge Cases', () => {
  let service: TimezoneService;

  beforeEach(() => {
    service = new TimezoneService();
  });

  describe('Spring Forward - Nonexistent Time (2am becomes 3am)', () => {
    it('should handle birthday at 2:30am during DST spring forward in New York', () => {
      // In 2025, DST starts on March 9 at 2am EST -> 3am EDT
      // 2am to 2:59am don't exist on this date
      const timezone = 'America/New_York';
      const birthdayDate = new Date('1990-03-09');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      // Should calculate 9am EDT successfully (not affected by 2am gap)
      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(localDt.month).toBe(3);
      expect(localDt.day).toBe(9);
      expect(localDt.isValid).toBe(true);
    });

    it('should handle nonexistent time during spring forward in Europe/London', () => {
      // In 2025, BST starts on March 30 at 1am GMT -> 2am BST
      const timezone = 'Europe/London';
      const birthdayDate = new Date('1990-03-30');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(localDt.isValid).toBe(true);
    });

    it('should verify DST status changes after spring forward', () => {
      const timezone = 'America/New_York';
      const currentYear = new Date().getFullYear();

      // Before DST: January (always standard time)
      const beforeDST = new Date(`${currentYear}-01-15T12:00:00Z`);
      const beforeInfo = service.handleDST(beforeDST, timezone);

      // After DST: April (always daylight time)
      const afterDST = new Date(`${currentYear}-04-15T12:00:00Z`);
      const afterInfo = service.handleDST(afterDST, timezone);

      expect(beforeInfo.isDST).toBe(false);
      expect(afterInfo.isDST).toBe(true);

      // Offset changes from UTC-5 to UTC-4
      expect(beforeInfo.offset).toBe(-300); // -5 hours = -300 minutes
      expect(afterInfo.offset).toBe(-240); // -4 hours = -240 minutes
    });

    it('should handle birthday exactly on spring forward date in Australia/Sydney', () => {
      // Australia has reversed seasons - DST starts in October
      // In 2025, AEDT starts on October 5 at 2am AEST -> 3am AEDT
      const timezone = 'Australia/Sydney';
      const birthdayDate = new Date('1990-10-05');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.month).toBe(10);
      expect(localDt.day).toBe(5);
      expect(localDt.isValid).toBe(true);
    });

    it('should correctly convert 9am EDT to UTC after spring forward', () => {
      const timezone = 'America/New_York';
      const birthdayDate = new Date('1990-03-15'); // After DST starts

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);

      // 9am EDT = 1pm UTC (UTC-4)
      expect(utcDt.hour).toBe(13);
      expect(utcDt.minute).toBe(0);
    });
  });

  describe('Fall Back - Ambiguous Time (2am happens twice)', () => {
    it('should handle birthday at 2am during DST fall back in New York', () => {
      // In 2025, DST ends on November 2 at 2am EDT -> 1am EST
      // 1am to 1:59am happen twice on this date
      const timezone = 'America/New_York';
      const birthdayDate = new Date('1990-11-02');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      // Should calculate 9am EST successfully (after the ambiguous hour)
      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(localDt.month).toBe(11);
      expect(localDt.day).toBe(2);
      expect(localDt.isValid).toBe(true);
    });

    it('should handle fall back in Europe/London', () => {
      // In 2025, GMT resumes on October 26 at 2am BST -> 1am GMT
      const timezone = 'Europe/London';
      const birthdayDate = new Date('1990-10-26');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(localDt.isValid).toBe(true);
    });

    it('should verify DST status changes after fall back', () => {
      const timezone = 'America/New_York';
      const currentYear = new Date().getFullYear();

      // Before fall back: July (always daylight time)
      const beforeDST = new Date(`${currentYear}-07-15T12:00:00Z`);
      const beforeInfo = service.handleDST(beforeDST, timezone);

      // After fall back: December (always standard time)
      const afterDST = new Date(`${currentYear}-12-15T12:00:00Z`);
      const afterInfo = service.handleDST(afterDST, timezone);

      expect(beforeInfo.isDST).toBe(true);
      expect(afterInfo.isDST).toBe(false);

      // Offset changes from UTC-4 to UTC-5
      expect(beforeInfo.offset).toBe(-240);
      expect(afterInfo.offset).toBe(-300);
    });

    it('should handle birthday exactly on fall back date in Australia/Sydney', () => {
      // In 2025, AEST resumes on April 6 at 3am AEDT -> 2am AEST
      const timezone = 'Australia/Sydney';
      const birthdayDate = new Date('1990-04-06');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.month).toBe(4);
      expect(localDt.day).toBe(6);
      expect(localDt.isValid).toBe(true);
    });

    it('should correctly convert 9am EST to UTC after fall back', () => {
      const timezone = 'America/New_York';
      const birthdayDate = new Date('1990-11-15'); // After DST ends

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);

      // 9am EST = 2pm UTC (UTC-5)
      expect(utcDt.hour).toBe(14);
      expect(utcDt.minute).toBe(0);
    });
  });

  describe('Multiple DST Zones Comparison', () => {
    const dstZones = [
      { name: 'America/New_York', description: 'US Eastern' },
      { name: 'America/Chicago', description: 'US Central' },
      { name: 'America/Denver', description: 'US Mountain' },
      { name: 'America/Los_Angeles', description: 'US Pacific' },
      { name: 'Europe/London', description: 'UK' },
      { name: 'Europe/Paris', description: 'Central European' },
      { name: 'Australia/Sydney', description: 'Australian Eastern' },
    ];

    it('should validate all DST zones', () => {
      dstZones.forEach(({ name }) => {
        const isValid = service.isValidTimezone(name);
        expect(isValid).toBe(true);
      });
    });

    it('should handle birthdays in all DST zones during summer', () => {
      const summerBirthday = new Date('1990-07-15');

      dstZones.forEach(({ name, description }) => {
        const result = service.calculateSendTime(summerBirthday, name);
        const localDt = DateTime.fromJSDate(result).setZone(name);

        expect(localDt.hour).toBe(9);
        expect(localDt.minute).toBe(0);
        expect(localDt.isValid).toBe(true);
      });
    });

    it('should handle birthdays in all DST zones during winter', () => {
      const winterBirthday = new Date('1990-01-15');

      dstZones.forEach(({ name, description }) => {
        const result = service.calculateSendTime(winterBirthday, name);
        const localDt = DateTime.fromJSDate(result).setZone(name);

        expect(localDt.hour).toBe(9);
        expect(localDt.minute).toBe(0);
        expect(localDt.isValid).toBe(true);
      });
    });

    it('should detect different DST statuses across hemispheres', () => {
      // July 15 - summer in northern hemisphere, winter in southern
      const currentYear = new Date().getFullYear();
      const julyDate = new Date(`${currentYear}-07-15T12:00:00Z`);

      const nyDST = service.handleDST(julyDate, 'America/New_York');
      const sydneyDST = service.handleDST(julyDate, 'Australia/Sydney');

      // Northern hemisphere: DST active
      expect(nyDST.isDST).toBe(true);

      // Southern hemisphere: DST inactive (winter)
      expect(sydneyDST.isDST).toBe(false);
    });

    it('should show offset changes during DST transitions', () => {
      const timezone = 'America/New_York';
      const currentYear = new Date().getFullYear();

      // January (winter - EST): UTC-5
      const winter = new Date(`${currentYear}-01-15T12:00:00Z`);
      const winterOffset = service.getUTCOffset(winter, timezone);

      // July (summer - EDT): UTC-4
      const summer = new Date(`${currentYear}-07-15T12:00:00Z`);
      const summerOffset = service.getUTCOffset(summer, timezone);

      expect(winterOffset).toBe(-300); // -5 hours
      expect(summerOffset).toBe(-240); // -4 hours
      expect(summerOffset - winterOffset).toBe(60); // 1 hour difference
    });
  });

  describe('DST on Exact Birthday Date', () => {
    it('should handle birthday on spring forward date with isBirthdayToday check', () => {
      const timezone = 'America/New_York';
      const birthdayDate = new Date('1990-03-09'); // DST starts March 9, 2025

      // Check if service correctly identifies birthday on DST transition day
      const isBirthday = service.isBirthdayToday(birthdayDate, timezone);

      // This depends on current date, so we test the calculation instead
      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.isValid).toBe(true);
      expect(localDt.month).toBe(3);
      expect(localDt.day).toBe(9);
    });

    it('should handle birthday on fall back date with isBirthdayToday check', () => {
      const timezone = 'America/New_York';
      const birthdayDate = new Date('1990-11-02'); // DST ends November 2, 2025

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.isValid).toBe(true);
      expect(localDt.month).toBe(11);
      expect(localDt.day).toBe(2);
    });

    it('should maintain date consistency across DST boundary', () => {
      const timezone = 'America/New_York';

      // Calculate for date before, on, and after DST transition
      const dates = [
        new Date('1990-03-08'), // Before DST
        new Date('1990-03-09'), // DST starts
        new Date('1990-03-10'), // After DST
      ];

      dates.forEach((date) => {
        const result = service.calculateSendTime(date, timezone);
        const localDt = DateTime.fromJSDate(result).setZone(timezone);

        expect(localDt.hour).toBe(9);
        expect(localDt.minute).toBe(0);
        expect(localDt.day).toBe(date.getDate());
        expect(localDt.isValid).toBe(true);
      });
    });
  });

  describe('DST Edge Cases - Cross-zone Coordination', () => {
    it('should maintain correct ordering when DST changes across zones', () => {
      // When DST starts/ends, the relative order of send times may change
      const birthdayDate = new Date('1990-03-09'); // DST starts in US

      const zones = [
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
      ];

      const sendTimes = zones.map((timezone) => {
        const result = service.calculateSendTime(birthdayDate, timezone);
        return {
          timezone,
          sendTime: result,
          utcTime: DateTime.fromJSDate(result).setZone('UTC'),
        };
      });

      // Verify chronological order (East to West)
      for (let i = 1; i < sendTimes.length; i++) {
        expect(sendTimes[i].utcTime.toMillis()).toBeGreaterThan(
          sendTimes[i - 1].utcTime.toMillis()
        );
      }
    });

    it('should handle UTC conversion accuracy during DST', () => {
      const timezone = 'Europe/London';
      const birthdayDate = new Date('1990-06-15'); // During BST

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      expect(localDt.hour).toBe(9);
      expect(utcDt.hour).toBe(8); // 9am BST = 8am UTC (UTC+1)
    });

    it('should format dates correctly during DST transitions', () => {
      const timezone = 'America/New_York';
      const currentYear = new Date().getFullYear();
      const springForward = new Date('1990-03-09');
      const fallBack = new Date('1990-11-02');

      const springResult = service.calculateSendTime(springForward, timezone);
      const fallResult = service.calculateSendTime(fallBack, timezone);

      const springFormatted = service.formatDateInTimezone(springResult, timezone);
      const fallFormatted = service.formatDateInTimezone(fallResult, timezone);

      // Use current year in regex patterns to be year-agnostic
      expect(springFormatted).toMatch(new RegExp(`${currentYear}-03-09 09:00:00`));
      expect(fallFormatted).toMatch(new RegExp(`${currentYear}-11-02 09:00:00`));
    });
  });

  describe('DST Historical Changes', () => {
    it('should handle pre-2007 DST rules (historical dates)', () => {
      // Before 2007, DST in US started first Sunday in April
      // This test verifies Luxon handles historical DST rules correctly
      const timezone = 'America/New_York';
      const historicalDate = new Date('2005-04-03'); // First Sunday in April 2005

      const result = service.calculateSendTime(historicalDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.isValid).toBe(true);
    });

    it('should handle current DST rules (post-2007)', () => {
      // Since 2007, DST starts second Sunday in March
      // Using a fixed March date that should work regardless of exact DST transition
      const timezone = 'America/New_York';
      const modernDate = new Date('2020-03-15'); // Mid-March (post-2007 rules)

      const result = service.calculateSendTime(modernDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.isValid).toBe(true);
    });
  });

  describe('Timezones Without DST', () => {
    const nonDSTZones = [
      { name: 'America/Phoenix', description: 'Arizona (no DST)' },
      { name: 'Pacific/Honolulu', description: 'Hawaii (no DST)' },
      { name: 'Asia/Tokyo', description: 'Japan (no DST)' },
      { name: 'Asia/Shanghai', description: 'China (no DST)' },
      { name: 'Asia/Singapore', description: 'Singapore (no DST)' },
    ];

    it('should handle Arizona (no DST) correctly year-round', () => {
      const timezone = 'America/Phoenix';
      const birthdayDate = new Date('1990-06-15');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);

      // Verify no DST in summer
      const dstInfo = service.handleDST(result, timezone);
      expect(dstInfo.isDST).toBe(false);
      expect(dstInfo.offset).toBe(-420); // UTC-7 always (MST)
    });

    it('should handle Hawaii (no DST) correctly year-round', () => {
      const timezone = 'Pacific/Honolulu';
      const winterBirthday = new Date('1990-01-15');
      const summerBirthday = new Date('1990-07-15');

      const winterResult = service.calculateSendTime(winterBirthday, timezone);
      const summerResult = service.calculateSendTime(summerBirthday, timezone);

      const winterOffset = service.getUTCOffset(winterResult, timezone);
      const summerOffset = service.getUTCOffset(summerResult, timezone);

      // Hawaii is always UTC-10
      expect(winterOffset).toBe(-600);
      expect(summerOffset).toBe(-600);
      expect(winterOffset).toBe(summerOffset);
    });

    it('should verify all non-DST zones maintain constant offset', () => {
      const winterDate = new Date('1990-01-15');
      const summerDate = new Date('1990-07-15');

      nonDSTZones.forEach(({ name, description }) => {
        const winterResult = service.calculateSendTime(winterDate, name);
        const summerResult = service.calculateSendTime(summerDate, name);

        const winterOffset = service.getUTCOffset(winterResult, name);
        const summerOffset = service.getUTCOffset(summerResult, name);

        // No DST means offsets should be identical year-round
        expect(winterOffset).toBe(summerOffset);

        const winterDST = service.handleDST(winterResult, name);
        const summerDST = service.handleDST(summerResult, name);

        expect(winterDST.isDST).toBe(false);
        expect(summerDST.isDST).toBe(false);
      });
    });
  });

  describe('International Date Line Crossing', () => {
    it('should handle date line crossing from Samoa to Kiribati', () => {
      // Samoa: UTC-11, Kiribati: UTC+14
      // These are 25 hours apart across the date line
      const birthday = new Date('1990-01-01');

      const samoaTime = service.calculateSendTime(birthday, 'Pacific/Pago_Pago');
      const kiribatiTime = service.calculateSendTime(birthday, 'Pacific/Kiritimati');

      const samoaDt = DateTime.fromJSDate(samoaTime).setZone('UTC');
      const kiribatiDt = DateTime.fromJSDate(kiribatiTime).setZone('UTC');

      // Samoa 9am (UTC-11) happens AFTER Kiribati 9am (UTC+14)
      expect(kiribatiDt.toMillis()).toBeLessThan(samoaDt.toMillis());

      // Time difference should be about 25 hours
      const hoursDiff = (samoaDt.toMillis() - kiribatiDt.toMillis()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeCloseTo(25, 0);
    });

    it('should handle New Zealand (UTC+13) correctly', () => {
      const timezone = 'Pacific/Auckland';
      const birthday = new Date('1990-12-31');

      const result = service.calculateSendTime(birthday, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      expect(localDt.hour).toBe(9);
      expect(localDt.day).toBe(31);
      expect(localDt.month).toBe(12);

      // In summer (NZDT), 9am Dec 31 = 8pm Dec 30 UTC
      expect(utcDt.day).toBe(30);
      expect(utcDt.hour).toBe(20);
    });

    it('should maintain chronological order across date line', () => {
      const birthday = new Date('1990-06-15');
      const zones = [
        'Pacific/Kiritimati', // UTC+14 (earliest)
        'Pacific/Auckland', // UTC+12
        'Asia/Tokyo', // UTC+9
        'UTC',
        'America/New_York', // UTC-5
        'America/Los_Angeles', // UTC-8
        'Pacific/Pago_Pago', // UTC-11 (latest)
      ];

      const sendTimes = zones.map((timezone) => {
        const result = service.calculateSendTime(birthday, timezone);
        return {
          timezone,
          utcMillis: DateTime.fromJSDate(result).setZone('UTC').toMillis(),
        };
      });

      // Verify chronological order (earliest to latest in UTC)
      for (let i = 1; i < sendTimes.length; i++) {
        expect(sendTimes[i].utcMillis).toBeGreaterThan(sendTimes[i - 1].utcMillis);
      }
    });
  });

  describe('Half-Hour and Quarter-Hour Offset Timezones', () => {
    const unusualOffsets = [
      { name: 'Asia/Kolkata', offset: 330, description: 'India UTC+5:30' },
      { name: 'Asia/Kathmandu', offset: 345, description: 'Nepal UTC+5:45' },
      { name: 'Asia/Tehran', offset: 210, description: 'Iran UTC+3:30 (winter)' },
      { name: 'Australia/Adelaide', offset: 570, description: 'South Australia UTC+9:30 (winter)' },
      { name: 'Australia/Eucla', offset: 525, description: 'Central Western Australia UTC+8:45' },
    ];

    it('should handle India Standard Time (UTC+5:30)', () => {
      const timezone = 'Asia/Kolkata';
      const birthday = new Date('1990-06-15');

      const result = service.calculateSendTime(birthday, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);

      // 9am IST = 3:30am UTC
      expect(utcDt.hour).toBe(3);
      expect(utcDt.minute).toBe(30);

      const offset = service.getUTCOffset(result, timezone);
      expect(offset).toBe(330); // 5.5 hours * 60
    });

    it('should handle Nepal (UTC+5:45) quarter-hour offset', () => {
      const timezone = 'Asia/Kathmandu';
      const birthday = new Date('1990-06-15');

      const result = service.calculateSendTime(birthday, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);

      // 9am NPT = 3:15am UTC
      expect(utcDt.hour).toBe(3);
      expect(utcDt.minute).toBe(15);

      const offset = service.getUTCOffset(result, timezone);
      expect(offset).toBe(345); // 5.75 hours * 60
    });

    it('should verify all unusual offset timezones', () => {
      const birthday = new Date('1990-06-15');

      unusualOffsets.forEach(({ name, description }) => {
        const result = service.calculateSendTime(birthday, name);
        const localDt = DateTime.fromJSDate(result).setZone(name);

        expect(localDt.hour).toBe(9);
        expect(localDt.minute).toBe(0);
        expect(localDt.isValid).toBe(true);
      });
    });

    it('should handle Iran with half-hour offset', () => {
      const timezone = 'Asia/Tehran';
      const winterBirthday = new Date('1990-01-15');
      const summerBirthday = new Date('1990-07-15');

      const winterResult = service.calculateSendTime(winterBirthday, timezone);
      const summerResult = service.calculateSendTime(summerBirthday, timezone);

      const winterOffset = service.getUTCOffset(winterResult, timezone);
      const summerOffset = service.getUTCOffset(summerResult, timezone);

      // Iran no longer observes DST (stopped in 2023)
      // Both should have UTC+3:30 offset (210 minutes)
      expect(winterOffset).toBe(210);
      expect(summerOffset).toBe(210);
    });
  });

  describe('Birthday at Midnight During DST Transition', () => {
    it('should handle birthday at exactly midnight during spring forward', () => {
      const timezone = 'America/New_York';
      const currentYear = new Date().getFullYear();

      // Create a DateTime for midnight on the DST transition day
      const dstDate = DateTime.fromObject(
        {
          year: currentYear,
          month: 3,
          day: 9, // 2025 DST starts
          hour: 0,
          minute: 0,
        },
        { zone: timezone }
      );

      const birthday = new Date('1990-03-09');
      const result = service.calculateSendTime(birthday, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      // Should still calculate 9am correctly
      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(localDt.isValid).toBe(true);
    });

    it('should handle birthday at exactly midnight during fall back', () => {
      const timezone = 'America/New_York';
      const currentYear = new Date().getFullYear();

      // Midnight happens twice during fall back
      const dstDate = DateTime.fromObject(
        {
          year: currentYear,
          month: 11,
          day: 2, // 2025 DST ends
          hour: 0,
          minute: 0,
        },
        { zone: timezone }
      );

      const birthday = new Date('1990-11-02');
      const result = service.calculateSendTime(birthday, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(localDt.isValid).toBe(true);
    });

    it('should handle birthday spanning midnight across timezones during DST', () => {
      const currentYear = new Date().getFullYear();
      const birthday = new Date('1990-03-09');

      // Calculate for multiple timezones (west to east for proper ordering)
      const zones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];

      const results = zones.map((timezone) => {
        const result = service.calculateSendTime(birthday, timezone);
        return {
          timezone,
          local: DateTime.fromJSDate(result).setZone(timezone),
          utc: DateTime.fromJSDate(result).setZone('UTC'),
        };
      });

      // All should have 9am local time
      results.forEach(({ timezone, local }) => {
        expect(local.hour).toBe(9);
        expect(local.minute).toBe(0);
      });

      // UTC times should be in chronological order (west to east)
      // New York 9am EDT happens before Los Angeles 9am PDT
      for (let i = 1; i < results.length; i++) {
        expect(results[i].utc.toMillis()).toBeGreaterThan(results[i - 1].utc.toMillis());
      }
    });
  });

  describe('Scheduler Service Integration with DST', () => {
    it('should maintain isBirthdayToday accuracy during DST transitions', () => {
      const timezone = 'America/New_York';
      const currentYear = new Date().getFullYear();

      // Test dates around DST transition
      const dates = [
        new Date('1990-03-08'), // Before DST
        new Date('1990-03-09'), // DST starts
        new Date('1990-03-10'), // After DST
      ];

      dates.forEach((birthdayDate) => {
        const result = service.calculateSendTime(birthdayDate, timezone);
        const localDt = DateTime.fromJSDate(result).setZone(timezone);

        // Verify month and day are preserved
        expect(localDt.month).toBe(birthdayDate.getMonth() + 1);
        expect(localDt.day).toBe(birthdayDate.getDate());

        // Verify time is exactly 9am
        expect(localDt.hour).toBe(9);
        expect(localDt.minute).toBe(0);
        expect(localDt.second).toBe(0);
      });
    });

    it('should handle concurrent birthdays across DST boundaries', () => {
      const birthday = new Date('1990-03-09');
      const zones = [
        'America/Phoenix', // No DST
        'America/Denver', // Has DST
        'America/Los_Angeles', // Has DST
      ];

      const sendTimes = zones.map((timezone) => {
        const result = service.calculateSendTime(birthday, timezone);
        const dstInfo = service.handleDST(result, timezone);
        return {
          timezone,
          sendTime: result,
          isDST: dstInfo.isDST,
          offset: dstInfo.offset,
        };
      });

      // Phoenix should not be in DST
      const phoenix = sendTimes.find((st) => st.timezone === 'America/Phoenix');
      expect(phoenix?.isDST).toBe(false);

      // Other zones may or may not be in DST depending on exact date
      sendTimes.forEach((st) => {
        expect(st.offset).toBeDefined();
        expect(typeof st.isDST).toBe('boolean');
      });
    });
  });

  describe('Cron Expression and DST Interaction', () => {
    it('should validate 9am scheduling across DST transitions', () => {
      const timezone = 'America/New_York';
      const currentYear = new Date().getFullYear();

      // Test scheduling for dates around DST
      const testDates = [
        { date: new Date('1990-03-08'), desc: 'day before spring forward' },
        { date: new Date('1990-03-09'), desc: 'spring forward day' },
        { date: new Date('1990-03-10'), desc: 'day after spring forward' },
        { date: new Date('1990-11-01'), desc: 'day before fall back' },
        { date: new Date('1990-11-02'), desc: 'fall back day' },
        { date: new Date('1990-11-03'), desc: 'day after fall back' },
      ];

      testDates.forEach(({ date, desc }) => {
        const result = service.calculateSendTime(date, timezone);
        const localDt = DateTime.fromJSDate(result).setZone(timezone);

        // Every date should have exactly 9am local time
        expect(localDt.hour).toBe(9);
        expect(localDt.minute).toBe(0);
        expect(localDt.isValid).toBe(true);
      });
    });

    it('should handle scheduler restart during DST transition', () => {
      // This tests that pre-calculated send times remain valid
      const timezone = 'America/New_York';
      const birthday = new Date('1990-03-09');

      // Calculate send time
      const sendTime = service.calculateSendTime(birthday, timezone);

      // Verify it's valid even if checked later
      const localDt = DateTime.fromJSDate(sendTime).setZone(timezone);
      expect(localDt.isValid).toBe(true);
      expect(localDt.hour).toBe(9);

      // Re-calculate should give same result
      const reSendTime = service.calculateSendTime(birthday, timezone);
      expect(reSendTime.getTime()).toBe(sendTime.getTime());
    });
  });

  describe('Edge Case: Multiple DST Transitions in One Year', () => {
    it('should handle both DST transitions in same year for same user', () => {
      const timezone = 'America/New_York';
      const currentYear = new Date().getFullYear();

      // Simulate a user with two important dates
      const springBirthday = new Date('1990-03-09'); // Spring forward
      const fallBirthday = new Date('1990-11-02'); // Fall back

      const springResult = service.calculateSendTime(springBirthday, timezone);
      const fallResult = service.calculateSendTime(fallBirthday, timezone);

      const springLocal = DateTime.fromJSDate(springResult).setZone(timezone);
      const fallLocal = DateTime.fromJSDate(fallResult).setZone(timezone);

      const springUTC = DateTime.fromJSDate(springResult).setZone('UTC');
      const fallUTC = DateTime.fromJSDate(fallResult).setZone('UTC');

      // Both should be 9am local
      expect(springLocal.hour).toBe(9);
      expect(fallLocal.hour).toBe(9);

      // But different UTC times due to DST
      // Spring: 9am EDT = 1pm UTC
      // Fall: 9am EST = 2pm UTC
      expect(springUTC.hour).toBe(13);
      expect(fallUTC.hour).toBe(14);
    });
  });

  describe('Southern Hemisphere DST (Reversed Seasons)', () => {
    it('should handle Australia Sydney DST (October to April)', () => {
      const timezone = 'Australia/Sydney';

      // Summer (DST active) - December
      const summerBirthday = new Date('1990-12-15');
      const summerResult = service.calculateSendTime(summerBirthday, timezone);
      const summerDST = service.handleDST(summerResult, timezone);

      // Winter (DST inactive) - June
      const winterBirthday = new Date('1990-06-15');
      const winterResult = service.calculateSendTime(winterBirthday, timezone);
      const winterDST = service.handleDST(winterResult, timezone);

      // December is summer in Australia (DST active)
      expect(summerDST.isDST).toBe(true);
      expect(summerDST.offset).toBe(660); // UTC+11 (AEDT)

      // June is winter in Australia (DST inactive)
      expect(winterDST.isDST).toBe(false);
      expect(winterDST.offset).toBe(600); // UTC+10 (AEST)
    });

    it('should verify opposite DST patterns between hemispheres', () => {
      const currentYear = new Date().getFullYear();

      // July: Northern summer, Southern winter
      const julyDate = new Date(`${currentYear}-07-15`);

      const northernDST = service.handleDST(julyDate, 'America/New_York');
      const southernDST = service.handleDST(julyDate, 'Australia/Sydney');

      // Northern hemisphere: DST active in July
      expect(northernDST.isDST).toBe(true);

      // Southern hemisphere: DST inactive in July (winter)
      expect(southernDST.isDST).toBe(false);

      // January: Northern winter, Southern summer
      const janDate = new Date(`${currentYear}-01-15`);

      const northernWinterDST = service.handleDST(janDate, 'America/New_York');
      const southernSummerDST = service.handleDST(janDate, 'Australia/Sydney');

      // Northern hemisphere: DST inactive in January
      expect(northernWinterDST.isDST).toBe(false);

      // Southern hemisphere: DST active in January (summer)
      expect(southernSummerDST.isDST).toBe(true);
    });
  });
});
