import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageStrategyFactory } from '../../../src/strategies/strategy-factory.js';
import { BirthdayMessageStrategy } from '../../../src/strategies/birthday-message.strategy.js';
import { AnniversaryMessageStrategy } from '../../../src/strategies/anniversary-message.strategy.js';
import type { MessageStrategy } from '../../../src/strategies/message-strategy.interface.js';

describe('MessageStrategyFactory', () => {
  let factory: MessageStrategyFactory;

  beforeEach(() => {
    // Reset singleton instance before each test
    MessageStrategyFactory.resetInstance();
    factory = MessageStrategyFactory.getInstance();
  });

  afterEach(() => {
    // Clean up after tests
    MessageStrategyFactory.resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls to getInstance()', () => {
      const instance1 = MessageStrategyFactory.getInstance();
      const instance2 = MessageStrategyFactory.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after resetInstance()', () => {
      const instance1 = MessageStrategyFactory.getInstance();
      MessageStrategyFactory.resetInstance();
      const instance2 = MessageStrategyFactory.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it('should automatically register default strategies on initialization', () => {
      const types = factory.getAllTypes();

      expect(types).toContain('BIRTHDAY');
      expect(types).toContain('ANNIVERSARY');
      expect(types.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('register()', () => {
    it('should register a new strategy', () => {
      // Clear default strategies first
      factory.clear();

      const birthdayStrategy = new BirthdayMessageStrategy();
      factory.register(birthdayStrategy);

      const types = factory.getAllTypes();
      expect(types).toContain('BIRTHDAY');
    });

    it('should replace existing strategy with same messageType', () => {
      // Factory already has default BIRTHDAY strategy
      const originalCount = factory.getCount();

      // Register another BIRTHDAY strategy
      const newBirthdayStrategy = new BirthdayMessageStrategy();
      factory.register(newBirthdayStrategy);

      // Count should remain the same (replaced, not added)
      expect(factory.getCount()).toBe(originalCount);
    });

    it('should throw error when registering null strategy', () => {
      expect(() => {
        factory.register(null as any);
      }).toThrow('Cannot register null or undefined strategy');
    });

    it('should throw error when registering undefined strategy', () => {
      expect(() => {
        factory.register(undefined as any);
      }).toThrow('Cannot register null or undefined strategy');
    });

    it('should throw error when strategy has invalid messageType', () => {
      const invalidStrategy = {
        messageType: null,
      } as any;

      expect(() => {
        factory.register(invalidStrategy);
      }).toThrow('Strategy must have a valid messageType string');
    });

    it('should normalize messageType to uppercase', () => {
      factory.clear();

      const strategy = new BirthdayMessageStrategy();
      factory.register(strategy);

      // Should be able to retrieve with lowercase
      const retrieved = factory.get('birthday');
      expect(retrieved).toBeDefined();
      expect(retrieved.messageType).toBe('BIRTHDAY');
    });
  });

  describe('get()', () => {
    it('should retrieve registered strategy by messageType', () => {
      const strategy = factory.get('BIRTHDAY');

      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(BirthdayMessageStrategy);
      expect(strategy.messageType).toBe('BIRTHDAY');
    });

    it('should be case-insensitive', () => {
      const strategy1 = factory.get('BIRTHDAY');
      const strategy2 = factory.get('birthday');
      const strategy3 = factory.get('Birthday');

      expect(strategy1).toBe(strategy2);
      expect(strategy2).toBe(strategy3);
    });

    it('should throw error when strategy not found', () => {
      expect(() => {
        factory.get('NONEXISTENT');
      }).toThrow('No strategy registered for message type: NONEXISTENT');
    });

    it('should include available types in error message', () => {
      try {
        factory.get('NONEXISTENT');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('Available types:');
        expect((error as Error).message).toContain('BIRTHDAY');
        expect((error as Error).message).toContain('ANNIVERSARY');
      }
    });

    it('should throw error for null messageType', () => {
      expect(() => {
        factory.get(null as any);
      }).toThrow('messageType must be a non-empty string');
    });

    it('should throw error for undefined messageType', () => {
      expect(() => {
        factory.get(undefined as any);
      }).toThrow('messageType must be a non-empty string');
    });

    it('should throw error for empty string messageType', () => {
      expect(() => {
        factory.get('');
      }).toThrow('messageType must be a non-empty string');
    });
  });

  describe('has()', () => {
    it('should return true for registered strategy', () => {
      expect(factory.has('BIRTHDAY')).toBe(true);
      expect(factory.has('ANNIVERSARY')).toBe(true);
    });

    it('should return false for unregistered strategy', () => {
      expect(factory.has('NONEXISTENT')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(factory.has('birthday')).toBe(true);
      expect(factory.has('Birthday')).toBe(true);
      expect(factory.has('BIRTHDAY')).toBe(true);
    });

    it('should return false for null messageType', () => {
      expect(factory.has(null as any)).toBe(false);
    });

    it('should return false for undefined messageType', () => {
      expect(factory.has(undefined as any)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(factory.has('')).toBe(false);
    });
  });

  describe('getAllTypes()', () => {
    it('should return all registered message types', () => {
      const types = factory.getAllTypes();

      expect(types).toContain('BIRTHDAY');
      expect(types).toContain('ANNIVERSARY');
      expect(types.length).toBe(2);
    });

    it('should return empty array when no strategies registered', () => {
      factory.clear();
      const types = factory.getAllTypes();

      expect(types).toEqual([]);
    });

    it('should return updated list after registering new strategy', () => {
      factory.clear();

      factory.register(new BirthdayMessageStrategy());
      expect(factory.getAllTypes()).toEqual(['BIRTHDAY']);

      factory.register(new AnniversaryMessageStrategy());
      expect(factory.getAllTypes()).toContain('BIRTHDAY');
      expect(factory.getAllTypes()).toContain('ANNIVERSARY');
      expect(factory.getAllTypes().length).toBe(2);
    });
  });

  describe('getAllStrategies()', () => {
    it('should return all registered strategy instances', () => {
      const strategies = factory.getAllStrategies();

      expect(strategies.length).toBe(2);
      expect(strategies.some(s => s.messageType === 'BIRTHDAY')).toBe(true);
      expect(strategies.some(s => s.messageType === 'ANNIVERSARY')).toBe(true);
    });

    it('should return empty array when no strategies registered', () => {
      factory.clear();
      const strategies = factory.getAllStrategies();

      expect(strategies).toEqual([]);
    });

    it('should return actual strategy instances', () => {
      const strategies = factory.getAllStrategies();

      for (const strategy of strategies) {
        expect(strategy).toHaveProperty('messageType');
        expect(strategy).toHaveProperty('shouldSend');
        expect(strategy).toHaveProperty('calculateSendTime');
        expect(strategy).toHaveProperty('composeMessage');
        expect(strategy).toHaveProperty('getSchedule');
        expect(strategy).toHaveProperty('validate');
      }
    });
  });

  describe('unregister()', () => {
    it('should remove a registered strategy', () => {
      expect(factory.has('BIRTHDAY')).toBe(true);

      const removed = factory.unregister('BIRTHDAY');

      expect(removed).toBe(true);
      expect(factory.has('BIRTHDAY')).toBe(false);
    });

    it('should return false when unregistering non-existent strategy', () => {
      const removed = factory.unregister('NONEXISTENT');

      expect(removed).toBe(false);
    });

    it('should be case-insensitive', () => {
      const removed = factory.unregister('birthday');

      expect(removed).toBe(true);
      expect(factory.has('BIRTHDAY')).toBe(false);
    });

    it('should return false for null messageType', () => {
      const removed = factory.unregister(null as any);

      expect(removed).toBe(false);
    });

    it('should return false for undefined messageType', () => {
      const removed = factory.unregister(undefined as any);

      expect(removed).toBe(false);
    });
  });

  describe('getCount()', () => {
    it('should return correct count of registered strategies', () => {
      expect(factory.getCount()).toBe(2); // BIRTHDAY and ANNIVERSARY
    });

    it('should return 0 when no strategies registered', () => {
      factory.clear();
      expect(factory.getCount()).toBe(0);
    });

    it('should update count after registering new strategy', () => {
      factory.clear();
      expect(factory.getCount()).toBe(0);

      factory.register(new BirthdayMessageStrategy());
      expect(factory.getCount()).toBe(1);

      factory.register(new AnniversaryMessageStrategy());
      expect(factory.getCount()).toBe(2);
    });

    it('should update count after unregistering strategy', () => {
      const initialCount = factory.getCount();
      factory.unregister('BIRTHDAY');

      expect(factory.getCount()).toBe(initialCount - 1);
    });
  });

  describe('clear()', () => {
    it('should remove all registered strategies', () => {
      expect(factory.getCount()).toBeGreaterThan(0);

      factory.clear();

      expect(factory.getCount()).toBe(0);
      expect(factory.getAllTypes()).toEqual([]);
      expect(factory.getAllStrategies()).toEqual([]);
    });

    it('should allow re-registering after clear', () => {
      factory.clear();

      factory.register(new BirthdayMessageStrategy());

      expect(factory.getCount()).toBe(1);
      expect(factory.has('BIRTHDAY')).toBe(true);
    });
  });

  describe('Integration - Adding new message type', () => {
    it('should support adding custom message type', () => {
      // Create a mock custom strategy
      const customStrategy: MessageStrategy = {
        messageType: 'CUSTOM',
        async shouldSend() { return true; },
        calculateSendTime() { return new Date(); },
        async composeMessage() { return 'Custom message'; },
        getSchedule() { return { cadence: 'YEARLY', triggerField: 'customDate' }; },
        validate() { return { valid: true, errors: [] }; },
      };

      // Register custom strategy
      factory.register(customStrategy);

      // Verify it's registered
      expect(factory.has('CUSTOM')).toBe(true);
      expect(factory.getCount()).toBe(3); // BIRTHDAY, ANNIVERSARY, CUSTOM

      // Verify we can retrieve it
      const retrieved = factory.get('CUSTOM');
      expect(retrieved.messageType).toBe('CUSTOM');
    });

    it('should iterate through all strategies including custom ones', () => {
      const customStrategy: MessageStrategy = {
        messageType: 'CUSTOM',
        async shouldSend() { return true; },
        calculateSendTime() { return new Date(); },
        async composeMessage() { return 'Custom message'; },
        getSchedule() { return { cadence: 'YEARLY', triggerField: 'customDate' }; },
        validate() { return { valid: true, errors: [] }; },
      };

      factory.register(customStrategy);

      const strategies = factory.getAllStrategies();
      const types = strategies.map(s => s.messageType);

      expect(types).toContain('BIRTHDAY');
      expect(types).toContain('ANNIVERSARY');
      expect(types).toContain('CUSTOM');
    });
  });

  describe('Error handling', () => {
    it('should provide helpful error message when strategy not found', () => {
      try {
        factory.get('UNKNOWN');
        expect.fail('Should have thrown error');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('No strategy registered');
        expect(message).toContain('UNKNOWN');
        expect(message).toContain('Available types');
      }
    });

    it('should validate strategy interface on registration', () => {
      const invalidStrategy = {
        messageType: 'INVALID',
        // Missing required methods
      } as any;

      // Should not throw on registration (duck typing in JS/TS)
      // But will fail when trying to use the strategy
      expect(() => {
        factory.register(invalidStrategy);
      }).not.toThrow();
    });
  });
});
