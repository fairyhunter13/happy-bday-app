/**
 * Response utility functions
 * Standardizes API responses
 */

import type { SuccessResponse, ErrorResponse } from '../types/index.js';

/**
 * Create a success response
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  path: string,
  details?: unknown
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
    path,
  };
}
