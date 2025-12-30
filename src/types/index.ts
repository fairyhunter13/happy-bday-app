/**
 * Core type definitions for the application
 */

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'healthy' | 'unhealthy';
    rabbitmq: 'healthy' | 'unhealthy';
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  path: string;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Export DTOs
export * from './dto.js';
