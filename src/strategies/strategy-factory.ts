import type { MessageStrategy } from './message-strategy.interface.js';
import { BirthdayMessageStrategy } from './birthday-message.strategy.js';
import { AnniversaryMessageStrategy } from './anniversary-message.strategy.js';
import { logger } from '../config/logger.js';

/**
 * MessageStrategyFactory
 *
 * Factory for managing and retrieving message strategies.
 * Implements the Factory Pattern + Singleton Pattern.
 *
 * Responsibilities:
 * - Register all available message strategies
 * - Retrieve strategy by message type
 * - List all registered strategy types
 * - Validate strategy registration
 *
 * Design patterns:
 * - Factory Pattern: Centralized strategy creation and management
 * - Singleton Pattern: Single global instance of factory
 * - Registry Pattern: Map of strategy types to strategy instances
 *
 * Benefits:
 * - Adding new message types requires only registering a new strategy
 * - No changes to core scheduler logic when adding message types
 * - Type-safe strategy retrieval with error handling
 * - Easy to test (can inject mock strategies)
 *
 * @example
 * ```typescript
 * // Get singleton instance
 * const factory = MessageStrategyFactory.getInstance();
 *
 * // Register a custom strategy
 * factory.register(new CustomMessageStrategy());
 *
 * // Get strategy by type
 * const birthdayStrategy = factory.get('BIRTHDAY');
 *
 * // Get all registered types
 * const types = factory.getAllTypes(); // ['BIRTHDAY', 'ANNIVERSARY', 'CUSTOM']
 *
 * // Get all strategies
 * const strategies = factory.getAllStrategies();
 * for (const strategy of strategies) {
 *   console.log(strategy.messageType);
 * }
 * ```
 */
export class MessageStrategyFactory {
  private static instance: MessageStrategyFactory | null = null;
  private strategies: Map<string, MessageStrategy> = new Map();

  /**
   * Private constructor to enforce singleton pattern
   * Use getInstance() to get the factory instance
   */
  private constructor() {
    logger.debug('MessageStrategyFactory constructor called');
    this.registerDefaultStrategies();
  }

  /**
   * Get the singleton instance of MessageStrategyFactory
   *
   * Creates the instance on first call, returns existing instance on subsequent calls.
   *
   * @returns MessageStrategyFactory - Singleton instance
   */
  static getInstance(): MessageStrategyFactory {
    if (!MessageStrategyFactory.instance) {
      MessageStrategyFactory.instance = new MessageStrategyFactory();
      logger.info('MessageStrategyFactory singleton instance created');
    }
    return MessageStrategyFactory.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   *
   * WARNING: Only use this in test environments!
   * Clears all registered strategies and creates a fresh instance.
   */
  static resetInstance(): void {
    MessageStrategyFactory.instance = null;
    logger.warn('MessageStrategyFactory singleton instance reset (should only happen in tests)');
  }

  /**
   * Register default message strategies
   *
   * Called automatically by constructor to set up built-in strategies.
   * Includes:
   * - BirthdayMessageStrategy
   * - AnniversaryMessageStrategy
   *
   * @private
   */
  private registerDefaultStrategies(): void {
    this.register(new BirthdayMessageStrategy());
    this.register(new AnniversaryMessageStrategy());

    logger.info(
      { registeredTypes: Array.from(this.strategies.keys()) },
      'Default message strategies registered'
    );
  }

  /**
   * Register a new message strategy
   *
   * Adds a strategy to the registry, allowing it to be used by the scheduler.
   * If a strategy with the same messageType already exists, it will be replaced.
   *
   * @param strategy - MessageStrategy implementation to register
   * @throws Error if strategy is null or has invalid messageType
   *
   * @example
   * ```typescript
   * const factory = MessageStrategyFactory.getInstance();
   * factory.register(new CustomMessageStrategy());
   * ```
   */
  register(strategy: MessageStrategy): void {
    if (!strategy) {
      throw new Error('Cannot register null or undefined strategy');
    }

    if (!strategy.messageType || typeof strategy.messageType !== 'string') {
      throw new Error('Strategy must have a valid messageType string');
    }

    const messageType = strategy.messageType.toUpperCase();

    // Warn if replacing existing strategy
    if (this.strategies.has(messageType)) {
      logger.warn({ messageType }, 'Replacing existing strategy with same messageType');
    }

    this.strategies.set(messageType, strategy);

    logger.info(
      { messageType, strategyClass: strategy.constructor.name },
      'Message strategy registered'
    );
  }

  /**
   * Get a strategy by message type
   *
   * Retrieves the registered strategy for the given message type.
   * Case-insensitive lookup (BIRTHDAY, birthday, Birthday all work).
   *
   * @param messageType - Message type to get strategy for (e.g., 'BIRTHDAY', 'ANNIVERSARY')
   * @returns MessageStrategy - Strategy implementation
   * @throws Error if no strategy is registered for the message type
   *
   * @example
   * ```typescript
   * const factory = MessageStrategyFactory.getInstance();
   * const strategy = factory.get('BIRTHDAY');
   * // Returns: BirthdayMessageStrategy instance
   * ```
   */
  get(messageType: string): MessageStrategy {
    if (!messageType || typeof messageType !== 'string') {
      throw new Error('messageType must be a non-empty string');
    }

    const normalizedType = messageType.toUpperCase();
    const strategy = this.strategies.get(normalizedType);

    if (!strategy) {
      const availableTypes = Array.from(this.strategies.keys()).join(', ');
      throw new Error(
        `No strategy registered for message type: ${messageType}. Available types: ${availableTypes}`
      );
    }

    logger.debug(
      { messageType: normalizedType, strategyClass: strategy.constructor.name },
      'Strategy retrieved from factory'
    );

    return strategy;
  }

  /**
   * Check if a strategy is registered for a message type
   *
   * @param messageType - Message type to check
   * @returns boolean - true if strategy exists, false otherwise
   *
   * @example
   * ```typescript
   * const factory = MessageStrategyFactory.getInstance();
   * const hasBirthday = factory.has('BIRTHDAY'); // true
   * const hasCustom = factory.has('CUSTOM'); // false
   * ```
   */
  has(messageType: string): boolean {
    if (!messageType || typeof messageType !== 'string') {
      return false;
    }

    const normalizedType = messageType.toUpperCase();
    return this.strategies.has(normalizedType);
  }

  /**
   * Get all registered message types
   *
   * Returns array of message type identifiers (e.g., ['BIRTHDAY', 'ANNIVERSARY'])
   * Useful for iterating through all message types in the scheduler.
   *
   * @returns string[] - Array of registered message types
   *
   * @example
   * ```typescript
   * const factory = MessageStrategyFactory.getInstance();
   * const types = factory.getAllTypes();
   * // Returns: ['BIRTHDAY', 'ANNIVERSARY']
   *
   * // Use in scheduler
   * for (const type of types) {
   *   const strategy = factory.get(type);
   *   await processMessagesForType(strategy);
   * }
   * ```
   */
  getAllTypes(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get all registered strategies
   *
   * Returns array of all strategy instances.
   * Useful for bulk operations or validation.
   *
   * @returns MessageStrategy[] - Array of all registered strategies
   *
   * @example
   * ```typescript
   * const factory = MessageStrategyFactory.getInstance();
   * const strategies = factory.getAllStrategies();
   *
   * // Validate all users for all message types
   * for (const strategy of strategies) {
   *   const result = strategy.validate(user);
   *   if (!result.valid) {
   *     console.log(`${strategy.messageType}: ${result.errors}`);
   *   }
   * }
   * ```
   */
  getAllStrategies(): MessageStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Unregister a strategy
   *
   * Removes a strategy from the registry.
   * Useful for testing or disabling specific message types.
   *
   * @param messageType - Message type to unregister
   * @returns boolean - true if strategy was removed, false if it didn't exist
   *
   * @example
   * ```typescript
   * const factory = MessageStrategyFactory.getInstance();
   * factory.unregister('ANNIVERSARY');
   * // Anniversary messages will no longer be processed
   * ```
   */
  unregister(messageType: string): boolean {
    if (!messageType || typeof messageType !== 'string') {
      return false;
    }

    const normalizedType = messageType.toUpperCase();
    const removed = this.strategies.delete(normalizedType);

    if (removed) {
      logger.info({ messageType: normalizedType }, 'Message strategy unregistered');
    } else {
      logger.debug(
        { messageType: normalizedType },
        'Attempted to unregister non-existent strategy'
      );
    }

    return removed;
  }

  /**
   * Get count of registered strategies
   *
   * @returns number - Number of registered strategies
   */
  getCount(): number {
    return this.strategies.size;
  }

  /**
   * Clear all registered strategies
   *
   * WARNING: Only use this in test environments!
   * Removes all strategies from the registry.
   */
  clear(): void {
    this.strategies.clear();
    logger.warn('All message strategies cleared (should only happen in tests)');
  }
}

// Export singleton instance for convenience
export const messageStrategyFactory = MessageStrategyFactory.getInstance();
