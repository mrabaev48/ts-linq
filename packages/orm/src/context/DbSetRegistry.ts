import { reflectGetOwnMetadata } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';

import { DbSet } from '../DbSet';
import type { DbSetContext } from '../DbSetContext';
import type { DbContextServices } from './DbContextServices';
import { getOriginal } from './entityOriginal';

/** Depth-managed transaction delegators forwarded into each `DbSetContext`. */
export interface DbSetTransactionDelegators {
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
}

/**
 * Owns the DbSet factory and identity map for a context: `set`/`defineSet`,
 * initial materialization of auto-generated DbSet properties, and assembly of
 * the shared {@link DbSetContext}. Extracted from `DbContext` (SRP).
 *
 * @internal
 */
export class DbSetRegistry {
  private readonly _dbSets = new Map<EntityCtorRef, DbSet<object>>();
  private readonly _decoratedDbSets = new Map<EntityCtorRef, DbSet<object>>();

  constructor(
    private readonly services: DbContextServices,
    private readonly tx: DbSetTransactionDelegators
  ) {}

  /** Build the per-call {@link DbSetContext} passed to every `DbSet`. */
  buildDbSetContext(): DbSetContext {
    return {
      provider: this.services.provider,
      changeTracker: this.services.changeTracker,
      entityLoader: this.services.entityLoader,
      entityCache: this.services.entityCache,
      performance: this.services.performanceOptions,
      globalFilters: this.services.globalFilters,
      softDeleteOptions: this.services.softDelete,
      querySplittingBehavior: this.services.querySplittingBehavior,
      beginTransaction: async () => this.tx.beginTransaction(),
      commitTransaction: async () => this.tx.commitTransaction(),
      rollbackTransaction: async () => this.tx.rollbackTransaction(),
      executionStrategyOptions: this.services.executionStrategyOptions,
      entityQueryFilterMap: this.services.entityQueryFilterMap,
      registry: this.services.registry,
      diagnosticSink: this.services.diagnosticSink
    };
  }

  /** Get a DbSet for the specified entity type. */
  set<T extends object>(entityClass: new () => T): DbSet<T> {
    const maybe = reflectGetOwnMetadata('orm:original', entityClass);
    const normalized: EntityCtorRef =
      typeof maybe === 'function' ? (maybe as EntityCtorRef) : entityClass;
    if (!this._dbSets.has(normalized)) {
      throw new Error(`DbSet for ${entityClass.name} is not configured`);
    }
    // Fast path: no decoration — return the shared instance unchanged
    if ((entityClass as unknown) === normalized) {
      return this._dbSets.get(normalized) as unknown as DbSet<T>;
    }
    // Decorated class: return a scoped DbSet that uses the decorated constructor.
    // Cached to avoid allocating on every call.
    if (!this._decoratedDbSets.has(entityClass)) {
      this._decoratedDbSets.set(
        entityClass,
        new DbSet<object>(entityClass, this.buildDbSetContext())
      );
    }
    return this._decoratedDbSets.get(entityClass) as unknown as DbSet<T>;
  }

  /** Create and register a typed DbSet for the given entity class. */
  defineSet<T extends object>(entityClass: new () => T): DbSet<T> {
    const original = getOriginal(entityClass);
    if (this._dbSets.has(original)) {
      return this._dbSets.get(original) as unknown as DbSet<T>;
    }
    // Entity not yet in the registry (dynamic registration after construction).
    const dbSet = new DbSet<T>(entityClass, this.buildDbSetContext());
    this._dbSets.set(original as unknown as EntityCtorRef, dbSet as unknown as DbSet<object>);
    return dbSet;
  }

  /**
   * Initialize DbSets for all registered entities and define auto-generated
   * DbSet properties on the owning context instance (see `DbContext` JSDoc for
   * the naming convention).
   */
  initialize(target: object): void {
    const entities = this.services.registry.getEntities();

    for (const entity of entities) {
      if (!entity.target) continue;
      const original = getOriginal(entity.target);
      const dbSet = new DbSet<object>(
        original as unknown as new () => object,
        this.buildDbSetContext()
      );
      this._dbSets.set(original, dbSet);

      // Create a writable, configurable data property for easy access.
      // Writable so that subclass field initialisers (e.g. `users = this.defineSet(User)`)
      // can overwrite it without throwing "property has only a getter".
      const base = original.name.toLowerCase();
      const propertyName = base.endsWith('y') ? base.slice(0, -1) + 'ies' : base + 's';
      Object.defineProperty(target, propertyName, {
        value: dbSet,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  }
}
