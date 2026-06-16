import { safeCacheSize } from '@ts-linq/metrics-safe';

import type { DbContextServices } from './DbContextServices';

/** Subset of services the scope needs (provider + caches for invalidation). */
type TransactionScopeServices = Pick<
  DbContextServices,
  'provider' | 'cacheCoordinator' | 'entityCache'
>;

/**
 * Owns the caller-managed transaction depth counter and the begin/commit/rollback
 * lifecycle, including the commit/rollback cache-invalidation bookkeeping.
 *
 * Nested calls (depth > 0) are absorbed — only the outermost call issues a real
 * provider transaction. Behaviour is preserved byte-for-byte from the previous
 * `DbContext` implementation.
 *
 * @internal
 */
export class TransactionScope {
  private _depth = 0;

  constructor(private readonly services: TransactionScopeServices) {}

  /** Whether a caller-managed transaction is currently active. */
  get isActive(): boolean {
    return this._depth > 0;
  }

  /**
   * Start (or nest into) a transaction. Only the outermost call opens a real
   * provider transaction; nested calls just increment the depth counter.
   */
  async begin(): Promise<void> {
    if (this._depth === 0) {
      await this.services.provider.beginTransaction();
    }
    this._depth++;
  }

  /**
   * Commit the current transaction. The real provider commit + cache invalidation
   * fire only when the outermost transaction (depth 1 → 0) is committed.
   */
  async commit(): Promise<void> {
    if (this._depth <= 1) {
      await this.services.provider.commitTransaction();
      this._depth = 0;
      try {
        this.services.cacheCoordinator.invalidateOnCommit();
        if (this.services.entityCache) {
          safeCacheSize(this.services.provider.loggerRef, {
            cache: 'entityL2',
            size: this.services.entityCache.size?.() ?? -1,
            provider: this.services.provider.providerLabel
          });
        }
      } catch (e) {
        // logInternalError('DbContext.commitTransaction.invalidateCaches', e);
      }
    } else {
      this._depth--;
    }
  }

  /** Rollback the current transaction. Resets the depth counter unconditionally. */
  async rollback(): Promise<void> {
    await this.services.provider.rollbackTransaction();
    this._depth = 0;
    this.services.cacheCoordinator.clearAll();
    if (this.services.entityCache) {
      try {
        safeCacheSize(this.services.provider.loggerRef, {
          cache: 'entityL2',
          size: this.services.entityCache.size?.() ?? 0,
          provider: this.services.provider.providerLabel
        });
      } catch (e) {
        // logInternalError('DbContext.rollbackTransaction.entityCacheClear', e);
      }
    }
  }

  /** Reset the depth counter (used by `DbContext.reset()` for pooled reuse). */
  reset(): void {
    this._depth = 0;
  }
}
