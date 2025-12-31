/**
 * Custom error classes for structured error handling
 */

export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

export class DatabaseError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}

export class ExternalServiceError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, details);
  }
}

export class ConfigurationError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIGURATION_ERROR', 500, details);
  }
}

export class UniqueConstraintError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'UNIQUE_CONSTRAINT_ERROR', 409, details);
  }
}
