/**
 * Message Sender Service Alias
 *
 * This file re-exports MessageSenderService from message.service.ts
 * for backward compatibility and convenience.
 */

export {
  MessageSenderService,
  messageSenderService,
  type MessageResponse,
} from './message.service.js';
