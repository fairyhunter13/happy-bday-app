/**
 * System Metrics Service
 *
 * Collects comprehensive system-level metrics NOT covered by prom-client's collectDefaultMetrics().
 * Complements the default metrics (process CPU, memory, heap, event loop lag, GC) with:
 * - System load averages and memory
 * - Event loop utilization tracking
 * - Custom GC pause monitoring
 * - V8 heap space breakdown
 * - External memory tracking
 *
 * Features:
 * - Singleton pattern for consistent metrics collection
 * - Configurable collection interval (default: 15 seconds)
 * - Graceful shutdown with cleanup
 * - Integration with existing MetricsService registry
 * - TypeScript type safety
 */

import { Gauge, type Registry } from 'prom-client';
import { performance, PerformanceObserver, type PerformanceEntry } from 'perf_hooks';
import { cpus, freemem, totalmem, loadavg, uptime } from 'os';
import v8 from 'v8';
import { logger } from '../config/logger.js';
import { metricsService } from './metrics.service.js';

/**
 * GC performance entry type (not exported by Node.js types)
 */
interface GCPerformanceEntry extends PerformanceEntry {
  kind?: number;
  flags?: number;
}

/**
 * Extended heap statistics for tracking GC memory changes
 * Reserved for future use in GC memory tracking
 */

interface HeapSnapshot {
  totalHeapSize: number;
  usedHeapSize: number;
  timestamp: number;
}

/**
 * GC types mapping for metric labels
 */
const GC_TYPES: Record<number, string> = {
  1: 'scavenge', // Minor GC
  2: 'mark-sweep-compact', // Major GC
  4: 'incremental-marking', // Incremental marking
  8: 'process-weak-callbacks', // Process weak callbacks
  15: 'all', // All types
};

/**
 * Configuration options for SystemMetricsService
 */
export interface SystemMetricsConfig {
  /** Collection interval in milliseconds (default: 15000) */
  collectionInterval?: number;
  /** Enable GC monitoring (default: true) */
  enableGcMonitoring?: boolean;
  /** Enable event loop utilization tracking (default: true) */
  enableEventLoopUtilization?: boolean;
  /** Enable heap space tracking (default: true) */
  enableHeapSpaceTracking?: boolean;
}

/**
 * System Metrics Service
 * Collects system-level metrics beyond prom-client defaults
 */
export class SystemMetricsService {
  private readonly registry: Registry;
  private readonly config: Required<SystemMetricsConfig>;
  private collectionIntervalId?: NodeJS.Timeout;
  private gcObserver?: PerformanceObserver;
  private previousEventLoopUtilization?: ReturnType<typeof performance.eventLoopUtilization>;
  private isShuttingDown = false;
  // Reserved for future CPU usage tracking
  private _heapBeforeGc?: HeapSnapshot;
  private _previousCpuUsage?: NodeJS.CpuUsage;
  private _previousTimestamp?: number;

  // ============================================
  // SYSTEM LOAD METRICS
  // ============================================
  /** System load average over different time periods */
  public readonly systemLoadAverage: Gauge;

  /** System free memory in bytes */
  public readonly systemMemoryFree: Gauge;

  /** System total memory in bytes */
  public readonly systemMemoryTotal: Gauge;

  /** System uptime in seconds */
  public readonly systemUptime: Gauge;

  /** CPU count (informational) */
  public readonly systemCpuCount: Gauge;

  // ============================================
  // EVENT LOOP METRICS
  // ============================================
  /** Event loop utilization percentage (0-1) */
  public readonly eventLoopUtilization: Gauge;

  /** Event loop active time percentage */
  public readonly eventLoopActive: Gauge;

  /** Event loop idle time percentage */
  public readonly eventLoopIdle: Gauge;

  // ============================================
  // GC MONITORING METRICS
  // ============================================
  /** GC pause duration in seconds by GC type */
  public readonly gcPauseSeconds: Gauge;

  /** Total GC runs by type (counter-like gauge) */
  public readonly gcRunsTotal: Gauge;

  // ============================================
  // V8 HEAP DETAILED METRICS
  // ============================================
  /** Heap space used bytes by space name */
  public readonly heapSpaceUsed: Gauge;

  /** Heap space size bytes by space name */
  public readonly heapSpaceSize: Gauge;

  /** Heap space available bytes by space name */
  public readonly heapSpaceAvailable: Gauge;

  /** External memory used by V8 in bytes */
  public readonly externalMemory: Gauge;

  /** Array buffer memory in bytes */
  public readonly arrayBufferMemory: Gauge;

  /**
   * Creates a new SystemMetricsService instance
   * @param config - Configuration options
   */
  constructor(config: SystemMetricsConfig = {}) {
    // Get registry from existing MetricsService
    this.registry = metricsService.getRegistry();

    // Merge config with defaults
    this.config = {
      collectionInterval: config.collectionInterval ?? 15000,
      enableGcMonitoring: config.enableGcMonitoring ?? true,
      enableEventLoopUtilization: config.enableEventLoopUtilization ?? true,
      enableHeapSpaceTracking: config.enableHeapSpaceTracking ?? true,
    };

    // ============================================
    // Initialize System Load Metrics
    // ============================================
    this.systemLoadAverage = new Gauge({
      name: 'system_load_average',
      help: 'System load average over different time periods',
      labelNames: ['period'],
      registers: [this.registry],
    });

    this.systemMemoryFree = new Gauge({
      name: 'system_memory_free_bytes',
      help: 'System free memory in bytes',
      registers: [this.registry],
    });

    this.systemMemoryTotal = new Gauge({
      name: 'system_memory_total_bytes',
      help: 'System total memory in bytes',
      registers: [this.registry],
    });

    this.systemUptime = new Gauge({
      name: 'system_uptime_seconds',
      help: 'System uptime in seconds',
      registers: [this.registry],
    });

    this.systemCpuCount = new Gauge({
      name: 'system_cpu_count',
      help: 'Number of CPU cores available',
      registers: [this.registry],
    });

    // ============================================
    // Initialize Event Loop Metrics
    // ============================================
    this.eventLoopUtilization = new Gauge({
      name: 'nodejs_eventloop_utilization',
      help: 'Event loop utilization percentage (0-1, where 1 = 100% busy)',
      registers: [this.registry],
    });

    this.eventLoopActive = new Gauge({
      name: 'nodejs_eventloop_active',
      help: 'Event loop active time percentage (0-1)',
      registers: [this.registry],
    });

    this.eventLoopIdle = new Gauge({
      name: 'nodejs_eventloop_idle',
      help: 'Event loop idle time percentage (0-1)',
      registers: [this.registry],
    });

    // ============================================
    // Initialize GC Metrics
    // ============================================
    this.gcPauseSeconds = new Gauge({
      name: 'nodejs_gc_pause_seconds',
      help: 'Garbage collection pause duration in seconds by GC type',
      labelNames: ['gc_type'],
      registers: [this.registry],
    });

    this.gcRunsTotal = new Gauge({
      name: 'nodejs_gc_runs_total',
      help: 'Total number of garbage collection runs by type',
      labelNames: ['gc_type'],
      registers: [this.registry],
    });

    // ============================================
    // Initialize V8 Heap Metrics
    // ============================================
    this.heapSpaceUsed = new Gauge({
      name: 'nodejs_heap_space_used_bytes',
      help: 'Heap space used in bytes by space name',
      labelNames: ['space'],
      registers: [this.registry],
    });

    this.heapSpaceSize = new Gauge({
      name: 'nodejs_heap_space_size_bytes',
      help: 'Heap space total size in bytes by space name',
      labelNames: ['space'],
      registers: [this.registry],
    });

    this.heapSpaceAvailable = new Gauge({
      name: 'nodejs_heap_space_available_bytes',
      help: 'Heap space available in bytes by space name',
      labelNames: ['space'],
      registers: [this.registry],
    });

    this.externalMemory = new Gauge({
      name: 'nodejs_external_memory_bytes',
      help: 'External memory used by V8 in bytes (C++ objects bound to JavaScript)',
      registers: [this.registry],
    });

    this.arrayBufferMemory = new Gauge({
      name: 'nodejs_array_buffer_memory_bytes',
      help: 'Memory allocated for ArrayBuffers and SharedArrayBuffers in bytes',
      registers: [this.registry],
    });
  }

  /**
   * Start metrics collection
   * Initializes periodic collection and GC monitoring
   */
  start(): void {
    if (this.collectionIntervalId) {
      logger.warn('SystemMetricsService already started');
      return;
    }

    logger.info(
      {
        collectionInterval: this.config.collectionInterval,
        gcMonitoring: this.config.enableGcMonitoring,
        eventLoopUtilization: this.config.enableEventLoopUtilization,
        heapSpaceTracking: this.config.enableHeapSpaceTracking,
      },
      'Starting SystemMetricsService'
    );

    // Initialize CPU usage tracking
    this.previousCpuUsage = process.cpuUsage();
    this.previousTimestamp = Date.now();

    // Initialize event loop utilization tracking
    if (this.config.enableEventLoopUtilization) {
      this.previousEventLoopUtilization = performance.eventLoopUtilization();
    }

    // Set up GC monitoring
    if (this.config.enableGcMonitoring) {
      this.setupGcMonitoring();
    }

    // Start periodic collection
    this.collectionIntervalId = setInterval(() => {
      this.collectMetrics();
    }, this.config.collectionInterval);

    // Collect metrics immediately on start
    this.collectMetrics();

    logger.info('SystemMetricsService started successfully');
  }

  /**
   * Stop metrics collection and cleanup
   * @param timeout - Maximum time to wait for cleanup in milliseconds
   */
  async stop(timeout = 5000): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('SystemMetricsService already shutting down');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Stopping SystemMetricsService...');

    // Clear collection interval
    if (this.collectionIntervalId) {
      clearInterval(this.collectionIntervalId);
      this.collectionIntervalId = undefined;
    }

    // Cleanup GC observer
    if (this.gcObserver) {
      try {
        this.gcObserver.disconnect();
        this.gcObserver = undefined;
      } catch (error) {
        logger.error({ error }, 'Error disconnecting GC observer');
      }
    }

    // Final metrics collection
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Final metrics collection timeout')), timeout)
      );

      await Promise.race([Promise.resolve(this.collectMetrics()), timeoutPromise]);
    } catch (error) {
      logger.error({ error }, 'Error during final metrics collection');
    }

    logger.info('SystemMetricsService stopped successfully');
  }

  /**
   * Setup GC performance monitoring
   * Uses PerformanceObserver to track GC events
   */
  private setupGcMonitoring(): void {
    try {
      // Initialize GC run counters
      for (const gcType of Object.values(GC_TYPES)) {
        this.gcRunsTotal.set({ gc_type: gcType }, 0);
      }

      this.gcObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'gc') {
            this.handleGcEntry(entry as GCPerformanceEntry);
          }
        }
      });

      this.gcObserver.observe({ entryTypes: ['gc'] });
      logger.debug('GC monitoring initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to setup GC monitoring');
    }
  }

  /**
   * Handle a GC performance entry
   * @param entry - GC performance entry
   */
  private handleGcEntry(entry: GCPerformanceEntry): void {
    if (this.isShuttingDown) {
      return;
    }

    const gcType = entry.kind ? GC_TYPES[entry.kind] || 'unknown' : 'unknown';
    const durationSeconds = entry.duration / 1000; // Convert ms to seconds

    // Record pause duration
    this.gcPauseSeconds.set({ gc_type: gcType }, durationSeconds);

    // Increment run counter
    this.gcRunsTotal.inc({ gc_type: gcType });

    logger.debug(
      {
        gcType,
        durationMs: entry.duration,
        durationSeconds,
      },
      'GC event recorded'
    );
  }

  /**
   * Collect all system metrics
   * Called periodically based on collection interval
   */
  private collectMetrics(): void {
    if (this.isShuttingDown) {
      return;
    }

    try {
      this.collectSystemLoadMetrics();

      if (this.config.enableEventLoopUtilization) {
        this.collectEventLoopMetrics();
      }

      if (this.config.enableHeapSpaceTracking) {
        this.collectHeapMetrics();
      }
    } catch (error) {
      logger.error({ error }, 'Error collecting system metrics');
    }
  }

  /**
   * Collect system load and memory metrics
   */
  private collectSystemLoadMetrics(): void {
    try {
      // System load averages
      const [load1, load5, load15] = loadavg();
      this.systemLoadAverage.set({ period: '1m' }, load1 ?? 0);
      this.systemLoadAverage.set({ period: '5m' }, load5 ?? 0);
      this.systemLoadAverage.set({ period: '15m' }, load15 ?? 0);

      // Memory metrics
      this.systemMemoryFree.set(freemem());
      this.systemMemoryTotal.set(totalmem());

      // System uptime
      this.systemUptime.set(uptime());

      // CPU count
      this.systemCpuCount.set(cpus().length);

      // Process metrics
      this.processUptimeSeconds.set(process.uptime());
      this.processMemoryRss.set(process.memoryUsage().rss);

      // CPU usage calculation
      if (this.previousCpuUsage && this.previousTimestamp) {
        const currentCpuUsage = process.cpuUsage(this.previousCpuUsage);
        const currentTimestamp = Date.now();
        const timeDelta = currentTimestamp - this.previousTimestamp;
        
        // Convert microseconds to percentage per CPU core
        const cpuPercent = ((currentCpuUsage.user + currentCpuUsage.system) / (timeDelta * 1000)) * 100;
        this.processCpuUsagePercent.set(cpuPercent);
      }
      
      // Store current values for next calculation
      this.previousCpuUsage = process.cpuUsage();
      this.previousTimestamp = Date.now();
    } catch (error) {
      logger.error({ error }, 'Error collecting system load metrics');
    }
  }

  /**
   * Collect event loop utilization metrics
   */
  private collectEventLoopMetrics(): void {
    try {
      const current = performance.eventLoopUtilization(this.previousEventLoopUtilization);
      this.previousEventLoopUtilization = performance.eventLoopUtilization();

      // Utilization is between 0 and 1 (0 = idle, 1 = 100% busy)
      this.eventLoopUtilization.set(current.utilization);
      this.eventLoopActive.set(current.active / (current.active + current.idle || 1));
      this.eventLoopIdle.set(current.idle / (current.active + current.idle || 1));
    } catch (error) {
      logger.error({ error }, 'Error collecting event loop metrics');
    }
  }

  /**
   * Collect V8 heap space metrics
   */
  private collectHeapMetrics(): void {
    try {
      const heapStats = v8.getHeapStatistics();
      const heapSpaces = v8.getHeapSpaceStatistics();

      // External memory
      this.externalMemory.set(heapStats.external_memory);

      // Array buffer memory (if available)
      if ('malloced_memory' in heapStats) {
        this.arrayBufferMemory.set(heapStats.malloced_memory);
      }

      // Heap space breakdown
      for (const space of heapSpaces) {
        const spaceName = space.space_name;

        this.heapSpaceUsed.set({ space: spaceName }, space.space_used_size);
        this.heapSpaceSize.set({ space: spaceName }, space.space_size);
        this.heapSpaceAvailable.set({ space: spaceName }, space.space_available_size);
      }
    } catch (error) {
      logger.error({ error }, 'Error collecting heap metrics');
    }
  }

  /**
   * Get current system metrics snapshot (for debugging)
   * @returns Current system metrics
   */
  getSnapshot(): {
    loadAverage: number[];
    memory: {
      free: number;
      total: number;
      used: number;
      usedPercent: number;
    };
    uptime: number;
    cpuCount: number;
  } {
    const [load1, load5, load15] = loadavg();
    const free = freemem();
    const total = totalmem();
    const used = total - free;

    return {
      loadAverage: [load1 ?? 0, load5 ?? 0, load15 ?? 0],
      memory: {
        free,
        total,
        used,
        usedPercent: (used / total) * 100,
      },
      uptime: uptime(),
      cpuCount: cpus().length,
    };
  }
}

/**
 * Singleton instance of SystemMetricsService
 * Integrated with the existing MetricsService registry
 */
export const systemMetricsService = new SystemMetricsService({
  collectionInterval: 15000, // 15 seconds
  enableGcMonitoring: true,
  enableEventLoopUtilization: true,
  enableHeapSpaceTracking: true,
});
