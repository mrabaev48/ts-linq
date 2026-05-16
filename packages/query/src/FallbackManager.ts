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
  // Writable via the private constructor to allow sharing by reference during clone().
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
   * Clone copies the fallbacks array but SHARES the throttle object by reference.
   * All clones in a Queryable chain must see the same throttle counters so that
   * the per-window rate limit is enforced across the whole chain.
   */
  clone(): FallbackManager<T> {
    const copy = new FallbackManager<T>(this.throttle);
    (copy.fallbacks as Array<QueryFallback<T>>).push(...this.fallbacks);
    return copy;
  }
}
