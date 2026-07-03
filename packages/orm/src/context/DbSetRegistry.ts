import { type EntityCtorRef, OrmConfigurationError } from '@ts-linq/types';

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

  /**
   * The single audited bridge between the heterogeneous storage (`DbSet<object>`,
   * keyed by the entity constructor the set was created for) and the public generic
   * `DbSet<T>` surface.
   *
   * safe: stored under its own ctor key — the `T` recovered on read is exactly the
   * `T` used on write. `DbSet<T>` is invariant only over its `_entityClass` field,
   * which is structurally erased at runtime, so the relation cannot be expressed
   * structurally but holds by construction.
   */
  private asTyped<T extends object>(dbSet: DbSet<object>): DbSet<T> {
    return dbSet as unknown as DbSet<T>;
  }

  /**
   * Instantiate a `DbSet<object>` for `ctor`. The abstract-ness of `EntityCtorRef`
   * is erased at runtime (every registered entity target is a concrete class), so a
   * single narrowing `as` to the concrete construct signature suffices here.
   */
  private instantiate(ctor: EntityCtorRef): DbSet<object> {
    return new DbSet<object>(ctor as new () => object, this.buildDbSetContext());
  }

  /** Get a DbSet for the specified entity type. */
  set<T extends object>(entityClass: new () => T): DbSet<T> {
    const normalized = getOriginal(entityClass);
    const stored = this._dbSets.get(normalized);
    if (stored === undefined) {
      throw OrmConfigurationError.setNotConfigured(entityClass.name);
    }
    // Fast path: no decoration — return the shared instance unchanged.
    if (entityClass === normalized) {
      return this.asTyped<T>(stored);
    }
    // Decorated class: return a scoped DbSet that uses the decorated constructor.
    // Cached to avoid allocating on every call.
    let decorated = this._decoratedDbSets.get(entityClass);
    if (decorated === undefined) {
      decorated = this.instantiate(entityClass);
      this._decoratedDbSets.set(entityClass, decorated);
    }
    return this.asTyped<T>(decorated);
  }

  /** Create and register a typed DbSet for the given entity class. */
  defineSet<T extends object>(entityClass: new () => T): DbSet<T> {
    const original = getOriginal(entityClass);
    const existing = this._dbSets.get(original);
    if (existing !== undefined) {
      return this.asTyped<T>(existing);
    }
    // Entity not yet in the registry (dynamic registration after construction).
    // Construct with the passed-in `entityClass`, but key on the undecorated `original`.
    const dbSet = this.instantiate(entityClass);
    this._dbSets.set(original, dbSet);
    return this.asTyped<T>(dbSet);
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
      const dbSet = this.instantiate(original);
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
