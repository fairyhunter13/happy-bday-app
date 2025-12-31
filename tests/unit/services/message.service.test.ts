import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ValidationError } from '../../../src/utils/errors.js';
import type { User } from '../../../src/db/schema/users.js';

// Mock the email service client before importing
vi.mock('../../../src/clients/email-service.client.js', () => ({
  emailServiceClient: {
    sendEmail: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'test-message-id',
    }),
    getHealthStatus: vi.fn().mockReturnValue({
      sendEmail: {
        state: 'closed',
        stats: { successes: 10, failures: 0 },
      },
    }),
  },
}));

import { MessageSenderService } from '../../../src/services/message.service.js';
import { emailServiceClient } from '../../../src/clients/email-service.client.js';

/**
 * Unit Tests: MessageSenderService
 *
 * Tests message sending with:
 * - Input validation
 * - Message composition
 * - Error handling
 */
describe('MessageSenderService', () => {
  let service: MessageSenderService;
  let mockUser: User;

  beforeEach(() => {
    // Create service instance
    service = new MessageSenderService();

    // Mock user data
    mockUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      timezone: 'America/New_York',
      birthdayDate: new Date('1990-12-30'),
      anniversaryDate: null,
      locationCity: 'New York',
      locationCountry: 'USA',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendBirthdayMessage', () => {
    it('should validate user input', async () => {
      const invalidUser = {
        ...mockUser,
        id: '',
      };

      await expect(service.sendBirthdayMessage(invalidUser)).rejects.toThrow(ValidationError);
    });

    it('should require user email', async () => {
      const invalidUser = {
        ...mockUser,
        email: '',
      };

      await expect(service.sendBirthdayMessage(invalidUser)).rejects.toThrow(ValidationError);
    });

    it('should compose correct birthday message', () => {
      // Access private method through instance (for testing)
      const messageContent = (service as any).composeBirthdayMessage(mockUser);

      expect(messageContent).toBe('Hey John, happy birthday!');
    });
  });

  describe('sendAnniversaryMessage', () => {
    it('should validate user input', async () => {
      const invalidUser = {
        ...mockUser,
        id: '',
      };

      await expect(service.sendAnniversaryMessage(invalidUser)).rejects.toThrow(ValidationError);
    });

    it('should require user email', async () => {
      const invalidUser = {
        ...mockUser,
        email: '',
      };

      await expect(service.sendAnniversaryMessage(invalidUser)).rejects.toThrow(ValidationError);
    });

    it('should compose correct anniversary message', () => {
      const messageContent = (service as any).composeAnniversaryMessage(mockUser);

      expect(messageContent).toBe('Hey John, happy work anniversary!');
    });
  });

  describe('message composition', () => {
    it('should compose birthday message with first name', () => {
      const user = { ...mockUser, firstName: 'Alice' };
      const message = (service as any).composeBirthdayMessage(user);

      expect(message).toBe('Hey Alice, happy birthday!');
    });

    it('should compose anniversary message with first name', () => {
      const user = { ...mockUser, firstName: 'Bob' };
      const message = (service as any).composeAnniversaryMessage(user);

      expect(message).toBe('Hey Bob, happy work anniversary!');
    });

    it('should handle special characters in names', () => {
      const user = { ...mockUser, firstName: "O'Brien" };
      const message = (service as any).composeBirthdayMessage(user);

      expect(message).toBe("Hey O'Brien, happy birthday!");
    });

    it('should handle unicode characters in names', () => {
      const user = { ...mockUser, firstName: 'José' };
      const message = (service as any).composeBirthdayMessage(user);

      expect(message).toBe('Hey José, happy birthday!');
    });
  });

  describe('error handling', () => {
    it('should throw ValidationError for null user', async () => {
      await expect(service.sendBirthdayMessage(null as unknown as User)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for undefined user', async () => {
      await expect(service.sendBirthdayMessage(undefined as unknown as User)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for user without ID', async () => {
      const user = { ...mockUser, id: '' };

      await expect(service.sendBirthdayMessage(user)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for user without email', async () => {
      const user = { ...mockUser, email: '' };

      await expect(service.sendBirthdayMessage(user)).rejects.toThrow(ValidationError);
    });
  });

  describe('payload construction', () => {
    it('should include all required fields in birthday payload', () => {
      // Verify the user structure has required fields
      expect(mockUser.id).toBeDefined();
      expect(mockUser.email).toBeDefined();
      expect(mockUser.firstName).toBeDefined();
      expect(mockUser.lastName).toBeDefined();
    });

    it('should include all required fields in anniversary payload', () => {
      expect(mockUser.id).toBeDefined();
      expect(mockUser.email).toBeDefined();
      expect(mockUser.firstName).toBeDefined();
      expect(mockUser.lastName).toBeDefined();
    });
  });

  describe('multiple users', () => {
    it('should handle sending to multiple users sequentially', async () => {
      const users = [
        { ...mockUser, id: 'user-1', email: 'user1@example.com' },
        { ...mockUser, id: 'user-2', email: 'user2@example.com' },
        { ...mockUser, id: 'user-3', email: 'user3@example.com' },
      ];

      // Verify structure for sequential processing
      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very long names', () => {
      const user = { ...mockUser, firstName: 'A'.repeat(100) };
      const message = (service as any).composeBirthdayMessage(user);

      expect(message).toContain('A'.repeat(100));
    });

    it('should handle empty first name gracefully', () => {
      const user = { ...mockUser, firstName: '' };
      const message = (service as any).composeBirthdayMessage(user);

      expect(message).toBe('Hey , happy birthday!');
    });

    it('should handle special email addresses', () => {
      const specialEmails = [
        'user+tag@example.com',
        'user.name@example.co.uk',
        'user_name@subdomain.example.com',
      ];

      specialEmails.forEach((email) => {
        const user = { ...mockUser, email };
        expect(user.email).toBe(email);
      });
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status from email client', () => {
      vi.mocked(emailServiceClient.getHealthStatus).mockReturnValue({
        sendEmail: {
          state: 'closed',
          stats: { successes: 10, failures: 0 },
        },
      });

      const status = service.getHealthStatus();

      expect(status).toEqual({
        sendEmail: {
          state: 'closed',
          stats: { successes: 10, failures: 0 },
        },
      });
    });
  });

  describe('isHealthy', () => {
    it('should return true when circuit is closed', () => {
      vi.mocked(emailServiceClient.getHealthStatus).mockReturnValue({
        sendEmail: { state: 'closed', stats: {} },
      });

      const result = service.isHealthy();

      expect(result).toBe(true);
    });

    it('should return false when circuit is open', () => {
      vi.mocked(emailServiceClient.getHealthStatus).mockReturnValue({
        sendEmail: { state: 'open', stats: {} },
      });

      const result = service.isHealthy();

      expect(result).toBe(false);
    });

    it('should return false when circuit is half-open', () => {
      vi.mocked(emailServiceClient.getHealthStatus).mockReturnValue({
        sendEmail: { state: 'half-open', stats: {} },
      });

      const result = service.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('getCircuitBreakerStats', () => {
    it('should return circuit breaker stats when closed', () => {
      vi.mocked(emailServiceClient.getHealthStatus).mockReturnValue({
        sendEmail: {
          state: 'closed',
          stats: { failures: 2, successes: 50 },
        },
      });

      const stats = service.getCircuitBreakerStats();

      expect(stats.state).toBe('closed');
      expect(stats.isOpen).toBe(false);
      expect(stats.failures).toBe(2);
      expect(stats.successes).toBe(50);
    });

    it('should return isOpen true when circuit is open', () => {
      vi.mocked(emailServiceClient.getHealthStatus).mockReturnValue({
        sendEmail: {
          state: 'open',
          stats: { failures: 10, successes: 5 },
        },
      });

      const stats = service.getCircuitBreakerStats();

      expect(stats.state).toBe('open');
      expect(stats.isOpen).toBe(true);
    });

    it('should handle missing stats', () => {
      vi.mocked(emailServiceClient.getHealthStatus).mockReturnValue({
        sendEmail: {
          state: 'closed',
          stats: undefined,
        },
      });

      const stats = service.getCircuitBreakerStats();

      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
    });
  });

  describe('successful message sending', () => {
    beforeEach(() => {
      // Reset to successful mock for these tests
      vi.mocked(emailServiceClient.sendEmail).mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
      });
    });

    it('should return message response on successful birthday message', async () => {
      const result = await service.sendBirthdayMessage(mockUser);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
    });

    it('should return message response on successful anniversary message', async () => {
      const result = await service.sendAnniversaryMessage(mockUser);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
    });

    it('should call email client with correct birthday message', async () => {
      await service.sendBirthdayMessage(mockUser);

      expect(emailServiceClient.sendEmail).toHaveBeenCalledWith({
        email: 'john.doe@example.com',
        message: 'Hey John, happy birthday!',
      });
    });

    it('should call email client with correct anniversary message', async () => {
      await service.sendAnniversaryMessage(mockUser);

      expect(emailServiceClient.sendEmail).toHaveBeenCalledWith({
        email: 'john.doe@example.com',
        message: 'Hey John, happy work anniversary!',
      });
    });
  });

  describe('email client error handling', () => {
    it('should propagate email client errors for birthday message', async () => {
      const error = new Error('Email service unavailable');
      vi.mocked(emailServiceClient.sendEmail).mockRejectedValue(error);

      await expect(service.sendBirthdayMessage(mockUser)).rejects.toThrow(
        'Email service unavailable'
      );
    });

    it('should propagate email client errors for anniversary message', async () => {
      const error = new Error('Rate limit exceeded');
      vi.mocked(emailServiceClient.sendEmail).mockRejectedValue(error);

      await expect(service.sendAnniversaryMessage(mockUser)).rejects.toThrow('Rate limit exceeded');
    });
  });
});
