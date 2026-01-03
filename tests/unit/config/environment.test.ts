import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

/**
 * Custom boolean coercion that properly handles string "false" and "0"
 * Standard z.coerce.boolean() treats "false" as truthy (non-empty string)
 */
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
    // For any other value, convert to boolean
    return Boolean(val);
  })
  .pipe(z.boolean());

describe('Environment Configuration - Boolean Parsing', () => {
  describe('booleanString parser', () => {
    it('should parse "true" as true', () => {
      const result = booleanString.parse('true');
      expect(result).toBe(true);
    });

    it('should parse "false" as false', () => {
      const result = booleanString.parse('false');
      expect(result).toBe(false);
    });

    it('should parse "TRUE" (uppercase) as true', () => {
      const result = booleanString.parse('TRUE');
      expect(result).toBe(true);
    });

    it('should parse "FALSE" (uppercase) as false', () => {
      const result = booleanString.parse('FALSE');
      expect(result).toBe(false);
    });

    it('should parse "1" as true', () => {
      const result = booleanString.parse('1');
      expect(result).toBe(true);
    });

    it('should parse "0" as false', () => {
      const result = booleanString.parse('0');
      expect(result).toBe(false);
    });

    it('should parse empty string as false', () => {
      const result = booleanString.parse('');
      expect(result).toBe(false);
    });

    it('should parse whitespace-padded "false" as false', () => {
      const result = booleanString.parse('  false  ');
      expect(result).toBe(false);
    });

    it('should parse whitespace-padded "true" as true', () => {
      const result = booleanString.parse('  true  ');
      expect(result).toBe(true);
    });

    it('should parse non-standard truthy string as true', () => {
      const result = booleanString.parse('yes');
      expect(result).toBe(true);
    });
  });

  describe('RATE_LIMIT_ENABLED environment variable parsing', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      // Save original environment
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    it('should correctly parse RATE_LIMIT_ENABLED=false from Docker environment', () => {
      // Simulate what Docker Compose does when setting RATE_LIMIT_ENABLED: false in YAML
      process.env.RATE_LIMIT_ENABLED = 'false';

      const schema = z.object({
        RATE_LIMIT_ENABLED: booleanString.default('true'),
      });

      const result = schema.parse(process.env);
      expect(result.RATE_LIMIT_ENABLED).toBe(false);
    });

    it('should correctly parse RATE_LIMIT_ENABLED=true from Docker environment', () => {
      process.env.RATE_LIMIT_ENABLED = 'true';

      const schema = z.object({
        RATE_LIMIT_ENABLED: booleanString.default('true'),
      });

      const result = schema.parse(process.env);
      expect(result.RATE_LIMIT_ENABLED).toBe(true);
    });

    it('should use default value when RATE_LIMIT_ENABLED is not set', () => {
      delete process.env.RATE_LIMIT_ENABLED;

      const schema = z.object({
        RATE_LIMIT_ENABLED: booleanString.default('true'),
      });

      const result = schema.parse(process.env);
      expect(result.RATE_LIMIT_ENABLED).toBe(true);
    });

    it('should handle RATE_LIMIT_ENABLED=0 as false', () => {
      process.env.RATE_LIMIT_ENABLED = '0';

      const schema = z.object({
        RATE_LIMIT_ENABLED: booleanString.default('true'),
      });

      const result = schema.parse(process.env);
      expect(result.RATE_LIMIT_ENABLED).toBe(false);
    });

    it('should handle RATE_LIMIT_ENABLED=1 as true', () => {
      process.env.RATE_LIMIT_ENABLED = '1';

      const schema = z.object({
        RATE_LIMIT_ENABLED: booleanString.default('true'),
      });

      const result = schema.parse(process.env);
      expect(result.RATE_LIMIT_ENABLED).toBe(true);
    });
  });

  describe('Comparison with z.coerce.boolean() (the broken approach)', () => {
    it('demonstrates why z.coerce.boolean() fails with string "false"', () => {
      // This is the BROKEN approach that was causing the bug
      const brokenSchema = z.object({
        RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
      });

      process.env.RATE_LIMIT_ENABLED = 'false';

      const result = brokenSchema.parse(process.env);

      // z.coerce.boolean() uses Boolean(value) which treats non-empty strings as true
      // Boolean("false") === true (because it's a non-empty string)
      expect(result.RATE_LIMIT_ENABLED).toBe(true); // WRONG! This is the bug!
    });

    it('shows that our booleanString parser correctly handles "false"', () => {
      const fixedSchema = z.object({
        RATE_LIMIT_ENABLED: booleanString.default('true'),
      });

      process.env.RATE_LIMIT_ENABLED = 'false';

      const result = fixedSchema.parse(process.env);

      // Our custom parser correctly interprets the string "false" as boolean false
      expect(result.RATE_LIMIT_ENABLED).toBe(false); // CORRECT!
    });
  });
});
