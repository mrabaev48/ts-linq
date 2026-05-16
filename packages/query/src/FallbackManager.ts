import type { QueryFallback } from '@ts-linq/types';

export interface ThrottleState {
  windowStart: number;
  usedInWindow: number;
  lastAttemptAt: number;
}

/**
 * Owns the fallback source list and per-chain throttle counters for a Queryable chain.
 *
 * Extracted from Queryable to give fallback state a single home that is independently
 * testable and explicitly passed to QueryExecutor.
 */
export class FallbackManager<T> {
  readonly fallbacks: Array<QueryFallback<T>> = [];
  readonly throttle: ThrottleState;

  private constructor(throttle?: ThrottleState) {
    this.throttle = throttle ?? { windowStart: 0, usedInWindow: 0, lastAttemptAt: 0 };
  }

  static create<T>(): FallbackManager<T> {
    return new FallbackManager<T>();
  }

  add(source: QueryFallback<T>): void {
    this.fallbacks.push(source);
  }

  /**
   * Clone copies the fallbacks array (same object references — fallback implementations
   * such as MemoryFallback represent shared cache layers and are intentionally shared)
   * and deep-copies the throttle counters so each clone has independent rate-limit state.
   *
   * Rationale: a fluent Queryable chain creates a clone per call site; rate-limit
   * counters from one chain must not bleed into an independent sibling chain.
   * Fallback objects are stateful cache layers — sharing them across clones is correct.
   */
  clone(): FallbackManager<T> {
    const copy = new FallbackManager<T>({ ...this.throttle }); // deep-copy counters
    (copy.fallbacks as Array<QueryFallback<T>>).push(...this.fallbacks);
    return copy;
  }
}
