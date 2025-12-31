/**
 * Timezone Rare Offsets Tests
 *
 * Comprehensive tests for timezones with unusual UTC offsets including:
 * - Nepal (UTC+5:45)
 * - Chatham Islands (UTC+12:45/+13:45 with DST)
 * - India (UTC+5:30)
 * - Afghanistan (UTC+4:30)
 * - Other 15-minute and 30-minute offset timezones
 *
 * Covers:
 * - Accurate time calculations with fractional hour offsets
 * - DST handling for rare offset zones
 * - UTC conversion accuracy
 * - Message scheduling precision
 *
 * Related edge cases: EC-TZ-013 to EC-TZ-015 from edge-cases-catalog.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DateTime } from 'luxon';
import { TimezoneService } from '../../src/services/timezone.service.js';

describe('Timezone Rare Offsets', () => {
  let service: TimezoneService;

  beforeEach(() => {
    service = new TimezoneService();
  });

  describe('Nepal (UTC+5:45)', () => {
    const timezone = 'Asia/Kathmandu'; // Nepal Standard Time (NPT)

    it('should validate Asia/Kathmandu timezone', () => {
      const isValid = service.isValidTimezone(timezone);
      expect(isValid).toBe(true);
    });

    it('should calculate correct UTC offset for Nepal', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const offset = service.getUTCOffset(date, timezone);

      // UTC+5:45 = 345 minutes (5 * 60 + 45)
      expect(offset).toBe(345);
    });

    it('should handle birthday at 9am NPT', () => {
      const birthdayDate = new Date('1990-12-30');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      // Should be 9am in Nepal
      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(localDt.month).toBe(12);
      expect(localDt.day).toBe(30);
    });

    it('should correctly convert 9am NPT to UTC', () => {
      const birthdayDate = new Date('1990-06-15');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // 9am NPT = 3:15am UTC (9:00 - 5:45)
      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(utcDt.hour).toBe(3);
      expect(utcDt.minute).toBe(15);
    });

    it('should verify Nepal has no DST', () => {
      const winterDate = new Date('2025-01-15T12:00:00Z');
      const summerDate = new Date('2025-07-15T12:00:00Z');

      const winterDst = service.handleDST(winterDate, timezone);
      const summerDst = service.handleDST(summerDate, timezone);

      // Nepal doesn't observe DST
      expect(winterDst.isDST).toBe(false);
      expect(summerDst.isDST).toBe(false);
      expect(winterDst.offset).toBe(345);
      expect(summerDst.offset).toBe(345);
    });

    it('should handle precise minute offset in timezone conversion', () => {
      const date = new Date('2025-06-15T03:15:00Z'); // Should be 9am NPT
      const dt = DateTime.fromJSDate(date).setZone(timezone);

      expect(dt.hour).toBe(9);
      expect(dt.minute).toBe(0);
    });

    it('should format date correctly in Nepal timezone', () => {
      const birthdayDate = new Date('1990-06-15');
      const result = service.calculateSendTime(birthdayDate, timezone);

      const formatted = service.formatDateInTimezone(result, timezone);

      expect(formatted).toMatch(/2025-06-15 09:00:00/);
    });

    it('should handle current time in Nepal timezone', () => {
      const currentTime = service.getCurrentTimeInTimezone(timezone);

      expect(currentTime.isValid).toBe(true);
      expect(currentTime.zoneName).toBe(timezone);
      expect(currentTime.offset).toBe(345);
    });
  });

  describe('Chatham Islands (UTC+12:45/+13:45)', () => {
    const timezone = 'Pacific/Chatham'; // Chatham Islands

    it('should validate Pacific/Chatham timezone', () => {
      const isValid = service.isValidTimezone(timezone);
      expect(isValid).toBe(true);
    });

    it('should calculate correct UTC offset for Chatham (standard time)', () => {
      // During standard time (winter in southern hemisphere)
      const winterDate = new Date('2025-07-15T12:00:00Z');
      const offset = service.getUTCOffset(winterDate, timezone);

      // UTC+12:45 = 765 minutes (12 * 60 + 45)
      expect(offset).toBe(765);
    });

    it('should calculate correct UTC offset for Chatham (DST)', () => {
      // During DST (summer in southern hemisphere)
      const summerDate = new Date('2025-01-15T12:00:00Z');
      const offset = service.getUTCOffset(summerDate, timezone);

      // UTC+13:45 = 825 minutes (13 * 60 + 45)
      expect(offset).toBe(825);
    });

    it('should handle birthday at 9am CHAST (standard time)', () => {
      const birthdayDate = new Date('1990-07-15'); // Winter in southern hemisphere

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(localDt.month).toBe(7);
      expect(localDt.day).toBe(15);
    });

    it('should handle birthday at 9am CHADT (DST)', () => {
      const birthdayDate = new Date('1990-01-15'); // Summer in southern hemisphere

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(localDt.month).toBe(1);
      expect(localDt.day).toBe(15);
    });

    it('should correctly convert 9am CHAST to UTC', () => {
      const birthdayDate = new Date('1990-07-15');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // 9am CHAST (UTC+12:45) = 8:15pm previous day UTC
      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(utcDt.hour).toBe(20); // 8pm
      expect(utcDt.minute).toBe(15);
      expect(utcDt.day).toBe(14); // Previous day
    });

    it('should verify Chatham Islands observes DST', () => {
      const winterDate = new Date('2025-07-15T12:00:00Z');
      const summerDate = new Date('2025-01-15T12:00:00Z');

      const winterDst = service.handleDST(winterDate, timezone);
      const summerDst = service.handleDST(summerDate, timezone);

      // Southern hemisphere: winter = no DST, summer = DST
      expect(winterDst.isDST).toBe(false);
      expect(summerDst.isDST).toBe(true);
      expect(winterDst.offset).toBe(765); // UTC+12:45
      expect(summerDst.offset).toBe(825); // UTC+13:45
    });

    it('should handle DST transition in Chatham Islands', () => {
      // Chatham Islands DST starts last Sunday in September
      // This is an approximate test
      const beforeDST = new Date('2025-09-01T12:00:00Z');
      const afterDST = new Date('2025-10-15T12:00:00Z');

      const beforeOffset = service.getUTCOffset(beforeDST, timezone);
      const afterOffset = service.getUTCOffset(afterDST, timezone);

      // After DST starts, offset increases by 60 minutes
      expect(afterOffset).toBe(beforeOffset + 60);
    });
  });

  describe('India (UTC+5:30)', () => {
    const timezone = 'Asia/Kolkata'; // Indian Standard Time (IST)

    it('should validate Asia/Kolkata timezone', () => {
      const isValid = service.isValidTimezone(timezone);
      expect(isValid).toBe(true);
    });

    it('should calculate correct UTC offset for India', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const offset = service.getUTCOffset(date, timezone);

      // UTC+5:30 = 330 minutes (5 * 60 + 30)
      expect(offset).toBe(330);
    });

    it('should handle birthday at 9am IST', () => {
      const birthdayDate = new Date('1990-12-30');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(localDt.month).toBe(12);
      expect(localDt.day).toBe(30);
    });

    it('should correctly convert 9am IST to UTC', () => {
      const birthdayDate = new Date('1990-06-15');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // 9am IST = 3:30am UTC (9:00 - 5:30)
      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(utcDt.hour).toBe(3);
      expect(utcDt.minute).toBe(30);
    });

    it('should verify India has no DST', () => {
      const winterDate = new Date('2025-01-15T12:00:00Z');
      const summerDate = new Date('2025-07-15T12:00:00Z');

      const winterDst = service.handleDST(winterDate, timezone);
      const summerDst = service.handleDST(summerDate, timezone);

      expect(winterDst.isDST).toBe(false);
      expect(summerDst.isDST).toBe(false);
      expect(winterDst.offset).toBe(330);
      expect(summerDst.offset).toBe(330);
    });

    it('should handle precise 30-minute offset', () => {
      const date = new Date('2025-06-15T03:30:00Z'); // Should be 9am IST
      const dt = DateTime.fromJSDate(date).setZone(timezone);

      expect(dt.hour).toBe(9);
      expect(dt.minute).toBe(0);
    });

    it('should handle birthday message scheduling in India', () => {
      const birthdayDate = new Date('1990-01-01');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.month).toBe(1);
      expect(localDt.day).toBe(1);
    });
  });

  describe('Afghanistan (UTC+4:30)', () => {
    const timezone = 'Asia/Kabul'; // Afghanistan Time (AFT)

    it('should validate Asia/Kabul timezone', () => {
      const isValid = service.isValidTimezone(timezone);
      expect(isValid).toBe(true);
    });

    it('should calculate correct UTC offset for Afghanistan', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      const offset = service.getUTCOffset(date, timezone);

      // UTC+4:30 = 270 minutes (4 * 60 + 30)
      expect(offset).toBe(270);
    });

    it('should handle birthday at 9am AFT', () => {
      const birthdayDate = new Date('1990-12-30');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);

      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(localDt.month).toBe(12);
      expect(localDt.day).toBe(30);
    });

    it('should correctly convert 9am AFT to UTC', () => {
      const birthdayDate = new Date('1990-06-15');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const localDt = DateTime.fromJSDate(result).setZone(timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // 9am AFT = 4:30am UTC (9:00 - 4:30)
      expect(localDt.hour).toBe(9);
      expect(localDt.minute).toBe(0);
      expect(utcDt.hour).toBe(4);
      expect(utcDt.minute).toBe(30);
    });

    it('should verify Afghanistan has no DST', () => {
      const winterDate = new Date('2025-01-15T12:00:00Z');
      const summerDate = new Date('2025-07-15T12:00:00Z');

      const winterDst = service.handleDST(winterDate, timezone);
      const summerDst = service.handleDST(summerDate, timezone);

      expect(winterDst.isDST).toBe(false);
      expect(summerDst.isDST).toBe(false);
      expect(winterDst.offset).toBe(270);
      expect(summerDst.offset).toBe(270);
    });

    it('should handle precise 30-minute offset', () => {
      const date = new Date('2025-06-15T04:30:00Z'); // Should be 9am AFT
      const dt = DateTime.fromJSDate(date).setZone(timezone);

      expect(dt.hour).toBe(9);
      expect(dt.minute).toBe(0);
    });
  });

  describe('Other Rare Offset Timezones', () => {
    describe('Myanmar (UTC+6:30)', () => {
      const timezone = 'Asia/Yangon'; // Myanmar Time (MMT)

      it('should validate Asia/Yangon timezone', () => {
        const isValid = service.isValidTimezone(timezone);
        expect(isValid).toBe(true);
      });

      it('should calculate correct UTC offset', () => {
        const date = new Date('2025-06-15T12:00:00Z');
        const offset = service.getUTCOffset(date, timezone);

        // UTC+6:30 = 390 minutes
        expect(offset).toBe(390);
      });

      it('should handle birthday at 9am MMT', () => {
        const birthdayDate = new Date('1990-06-15');
        const result = service.calculateSendTime(birthdayDate, timezone);
        const localDt = DateTime.fromJSDate(result).setZone(timezone);

        expect(localDt.hour).toBe(9);
        expect(localDt.minute).toBe(0);
      });
    });

    describe('Iran (UTC+3:30 standard, UTC+4:30 DST)', () => {
      const timezone = 'Asia/Tehran'; // Iran Time

      it('should validate Asia/Tehran timezone', () => {
        const isValid = service.isValidTimezone(timezone);
        expect(isValid).toBe(true);
      });

      it('should handle birthday at 9am IRST', () => {
        const birthdayDate = new Date('1990-06-15');
        const result = service.calculateSendTime(birthdayDate, timezone);
        const localDt = DateTime.fromJSDate(result).setZone(timezone);

        expect(localDt.hour).toBe(9);
        expect(localDt.minute).toBe(0);
      });

      it('should handle DST in Iran', () => {
        const winterDate = new Date('2025-01-15T12:00:00Z');
        const summerDate = new Date('2025-07-15T12:00:00Z');

        const winterDst = service.handleDST(winterDate, timezone);
        const summerDst = service.handleDST(summerDate, timezone);

        expect(winterDst.isValid).toBe(true);
        expect(summerDst.isValid).toBe(true);

        // Iran observes DST (March to September)
        // Offsets: UTC+3:30 (standard), UTC+4:30 (DST)
      });
    });

    describe('Marquesas Islands (UTC-9:30)', () => {
      const timezone = 'Pacific/Marquesas'; // Marquesas Time (MART)

      it('should validate Pacific/Marquesas timezone', () => {
        const isValid = service.isValidTimezone(timezone);
        expect(isValid).toBe(true);
      });

      it('should calculate correct UTC offset', () => {
        const date = new Date('2025-06-15T12:00:00Z');
        const offset = service.getUTCOffset(date, timezone);

        // UTC-9:30 = -570 minutes
        expect(offset).toBe(-570);
      });

      it('should handle birthday at 9am MART', () => {
        const birthdayDate = new Date('1990-06-15');
        const result = service.calculateSendTime(birthdayDate, timezone);
        const localDt = DateTime.fromJSDate(result).setZone(timezone);

        expect(localDt.hour).toBe(9);
        expect(localDt.minute).toBe(0);
      });

      it('should correctly convert 9am MART to UTC', () => {
        const birthdayDate = new Date('1990-06-15');
        const result = service.calculateSendTime(birthdayDate, timezone);
        const localDt = DateTime.fromJSDate(result).setZone(timezone);
        const utcDt = DateTime.fromJSDate(result).setZone('UTC');

        // 9am MART = 6:30pm UTC (9:00 + 9:30)
        expect(localDt.hour).toBe(9);
        expect(utcDt.hour).toBe(18);
        expect(utcDt.minute).toBe(30);
      });
    });

    describe('North Korea (UTC+9)', () => {
      const timezone = 'Asia/Pyongyang'; // Pyongyang Time (PYT)

      it('should validate Asia/Pyongyang timezone', () => {
        const isValid = service.isValidTimezone(timezone);
        expect(isValid).toBe(true);
      });

      it('should handle birthday in North Korea timezone', () => {
        const birthdayDate = new Date('1990-06-15');
        const result = service.calculateSendTime(birthdayDate, timezone);
        const localDt = DateTime.fromJSDate(result).setZone(timezone);

        expect(localDt.hour).toBe(9);
        expect(localDt.minute).toBe(0);
      });
    });
  });

  describe('Comparison Across Rare Offset Timezones', () => {
    const rareOffsetTimezones = [
      { name: 'Asia/Kathmandu', offset: 345, description: 'Nepal UTC+5:45' },
      { name: 'Pacific/Chatham', offset: 765, description: 'Chatham UTC+12:45 (std)' },
      { name: 'Asia/Kolkata', offset: 330, description: 'India UTC+5:30' },
      { name: 'Asia/Kabul', offset: 270, description: 'Afghanistan UTC+4:30' },
      { name: 'Asia/Yangon', offset: 390, description: 'Myanmar UTC+6:30' },
      { name: 'Pacific/Marquesas', offset: -570, description: 'Marquesas UTC-9:30' },
    ];

    it('should validate all rare offset timezones', () => {
      rareOffsetTimezones.forEach(({ name }) => {
        const isValid = service.isValidTimezone(name);
        expect(isValid).toBe(true);
      });
    });

    it('should handle birthday scheduling in all rare offset timezones', () => {
      const birthdayDate = new Date('1990-06-15');

      const results = rareOffsetTimezones.map(({ name, description }) => {
        const result = service.calculateSendTime(birthdayDate, name);
        const localDt = DateTime.fromJSDate(result).setZone(name);

        return {
          timezone: name,
          description,
          localHour: localDt.hour,
          localMinute: localDt.minute,
          isValid: localDt.isValid,
        };
      });

      // All should have 9am local time
      results.forEach((r) => {
        expect(r.localHour).toBe(9);
        expect(r.localMinute).toBe(0);
        expect(r.isValid).toBe(true);
      });
    });

    it('should have unique UTC conversion times for different offsets', () => {
      const birthdayDate = new Date('1990-06-15');

      const utcTimes = rareOffsetTimezones.map(({ name }) => {
        const result = service.calculateSendTime(birthdayDate, name);
        const utcDt = DateTime.fromJSDate(result).setZone('UTC');
        return utcDt.toISO();
      });

      const uniqueTimes = new Set(utcTimes);
      expect(uniqueTimes.size).toBe(rareOffsetTimezones.length);
    });

    it('should handle timezone conversion between rare offset zones', () => {
      const date = new Date('2025-06-15T09:00:00Z');

      // Convert between Nepal and Chatham Islands
      const fromNepal = service.convertTimezone(date, 'Asia/Kathmandu', 'Pacific/Chatham');

      expect(fromNepal.isValid).toBe(true);
      expect(fromNepal.zoneName).toBe('Pacific/Chatham');
    });

    it('should maintain precision with minute-level offsets', () => {
      const birthdayDate = new Date('1990-06-15');

      // Test Nepal (45-minute offset)
      const nepalResult = service.calculateSendTime(birthdayDate, 'Asia/Kathmandu');
      const nepalUtc = DateTime.fromJSDate(nepalResult).setZone('UTC');

      // Should have 15-minute precision
      expect([0, 15, 30, 45]).toContain(nepalUtc.minute);
    });

    it('should handle formatting for rare offset timezones', () => {
      const birthdayDate = new Date('1990-06-15');

      rareOffsetTimezones.forEach(({ name }) => {
        const result = service.calculateSendTime(birthdayDate, name);
        const formatted = service.formatDateInTimezone(result, name);

        // Should include time with proper formatting
        expect(formatted).toMatch(/2025-06-15 09:00:00/);
      });
    });

    it('should verify offset calculations are consistent', () => {
      const date = new Date('2025-06-15T12:00:00Z');

      rareOffsetTimezones.forEach(({ name, offset, description }) => {
        const actualOffset = service.getUTCOffset(date, name);

        // For zones without DST, offset should match exactly
        // For zones with DST, offset may vary
        if (
          name === 'Asia/Kathmandu' ||
          name === 'Asia/Kolkata' ||
          name === 'Asia/Kabul' ||
          name === 'Asia/Yangon' ||
          name === 'Pacific/Marquesas'
        ) {
          // No DST zones should match exactly
          expect(actualOffset).toBe(offset);
        } else {
          // DST zones (like Chatham) may have different offset
          expect(Math.abs(actualOffset)).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Edge Cases - Minute Precision', () => {
    it('should handle exact minute boundaries for 45-minute offset', () => {
      const timezone = 'Asia/Kathmandu';
      const birthdayDate = new Date('1990-06-15');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // 9am NPT = 3:15am UTC
      expect(utcDt.hour).toBe(3);
      expect(utcDt.minute).toBe(15);
      expect(utcDt.second).toBe(0);
    });

    it('should handle exact minute boundaries for 30-minute offset', () => {
      const timezone = 'Asia/Kolkata';
      const birthdayDate = new Date('1990-06-15');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const utcDt = DateTime.fromJSDate(result).setZone('UTC');

      // 9am IST = 3:30am UTC
      expect(utcDt.hour).toBe(3);
      expect(utcDt.minute).toBe(30);
      expect(utcDt.second).toBe(0);
    });

    it('should not lose precision in milliseconds', () => {
      const timezone = 'Asia/Kathmandu';
      const birthdayDate = new Date('1990-06-15');

      const result = service.calculateSendTime(birthdayDate, timezone);
      const dt = DateTime.fromJSDate(result);

      // Should have 0 milliseconds
      expect(dt.millisecond).toBe(0);
    });
  });
});
