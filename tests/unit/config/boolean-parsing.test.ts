import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Standalone tests demonstrating the boolean parsing bug and fix
 * These tests don't require environment setup
 */

describe('Boolean Parsing - Standalone Demonstration', () => {
  describe('JavaScript Boolean() coercion behavior', () => {
    it('demonstrates that Boolean("false") returns true (the bug)', () => {
      // This is the root cause of the rate limiting bug
      expect(Boolean('false')).toBe(true); // ❌ Any non-empty string is truthy!
      expect(Boolean('0')).toBe(true); // ❌ Also truthy!
      expect(Boolean('no')).toBe(true); // ❌ Also truthy!
      expect(Boolean('disabled')).toBe(true); // ❌ Also truthy!

      // Only empty string, 0, null, undefined, false are falsy
      expect(Boolean('')).toBe(false);
      expect(Boolean(0)).toBe(false);
      expect(Boolean(false)).toBe(false);
    });

    it('demonstrates that z.coerce.boolean() has the same bug', () => {
      const buggySchema = z.coerce.boolean();

      // These all return true because z.coerce.boolean() uses Boolean()
      expect(buggySchema.parse('false')).toBe(true); // ❌ BUG!
      expect(buggySchema.parse('0')).toBe(true); // ❌ BUG!
      expect(buggySchema.parse('no')).toBe(true); // ❌ BUG!

      // Only falsy values work
      expect(buggySchema.parse('')).toBe(false);
      expect(buggySchema.parse(false)).toBe(false);
      expect(buggySchema.parse(0)).toBe(false);
    });
  });

  describe('Custom booleanString parser (the fix)', () => {
    const booleanString = z
      .string()
      .transform((val) => {
        const normalized = val.toLowerCase().trim();
        if (normalized === 'false' || normalized === '0' || normalized === '') {
          return false;
        }
        if (normalized === 'true' || normalized === '1') {
          return true;
        }
        return Boolean(val);
      })
      .pipe(z.boolean());

    it('correctly parses "false" as false', () => {
      expect(booleanString.parse('false')).toBe(false); // ✅ Fixed!
    });

    it('correctly parses "true" as true', () => {
      expect(booleanString.parse('true')).toBe(true);
    });

    it('correctly parses "0" as false', () => {
      expect(booleanString.parse('0')).toBe(false); // ✅ Fixed!
    });

    it('correctly parses "1" as true', () => {
      expect(booleanString.parse('1')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(booleanString.parse('FALSE')).toBe(false);
      expect(booleanString.parse('TRUE')).toBe(true);
      expect(booleanString.parse('False')).toBe(false);
      expect(booleanString.parse('True')).toBe(true);
    });

    it('trims whitespace', () => {
      expect(booleanString.parse('  false  ')).toBe(false);
      expect(booleanString.parse('  true  ')).toBe(true);
    });

    it('handles empty string as false', () => {
      expect(booleanString.parse('')).toBe(false);
    });

    it('uses Boolean() for other values', () => {
      // These fall back to standard Boolean() coercion
      expect(booleanString.parse('yes')).toBe(true);
      expect(booleanString.parse('no')).toBe(true); // Non-standard, but consistent
    });
  });

  describe('Real-world Docker Compose scenario', () => {
    it('simulates Docker Compose setting RATE_LIMIT_ENABLED=false', () => {
      // Docker Compose converts YAML `false` to the string "false"
      const dockerEnvValue = 'false';

      // The buggy approach (what we had before)
      const buggySchema = z.object({
        RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
      });

      // Simulate environment: { RATE_LIMIT_ENABLED: 'false' }
      const buggyResult = buggySchema.parse({ RATE_LIMIT_ENABLED: dockerEnvValue });

      // BUG: This returns true, so rate limiting stays active!
      expect(buggyResult.RATE_LIMIT_ENABLED).toBe(true); // ❌ BUG!

      // The fixed approach (what we have now)
      const booleanString = z
        .string()
        .transform((val) => {
          const normalized = val.toLowerCase().trim();
          if (normalized === 'false' || normalized === '0' || normalized === '') {
            return false;
          }
          if (normalized === 'true' || normalized === '1') {
            return true;
          }
          return Boolean(val);
        })
        .pipe(z.boolean());

      const fixedSchema = z.object({
        RATE_LIMIT_ENABLED: booleanString.default('true'),
      });

      const fixedResult = fixedSchema.parse({ RATE_LIMIT_ENABLED: dockerEnvValue });

      // FIXED: This correctly returns false!
      expect(fixedResult.RATE_LIMIT_ENABLED).toBe(false); // ✅ FIXED!
    });

    it('demonstrates the complete fix flow', () => {
      // 1. Docker Compose YAML sets: RATE_LIMIT_ENABLED: false
      // 2. Docker converts to environment variable: RATE_LIMIT_ENABLED="false"
      const dockerValue = 'false';

      // 3. Our custom parser correctly interprets it
      const booleanString = z
        .string()
        .transform((val) => {
          const normalized = val.toLowerCase().trim();
          if (normalized === 'false' || normalized === '0' || normalized === '') {
            return false;
          }
          if (normalized === 'true' || normalized === '1') {
            return true;
          }
          return Boolean(val);
        })
        .pipe(z.boolean());

      const parsed = booleanString.parse(dockerValue);

      // 4. Result is boolean false (correct!)
      expect(parsed).toBe(false);
      expect(typeof parsed).toBe('boolean');

      // 5. The application correctly skips rate limiting registration
      if (parsed === true) {
        throw new Error('Should not register rate limiting!');
      } else {
        // Rate limiting is correctly disabled
        expect(parsed).toBe(false);
      }
    });
  });

  describe('Edge cases and validation', () => {
    const booleanString = z
      .string()
      .transform((val) => {
        const normalized = val.toLowerCase().trim();
        if (normalized === 'false' || normalized === '0' || normalized === '') {
          return false;
        }
        if (normalized === 'true' || normalized === '1') {
          return true;
        }
        return Boolean(val);
      })
      .pipe(z.boolean());

    it('handles mixed case correctly', () => {
      expect(booleanString.parse('FaLsE')).toBe(false);
      expect(booleanString.parse('TrUe')).toBe(true);
    });

    it('handles whitespace variations', () => {
      expect(booleanString.parse('\tfalse\n')).toBe(false);
      expect(booleanString.parse('\ttrue\n')).toBe(true);
    });

    it('handles numeric strings', () => {
      expect(booleanString.parse('0')).toBe(false);
      expect(booleanString.parse('1')).toBe(true);
    });
  });
});
