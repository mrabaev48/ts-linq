import type { DatabaseProvider, EntityLoader } from '@ts-linq/core';
import type { QueryTrackingBehavior } from '@ts-linq/core';
import type {
  EntityAttacher,
  EntityCacheLike,
  GlobalFilter,
  PerformanceOptions,
  QueryFilterMetadata,
  QuerySplittingBehavior,
  SoftDeleteOptions
} from '@ts-linq/types';

import { SqlVisitorFactory } from './SqlVisitorFactory';

/**
 * Shared, stateless {@link SqlVisitorFactory}. The factory holds no per-query state, so a single
 * instance backs every {@link QueryContext} that does not supply its own.
 */
const DEFAULT_VISITOR_FACTORY = new SqlVisitorFactory();

/**
 * Public, fully type-safe seed configuration for constructing a chain-starting
 * {@link Queryable} through the {@link createQueryable} factory. Every field is typed against the
 * package's public contracts (`@ts-linq/core` / `@ts-linq/types`); the query-internal
 * {@link SqlVisitorFactory} assembly detail is intentionally NOT part of this shape and is added
 * only by the internal {@link QueryContextProps}.
 *
 * This is the boundary abstraction `@ts-linq/orm` depends on instead of reaching into
 * `@ts-linq/query/internal` for the raw {@link QueryContext} (orm/task-6.1).
 *
 * @public
 */
export interface QueryableSeedProps {
  /** Database provider used for execution. */
  readonly provider: DatabaseProvider;
  /** Optional entity loader for eager includes. */
  readonly entityLoader?: EntityLoader;
  /** Optional entity cache consulted during materialization. */
  readonly entityCache?: EntityCacheLike;
  /** Performance options (SQL/count caches, fallback policy, …). */
  readonly performance?: PerformanceOptions;
  /** Model-level global query filters to apply. */
  readonly globalFilters?: GlobalFilter[];
  /** Soft-delete configuration (overrides the provider default when present). */
  readonly softDeleteOptions?: SoftDeleteOptions;
  /** Change-tracker attacher consulted by terminal operators in TrackAll mode. */
  readonly entityAttacher?: EntityAttacher;
  /** Initial tracking mode (defaults to TrackAll inside {@link Queryable}). */
  readonly trackingMode?: QueryTrackingBehavior;
  /** Context-level query splitting default, propagated from DbContextOptions. */
  readonly globalSplittingBehavior?: QuerySplittingBehavior;
  /** Per-context entity query filters from ModelBuilder.hasQueryFilter (P0-11). */
  readonly entityQueryFilters?: ReadonlyArray<QueryFilterMetadata>;
}

/**
 * Construction inputs for {@link QueryContext} — the public {@link QueryableSeedProps} plus the
 * query-internal visitor-factory assembly point.
 *
 * @internal
 */
export interface QueryContextProps extends QueryableSeedProps {
  /** Visitor factory. Defaults to a shared stateless instance. */
  readonly visitorFactory?: SqlVisitorFactory;
}

/**
 * Immutable value object bundling the cross-cutting, chain-invariant configuration shared by an
 * entire {@link Queryable} chain (provider, loader, cache, performance, global filters,
 * soft-delete, attacher, tracking mode, splitting default, entity query filters) plus the
 * {@link SqlVisitorFactory} assembly point.
 *
 * Replaces the former 11-positional-argument `Queryable` constructor: callers copy one context
 * reference instead of reproducing the exact positional ordering at every construction site,
 * eliminating connascence of position and the latent `selectCompiled` config-loss bug (a
 * projection that silently dropped tracking/filter configuration).
 *
 * @internal
 */
export class QueryContext {
  public readonly provider: DatabaseProvider;
  public readonly entityLoader?: EntityLoader;
  public readonly entityCache?: EntityCacheLike;
  public readonly performance?: PerformanceOptions;
  public readonly globalFilters?: GlobalFilter[];
  public readonly softDeleteOptions?: SoftDeleteOptions;
  public readonly entityAttacher?: EntityAttacher;
  public readonly trackingMode?: QueryTrackingBehavior;
  public readonly globalSplittingBehavior?: QuerySplittingBehavior;
  public readonly entityQueryFilters?: ReadonlyArray<QueryFilterMetadata>;
  public readonly visitorFactory: SqlVisitorFactory;

  constructor(props: QueryContextProps) {
    this.provider = props.provider;
    this.entityLoader = props.entityLoader;
    this.entityCache = props.entityCache;
    this.performance = props.performance;
    this.globalFilters = props.globalFilters;
    this.softDeleteOptions = props.softDeleteOptions;
    this.entityAttacher = props.entityAttacher;
    this.trackingMode = props.trackingMode;
    this.globalSplittingBehavior = props.globalSplittingBehavior;
    this.entityQueryFilters = props.entityQueryFilters;
    this.visitorFactory = props.visitorFactory ?? DEFAULT_VISITOR_FACTORY;
  }

  /**
   * Return a new context with the given fields overridden and all others preserved. Passing an
   * explicit `undefined` clears a field (e.g. `ofType` drops `entityQueryFilters` for subtype
   * queries via `{ entityQueryFilters: undefined }`).
   */
  public with(overrides: Partial<QueryContextProps>): QueryContext {
    return new QueryContext({ ...this.toProps(), ...overrides });
  }

  /** Provider-only context with optional overrides (test/facade convenience). */
  public static fromProvider(
    provider: DatabaseProvider,
    overrides?: Partial<QueryContextProps>
  ): QueryContext {
    return new QueryContext({ provider, ...overrides });
  }

  /** Snapshot the current fields as construction props (used by {@link with}). */
  private toProps(): QueryContextProps {
    return {
      provider: this.provider,
      entityLoader: this.entityLoader,
      entityCache: this.entityCache,
      performance: this.performance,
      globalFilters: this.globalFilters,
      softDeleteOptions: this.softDeleteOptions,
      entityAttacher: this.entityAttacher,
      trackingMode: this.trackingMode,
      globalSplittingBehavior: this.globalSplittingBehavior,
      entityQueryFilters: this.entityQueryFilters,
      visitorFactory: this.visitorFactory
    };
  }
}
