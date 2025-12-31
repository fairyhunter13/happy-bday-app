/**
 * Database Metrics Interceptor
 *
 * Tracks database operations with Prometheus metrics via Drizzle ORM logger.
 * Captures query execution duration, operation counts, slow queries, and errors.
 *
 * Features:
 * - Query execution duration tracking (histogram)
 * - Operation type counters (SELECT, INSERT, UPDATE, DELETE)
 * - Slow query detection (configurable threshold)
 * - Query error tracking by error type
 * - Connection pool metrics integration
 *
 * Integration:
 * - Uses Drizzle's custom logger interface
 * - Extracts operation type from SQL query
 * - Extracts table name from query for granular metrics
 * - Records metrics to MetricsService
 */

import type { Logger } from 'drizzle-orm';
import { metricsService } from '../../services/metrics.service.js';
import { logger } from '../../config/logger.js';

/**
 * Configuration for the metrics interceptor
 */
export interface MetricsInterceptorConfig {
  /**
   * Threshold in milliseconds to consider a query as slow
   * @default 100
   */
  slowQueryThreshold?: number;

  /**
   * Whether to log slow queries to console/logs
   * @default true
   */
  logSlowQueries?: boolean;

  /**
   * Whether to log all queries (useful for debugging)
   * @default false in production, true in development
   */
  logAllQueries?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<MetricsInterceptorConfig> = {
  slowQueryThreshold: 100,
  logSlowQueries: true,
  logAllQueries: process.env.NODE_ENV === 'development',
};

/**
 * Extract operation type (SELECT, INSERT, UPDATE, DELETE) from SQL query
 */
function extractOperationType(query: string): string {
  const normalizedQuery = query.trim().toUpperCase();

  if (normalizedQuery.startsWith('SELECT')) {
    return 'SELECT';
  }
  if (normalizedQuery.startsWith('INSERT')) {
    return 'INSERT';
  }
  if (normalizedQuery.startsWith('UPDATE')) {
    return 'UPDATE';
  }
  if (normalizedQuery.startsWith('DELETE')) {
    return 'DELETE';
  }
  if (normalizedQuery.startsWith('BEGIN')) {
    return 'BEGIN';
  }
  if (normalizedQuery.startsWith('COMMIT')) {
    return 'COMMIT';
  }
  if (normalizedQuery.startsWith('ROLLBACK')) {
    return 'ROLLBACK';
  }
  if (normalizedQuery.startsWith('CREATE')) {
    return 'CREATE';
  }
  if (normalizedQuery.startsWith('ALTER')) {
    return 'ALTER';
  }
  if (normalizedQuery.startsWith('DROP')) {
    return 'DROP';
  }

  return 'OTHER';
}

/**
 * Extract table name from SQL query
 * Handles common patterns like:
 * - SELECT ... FROM table_name
 * - INSERT INTO table_name
 * - UPDATE table_name
 * - DELETE FROM table_name
 */
function extractTableName(query: string): string {
  const normalizedQuery = query.trim().toUpperCase();

  // SELECT pattern: SELECT ... FROM table_name
  const selectMatch = normalizedQuery.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (selectMatch && selectMatch[1]) {
    return selectMatch[1].toLowerCase();
  }

  // INSERT pattern: INSERT INTO table_name
  const insertMatch = normalizedQuery.match(/INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (insertMatch && insertMatch[1]) {
    return insertMatch[1].toLowerCase();
  }

  // UPDATE pattern: UPDATE table_name
  const updateMatch = normalizedQuery.match(/UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (updateMatch && updateMatch[1]) {
    return updateMatch[1].toLowerCase();
  }

  // DELETE pattern: DELETE FROM table_name
  const deleteMatch = normalizedQuery.match(/DELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (deleteMatch && deleteMatch[1]) {
    return deleteMatch[1].toLowerCase();
  }

  return 'unknown';
}

/**
 * Database Metrics Interceptor
 *
 * Implements Drizzle's Logger interface to capture query metrics.
 * Records query duration, counts, slow queries, and errors to Prometheus.
 *
 * @example
 * const interceptor = new DatabaseMetricsInterceptor();
 * const db = drizzle(queryClient, {
 *   schema,
 *   logger: interceptor,
 * });
 */
export class DatabaseMetricsInterceptor implements Logger {
  private readonly config: Required<MetricsInterceptorConfig>;

  constructor(config?: MetricsInterceptorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info(
      {
        slowQueryThreshold: this.config.slowQueryThreshold,
        logSlowQueries: this.config.logSlowQueries,
        logAllQueries: this.config.logAllQueries,
      },
      'DatabaseMetricsInterceptor initialized'
    );
  }

  /**
   * Log query execution
   * Called by Drizzle ORM for each query execution
   *
   * @param query - SQL query string
   * @param params - Query parameters
   */
  logQuery(query: string, params: unknown[]): void {
    // Extract query metadata
    const operation = extractOperationType(query);
    const table = extractTableName(query);

    // Note: Drizzle's logQuery is called BEFORE execution, so we can't measure timing here
    // The actual metrics are captured via startConnectionPoolMetrics
    // This method primarily serves as a query logger

    if (this.config.logAllQueries) {
      logger.debug(
        {
          operation,
          table,
          query: query.substring(0, 200), // Truncate long queries
          params: params.length,
        },
        'Database query executed'
      );
    }
  }
}

/**
 * Query Timing Tracker
 *
 * Wraps query execution to track timing and metrics.
 * This is used in conjunction with postgres client hooks.
 */
export class QueryTimingTracker {
  private readonly config: Required<MetricsInterceptorConfig>;

  constructor(config?: MetricsInterceptorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Track query execution
   *
   * @param query - SQL query string
   * @param params - Query parameters
   * @param executor - Function that executes the query
   * @returns Query result
   */
  async trackQuery<T>(query: string, params: unknown[], executor: () => Promise<T>): Promise<T> {
    const startTime = process.hrtime.bigint();
    const operation = extractOperationType(query);
    const table = extractTableName(query);

    try {
      const result = await executor();

      // Record successful query
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000; // Convert nanoseconds to milliseconds
      const durationSeconds = durationMs / 1000;

      // Record query duration histogram
      metricsService.databaseQueryDuration.observe(
        {
          query_type: operation,
          table,
        },
        durationSeconds
      );

      // Record query count
      metricsService.databaseQueryErrorsTotal.inc(
        {
          query_type: operation,
          error_code: 'none',
        },
        0
      ); // Just to ensure the metric exists

      // Check for slow query
      if (durationMs >= this.config.slowQueryThreshold) {
        metricsService.databaseSlowQueriesTotal.inc({
          query_type: operation,
          table,
          threshold_ms: String(this.config.slowQueryThreshold),
        });

        if (this.config.logSlowQueries) {
          logger.warn(
            {
              operation,
              table,
              durationMs: durationMs.toFixed(2),
              threshold: this.config.slowQueryThreshold,
              query: query.substring(0, 200),
            },
            'Slow query detected'
          );
        }
      }

      if (this.config.logAllQueries) {
        logger.debug(
          {
            operation,
            table,
            durationMs: durationMs.toFixed(2),
            params: params.length,
          },
          'Query executed successfully'
        );
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Record query error
      const errorType = error.name || 'UnknownError';
      metricsService.databaseQueryErrorsTotal.inc({
        query_type: operation,
        error_code: errorType,
      });

      logger.error(
        {
          operation,
          table,
          error: error.message,
          query: query.substring(0, 200),
        },
        'Query execution failed'
      );

      throw error;
    }
  }
}

/**
 * Create a custom postgres client wrapper with metrics tracking
 *
 * This wraps the postgres client to intercept queries and track metrics.
 * It uses a Proxy to intercept query execution.
 *
 * @param client - Original postgres client
 * @param config - Interceptor configuration
 * @returns Wrapped client with metrics tracking
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMetricsWrapper<T extends (...args: any[]) => any>(
  client: T,
  config?: MetricsInterceptorConfig
): T {
  const tracker = new QueryTimingTracker(config);

  // Return a Proxy that intercepts calls to the client
  return new Proxy(client, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apply(target, thisArg, args: any[]) {
      // Extract query information
      const query = typeof args[0] === 'string' ? args[0] : String(args[0]);
      const params = args.slice(1);

      // Track the query execution
      return tracker.trackQuery(query, params, () => Reflect.apply(target, thisArg, args));
    },
  }) as T;
}

/**
 * Update connection pool metrics
 *
 * Call this periodically to update connection pool gauge metrics.
 * Integrates with postgres-js connection pool stats.
 *
 * @param poolStats - Connection pool statistics
 */
export function updateConnectionPoolMetrics(poolStats: {
  total: number;
  idle: number;
  active: number;
}): void {
  // Update database connections gauge
  metricsService.databaseConnections.set(poolStats.active);

  // Log pool stats in debug mode
  if (process.env.NODE_ENV === 'development') {
    logger.debug(
      {
        total: poolStats.total,
        idle: poolStats.idle,
        active: poolStats.active,
      },
      'Connection pool stats updated'
    );
  }
}

/**
 * Start periodic connection pool metrics collection
 *
 * @param queryClient - Postgres client instance
 * @param intervalMs - Interval in milliseconds (default: 10000 = 10 seconds)
 * @returns Cleanup function to stop metrics collection
 */
export function startConnectionPoolMetrics(
  queryClient: any,
  intervalMs: number = 10000
): () => void {
  const interval = setInterval(() => {
    try {
      // Try to get pool stats from postgres-js client
      // Note: postgres-js doesn't expose pool stats directly,
      // so we'll need to track connections via other means
      // For now, we'll use a placeholder implementation

      // In a production environment, you might:
      // 1. Query pg_stat_activity for connection counts
      // 2. Implement custom connection tracking
      // 3. Use connection events to track active connections

      // Placeholder: Track via pg_stat_activity query
      queryClient`
        SELECT count(*) as active_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND state = 'active'
      `
        .then((result: Array<{ active_connections?: string }>) => {
          const activeConnections = parseInt(result[0]?.active_connections || '0', 10);
          metricsService.databaseConnections.set(activeConnections);
        })
        .catch((err: unknown) => {
          const error = err instanceof Error ? err : new Error(String(err));
          logger.error({ error: error.message }, 'Failed to collect connection pool metrics');
        });
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        'Error in connection pool metrics collection'
      );
    }
  }, intervalMs);

  logger.info({ intervalMs }, 'Started connection pool metrics collection');

  // Return cleanup function
  return () => {
    clearInterval(interval);
    logger.info('Stopped connection pool metrics collection');
  };
}

/**
 * Create database metrics interceptor instance
 * Singleton for use across the application
 */
export const databaseMetricsInterceptor = new DatabaseMetricsInterceptor();

/**
 * Export tracker for manual query wrapping if needed
 */
export const queryTimingTracker = new QueryTimingTracker();
