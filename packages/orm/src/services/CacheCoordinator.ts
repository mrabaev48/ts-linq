import { reflectGetOwnMetadata } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';
import type { CountCache, EntityCacheLike } from '@ts-linq/types';

import { type DiagnosticSink, NULL_DIAGNOSTIC_SINK } from '../context/DiagnosticSink';
import type { NormalizedChange } from '../types';

type SqlCacheLike = { invalidateBy?: (m: (k: string) => boolean) => number };
type CountCacheLike = CountCache;

interface MutationChange {
  entity: Record<string, unknown>;
  entityClass: EntityCtorRef;
  state: string;
}

interface RegistryLike {
  getEntities(): ReadonlyArray<{ target?: EntityCtorRef }>;
}

/** @internal */
export class CacheCoordinator {
  constructor(
    private readonly entityCache: EntityCacheLike | undefined,
    private readonly sqlCache: SqlCacheLike | undefined,
    private readonly countCache: CountCacheLike | undefined,
    private readonly providerLabel: string | undefined,
    private readonly cacheNamespace: string | undefined,
    private readonly registry: RegistryLike,
    private readonly getPrimaryKey: (entityClass: EntityCtorRef) => string | undefined,
    private readonly diagnostics: DiagnosticSink = NULL_DIAGNOSTIC_SINK
  ) {}

  updateEntry(change: Pick<NormalizedChange, 'entity' | 'entityClass'>): void {
    if (!this.entityCache) return;
    const pk = this.getPrimaryKey(change.entityClass);
    if (!pk) return;
    this.entityCache.set(change.entityClass, change.entity[pk], change.entity);
  }

  removeEntry(change: Pick<NormalizedChange, 'entity' | 'entityClass'>): void {
    if (!this.entityCache) return;
    const pk = this.getPrimaryKey(change.entityClass);
    if (!pk) return;
    this.entityCache.remove(change.entityClass, change.entity[pk]);
  }

  invalidateAfterMutation(changes: ReadonlyArray<MutationChange>): void {
    try {
      const changedNames = new Set<string>(changes.map((c) => c.entityClass.name));
      const needFullL2Clear = this.computeNeedFullL2Clear(changedNames);
      this.removeDeletedFromEntityCache(changes, needFullL2Clear);
      this.invalidateSqlCacheByNames(changedNames);
      this.invalidateCountCacheByNames(changedNames);
    } catch (e) {
      this.diagnostics.internalDiag('CacheCoordinator.invalidateAfterMutation', e);
    }
  }

  /**
   * Invalidate caches after a committed transaction. Intentionally does NOT
   * swallow: a failure here means the cache may now be stale relative to the
   * just-committed data, so the error must propagate to the caller
   * ({@link TransactionScope.commit}) which surfaces an observable staleness
   * warning. Swallowing it here would hide the very defect orm/task-2 fixes.
   */
  invalidateOnCommit(): void {
    if (this.entityCache) this.entityCache.clear();
  }

  clearAll(): void {
    try {
      if (this.entityCache) this.entityCache.clear();
    } catch (e) {
      this.diagnostics.internalDiag('CacheCoordinator.clearAll.entityCache', e);
    }
    try {
      this.countCache?.clear();
    } catch (e) {
      this.diagnostics.internalDiag('CacheCoordinator.clearAll.countCache', e);
    }
  }

  invalidateByEntityNames(entityNames: ReadonlyArray<string>): void {
    try {
      for (const name of entityNames) {
        if (this.sqlCache?.invalidateBy) {
          const prefix = name + '|';
          this.sqlCache.invalidateBy((k) => k.startsWith(prefix) || k.includes(`|${name}|`));
        }
      }
    } catch (e) {
      this.diagnostics.internalDiag('CacheCoordinator.invalidateByEntityNames.sqlCache', e);
    }
    try {
      if (this.countCache?.invalidateBy) {
        for (const name of entityNames) {
          this.countCache.invalidateBy((k) => k.includes(`|count|`) && k.includes(`${name}|`));
        }
      }
    } catch (e) {
      this.diagnostics.internalDiag('CacheCoordinator.invalidateByEntityNames.countCache', e);
    }
  }

  private computeNeedFullL2Clear(changedNames: ReadonlySet<string>): boolean {
    try {
      const entities = this.registry.getEntities();
      for (const e of entities) {
        const meta = reflectGetOwnMetadata('orm:cachePolicy', e.target as Function) as
          | { invalidateOn?: ReadonlyArray<string> }
          | undefined;
        if (meta?.invalidateOn && meta.invalidateOn.some((n) => changedNames.has(n))) {
          return true;
        }
      }
    } catch (e) {
      this.diagnostics.internalDiag('CacheCoordinator.computeNeedFullL2Clear', e);
    }
    return false;
  }

  private removeDeletedFromEntityCache(
    changes: ReadonlyArray<MutationChange>,
    needFullClear: boolean
  ): void {
    if (!this.entityCache) return;
    try {
      for (const c of changes) {
        if (c.state === 'deleted') {
          const pk = this.getPrimaryKey(c.entityClass);
          if (pk !== undefined) {
            this.entityCache.remove(c.entityClass, c.entity[pk]);
          }
        }
      }
      if (needFullClear) this.entityCache.clear();
    } catch (e) {
      this.diagnostics.internalDiag('CacheCoordinator.removeDeletedFromEntityCache', e);
    }
  }

  private invalidateSqlCacheByNames(changedNames: ReadonlySet<string>): void {
    try {
      if (this.sqlCache?.invalidateBy) {
        const providerPrefix = this.providerLabel ? `${this.providerLabel}|` : '';
        const ns = this.cacheNamespace ? `${this.cacheNamespace}|` : '';
        for (const name of changedNames) {
          const prefix = `${ns}${providerPrefix}${name}|`;
          this.sqlCache.invalidateBy((key) => key.startsWith(prefix));
        }
      }
    } catch (e) {
      this.diagnostics.internalDiag('CacheCoordinator.invalidateSqlCacheByNames', e);
    }
  }

  private invalidateCountCacheByNames(changedNames: ReadonlySet<string>): void {
    try {
      if (!this.countCache?.invalidateBy) return;
      const providerPrefix = this.providerLabel ? `${this.providerLabel}|` : '';
      const ns = this.cacheNamespace ? `${this.cacheNamespace}|` : '';
      for (const name of changedNames) {
        const prefix = `${ns}${providerPrefix}${name}|count|`;
        this.countCache.invalidateBy((key) => key.startsWith(prefix));
      }
    } catch (e) {
      this.diagnostics.internalDiag('CacheCoordinator.invalidateCountCacheByNames', e);
    }
  }
}
