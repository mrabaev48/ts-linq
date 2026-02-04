import type { RetryPolicy, SqlLogger, SqlParameter } from '@ts-linq/types';
import type { CircuitBreakerOptions, CircuitState } from '../types';
import { CircuitOpenError } from '../types';

export interface ResilienceContext {
  sql: string;
  params: readonly SqlParameter[];
  traceId?: string;
  inTransaction: boolean;
}

export class ResilienceManager {
  private circuitState: CircuitState = 'closed';
  private circuitFailures: number = 0;
  private circuitOpenedAt?: number;
  private halfOpenInFlight: number = 0;
  private circuitOpenBackoffExp: number = 0;

  constructor(
    private readonly logger?: SqlLogger,
    private readonly providerName: string = 'unknown',
    private circuitOptions?: CircuitBreakerOptions,
    private retryPolicy?: RetryPolicy,
    private readonly isTransientError: (error: unknown) => boolean = (e) => false
  ) {}

  public configureCircuit(options: CircuitBreakerOptions): void {
    this.circuitOptions = { ...this.circuitOptions, ...options };
  }

  public get state(): CircuitState {
    return this.circuitState;
  }

  public forceOpen(reason: string, durationMs?: number): void {
    this.openCircuit(reason || 'manual open');
    if (typeof durationMs === 'number' && durationMs > 0) {
      this.circuitOpenedAt =
        Date.now() - (this.circuitOptions?.openDurationMs ?? 30000) + durationMs;
    }
  }

  public manualReset(reason: string = 'manual reset'): void {
    this.transitionCircuit('closed', reason);
  }

  public async execute<T>(
    fn: () => Promise<T>,
    context: ResilienceContext
  ): Promise<T> {
    this.preCheckCircuit();
    
    const maxAttempts = 3;
    const baseDelayMs = 50;
    let attempt = 0;

    // Do not retry within an explicit transaction; also avoid retrying in half-open
    const allowRetry = !context.inTransaction && this.circuitState === 'closed';
    
    // Track half-open probe usage to enforce concurrency cap
    let decrementHalfOpenOnExit = false;
    if (this.circuitState === 'half-open') {
      decrementHalfOpenOnExit = true;
    }

    while (true) {
      try {
        const result = await fn();
        
        // Success path: reset circuit if needed
        if (this.circuitState === 'half-open') {
          this.transitionCircuit('closed', 'probe succeeded');
        }
        this.circuitFailures = 0;
        
        if (decrementHalfOpenOnExit) {
          this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
        }
        return result;
      } catch (error) {
        attempt++;
        const isTransient = this.isTransientError(error);
        
        // Circuit breaker failure accounting
        const countOnlyTransient = this.circuitOptions?.countTransientOnly ?? true;
        const shouldCountFailure = !countOnlyTransient || isTransient;
        
        if (shouldCountFailure) this.circuitFailures++;

        // If in half-open, immediate open on first failure
        if (this.circuitState === 'half-open') {
          this.openCircuit('half-open probe failed');
          if (decrementHalfOpenOnExit) {
            this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
          }
          throw error;
        }

        // If in closed and threshold exceeded, open circuit
        const threshold = Math.max(1, this.circuitOptions?.failureThreshold ?? 5);
        if (this.circuitState === 'closed' && this.circuitFailures >= threshold) {
          this.openCircuit('failure threshold reached');
          if (decrementHalfOpenOnExit) {
            this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
          }
          throw error;
        }

        const should = this.retryPolicy
          ? this.retryPolicy.shouldRetry(error, attempt, context.inTransaction)
          : isTransient;

        if (!allowRetry || !should || attempt >= maxAttempts) {
          if (decrementHalfOpenOnExit) {
            this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
          }
          throw error;
        }

        const jitter = Math.floor(Math.random() * 25);
        const defaultBackoff = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        const backoff = this.retryPolicy?.getDelayMs?.(attempt) ?? defaultBackoff;

        this.logger?.retry?.({
          sql: context.sql,
          params: context.params,
          attempt,
          traceId: context.traceId,
          provider: this.providerName
        });

        await new Promise((res) => setTimeout(res, backoff));
      }
    }
  }

  private preCheckCircuit(): void {
    const enabled = this.circuitOptions?.enabled ?? true;
    if (!enabled) return;
    
    if (this.circuitState === 'open') {
      const now = Date.now();
      const openSince = this.circuitOpenedAt ?? now;
      const baseOpen = Math.max(1000, this.circuitOptions?.openDurationMs ?? 30000);
      const cap = Math.max(baseOpen, this.circuitOptions?.maxOpenDurationMs ?? 300000);
      const factor = Math.min(6, Math.max(0, this.circuitOpenBackoffExp));
      const openDuration = Math.min(baseOpen * Math.pow(2, factor), cap);
      
      if (now - openSince < openDuration) {
        throw new CircuitOpenError();
      }
      
      // Cooldown elapsed -> move to half-open
      this.transitionCircuit('half-open', 'cooldown elapsed');
      this.halfOpenInFlight = 0;
    }
    
    if (this.circuitState === 'half-open') {
      const maxProbes = Math.max(1, this.circuitOptions?.halfOpenMaxCalls ?? 1);
      if (this.halfOpenInFlight >= maxProbes) {
        throw new CircuitOpenError('Half-open probes limit reached');
      }
      this.halfOpenInFlight += 1;
    }
  }

  private openCircuit(reason: string): void {
    this.circuitState = 'open';
    this.circuitOpenedAt = Date.now();
    this.circuitOpenBackoffExp = Math.min(6, this.circuitOpenBackoffExp + 1);
    this.logger?.circuit?.({
      state: 'open',
      provider: this.providerName,
      failures: this.circuitFailures,
      reason,
      halfOpenInFlight: this.halfOpenInFlight
    });
  }

  public transitionCircuit(state: CircuitState, reason: string): void {
    const oldState = this.circuitState;
    this.circuitState = state;
    if (state === 'closed') {
      this.circuitFailures = 0;
      this.circuitOpenedAt = undefined;
      this.halfOpenInFlight = 0;
      this.circuitOpenBackoffExp = 0;
    }
    if (state === 'open') {
      this.circuitOpenedAt = Date.now();
    }
    this.logger?.circuit?.({
      state,
      provider: this.providerName,
      failures: this.circuitFailures,
      reason,
      halfOpenInFlight: this.halfOpenInFlight
    });
  }
}
