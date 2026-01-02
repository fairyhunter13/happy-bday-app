/**
 * Mock Email Server for E2E Testing
 *
 * Simulates external email API with configurable responses:
 * - Success responses (200)
 * - Error responses (500, 429, etc.)
 * - Timeout simulation
 * - Request tracking and verification
 * - Configurable failure modes
 *
 * Usage:
 *   const server = await createMockEmailServer();
 *   server.setResponseMode('error-500');
 *   await server.stop();
 */

import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { logger } from '../../src/config/logger.js';

/**
 * Response modes for mock server
 */
export type ResponseMode =
  | 'success'
  | 'error-500'
  | 'error-429'
  | 'error-400'
  | 'timeout'
  | 'slow'
  | 'random'
  | 'probabilistic-failure';

/**
 * Request data captured by mock server
 */
export interface MockRequest {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: any;
  timestamp: number;
}

/**
 * Mock Email Server configuration
 */
export interface MockServerConfig {
  port?: number;
  defaultMode?: ResponseMode;
  requestDelay?: number;
}

/**
 * Mock Email Server
 *
 * HTTP server that simulates external email API for testing
 */
export class MockEmailServer {
  private server: Server | null = null;
  private port: number;
  private responseMode: ResponseMode = 'success';
  private requests: MockRequest[] = [];
  private errorCount: number = 0;
  private currentErrors: number = 0;
  private requestDelay: number = 0;
  private probabilisticFailureRate: number = 0.1; // 10% default

  constructor(config: MockServerConfig = {}) {
    this.port = config.port || 0; // 0 = random available port
    this.responseMode = config.defaultMode || 'success';
    this.requestDelay = config.requestDelay || 0;
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        logger.error({ error }, 'Mock server error');
        reject(error);
      });

      this.server.listen(this.port, () => {
        const address = this.server!.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
        }
        logger.info({ port: this.port }, 'Mock email server started');
        resolve();
      });
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          logger.error({ error }, 'Error stopping mock server');
          reject(error);
        } else {
          logger.info('Mock email server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Parse request body
    const body = await this.parseBody(req);

    // Capture request
    const mockRequest: MockRequest = {
      method: req.method || 'GET',
      url: req.url || '/',
      headers: req.headers,
      body,
      timestamp: Date.now(),
    };

    this.requests.push(mockRequest);

    logger.debug(
      {
        method: mockRequest.method,
        url: mockRequest.url,
        mode: this.responseMode,
      },
      'Mock server received request'
    );

    // Apply delay if configured
    if (this.requestDelay > 0) {
      await this.sleep(this.requestDelay);
    }

    // Handle based on response mode
    switch (this.responseMode) {
      case 'success':
        this.sendSuccess(res, body);
        break;

      case 'error-500':
        if (this.errorCount > 0 && this.currentErrors < this.errorCount) {
          this.currentErrors++;
          this.sendError(res, 500, 'Internal Server Error');
        } else {
          // After error count reached, succeed
          this.sendSuccess(res, body);
        }
        break;

      case 'error-429':
        this.sendError(res, 429, 'Too Many Requests');
        break;

      case 'error-400':
        this.sendError(res, 400, 'Bad Request');
        break;

      case 'timeout':
        // Don't respond - simulate timeout
        // Response will eventually timeout on client side
        break;

      case 'slow':
        await this.sleep(5000); // 5 second delay
        this.sendSuccess(res, body);
        break;

      case 'random':
        if (Math.random() > 0.5) {
          this.sendSuccess(res, body);
        } else {
          this.sendError(res, 500, 'Random error');
        }
        break;

      case 'probabilistic-failure':
        if (Math.random() < this.probabilisticFailureRate) {
          // Fail with configured probability
          this.sendError(res, 500, 'Probabilistic failure (simulating ~10% API failure rate)');
        } else {
          this.sendSuccess(res, body);
        }
        break;

      default:
        this.sendSuccess(res, body);
    }
  }

  /**
   * Send success response
   */
  private sendSuccess(res: ServerResponse, requestBody: any): void {
    const response = {
      success: true,
      message: 'Message sent successfully',
      messageId: `mock-${Date.now()}`,
      recipient: requestBody?.email || 'unknown',
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  /**
   * Send error response
   */
  private sendError(res: ServerResponse, statusCode: number, message: string): void {
    const response = {
      success: false,
      error: message,
      statusCode,
    };

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  /**
   * Parse request body
   */
  private async parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve(parsed);
        } catch (error) {
          resolve({ raw: body });
        }
      });

      req.on('error', () => {
        resolve({});
      });
    });
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set response mode
   */
  setResponseMode(mode: ResponseMode): void {
    this.responseMode = mode;
    this.currentErrors = 0; // Reset error counter when mode changes
    logger.debug({ mode }, 'Mock server response mode changed');
  }

  /**
   * Set number of errors to return before succeeding
   */
  setErrorCount(count: number): void {
    this.errorCount = count;
    this.currentErrors = 0;
  }

  /**
   * Set request delay (milliseconds)
   */
  setRequestDelay(ms: number): void {
    this.requestDelay = ms;
  }

  /**
   * Set probabilistic failure rate (0.0 to 1.0)
   * For example: 0.1 = 10% failure rate
   */
  setProbabilisticFailureRate(rate: number): void {
    if (rate < 0 || rate > 1) {
      throw new Error('Failure rate must be between 0.0 and 1.0');
    }
    this.probabilisticFailureRate = rate;
    logger.debug({ rate }, 'Probabilistic failure rate set');
  }

  /**
   * Get all captured requests
   */
  getRequests(): MockRequest[] {
    return [...this.requests];
  }

  /**
   * Get last captured request
   */
  getLastRequest(): MockRequest | undefined {
    return this.requests[this.requests.length - 1];
  }

  /**
   * Get request count
   */
  getRequestCount(): number {
    return this.requests.length;
  }

  /**
   * Clear captured requests
   */
  clearRequests(): void {
    this.requests = [];
    this.currentErrors = 0;
  }

  /**
   * Get server URL (legacy - includes path for backward compatibility)
   */
  getUrl(): string {
    return `http://localhost:${this.port}/api/messages`;
  }

  /**
   * Get base URL (for SDK clients that append their own paths)
   */
  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Get server port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Check if request was received with specific criteria
   */
  hasRequestMatching(predicate: (req: MockRequest) => boolean): boolean {
    return this.requests.some(predicate);
  }

  /**
   * Find request by email
   */
  findRequestByEmail(email: string): MockRequest | undefined {
    return this.requests.find((req) => req.body?.email === email);
  }

  /**
   * Get requests for specific user
   */
  getRequestsByUserId(userId: string): MockRequest[] {
    return this.requests.filter((req) => req.body?.userId === userId);
  }

  /**
   * Get statistics about requests
   */
  getStats(): {
    totalRequests: number;
    byMethod: Record<string, number>;
    byMessageType: Record<string, number>;
    averageResponseTime: number;
  } {
    const byMethod: Record<string, number> = {};
    const byMessageType: Record<string, number> = {};

    for (const req of this.requests) {
      byMethod[req.method] = (byMethod[req.method] || 0) + 1;

      const messageType = req.body?.messageType || 'unknown';
      byMessageType[messageType] = (byMessageType[messageType] || 0) + 1;
    }

    return {
      totalRequests: this.requests.length,
      byMethod,
      byMessageType,
      averageResponseTime: this.requestDelay,
    };
  }

  /**
   * Verify request was made with expected data
   */
  verifyRequest(email: string, expectedFields: Partial<any>): boolean {
    const request = this.findRequestByEmail(email);

    if (!request) {
      return false;
    }

    for (const [key, value] of Object.entries(expectedFields)) {
      if (request.body[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Reset server to initial state
   */
  reset(): void {
    this.clearRequests();
    this.setResponseMode('success');
    this.setErrorCount(0);
    this.setRequestDelay(0);
  }
}

/**
 * Create and start a mock email server
 */
export async function createMockEmailServer(
  config: MockServerConfig = {}
): Promise<MockEmailServer> {
  const server = new MockEmailServer(config);
  await server.start();
  return server;
}

/**
 * Create mock email server with specific error scenario
 */
export async function createMockServerWithErrors(
  errorMode: ResponseMode,
  errorCount: number = 3
): Promise<MockEmailServer> {
  const server = new MockEmailServer({ defaultMode: errorMode });
  server.setErrorCount(errorCount);
  await server.start();
  return server;
}

/**
 * Create slow mock email server (for timeout testing)
 */
export async function createSlowMockServer(delayMs: number = 5000): Promise<MockEmailServer> {
  const server = new MockEmailServer({ requestDelay: delayMs });
  await server.start();
  return server;
}
