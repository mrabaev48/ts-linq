import { reflectGetOwnMetadata } from '@ts-linq/metadata';
import { QueryBuilder } from '@ts-linq/query';
import type { EntityCtorRef } from '@ts-linq/types';
import type { CountCache, EntityCacheLike } from '@ts-linq/types';

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
    private readonly getPrimaryKey: (entityClass: EntityCtorRef) => string | undefined
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
    } catch {
      /* ignore */
    }
  }

  invalidateOnCommit(): void {
    try {
      if (this.entityCache) this.entityCache.clear();
    } catch {
      /* ignore */
    }
  }

  clearAll(): void {
    try {
      if (this.entityCache) this.entityCache.clear();
    } catch {
      /* ignore */
    }
    try {
      this.countCache?.clear();
    } catch {
      /* ignore */
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
    } catch {
      /* ignore */
    }
    try {
      if (this.countCache?.invalidateBy) {
        for (const name of entityNames) {
          this.countCache.invalidateBy((k) => k.includes(`|count|`) && k.includes(`${name}|`));
        }
      }
    } catch {
      /* ignore */
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
    } catch {
      /* ignore */
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
    } catch {
      /* ignore */
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
      } else {
        for (const name of changedNames) QueryBuilder.invalidateForEntity(name);
      }
    } catch {
      /* ignore */
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
    } catch {
      /* ignore */
    }
  }
}
