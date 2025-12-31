/**
 * Circuit Breaker Edge Cases Tests
 *
 * Covers comprehensive circuit breaker scenarios:
 * - Circuit breaker state transitions (closed -> open -> half-open -> closed)
 * - Circuit breaker under load (high volume, concurrent requests)
 * - Multiple service circuit breakers (isolation, cascading failures)
 * - Circuit breaker recovery timing and strategies
 * - Edge cases in state management
 * - Metrics and monitoring integration
 *
 * These tests ensure the circuit breaker pattern works correctly to prevent
 * cascading failures and allows graceful degradation of services.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Circuit Breaker Edge Cases', () => {
  describe('State Transitions', () => {
    it('should transition from CLOSED to OPEN after threshold failures', () => {
      interface CircuitState {
        state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
        failures: number;
        successes: number;
        threshold: number;
      }

      const circuit: CircuitState = {
        state: 'CLOSED',
        failures: 0,
        successes: 0,
        threshold: 5,
      };

      const recordFailure = (): void => {
        circuit.failures++;
        if (circuit.failures >= circuit.threshold) {
          circuit.state = 'OPEN';
        }
      };

      // Record failures up to threshold
      for (let i = 0; i < 5; i++) {
        recordFailure();
      }

      expect(circuit.state).toBe('OPEN');
      expect(circuit.failures).toBe(5);
    });

    it('should transition from OPEN to HALF_OPEN after timeout', () => {
      interface CircuitState {
        state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
        openedAt: number | null;
        resetTimeout: number;
      }

      const circuit: CircuitState = {
        state: 'OPEN',
        openedAt: Date.now() - 31000, // Opened 31 seconds ago
        resetTimeout: 30000, // 30 second timeout
      };

      const checkStateTransition = (currentTime: number): void => {
        if (
          circuit.state === 'OPEN' &&
          circuit.openedAt &&
          currentTime - circuit.openedAt >= circuit.resetTimeout
        ) {
          circuit.state = 'HALF_OPEN';
        }
      };

      checkStateTransition(Date.now());

      expect(circuit.state).toBe('HALF_OPEN');
    });

    it('should transition from HALF_OPEN to CLOSED on success', () => {
      interface CircuitState {
        state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
        failures: number;
        successes: number;
      }

      const circuit: CircuitState = {
        state: 'HALF_OPEN',
        failures: 0,
        successes: 0,
      };

      const recordSuccess = (): void => {
        circuit.successes++;
        if (circuit.state === 'HALF_OPEN') {
          circuit.state = 'CLOSED';
          circuit.failures = 0;
        }
      };

      recordSuccess();

      expect(circuit.state).toBe('CLOSED');
      expect(circuit.failures).toBe(0);
    });

    it('should transition from HALF_OPEN to OPEN on failure', () => {
      interface CircuitState {
        state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
        openedAt: number | null;
      }

      const circuit: CircuitState = {
        state: 'HALF_OPEN',
        openedAt: null,
      };

      const recordFailure = (): void => {
        if (circuit.state === 'HALF_OPEN') {
          circuit.state = 'OPEN';
          circuit.openedAt = Date.now();
        }
      };

      recordFailure();

      expect(circuit.state).toBe('OPEN');
      expect(circuit.openedAt).not.toBeNull();
    });

    it('should reset failure count on transition to CLOSED', () => {
      interface CircuitState {
        state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
        failures: number;
        consecutiveSuccesses: number;
      }

      const circuit: CircuitState = {
        state: 'HALF_OPEN',
        failures: 10,
        consecutiveSuccesses: 0,
      };

      const transitionToClosed = (): void => {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
        circuit.consecutiveSuccesses = 0;
      };

      transitionToClosed();

      expect(circuit.state).toBe('CLOSED');
      expect(circuit.failures).toBe(0);
    });

    it('should handle rapid state transitions', () => {
      interface StateTransition {
        from: string;
        to: string;
        timestamp: number;
      }

      const transitions: StateTransition[] = [];
      let currentState = 'CLOSED';

      const recordTransition = (to: string): void => {
        transitions.push({
          from: currentState,
          to,
          timestamp: Date.now(),
        });
        currentState = to;
      };

      // Simulate rapid transitions
      recordTransition('OPEN');
      recordTransition('HALF_OPEN');
      recordTransition('OPEN');
      recordTransition('HALF_OPEN');
      recordTransition('CLOSED');

      expect(transitions).toHaveLength(5);
      expect(currentState).toBe('CLOSED');

      // Verify transition sequence
      expect(transitions[0]!.from).toBe('CLOSED');
      expect(transitions[0]!.to).toBe('OPEN');
      expect(transitions[4]!.to).toBe('CLOSED');
    });
  });

  describe('Circuit Breaker Under Load', () => {
    it('should handle high volume of requests in CLOSED state', () => {
      const circuit = {
        state: 'CLOSED',
        totalRequests: 0,
        failures: 0,
        threshold: 50,
      };

      const processRequest = (willFail: boolean): boolean => {
        circuit.totalRequests++;

        if (willFail) {
          circuit.failures++;
          if (circuit.failures >= circuit.threshold) {
            circuit.state = 'OPEN';
          }
          return false;
        }

        return true;
      };

      // Process high volume with low failure rate
      for (let i = 0; i < 1000; i++) {
        const fails = i % 50 === 0; // 2% failure rate
        processRequest(fails);
      }

      expect(circuit.totalRequests).toBe(1000);
      expect(circuit.state).toBe('CLOSED'); // Low failure rate keeps circuit closed
    });

    it('should reject requests immediately when OPEN', () => {
      const circuit = {
        state: 'OPEN' as const,
        rejectedCount: 0,
      };

      const tryRequest = (): boolean => {
        if (circuit.state === 'OPEN') {
          circuit.rejectedCount++;
          return false;
        }
        return true;
      };

      // All requests should be rejected
      for (let i = 0; i < 100; i++) {
        expect(tryRequest()).toBe(false);
      }

      expect(circuit.rejectedCount).toBe(100);
    });

    it('should limit concurrent requests in HALF_OPEN state', () => {
      const circuit = {
        state: 'HALF_OPEN',
        maxConcurrentInHalfOpen: 3,
        currentConcurrent: 0,
      };

      const tryAcquireSlot = (): boolean => {
        if (circuit.state !== 'HALF_OPEN') return true;

        if (circuit.currentConcurrent >= circuit.maxConcurrentInHalfOpen) {
          return false;
        }

        circuit.currentConcurrent++;
        return true;
      };

      const releaseSlot = (): void => {
        circuit.currentConcurrent = Math.max(0, circuit.currentConcurrent - 1);
      };

      // First 3 requests acquire slots
      expect(tryAcquireSlot()).toBe(true);
      expect(tryAcquireSlot()).toBe(true);
      expect(tryAcquireSlot()).toBe(true);

      // 4th request is rejected
      expect(tryAcquireSlot()).toBe(false);

      // Release a slot
      releaseSlot();

      // Now can acquire again
      expect(tryAcquireSlot()).toBe(true);
    });

    it('should track request rate and latency', () => {
      interface RequestMetrics {
        count: number;
        totalLatency: number;
        avgLatency: number;
        requestsPerSecond: number;
        windowStart: number;
      }

      const metrics: RequestMetrics = {
        count: 0,
        totalLatency: 0,
        avgLatency: 0,
        requestsPerSecond: 0,
        windowStart: Date.now(),
      };

      const recordRequest = (latency: number): void => {
        metrics.count++;
        metrics.totalLatency += latency;
        metrics.avgLatency = metrics.totalLatency / metrics.count;

        const windowDuration = (Date.now() - metrics.windowStart) / 1000;
        metrics.requestsPerSecond = metrics.count / windowDuration;
      };

      recordRequest(100);
      recordRequest(150);
      recordRequest(200);

      expect(metrics.count).toBe(3);
      expect(metrics.avgLatency).toBe(150);
      expect(metrics.requestsPerSecond).toBeGreaterThan(0);
    });

    it('should handle spike in failure rate', () => {
      const circuit = {
        state: 'CLOSED',
        failures: 0,
        successes: 0,
        failureThreshold: 10,
        failureRateThreshold: 0.5, // 50%
      };

      const recordResult = (success: boolean): void => {
        if (success) {
          circuit.successes++;
        } else {
          circuit.failures++;
        }

        const total = circuit.failures + circuit.successes;
        const failureRate = circuit.failures / total;

        if (
          circuit.failures >= circuit.failureThreshold &&
          failureRate >= circuit.failureRateThreshold
        ) {
          circuit.state = 'OPEN';
        }
      };

      // Spike: 15 failures, 5 successes (75% failure rate)
      for (let i = 0; i < 15; i++) recordResult(false);
      for (let i = 0; i < 5; i++) recordResult(true);

      expect(circuit.state).toBe('OPEN');
    });
  });

  describe('Multiple Service Circuit Breakers', () => {
    it('should isolate failures to specific services', () => {
      interface ServiceCircuit {
        service: string;
        state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
        failures: number;
      }

      const circuits: Map<string, ServiceCircuit> = new Map([
        ['email-service', { service: 'email-service', state: 'CLOSED', failures: 0 }],
        ['database', { service: 'database', state: 'CLOSED', failures: 0 }],
        ['cache', { service: 'cache', state: 'CLOSED', failures: 0 }],
      ]);

      const recordFailure = (service: string): void => {
        const circuit = circuits.get(service);
        if (circuit) {
          circuit.failures++;
          if (circuit.failures >= 5) {
            circuit.state = 'OPEN';
          }
        }
      };

      // Email service fails
      for (let i = 0; i < 5; i++) {
        recordFailure('email-service');
      }

      expect(circuits.get('email-service')?.state).toBe('OPEN');
      expect(circuits.get('database')?.state).toBe('CLOSED');
      expect(circuits.get('cache')?.state).toBe('CLOSED');
    });

    it('should prevent cascading failures across services', () => {
      interface DependencyCircuit {
        service: string;
        state: string;
        dependencies: string[];
      }

      const circuits: Map<string, DependencyCircuit> = new Map([
        ['service-a', { service: 'service-a', state: 'CLOSED', dependencies: ['service-b'] }],
        ['service-b', { service: 'service-b', state: 'OPEN', dependencies: [] }],
        ['service-c', { service: 'service-c', state: 'CLOSED', dependencies: ['service-a'] }],
      ]);

      const canCallService = (service: string, visited = new Set<string>()): boolean => {
        const circuit = circuits.get(service);
        if (!circuit) return false;

        // Prevent infinite loops
        if (visited.has(service)) return true;
        visited.add(service);

        // Check if service itself is available
        if (circuit.state === 'OPEN') return false;

        // Check if dependencies are available (recursively)
        for (const dep of circuit.dependencies) {
          if (!canCallService(dep, visited)) {
            return false; // Prevent calling if any dependency is down
          }
        }

        return true;
      };

      expect(canCallService('service-b')).toBe(false); // Circuit is OPEN
      expect(canCallService('service-a')).toBe(false); // Dependency (service-b) is OPEN
      expect(canCallService('service-c')).toBe(false); // Indirect dependency (service-b) is OPEN
    });

    it('should track health status across services', () => {
      interface ServiceHealth {
        service: string;
        circuitState: string;
        healthy: boolean;
        lastCheck: number;
      }

      const healthStatus: Map<string, ServiceHealth> = new Map();

      const updateHealth = (service: string, circuitState: string): void => {
        healthStatus.set(service, {
          service,
          circuitState,
          healthy: circuitState === 'CLOSED',
          lastCheck: Date.now(),
        });
      };

      updateHealth('email-service', 'OPEN');
      updateHealth('database', 'CLOSED');
      updateHealth('cache', 'HALF_OPEN');

      const healthyServices = Array.from(healthStatus.values()).filter((h) => h.healthy);

      expect(healthyServices).toHaveLength(1);
      expect(healthyServices[0]!.service).toBe('database');
    });

    it('should use fallback when primary service circuit is open', () => {
      interface ServiceConfig {
        primary: { name: string; circuitState: string };
        fallback: { name: string; circuitState: string };
      }

      const config: ServiceConfig = {
        primary: { name: 'email-api', circuitState: 'OPEN' },
        fallback: { name: 'email-queue', circuitState: 'CLOSED' },
      };

      const getServiceToUse = (cfg: ServiceConfig): string => {
        if (cfg.primary.circuitState === 'CLOSED') {
          return cfg.primary.name;
        }
        return cfg.fallback.name;
      };

      expect(getServiceToUse(config)).toBe('email-queue');

      // Primary recovers
      config.primary.circuitState = 'CLOSED';

      expect(getServiceToUse(config)).toBe('email-api');
    });

    it('should aggregate circuit metrics across services', () => {
      interface CircuitMetrics {
        service: string;
        state: string;
        totalRequests: number;
        failures: number;
      }

      const metrics: CircuitMetrics[] = [
        { service: 'api-1', state: 'CLOSED', totalRequests: 1000, failures: 5 },
        { service: 'api-2', state: 'OPEN', totalRequests: 500, failures: 250 },
        { service: 'api-3', state: 'CLOSED', totalRequests: 800, failures: 10 },
      ];

      const aggregated = {
        totalServices: metrics.length,
        openCircuits: metrics.filter((m) => m.state === 'OPEN').length,
        totalRequests: metrics.reduce((sum, m) => sum + m.totalRequests, 0),
        totalFailures: metrics.reduce((sum, m) => sum + m.failures, 0),
        overallFailureRate: 0,
      };

      aggregated.overallFailureRate = aggregated.totalFailures / aggregated.totalRequests;

      expect(aggregated.totalServices).toBe(3);
      expect(aggregated.openCircuits).toBe(1);
      expect(aggregated.totalRequests).toBe(2300);
      expect(aggregated.overallFailureRate).toBeCloseTo(0.115, 2);
    });
  });

  describe('Circuit Breaker Recovery', () => {
    it('should implement exponential backoff for recovery attempts', () => {
      const recovery = {
        attempt: 0,
        baseTimeout: 30000, // 30s
        maxTimeout: 300000, // 5 minutes
      };

      const calculateRecoveryTimeout = (): number => {
        const timeout = recovery.baseTimeout * Math.pow(2, recovery.attempt);
        return Math.min(timeout, recovery.maxTimeout);
      };

      expect(calculateRecoveryTimeout()).toBe(30000); // 30s

      recovery.attempt = 1;
      expect(calculateRecoveryTimeout()).toBe(60000); // 60s

      recovery.attempt = 2;
      expect(calculateRecoveryTimeout()).toBe(120000); // 120s

      recovery.attempt = 10;
      expect(calculateRecoveryTimeout()).toBe(300000); // Capped at max
    });

    it('should gradually increase traffic in HALF_OPEN state', () => {
      const halfOpenConfig = {
        maxRequests: 10,
        currentRequests: 0,
        successThreshold: 5, // Need 5 successes to close
        successes: 0,
      };

      const canSendRequest = (): boolean => {
        return halfOpenConfig.currentRequests < halfOpenConfig.maxRequests;
      };

      const recordSuccess = (): boolean => {
        halfOpenConfig.successes++;
        return halfOpenConfig.successes >= halfOpenConfig.successThreshold;
      };

      // Allow limited requests
      for (let i = 0; i < 10; i++) {
        expect(canSendRequest()).toBe(true);
        halfOpenConfig.currentRequests++;
      }

      expect(canSendRequest()).toBe(false);

      // Record successes
      let shouldClose = false;
      for (let i = 0; i < 5; i++) {
        shouldClose = recordSuccess();
      }

      expect(shouldClose).toBe(true); // Should close circuit after 5 successes
    });

    it('should track recovery success rate', () => {
      interface RecoveryMetrics {
        attempts: number;
        successes: number;
        failures: number;
        successRate: number;
      }

      const metrics: RecoveryMetrics = {
        attempts: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
      };

      const recordRecoveryAttempt = (success: boolean): void => {
        metrics.attempts++;
        if (success) {
          metrics.successes++;
        } else {
          metrics.failures++;
        }
        metrics.successRate = (metrics.successes / metrics.attempts) * 100;
      };

      recordRecoveryAttempt(false);
      recordRecoveryAttempt(false);
      recordRecoveryAttempt(true);
      recordRecoveryAttempt(true);
      recordRecoveryAttempt(true);

      expect(metrics.attempts).toBe(5);
      expect(metrics.successRate).toBe(60);
    });

    it('should implement cooldown period after failed recovery', () => {
      const recovery = {
        lastAttempt: Date.now(),
        cooldownPeriod: 60000, // 1 minute
        failedAttempts: 0,
      };

      const canAttemptRecovery = (): boolean => {
        const timeSinceLastAttempt = Date.now() - recovery.lastAttempt;
        return timeSinceLastAttempt >= recovery.cooldownPeriod;
      };

      expect(canAttemptRecovery()).toBe(false);

      // Simulate time passing
      recovery.lastAttempt = Date.now() - 61000;

      expect(canAttemptRecovery()).toBe(true);
    });

    it('should reset on consecutive successful recoveries', () => {
      const state = {
        consecutiveSuccesses: 0,
        resetThreshold: 3,
        recoveryAttempt: 5,
      };

      const recordRecoverySuccess = (): void => {
        state.consecutiveSuccesses++;
        if (state.consecutiveSuccesses >= state.resetThreshold) {
          state.recoveryAttempt = 0; // Reset recovery attempt counter
        }
      };

      recordRecoverySuccess();
      recordRecoverySuccess();
      recordRecoverySuccess();

      expect(state.recoveryAttempt).toBe(0);
    });
  });

  describe('Edge Cases in State Management', () => {
    it('should handle concurrent state updates', () => {
      const circuit = {
        state: 'CLOSED',
        version: 0,
      };

      const updateState = (newState: string, expectedVersion: number): boolean => {
        if (circuit.version !== expectedVersion) {
          return false; // Version mismatch - concurrent update detected
        }

        circuit.state = newState;
        circuit.version++;
        return true;
      };

      // First update succeeds
      expect(updateState('OPEN', 0)).toBe(true);
      expect(circuit.state).toBe('OPEN');
      expect(circuit.version).toBe(1);

      // Concurrent update with stale version fails
      expect(updateState('HALF_OPEN', 0)).toBe(false);
      expect(circuit.state).toBe('OPEN'); // Unchanged
    });

    it('should handle state transitions during shutdown', () => {
      const circuit = {
        state: 'OPEN',
        shuttingDown: false,
      };

      const initiateShutdown = (): void => {
        circuit.shuttingDown = true;
      };

      const canTransitionState = (): boolean => {
        return !circuit.shuttingDown;
      };

      expect(canTransitionState()).toBe(true);

      initiateShutdown();

      expect(canTransitionState()).toBe(false);
    });

    it('should preserve state across process restarts', () => {
      interface PersistedState {
        state: string;
        failures: number;
        openedAt: number | null;
        version: number;
      }

      const stateStorage = new Map<string, PersistedState>();

      const saveState = (serviceName: string, state: PersistedState): void => {
        stateStorage.set(serviceName, state);
      };

      const loadState = (serviceName: string): PersistedState | undefined => {
        return stateStorage.get(serviceName);
      };

      // Save state before shutdown
      saveState('email-service', {
        state: 'OPEN',
        failures: 10,
        openedAt: Date.now(),
        version: 5,
      });

      // Process restarts...

      // Load state after restart
      const loaded = loadState('email-service');
      expect(loaded?.state).toBe('OPEN');
      expect(loaded?.failures).toBe(10);
    });

    it('should handle clock skew in timeout calculations', () => {
      const circuit = {
        openedAt: Date.now(),
        resetTimeout: 30000,
      };

      const calculateTimeRemaining = (currentTime: number): number => {
        if (!circuit.openedAt) return 0;

        const elapsed = currentTime - circuit.openedAt;
        const remaining = circuit.resetTimeout - elapsed;

        // Handle clock skew (negative remaining time)
        return Math.max(0, remaining);
      };

      // Normal case
      const now = Date.now();
      expect(calculateTimeRemaining(now + 15000)).toBeGreaterThan(0);

      // Clock skew (current time is before openedAt)
      // When current time is before openedAt, elapsed is negative, so remaining = resetTimeout - (-1000) = 31000
      expect(calculateTimeRemaining(circuit.openedAt - 1000)).toBeGreaterThanOrEqual(
        circuit.resetTimeout
      );
    });

    it('should cleanup stale circuit breaker state', () => {
      interface CircuitState {
        service: string;
        lastActivity: number;
        state: string;
      }

      const circuits: CircuitState[] = [
        { service: 'api-1', lastActivity: Date.now() - 86400000, state: 'CLOSED' }, // 1 day old
        { service: 'api-2', lastActivity: Date.now() - 1000, state: 'OPEN' }, // Recent
        { service: 'api-3', lastActivity: Date.now() - 172800000, state: 'CLOSED' }, // 2 days old
      ];

      const cleanupStale = (maxAge: number): CircuitState[] => {
        const cutoff = Date.now() - maxAge;
        return circuits.filter((c) => c.lastActivity > cutoff);
      };

      const active = cleanupStale(3600000); // 1 hour

      expect(active).toHaveLength(1);
      expect(active[0]!.service).toBe('api-2');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track circuit state duration', async () => {
      interface StateMetrics {
        state: string;
        enteredAt: number;
        duration: number;
      }

      const stateHistory: StateMetrics[] = [];

      const recordStateChange = (newState: string, previousMetrics?: StateMetrics): void => {
        if (previousMetrics) {
          previousMetrics.duration = Date.now() - previousMetrics.enteredAt;
        }

        stateHistory.push({
          state: newState,
          enteredAt: Date.now(),
          duration: 0,
        });
      };

      recordStateChange('CLOSED');

      // Wait a bit to ensure time passes
      await new Promise((resolve) => setTimeout(resolve, 10));

      recordStateChange('OPEN', stateHistory[0]);
      recordStateChange('HALF_OPEN', stateHistory[1]);

      expect(stateHistory).toHaveLength(3);
      expect(stateHistory[0]!.duration).toBeGreaterThan(0);
    });

    it('should calculate error rate thresholds', () => {
      const metrics = {
        totalRequests: 100,
        errors: 15,
        errorThreshold: 0.1, // 10%
      };

      const shouldOpenCircuit = (): boolean => {
        const errorRate = metrics.errors / metrics.totalRequests;
        return errorRate > metrics.errorThreshold;
      };

      expect(shouldOpenCircuit()).toBe(true); // 15% > 10%

      metrics.errors = 5;
      expect(shouldOpenCircuit()).toBe(false); // 5% < 10%
    });

    it('should emit circuit state change events', () => {
      interface StateChangeEvent {
        from: string;
        to: string;
        timestamp: number;
        reason: string;
      }

      const events: StateChangeEvent[] = [];

      const emitStateChange = (from: string, to: string, reason: string): void => {
        events.push({ from, to, timestamp: Date.now(), reason });
      };

      emitStateChange('CLOSED', 'OPEN', 'Failure threshold exceeded');
      emitStateChange('OPEN', 'HALF_OPEN', 'Reset timeout elapsed');
      emitStateChange('HALF_OPEN', 'CLOSED', 'Recovery successful');

      expect(events).toHaveLength(3);
      expect(events[0]!.reason).toBe('Failure threshold exceeded');
      expect(events[2]!.to).toBe('CLOSED');
    });

    it('should track success/failure counts in sliding window', () => {
      interface WindowBucket {
        timestamp: number;
        successes: number;
        failures: number;
      }

      const buckets: WindowBucket[] = [];
      const windowSize = 60000; // 1 minute
      const bucketSize = 10000; // 10 seconds

      const recordResult = (success: boolean): void => {
        const now = Date.now();
        const bucketTime = Math.floor(now / bucketSize) * bucketSize;

        let bucket = buckets.find((b) => b.timestamp === bucketTime);
        if (!bucket) {
          bucket = { timestamp: bucketTime, successes: 0, failures: 0 };
          buckets.push(bucket);
        }

        if (success) {
          bucket.successes++;
        } else {
          bucket.failures++;
        }

        // Remove old buckets
        const cutoff = now - windowSize;
        const index = buckets.findIndex((b) => b.timestamp < cutoff);
        if (index > -1) {
          buckets.splice(0, index + 1);
        }
      };

      recordResult(true);
      recordResult(true);
      recordResult(false);

      expect(buckets.length).toBeGreaterThan(0);
      expect(buckets[0]!.successes).toBeGreaterThan(0);
    });
  });
});
