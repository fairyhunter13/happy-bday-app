/**
 * Message Strategy Pattern Exports
 *
 * This module provides the Strategy Pattern implementation for different message types.
 *
 * Core components:
 * - MessageStrategy: Interface for all message strategies
 * - BirthdayMessageStrategy: Implementation for birthday messages
 * - AnniversaryMessageStrategy: Implementation for anniversary messages
 * - MessageStrategyFactory: Factory for managing and retrieving strategies
 *
 * Usage:
 * ```typescript
 * import { messageStrategyFactory } from './strategies';
 *
 * // Get a strategy
 * const birthdayStrategy = messageStrategyFactory.get('BIRTHDAY');
 *
 * // Check if message should be sent
 * const shouldSend = await birthdayStrategy.shouldSend(user, new Date());
 *
 * // Get all registered types
 * const types = messageStrategyFactory.getAllTypes();
 * ```
 */

// Export interface and types
export type {
  MessageStrategy,
  MessageContext,
  Schedule,
  ValidationResult,
} from './message-strategy.interface.js';

// Export concrete strategy implementations
export { BirthdayMessageStrategy } from './birthday-message.strategy.js';
export { AnniversaryMessageStrategy } from './anniversary-message.strategy.js';

// Export factory and singleton instance
export { MessageStrategyFactory, messageStrategyFactory } from './strategy-factory.js';
