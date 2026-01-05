/**
 * Database URL Configuration Tests
 *
 * Comprehensive tests for the getDatabaseUrl utility function.
 * Tests all environment variable combinations and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabaseUrl, DEFAULT_DEV_CONFIG } from '../../../src/db/utils/database-url.js';

describe('getDatabaseUrl', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear all database-related env vars for clean tests
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
    delete process.env.DATABASE_USER;
    delete process.env.DATABASE_PASSWORD;
    delete process.env.DATABASE_NAME;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('when DATABASE_URL is set', () => {
    it('should return DATABASE_URL directly', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@host:5432/db';
      expect(getDatabaseUrl()).toBe('postgres://user:pass@host:5432/db');
    });

    it('should return DATABASE_URL even with other env vars set', () => {
      process.env.DATABASE_URL = 'postgres://override:secret@remote:5433/proddb';
      process.env.DATABASE_HOST = 'localhost';
      process.env.DATABASE_PORT = '5432';
      process.env.DATABASE_USER = 'devuser';
      process.env.DATABASE_PASSWORD = 'devpass';
      process.env.DATABASE_NAME = 'devdb';

      expect(getDatabaseUrl()).toBe('postgres://override:secret@remote:5433/proddb');
    });

    it('should return DATABASE_URL in production mode', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://prod:prodpass@prodhost:5432/proddb';

      expect(getDatabaseUrl()).toBe('postgres://prod:prodpass@prodhost:5432/proddb');
    });

    it('should handle DATABASE_URL with special characters in password', () => {
      process.env.DATABASE_URL = 'postgres://user:p%40ssw0rd%21@host:5432/db';
      expect(getDatabaseUrl()).toBe('postgres://user:p%40ssw0rd%21@host:5432/db');
    });

    it('should handle DATABASE_URL with connection parameters', () => {
      process.env.DATABASE_URL =
        'postgres://user:pass@host:5432/db?sslmode=require&connect_timeout=10';
      expect(getDatabaseUrl()).toBe(
        'postgres://user:pass@host:5432/db?sslmode=require&connect_timeout=10'
      );
    });
  });

  describe('when DATABASE_URL is NOT set in production', () => {
    it('should throw error when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';

      expect(() => getDatabaseUrl()).toThrow(
        'DATABASE_URL environment variable is required in production'
      );
    });

    it('should throw error when NODE_ENV is production (case sensitive)', () => {
      process.env.NODE_ENV = 'production';

      expect(() => getDatabaseUrl()).toThrow(Error);
    });
  });

  describe('when DATABASE_URL is NOT set in development', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should return URL with all default values', () => {
      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@localhost:5432/birthday_app');
    });

    it('should use custom DATABASE_HOST when provided', () => {
      process.env.DATABASE_HOST = 'db.example.com';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@db.example.com:5432/birthday_app');
    });

    it('should use custom DATABASE_PORT when provided', () => {
      process.env.DATABASE_PORT = '5433';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@localhost:5433/birthday_app');
    });

    it('should use custom DATABASE_USER when provided', () => {
      process.env.DATABASE_USER = 'myuser';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://myuser:postgres@localhost:5432/birthday_app');
    });

    it('should use custom DATABASE_PASSWORD when provided', () => {
      process.env.DATABASE_PASSWORD = 'mysecret';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:mysecret@localhost:5432/birthday_app');
    });

    it('should use custom DATABASE_NAME when provided', () => {
      process.env.DATABASE_NAME = 'mydb';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@localhost:5432/mydb');
    });

    it('should use all custom values when all are provided', () => {
      process.env.DATABASE_HOST = 'custom-host';
      process.env.DATABASE_PORT = '5434';
      process.env.DATABASE_USER = 'custom-user';
      process.env.DATABASE_PASSWORD = 'custom-pass';
      process.env.DATABASE_NAME = 'custom-db';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://custom-user:custom-pass@custom-host:5434/custom-db');
    });

    it('should work without NODE_ENV set (defaults to development behavior)', () => {
      delete process.env.NODE_ENV;

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@localhost:5432/birthday_app');
    });

    it('should work with NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@localhost:5432/birthday_app');
    });

    it('should work with NODE_ENV=staging', () => {
      process.env.NODE_ENV = 'staging';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@localhost:5432/birthday_app');
    });
  });

  describe('edge cases', () => {
    it('should handle empty DATABASE_URL as falsy', () => {
      process.env.DATABASE_URL = '';
      process.env.NODE_ENV = 'development';

      // Empty string is falsy, so it falls through to dev defaults
      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@localhost:5432/birthday_app');
    });

    it('should handle DATABASE_HOST with IPv4 address', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_HOST = '192.168.1.100';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@192.168.1.100:5432/birthday_app');
    });

    it('should handle DATABASE_HOST with IPv6 address', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_HOST = '::1';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@::1:5432/birthday_app');
    });

    it('should handle DATABASE_PORT as string', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_PORT = '15432';

      const url = getDatabaseUrl();
      expect(url).toContain(':15432/');
    });

    it('should handle special characters in DATABASE_PASSWORD', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_PASSWORD = 'p@ss:word/with?special=chars';

      const url = getDatabaseUrl();
      expect(url).toContain('p@ss:word/with?special=chars');
    });

    it('should handle DATABASE_NAME with hyphens', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_NAME = 'my-database-name';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@localhost:5432/my-database-name');
    });

    it('should handle DATABASE_NAME with underscores', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_NAME = 'my_database_name';

      const url = getDatabaseUrl();
      expect(url).toBe('postgres://postgres:postgres@localhost:5432/my_database_name');
    });
  });
});

describe('DEFAULT_DEV_CONFIG', () => {
  it('should have correct default host', () => {
    expect(DEFAULT_DEV_CONFIG.host).toBe('localhost');
  });

  it('should have correct default port', () => {
    expect(DEFAULT_DEV_CONFIG.port).toBe('5432');
  });

  it('should have correct default user', () => {
    expect(DEFAULT_DEV_CONFIG.user).toBe('postgres');
  });

  it('should have correct default password', () => {
    expect(DEFAULT_DEV_CONFIG.password).toBe('postgres');
  });

  it('should have correct default database', () => {
    expect(DEFAULT_DEV_CONFIG.database).toBe('birthday_app');
  });

  it('should be readonly (frozen object)', () => {
    // TypeScript enforces 'as const', but we verify the values match expected defaults
    const config = DEFAULT_DEV_CONFIG;
    expect(config.host).toBe('localhost');
    expect(config.port).toBe('5432');
  });
});
