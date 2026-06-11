import type { ExpressionNode, PropertyNode } from '@ts-linq/ast';
import type { DatabaseProvider, EntityLoader } from '@ts-linq/core';
import { QueryTrackingBehavior } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { ColumnResolver, ConverterResolver, SqlVisitor } from '@ts-linq/sql-visitor';
import { FragmentJoinPlanner } from '@ts-linq/sql-visitor/internal';
import type {
  CountCache,
  CteDefinition,
  EntityAttacher,
  EntityCacheLike,
  EntityCtorRef,
  FallbackPolicy,
  GlobalFilter,
  PerformanceOptions,
  QueryFallback,
  QueryFilterMetadata,
  QuerySplittingBehavior,
  SqlParameter,
  TemporalClause,
  WhereClause
} from '@ts-linq/types';
import { InheritanceStrategy } from '@ts-linq/types';
import { QuerySplittingBehavior as QSB } from '@ts-linq/types';

import { AggregateOperations } from './AggregateOperations';
import { type QueryTagList } from './ast/query-tags';
import { BulkDmlExecutor } from './BulkDmlExecutor';
import { CountCoordinator } from './CountCoordinator';
import { IncludeResolutionError } from './errors';
import { extractKey } from './extractKey';
import { FallbackManager } from './FallbackManager';
import { GlobalFilterApplier } from './GlobalFilterApplier';
import type { NavigationProxy } from './include/IncludeSubquery';
import { IncludeSubquery } from './include/IncludeSubquery';
import { IncludePlanner } from './IncludePlanner';
import { resolveTargetCtor } from './includeUtils';
import { PaginationBuilder } from './PaginationBuilder';
import { QueryBuilder } from './QueryBuilder';
import type { QueryContext } from './QueryContext';
import { QueryExecutor } from './QueryExecutor';
import { QueryModel } from './QueryModel';
import { RowMaterializer } from './RowMaterializer';
import { SetOperationBuilder } from './SetOperationBuilder';
import { type ISetPropertyCalls } from './SetPropertyCalls';
import { StreamingExecutor } from './StreamingExecutor';
import { applyTagWith } from './tag-with';
import { captureCallSiteTag } from './tag-with-call-site';
import { TrackingCoordinator } from './TrackingCoordinator';

/**
 * Fluent query builder over a given entity type. Accumulates query intent
 * in a QueryModel and delegates SQL generation to QueryBuilder.
 */
export class Queryable<T> {
  /** Used by the compile-time transformer to identify Queryable instances. Do not use at runtime. */
  declare readonly __tsLinqWhereTransformerBrand: true;

  private _entityClass: new () => T;
  private _provider: DatabaseProvider;
  protected _model: QueryModel = new QueryModel();
  private _entityLoader?: EntityLoader;
  private _entityCache?: EntityCacheLike;
  private _performance?: PerformanceOptions;
  private _includes: string[] = [];
  /** Filtered includes: property name → IncludeSubquery with filter/sort/pagination specs. */
  private _filteredIncludes: Map<string, IncludeSubquery<unknown>> = new Map();
  private _sqlBuilder: QueryBuilder;
  // Single-flight deduplication for concurrent count() calls (per-chain instance)
  private _inflightCounts: Map<string, Promise<number>> = new Map();
  private _externalCountCache?: CountCache;
  private _abortSignal?: AbortSignal;
  private _globalFilters?: GlobalFilter[];
  private _globalFilterApplier = new GlobalFilterApplier();
  /**
   * Immutable bundle of cross-cutting, chain-invariant configuration (provider, loader, cache,
   * performance, filters, soft-delete, attacher, tracking, splitting, visitor factory). Copied by
   * reference at every construction site instead of reproducing 11 positional arguments.
   */
  private readonly _context: QueryContext;
  /** Model-level filter names to skip. `'all'` disables every model-level filter. */
  private _ignoredFilters?: Set<string> | 'all';
  /** Per-context entity query filters from ModelBuilder.hasQueryFilter (P0-11). */
  private _entityQueryFilters?: ReadonlyArray<QueryFilterMetadata>;
  private _materializer!: RowMaterializer<T>;
  private _includePlanner!: IncludePlanner<T>;
  // Lightweight signature of WHERE clauses for fast count() cache keys
  private _whereSignature: string = '[]';
  // Internal storage for CTE info (used by providers that support WITH ...)
  private _cte?: CteDefinition;

  private _softDeleteOptions?: import('@ts-linq/types').SoftDeleteOptions;

  /** Tracks the last include path for thenInclude() chaining. */
  private _lastIncludePath: string = '';

  /** Fallback state: source list + per-chain throttle counters. */
  private _fallbackManager: FallbackManager<T> = FallbackManager.create<T>();

  /** Execution delegate: primary + fallback + hedging paths. Re-created in clone() with shared throttle ref. */
  private _executor!: QueryExecutor<T>;
  /** Stateless aggregate operations. Shared by reference across all clones. */
  private _aggregates!: AggregateOperations<T>;
  /** Streaming executor (asAsyncEnumerable / toDictionary). Re-created per instance in ctor. */
  private _streaming!: StreamingExecutor<T>;
  /** Bulk DML (executeUpdate / executeDelete) executor. Re-created per instance in ctor. */
  private _bulkDml!: BulkDmlExecutor<T>;
  /** Stateless tracking / identity-resolution coordinator. Shared by reference across all clones. */
  private _tracking: TrackingCoordinator = new TrackingCoordinator();
  /** Stateless count-cache / single-flight coordinator. Shared by reference across all clones. */
  private _countCoordinator: CountCoordinator = new CountCoordinator();
  /** Stateless set-operation (union/except/…) clause builder. Shared by reference across clones. */
  private _setOps: SetOperationBuilder = new SetOperationBuilder();

  /** Per-query tracking mode. Defaults to TrackAll (mirrors EF Core semantics). */
  private _trackingMode: QueryTrackingBehavior = QueryTrackingBehavior.TrackAll;
  /** Optional entity attacher (e.g. ChangeTracker) consulted by terminal operators in TrackAll mode. */
  private _entityAttacher?: EntityAttacher;
  /**
   * Effective query splitting behavior. Falls back to the context-level global default
   * (`_globalSplittingBehavior`) when not overridden by `asSplitQuery()` / `asSingleQuery()`.
   */
  private _splittingBehavior?: QuerySplittingBehavior;
  /** Context-level global default, propagated from DbContextOptions. */
  private _globalSplittingBehavior?: QuerySplittingBehavior;

  /**
   * Create a new Queryable bound to an entity type and a {@link QueryContext}.
   * @param entityClass Entity constructor.
   * @param context Immutable bundle of cross-cutting query configuration (provider, loader, …).
   * @param model Optional pre-built query model (used by `clone`/`selectCompiled`/`ofType`).
   */
  constructor(entityClass: new () => T, context: QueryContext, model?: QueryModel) {
    this._entityClass = entityClass;
    this._context = context;
    const provider = context.provider;
    const performance = context.performance;
    this._provider = provider;
    this._entityLoader = context.entityLoader;
    this._entityCache = context.entityCache;
    this._performance = performance;
    this._globalFilters = context.globalFilters;
    this._softDeleteOptions = context.softDeleteOptions;
    if (context.entityAttacher !== undefined) this._entityAttacher = context.entityAttacher;
    if (context.trackingMode !== undefined) this._trackingMode = context.trackingMode;
    if (context.globalSplittingBehavior !== undefined)
      this._globalSplittingBehavior = context.globalSplittingBehavior;
    if (context.entityQueryFilters !== undefined)
      this._entityQueryFilters = context.entityQueryFilters;
    if (model !== undefined) this._model = model;
    this._externalCountCache = performance?.countCache;
    this._sqlBuilder = new QueryBuilder(
      provider.getDialect(),
      provider.loggerRef,
      provider.providerLabel,
      performance?.sqlCache,
      performance?.cacheNamespace
    );
    this._materializer = new RowMaterializer<T>(
      this._entityClass,
      this._provider,
      this._entityCache,
      this._performance
    );
    this._includePlanner = new IncludePlanner<T>(this._entityLoader, this._entityClass);
    // Initialize fallback policy defaults
    if (!this._performance?.fallbackPolicy?.allowOps) {
      const defaults: FallbackPolicy = {
        allowOps: ['select', 'count', 'first', 'single', 'any', 'aggregate']
      };
      this._performance = {
        ...this._performance,
        fallbackPolicy: { ...defaults, ...(this._performance?.fallbackPolicy || {}) }
      };
    }
    this._executor = new QueryExecutor<T>(
      this._entityClass,
      this._provider,
      this._sqlBuilder,
      this._materializer,
      this._includePlanner,
      this._fallbackManager,
      this._performance
    );
    this._aggregates = new AggregateOperations<T>(
      this._entityClass,
      this._provider,
      this._sqlBuilder
    );
    this._streaming = new StreamingExecutor<T>(
      this._entityClass,
      this._provider,
      this._sqlBuilder,
      this._materializer
    );
    this._bulkDml = new BulkDmlExecutor<T>(this._entityClass, this._provider);
  }

  /** Create a shallow clone sharing provider/loader but copying model. */
  public clone(): Queryable<T> {
    // Build via `this.constructor` so the runtime subtype is preserved (e.g. cloning an
    // `OrderedQueryable` yields an `OrderedQueryable`, keeping `thenBy` available and
    // honoring `ignoreQueryFilters(): this`). The subclass shares Queryable's constructor.
    const Ctor = this.constructor as new (
      entityClass: new () => T,
      context: QueryContext,
      model?: QueryModel
    ) => Queryable<T>;
    const clonedQueryable = new Ctor(this._entityClass, this._context);
    clonedQueryable._model = this._model.clone();
    // preserve where signature for accurate count cache keys
    clonedQueryable._whereSignature = this._whereSignature;
    // preserve includes and client-side predicates
    clonedQueryable._includes = [...this._includes];
    clonedQueryable._filteredIncludes = new Map(this._filteredIncludes);
    clonedQueryable._lastIncludePath = this._lastIncludePath;
    // Clone copies fallbacks (shared cache layers) and deep-copies throttle (independent per clone)
    clonedQueryable._fallbackManager = this._fallbackManager.clone();
    // Re-create executor with the cloned FallbackManager (independent throttle per clone)
    clonedQueryable._executor = new QueryExecutor<T>(
      this._entityClass,
      this._provider,
      this._sqlBuilder,
      clonedQueryable._materializer,
      clonedQueryable._includePlanner,
      clonedQueryable._fallbackManager,
      this._performance
    );
    // AggregateOperations is stateless — share the same instance
    clonedQueryable._aggregates = this._aggregates;
    // Carry tracking mode and attacher
    clonedQueryable._trackingMode = this._trackingMode;
    clonedQueryable._entityAttacher = this._entityAttacher;
    // Carry per-query splitting behavior override
    clonedQueryable._splittingBehavior = this._splittingBehavior;
    // Carry ignored filter set
    clonedQueryable._ignoredFilters = this._ignoredFilters;
    // Carry chain-level instance state not re-derived from the context. Under uniform
    // immutability every operator clones, so these must propagate or they'd be silently
    // dropped by the next operator after `withCte`/`withAbort`/`withFallbackPolicy`.
    clonedQueryable._cte = this._cte;
    clonedQueryable._abortSignal = this._abortSignal;
    clonedQueryable._performance = this._performance;
    return clonedQueryable;
  }

  /**
   * The single derive path (Template Method). Clones this instance, applies `mutate` to the
   * *clone's* model — and, when the operator touches instance-level state, the clone itself —
   * then returns the fresh instance. Every chainable operator routes through here so that no
   * method ever mutates `this`, making the builder uniformly immutable and safe to fork/share.
   *
   * `protected` so `OrderedQueryable` (`thenBy`/`thenByDescending`) reuses the same path.
   * The mutator also receives `draft` because some chain state (`_whereSignature`, `_includes`,
   * `_abortSignal`, `_ignoredFilters`, …) lives on the instance, not in {@link QueryModel}.
   */
  protected withModel(mutate: (model: QueryModel, draft: Queryable<T>) => void): Queryable<T> {
    const draft = this.clone();
    mutate(draft._model, draft);
    return draft;
  }

  // ─── Tracking API ────────────────────────────────────────────────────────

  /** Return a clone of this query that disables change-tracker attachment for its results. */
  public asNoTracking(): Queryable<T> {
    const cloned = this.clone();
    cloned._trackingMode = QueryTrackingBehavior.NoTracking;
    return cloned;
  }

  /** Return a clone of this query that enables change-tracker attachment (the default). */
  public asTracking(): Queryable<T> {
    const cloned = this.clone();
    cloned._trackingMode = QueryTrackingBehavior.TrackAll;
    return cloned;
  }

  /**
   * Return a clone of this query that deduplicates result entities by primary key without
   * attaching them to the change tracker. Useful for read-only queries with JOINs.
   */
  public asNoTrackingWithIdentityResolution(): Queryable<T> {
    const cloned = this.clone();
    cloned._trackingMode = QueryTrackingBehavior.NoTrackingWithIdentityResolution;
    return cloned;
  }

  // ─── Query tagging API (EF Core parity) ─────────────────────────────────

  /**
   * Attach a diagnostic comment to the emitted SQL statement (mirrors EF Core `TagWith`).
   *
   * The tag is prepended as a leading `-- <tag>` comment before the SELECT/UPDATE/etc.
   * Multiple `tagWith()` calls accumulate in call order.
   *
   * @example
   * const orders = await ctx.orders
   *   .tagWith('dashboard-top-orders')
   *   .where(o => o.status === 'OPEN')
   *   .toArray();
   * // Emitted SQL:
   * // -- dashboard-top-orders
   * // SELECT ...
   *
   * @param tag - Single-line label. Must not contain newline characters or the sequence `*\/`.
   * @throws {QueryTagError} When the tag contains forbidden characters.
   */
  public tagWith(tag: string): Queryable<T> {
    const cloned = this.clone();
    applyTagWith(tag, cloned._model);
    return cloned;
  }

  /**
   * Attach the caller's source file and line number as a diagnostic tag (mirrors EF Core `TagWithCallSite`).
   *
   * Captures `Error().stack` at call time using V8 stack introspection.
   * Appended after any tags already set by `tagWith()`.
   *
   * @example
   * const orders = await ctx.orders
   *   .tagWith('dashboard-top-orders')
   *   .tagWithCallSite()
   *   .toArray();
   * // Emitted SQL:
   * // -- dashboard-top-orders
   * // -- File: orders-controller.ts:42
   * // SELECT ...
   */
  public tagWithCallSite(): Queryable<T> {
    const cloned = this.clone();
    const callSiteTag = captureCallSiteTag(2);
    applyTagWith(callSiteTag, cloned._model);
    return cloned;
  }

  /**
   * Return the ordered list of tags currently attached to this query chain.
   * Returns an empty array when no tags have been set.
   */
  public getTags(): QueryTagList {
    return this._model.tags ?? [];
  }

  // ─── Query splitting API (EF Core parity) ────────────────────────────────

  /**
   * Override the query-splitting strategy for this query chain to `SplitQuery`.
   *
   * Each collection `include()` path is loaded via a separate batched IN-query,
   * preventing cartesian-product row explosion at the cost of additional round trips.
   *
   * > **Warning (mirrors EF Core):** Split queries are not guaranteed to be
   * > transactionally consistent unless the caller wraps the operation in an
   * > explicit transaction.
   *
   * @example
   * const blogs = await context.blogs
   *   .include(b => b.posts)
   *   .thenInclude(p => p.tags)
   *   .asSplitQuery()
   *   .toListAsync();
   */
  public asSplitQuery(): Queryable<T> {
    const cloned = this.clone();
    cloned._splittingBehavior = QSB.SplitQuery;
    cloned._model.splittingBehavior = QSB.SplitQuery;
    return cloned;
  }

  /**
   * Override the query-splitting strategy for this query chain to `SingleQuery`.
   *
   * All includes are loaded in a single SQL statement alongside the root query.
   * For queries with multiple collection Includes this may produce cartesian-product
   * row explosion (N × M rows). Use only when the result set is known to be small.
   *
   * @example
   * const blogs = await context.blogs
   *   .include(b => b.posts)
   *   .asSingleQuery()
   *   .toListAsync();
   */
  public asSingleQuery(): Queryable<T> {
    const cloned = this.clone();
    cloned._splittingBehavior = QSB.SingleQuery;
    cloned._model.splittingBehavior = QSB.SingleQuery;
    return cloned;
  }

  /** Returns the resolved splitting behavior, preferring per-query override over the global default. */
  protected get effectiveSplittingBehavior(): QuerySplittingBehavior {
    return this._splittingBehavior ?? this._globalSplittingBehavior ?? QSB.SplitQuery;
  }

  // ─── Temporal API (SQL Server system-versioned tables / EF Core parity) ──

  /**
   * Query the state of the entity at a specific point in time.
   * Emits `FOR SYSTEM_TIME AS OF @p` on MSSQL. Throws on other dialects.
   *
   * @example
   * const snapshot = await ctx.employees
   *   .temporalAsOf(new Date('2023-01-01'))
   *   .where(e => e.department === 'Sales')
   *   .toArray();
   */
  public temporalAsOf(pointInTime: Date): Queryable<T> {
    const cloned = this.clone();
    cloned._model.temporal = { mode: 'AsOf', from: pointInTime } satisfies TemporalClause;
    return cloned;
  }

  /**
   * Query all historical and current rows.
   * Emits `FOR SYSTEM_TIME ALL` on MSSQL. Throws on other dialects.
   *
   * @example
   * const history = await ctx.employees
   *   .temporalAll()
   *   .orderBy('PeriodStart')
   *   .toArray();
   */
  public temporalAll(): Queryable<T> {
    const cloned = this.clone();
    cloned._model.temporal = { mode: 'All' } satisfies TemporalClause;
    return cloned;
  }

  /**
   * Query rows active at any point within a half-open interval [from, to).
   * Emits `FOR SYSTEM_TIME BETWEEN @from AND @to` on MSSQL. Throws on other dialects.
   *
   * @example
   * const rows = await ctx.employees.temporalBetween(from, to).toArray();
   */
  public temporalBetween(from: Date, to: Date): Queryable<T> {
    const cloned = this.clone();
    cloned._model.temporal = { mode: 'Between', from, to } satisfies TemporalClause;
    return cloned;
  }

  /**
   * Query rows active at any point within the open interval (from, to).
   * Emits `FOR SYSTEM_TIME FROM @from TO @to` on MSSQL. Throws on other dialects.
   *
   * @example
   * const rows = await ctx.employees.temporalFromTo(from, to).toArray();
   */
  public temporalFromTo(from: Date, to: Date): Queryable<T> {
    const cloned = this.clone();
    cloned._model.temporal = { mode: 'FromTo', from, to } satisfies TemporalClause;
    return cloned;
  }

  /**
   * Query rows whose entire active period falls within [from, to].
   * Emits `FOR SYSTEM_TIME CONTAINED IN (@from, @to)` on MSSQL. Throws on other dialects.
   *
   * @example
   * const rows = await ctx.employees.temporalContainedIn(from, to).toArray();
   */
  public temporalContainedIn(from: Date, to: Date): Queryable<T> {
    const cloned = this.clone();
    cloned._model.temporal = { mode: 'ContainedIn', from, to } satisfies TemporalClause;
    return cloned;
  }

  /**
   * Seed this query with a raw SQL source that will be wrapped as a derived table:
   *   FROM (<sql>) AS t0
   * Called by DbSet.fromSqlInterpolated / fromSqlRaw.
   * @internal
   */
  public _withRawSqlSource(raw: { sql: string; params: readonly SqlParameter[] }): Queryable<T> {
    const cloned = this.clone();
    cloned._model.rawSqlSource = raw;
    return cloned;
  }

  /** Apply tracking / identity-resolution logic to a freshly materialized entity list. */
  private _applyTracking(entities: T[]): T[] {
    return this._tracking.apply(
      entities,
      this._entityClass,
      this._trackingMode,
      this._entityAttacher
    );
  }

  /**
   * Adds a WHERE IN clause for a specific column.
   * Efficiently handles large lists of values.
   * filter: column IN (v1, v2, ...)
   */
  public whereIn<K extends keyof T & string>(column: K, values: ReadonlyArray<T[K]>): Queryable<T> {
    if (!values || values.length === 0) {
      // IN (empty) matches nothing; ensure we return empty set via condition "1 = 0".
      return this.withModel((model, draft) => {
        model.where = model.where || [];
        model.where.push({ condition: '1 = 0', parameters: [] });
        draft._whereSignature += '|1=0:[]';
      });
    }

    // Resolve column name from metadata (if available) or use property name
    const metadata = MetadataStorage.getEntity(this._entityClass);
    const dbColumn = metadata
      ? metadata.columns.find((c) => c.propertyName === column || c.columnName === column)
          ?.columnName || column
      : column;

    const quotedCol = this._provider.getDialect().quoteIdentifier(dbColumn);

    const whereClause: WhereClause = {
      condition: `${quotedCol} IN (${values.map(() => '?').join(', ')})`,
      parameters: values as unknown as SqlParameter[]
    };

    const sigParams = values.length > 5 ? `[${values.length} values]` : JSON.stringify(values);
    return this.withModel((model, draft) => {
      model.where = model.where || [];
      model.where.push(whereClause);
      draft._whereSignature += `|${column}IN:${sigParams}`;
    });
  }

  /** Apply configured global filters to the provided query model. */
  private applyGlobalFiltersToModel(model: QueryModel & { where?: WhereClause[] }): void {
    this._globalFilterApplier.apply(
      this._entityClass,
      model,
      this._softDeleteOptions ?? this._provider.softDeleteOptions,
      this._globalFilters,
      this._ignoredFilters,
      this.buildColumnResolver(),
      this._entityQueryFilters,
      this.createSqlVisitor()
    );
  }

  private prepareQueryModel(): QueryModel {
    const model = this._model.clone();
    this.applyGlobalFiltersToModel(model);

    // Auto-join table fragments for entity splitting (P1-25).
    const meta = MetadataStorage.getEntity(this._entityClass);
    if (meta?.tableFragments?.length) {
      const fragmentJoins = new FragmentJoinPlanner().plan(meta);
      if (fragmentJoins.length > 0) {
        model.joins = [...(model.joins ?? []), ...fragmentJoins];
      }
    }

    return model;
  }

  /**
   * Add a type-safe INNER JOIN on a single equality key pair.
   * Accepts property name strings or lambda selectors (EF Core style).
   *
   * @example
   * context.books.innerJoinOn(Author, b => b.authorId, a => a.id)
   * context.books.innerJoinOn(Author, 'authorId', 'id')
   */
  /**
   * Adds an INNER JOIN on matching column keys.
   *
   * @param leftKey - A property key **or** a single-property lambda on `T`.
   *   Nested-path lambdas are **not** supported — pass a string key instead.
   * @param rightKey - A property key **or** a single-property lambda on `TOther`.
   *   Nested-path lambdas are **not** supported — pass a string key instead.
   */
  public innerJoinOn<TOther>(
    otherCtor: new () => TOther,
    leftKey: (keyof T & string) | ((entity: T) => T[keyof T]),
    rightKey: (keyof TOther & string) | ((entity: TOther) => TOther[keyof TOther]),
    alias?: string
  ): Queryable<T> {
    return this.withModel((_model, draft) => {
      draft._addJoinOn('INNER', otherCtor, extractKey(leftKey), extractKey(rightKey), alias);
    });
  }

  /**
   * Add a type-safe LEFT JOIN on a single equality key pair.
   * Accepts property name strings or lambda selectors (EF Core style).
   *
   * @example
   * context.books.leftJoinOn(Author, b => b.authorId, a => a.id)
   * context.books.leftJoinOn(Author, 'authorId', 'id')
   */
  /**
   * Adds a LEFT JOIN on matching column keys.
   *
   * @param leftKey - A property key **or** a single-property lambda on `T`.
   *   Nested-path lambdas are **not** supported — pass a string key instead.
   * @param rightKey - A property key **or** a single-property lambda on `TOther`.
   *   Nested-path lambdas are **not** supported — pass a string key instead.
   */
  public leftJoinOn<TOther>(
    otherCtor: new () => TOther,
    leftKey: (keyof T & string) | ((entity: T) => T[keyof T]),
    rightKey: (keyof TOther & string) | ((entity: TOther) => TOther[keyof TOther]),
    alias?: string
  ): Queryable<T> {
    return this.withModel((_model, draft) => {
      draft._addJoinOn('LEFT', otherCtor, extractKey(leftKey), extractKey(rightKey), alias);
    });
  }

  /**
   * Disables all model-level global query filters for this query (EF9 parity).
   * Pass one or more filter names to disable only those named filters.
   *
   * @example
   * // disable all filters
   * ctx.posts.ignoreQueryFilters().toArray();
   * // disable only soft-delete filter
   * ctx.posts.ignoreQueryFilters('softDelete').toArray();
   */
  public ignoreQueryFilters(): this;
  public ignoreQueryFilters(...names: string[]): this;
  public ignoreQueryFilters(...names: string[]): this {
    // Subtype-preserving clone keeps `: this` truthful (e.g. on an OrderedQueryable).
    return this.withModel((_model, draft) => {
      draft._ignoredFilters = names.length === 0 ? 'all' : new Set(names);
    }) as this;
  }

  /**
   * Adds a filter predicate to the query.
   * NOTE: This stub must remain — the compile-time transformer (`@ts-linq/transformer`)
   * rewrites `where(...)` calls into `whereCompiled(...)`. TypeScript type-checks the
   * pre-transformed source, so the method must exist in the type signature.
   *
   * @example
   * const cheap = await context.products.where(p => p.price < 100).toArray();
   */
  public where(predicate: (entity: T) => boolean): Queryable<T> {
    // Runtime predicate parsing is intentionally not supported.
    // Use the compile-time transformer which rewrites `where(...)` into `whereCompiled(...)`.
    throw new Error(
      "ts-linq(where): compile-time transformer is required. Configure ts-patch plugin '@ts-linq/transformer'."
    );
  }

  /**
   * Adds a WHERE predicate that has been compiled to a query AST at build time.
   *
   * This method is intended to be called only by the compile-time transformer.
   */
  public whereCompiled(input: {
    readonly ast: ExpressionNode;
    readonly parameters: readonly unknown[];
  }): Queryable<T> {
    const visitor = this.createSqlVisitor();
    const { condition, parameters } = visitor.toSql(
      input.ast,
      input.parameters,
      this.buildColumnResolver()
    );
    const whereClause: WhereClause = { condition, parameters };
    return this.withModel((model, draft) => {
      model.where = model.where || [];
      model.where.push(whereClause);
      draft._whereSignature += `|${whereClause.condition}:${JSON.stringify(whereClause.parameters)}`;
    });
  }

  /**
   * Register a graceful-degradation fallback source to be used when the primary provider is unavailable.
   * Fallbacks are tried in the order they are registered until one succeeds.
   */
  public fallbackTo(source: QueryFallback<T>): Queryable<T> {
    // clone() deep-copies the FallbackManager, so adding to the draft's manager is isolated.
    return this.withModel((_model, draft) => {
      draft._fallbackManager.add(source);
    });
  }

  /** Configure per-query fallback policy overrides. */
  public withFallbackPolicy(policy: Partial<FallbackPolicy>): Queryable<T> {
    const cloned = this.clone();
    const base = cloned._performance?.fallbackPolicy || {};
    cloned._performance = {
      ...cloned._performance,
      fallbackPolicy: { ...base, ...policy }
    };
    return cloned;
  }

  /** Add EXISTS (subquery) predicate. */
  public whereExists<TOther>(subquery: Queryable<TOther>): Queryable<T> {
    const subqueryBuilder = subquery._sqlBuilder;
    const subqueryModel = subquery._model;
    const subqueryEntity = subquery._entityClass as unknown as new () => unknown;
    const { query, parameters } = subqueryBuilder.generateFromModel(subqueryEntity, subqueryModel);
    const clause: WhereClause = {
      condition: `EXISTS (${this.normalizeSplicedSubquerySql(query)})`,
      parameters
    };
    return this.withModel((model, draft) => {
      model.where = model.where || [];
      model.where.push(clause);
      draft._whereSignature += `|${clause.condition}:${JSON.stringify(clause.parameters)}`;
    });
  }

  /** Add IN (subquery) predicate for a column. */
  public whereInSubquery<TOther>(
    column: keyof T & string,
    subquery: Queryable<TOther>
  ): Queryable<T> {
    const subqueryBuilder = subquery._sqlBuilder;
    const subqueryModel = subquery._model;
    const subqueryEntity = subquery._entityClass as unknown as new () => unknown;
    const { query, parameters } = subqueryBuilder.generateFromModel(subqueryEntity, subqueryModel);
    // Resolve the property key to its mapped column name and quote it via the dialect so the
    // predicate is correct under `@Column({ name })` and portable across dialects (no raw key).
    const quotedColumn = this._provider
      .getDialect()
      .quoteIdentifier(this.resolveColumnName(column));
    const clause: WhereClause = {
      condition: `${quotedColumn} IN (${this.normalizeSplicedSubquerySql(query)})`,
      parameters
    };
    return this.withModel((model, draft) => {
      model.where = model.where || [];
      model.where.push(clause);
      draft._whereSignature += `|${clause.condition}:${JSON.stringify(clause.parameters)}`;
    });
  }

  /**
   * Reset a spliced subquery's placeholders back to positional `?`.
   *
   * The subquery is rendered by its own dialect pass, which may have already numbered its
   * placeholders (`$1` for Postgres, `@p1` for SQL Server). Once spliced into the outer
   * statement, the dialect renumbers placeholders globally in document order; pre-numbered
   * subquery placeholders would survive that pass and collide with the outer parameters. By
   * normalizing them to `?`, the single global renumber assigns consistent indices across the
   * outer clause and the subquery, keeping every parameter aligned. Values are always
   * parameterized (never interpolated), so no literal can contain a `$N`/`@pN` token.
   */
  private normalizeSplicedSubquerySql(sql: string): string {
    return sql.replace(/@p\d+|\$\d+/g, '?');
  }

  /** With CTE support: define a named subquery and return a Queryable bound to that CTE. */
  public withCte(name: string, subquery: Queryable<unknown>): Queryable<T> {
    const { query } = subquery._sqlBuilder.generateFromModel(
      subquery._entityClass,
      subquery._model
    );
    const cloned = this.clone();
    cloned._model.from = name;
    cloned._cte = { name, sql: query };
    return cloned;
  }

  /**
   * Projects selected properties. Returns a new Queryable of the projected type.
   * NOTE: This stub must remain — the compile-time transformer (`@ts-linq/transformer`)
   * rewrites `select(...)` calls into `selectCompiled(...)`.
   *
   * @example
   * const names = await context.authors.select(a => a.name).toArray();
   */
  public select<TResult>(_selector: (entity: T) => TResult): Queryable<TResult> {
    throw new Error(
      "ts-linq(select): compile-time transformer is required. Configure ts-patch plugin '@ts-linq/transformer'."
    );
  }

  /**
   * Projected SELECT with a pre-computed field list provided by the compile-time transformer.
   * Do not call this method directly — it is emitted by the transformer when rewriting select().
   */
  public selectCompiled<TResult>(input: {
    readonly fields: readonly string[];
  }): Queryable<TResult> {
    // Carry the FULL context (provider, loader, cache, performance, global filters, soft-delete,
    // attacher, splitting default, entity query filters) into the projection. The former
    // 5-positional construction silently dropped six config fields, so a projected query lost its
    // tracking/filter configuration — a real latent bug, not just a smell.
    const next = new Queryable<TResult>(
      this._entityClass as unknown as new () => TResult,
      this._context
    );
    next._model = this._model.clone();
    next._model.select = [...input.fields];
    (next as unknown as { _fallbackManager: FallbackManager<TResult> })._fallbackManager =
      this._fallbackManager;
    // Carry per-chain state set after construction (mirrors clone()): an `asNoTracking()` /
    // `asSplitQuery()` / `ignoreQueryFilters()` applied before the projection must survive it.
    next._trackingMode = this._trackingMode;
    next._entityAttacher = this._entityAttacher;
    next._splittingBehavior = this._splittingBehavior;
    next._ignoredFilters = this._ignoredFilters;
    return next;
  }

  /**
   * Adds ASC ordering by property key or lambda selector.
   *
   * @example
   * const ordered = await context.books.orderBy(b => b.title).toArray();
   * const ordered = await context.books.orderBy('title').toArray();
   */
  /**
   * Sorts results in ascending order by the specified property.
   *
   * @param keyOrSelector - A property key string **or** a single-property lambda (`entity => entity.name`).
   *   Nested-path lambdas (`entity => entity.profile.city`) are **not** supported and will throw at runtime —
   *   pass a string key instead.
   */
  public orderBy<K extends keyof T>(
    keyOrSelector: K | ((entity: T) => T[keyof T])
  ): OrderedQueryable<T> {
    const column = this.resolveColumnName(extractKey(keyOrSelector));
    const draft = this.withModel((model) => {
      model.orderBy = model.orderBy || [];
      model.orderBy.push({ column, direction: 'ASC' });
    });
    return OrderedQueryable._fromQueryable(draft);
  }

  /**
   * Adds DESC ordering by property key or lambda selector.
   *
   * @example
   * const latest = await context.books.orderByDescending(b => b.id).take(5).toArray();
   */
  /**
   * Sorts results in descending order by the specified property.
   *
   * @param keyOrSelector - A property key string **or** a single-property lambda (`entity => entity.name`).
   *   Nested-path lambdas (`entity => entity.profile.city`) are **not** supported and will throw at runtime —
   *   pass a string key instead.
   */
  public orderByDescending<K extends keyof T>(
    keyOrSelector: K | ((entity: T) => T[keyof T])
  ): OrderedQueryable<T> {
    const column = this.resolveColumnName(extractKey(keyOrSelector));
    const draft = this.withModel((model) => {
      model.orderBy = model.orderBy || [];
      model.orderBy.push({ column, direction: 'DESC' });
    });
    return OrderedQueryable._fromQueryable(draft);
  }

  /** Limits the number of returned rows.
   * @example
   * const top10 = await context.products.take(10).toArray();
   */
  public take(count: number): Queryable<T> {
    return this.withModel((model) => {
      model.limit = count;
    });
  }
  /** Skips given number of rows.
   * @example
   * const page2 = await context.products.orderBy('id').skip(10).take(10).toArray();
   */
  public skip(count: number): Queryable<T> {
    return this.withModel((model) => {
      model.offset = count;
    });
  }
  /** Ensures distinct rows.
   * @example
   * const titles = await context.books.select(b => b.title).distinct().toArray();
   */
  public distinct(): Queryable<T> {
    return this.withModel((model) => {
      model.distinct = true;
    });
  }

  /** UNION with another queryable of the same entity. */
  public union(other: Queryable<T>): Queryable<T> {
    return this.withModel((model) => {
      model.unions = model.unions || [];
      model.unions.push(this._setOps.build('union', other._model, other._entityClass));
    });
  }
  /** UNION ALL with another queryable of the same entity. */
  public unionAll(other: Queryable<T>): Queryable<T> {
    return this.withModel((model) => {
      model.unions = model.unions || [];
      model.unions.push(this._setOps.build('unionAll', other._model, other._entityClass));
    });
  }

  /**
   * Filters the query to return only instances of the given subtype.
   * Mirrors EF Core's `OfType<TSub>()`.
   *
   * - **TPH**: adds a WHERE clause on the discriminator column.
   * - **TPT**: adds an INNER JOIN to the subtype table on the shared PK.
   * - **TPC**: changes the FROM table to the concrete leaf table.
   *
   * @example
   * const emails = ctx.notifications.ofType(EmailNotification);
   */
  public ofType<TSub extends T>(ctor: new () => TSub): Queryable<TSub> {
    // Subtype query: carry the current per-chain attacher/tracking mode, but intentionally drop
    // entity query filters (they target the base entity) — now an explicit wither override instead
    // of a positional omission.
    const sub = new Queryable<TSub>(
      ctor,
      this._context.with({
        entityAttacher: this._entityAttacher,
        trackingMode: this._trackingMode,
        entityQueryFilters: undefined
      })
    );
    sub._model = this._model.clone();

    const subtypeMeta = MetadataStorage.getEntity(ctor);
    if (!subtypeMeta?.hierarchyRoot) return sub;

    const rootMeta = MetadataStorage.getEntity(subtypeMeta.hierarchyRoot as unknown as new () => T);
    if (!rootMeta?.hierarchy) return sub;

    const { strategy, discriminator } = rootMeta.hierarchy;

    if (strategy === InheritanceStrategy.Tph) {
      const entry = discriminator?.entries.find((e) => e.ctor === ctor);
      if (entry && discriminator) {
        // Quote the discriminator column through the dialect — no hardcoded ANSI `"`.
        const quotedDiscriminator = this._provider
          .getDialect()
          .quoteIdentifier(discriminator.columnName);
        sub._model.where = sub._model.where ?? [];
        sub._model.where.push({
          condition: `${quotedDiscriminator} = ?`,
          parameters: [entry.value as SqlParameter]
        });
      }
    } else if (strategy === InheritanceStrategy.Tpt) {
      const pk = rootMeta.primaryKeys?.[0] ?? 'id';
      const baseTable = rootMeta.tableName;
      const subTable = subtypeMeta.tableName;
      sub._model.joins = sub._model.joins ?? [];
      // Emit a structured equi-join on the shared PK; the dialect renders + quotes it.
      sub._model.joins.push({
        type: 'INNER',
        table: subTable,
        onColumns: [
          {
            left: { table: baseTable, column: pk },
            right: { table: subTable, column: pk }
          }
        ]
      });
    } else if (strategy === InheritanceStrategy.Tpc) {
      sub._model.from = subtypeMeta.tableName;
    }

    return sub;
  }

  /**
   * Group results by a property key.
   * @example
   * const q = context.books.groupBy('authorId');
   */
  public groupBy<K extends keyof T>(key: K): Queryable<T> {
    const column = this.resolveColumnName(key as string);
    return this.withModel((model) => {
      model.groupBy = { columns: [column] };
    });
  }

  /**
   * Apply HAVING predicate to an existing groupBy.
   * NOTE: This stub must remain — the compile-time transformer rewrites
   * `having(...)` into `havingCompiled(...)`.
   *
   * @example
   * const q = context.books.groupBy('authorId').having(() => true);
   */
  public having(predicate: (entity: T) => boolean): Queryable<T> {
    if (!this._model.groupBy) {
      throw new Error('having() requires a preceding groupBy()');
    }
    // Runtime predicate parsing is intentionally not supported.
    // Use the compile-time transformer which rewrites `having(...)` into `havingCompiled(...)`.
    throw new Error(
      "ts-linq(having): compile-time transformer is required. Configure ts-patch plugin '@ts-linq/transformer'."
    );
  }

  /**
   * Adds a HAVING predicate that has been compiled to a query AST at build time.
   *
   * This method is intended to be called only by the compile-time transformer.
   */
  public havingCompiled(input: {
    readonly ast: ExpressionNode;
    readonly parameters: readonly unknown[];
  }): Queryable<T> {
    if (!this._model.groupBy) {
      throw new Error('havingCompiled() requires a preceding groupBy()');
    }
    const visitor = this.createSqlVisitor();
    const { condition, parameters } = visitor.toSql(
      input.ast,
      input.parameters,
      this.buildColumnResolver()
    );
    return this.withModel((model) => {
      // groupBy is guaranteed present (checked above; the cloned model carries it).
      model.groupBy!.having = { condition, parameters };
    });
  }

  /**
   * Paginate by page number and size. Delegates logic to PaginationBuilder.
   * @example
   * const page1 = await context.books.orderBy('id').paginate(1, 20);
   */
  public async paginate(
    page: number,
    size: number
  ): Promise<{ items: T[]; total: number; page: number; size: number }> {
    return new PaginationBuilder<T>(
      this._entityClass,
      this._provider,
      this._executor,
      this._includes,
      this._cte,
      () => this.prepareQueryModel(),
      async () => this.count()
    ).paginate(page, size);
  }

  /**
   * Keyset pagination helper. Delegates logic to PaginationBuilder.
   * @example
   * const page = await context.books.orderBy('id').keysetPaginate('id', lastId, 20);
   */
  public async keysetPaginate<TKey extends keyof T>(
    key: TKey,
    after: T[TKey] | null,
    size: number
  ): Promise<{ items: T[]; pageSize: number; nextAfter: T[TKey] | null }> {
    return new PaginationBuilder<T>(
      this._entityClass,
      this._provider,
      this._executor,
      this._includes,
      this._cte,
      () => this.prepareQueryModel(),
      async () => this.count()
    ).keysetPaginate(key, after, size);
  }

  /**
   * Eagerly loads a direct navigation property (relation).
   * Accepts a plain property key, a simple lambda selector, or a filtered include
   * lambda that chains where / orderBy / skip / take on the navigation property.
   *
   * **Simple include:**
   * ```ts
   * ctx.blogs.include('posts')
   * ctx.blogs.include(b => b.posts)
   * ```
   *
   * **Filtered include (EF Core parity):**
   * ```ts
   * ctx.blogs.include(b => b.posts
   *   .where(p => p.isPublished)
   *   .orderByDescending(p => p.publishedAt)
   *   .take(10))
   * ```
   *
   * Forbidden operators inside the filtered lambda: `select`, `groupBy`, `join` — these
   * throw at runtime with a descriptive message.
   *
   * @param keyOrSelector - A property key string, a simple single-property lambda, **or** a
   *   filtered-include lambda returning an `IncludeSubquery`.
   * @throws {IncludeResolutionError} if the property is not a declared relationship.
   */
  public include<K extends keyof T & string>(key: K): Queryable<T>;
  public include<K extends keyof T>(selector: (entity: T) => T[K]): Queryable<T>;
  public include<U>(selector: (entity: NavigationProxy<T>) => IncludeSubquery<U>): Queryable<T>;
  public include(keyOrSelector: unknown): Queryable<T> {
    // ── String key ──────────────────────────────────────────────────────────
    if (typeof keyOrSelector !== 'function') {
      return this._addSimpleInclude(String(keyOrSelector));
    }

    // ── Lambda: try filtered-include proxy first ─────────────────────────────
    // The proxy returns an IncludeSubquery for any property access.
    // For a filtered lambda (b => b.posts.where(...).take(10)), the returned
    // value will be an IncludeSubquery with filter specs captured.
    // For a plain lambda (b => b.posts), the returned value will also be an
    // IncludeSubquery but with isFiltered === false → treated as simple include.
    let proxyResult: unknown;
    const makeIncludeProxy = (): T =>
      new Proxy({} as object, {
        get(_target, prop) {
          return new IncludeSubquery<unknown>(String(prop));
        }
      }) as unknown as T;
    try {
      proxyResult = (keyOrSelector as (entity: T) => unknown)(makeIncludeProxy());
    } catch (err) {
      // Proxy call threw (e.g. forbidden operator). Surface the captured error directly —
      // re-running the lambda would invoke user side effects a second time (task-9 extracts
      // this proxy entirely).
      throw err;
    }

    if (proxyResult instanceof IncludeSubquery) {
      const subquery = proxyResult as IncludeSubquery<unknown>;
      const key = subquery.propertyName;
      this._validateIncludeProperty(key);
      return this.withModel((_model, draft) => {
        draft._lastIncludePath = key;
        if (subquery.isFiltered) {
          draft._filteredIncludes.set(key, subquery);
        } else if (!draft._includes.includes(key)) {
          draft._includes.push(key);
        }
      });
    }

    // ── Fallback: plain key-extractor lambda (single property access) ────────
    const key = extractKey(keyOrSelector as (entity: T) => T[keyof T]);
    return this._addSimpleInclude(key);
  }

  private _addSimpleInclude(key: string): Queryable<T> {
    this._validateIncludeProperty(key);
    return this.withModel((_model, draft) => {
      draft._lastIncludePath = key;
      if (!draft._includes.includes(key)) draft._includes.push(key);
    });
  }

  private _validateIncludeProperty(key: string): void {
    const metadata = MetadataStorage.getEntity(this._entityClass);
    const valid = metadata?.relationships.some((r) => r.propertyName === key);
    if (!valid) {
      throw new IncludeResolutionError(
        'UNKNOWN_PROPERTY',
        `Property '${key}' does not exist on entity '${this._entityClass.name}'. ` +
          `Define relationship '${key}' via decorators or fix the name.`,
        {
          entityName: this._entityClass.name,
          propertyPath: key,
          propertyName: key
        }
      );
    }
  }

  /**
   * Eager-loads a nested relationship. Must follow include() or another thenInclude().
   * Accepts a lambda selector on the navigation entity type.
   *
   * @example
   * const blogs = await context.blogs
   *   .include(b => b.posts)
   *   .thenInclude(p => p.comments)
   *   .toArray();
   *
   * @throws {IncludeResolutionError} if the nested key is not a declared relationship on the
   *   target entity of the preceding include chain.
   */
  /**
   * Eagerly loads a nested navigation property after `include()`.
   *
   * @param selector - A single-property lambda (`nav => nav.address`).
   *   Nested-path lambdas are **not** supported — call `thenInclude` multiple times or
   *   use `include('relation.nested')` string form instead.
   * @throws {Error} If called without a prior `include()`.
   */
  public thenInclude(selector: (nav: never) => unknown): Queryable<T> {
    if (!this._lastIncludePath) {
      throw new Error('thenInclude() must be called after include()');
    }
    const nestedKey = extractKey(selector as (entity: never) => never[keyof never]);

    // Walk the metadata chain from the root entity class to validate nestedKey
    // against the leaf entity in the current include chain.
    let currentClass: EntityCtorRef = this._entityClass;
    for (const segment of this._lastIncludePath.split('.')) {
      const meta = MetadataStorage.getEntity(currentClass);
      if (!meta) break;
      const rel = meta.relationships.find((r) => r.propertyName === segment);
      if (!rel) break;
      const ctor = resolveTargetCtor(rel.targetEntity);
      if (!ctor) break;
      currentClass = ctor;
    }

    const leafMeta = MetadataStorage.getEntity(currentClass);
    if (leafMeta) {
      const valid = leafMeta.relationships.some((r) => r.propertyName === nestedKey);
      if (!valid) {
        const fullPath = `${this._lastIncludePath}.${nestedKey}`;
        throw new IncludeResolutionError(
          'UNKNOWN_PROPERTY',
          `Property '${nestedKey}' does not exist on entity '${currentClass.name}'. ` +
            `Check the include path '${fullPath}' for typos or missing relationship decorators.`,
          {
            entityName: currentClass.name,
            propertyPath: fullPath,
            propertyName: nestedKey
          }
        );
      }
    }

    const path = `${this._lastIncludePath}.${nestedKey}`;
    return this.withModel((_model, draft) => {
      draft._lastIncludePath = path;
      if (!draft._includes.includes(path)) draft._includes.push(path);
    });
  }

  /**
   * Executes the query and returns materialized entities.
   * Alias for `toArray()` — matches EF Core's `ToListAsync()` naming convention.
   * @example
   * const items = await context.blogs.include(b => b.posts).asSplitQuery().toListAsync();
   */
  public async toListAsync(): Promise<T[]> {
    return this.toArray();
  }

  /**
   * Returns an AsyncIterable<T> that streams entities from the database using
   * chunked OFFSET pagination (1000 rows per chunk by default). Memory is bounded
   * to one chunk at a time — suitable for large result sets (ETL, exports).
   *
   * Mirrors EF Core's `AsAsyncEnumerable()` extension method.
   *
   * **Limitations**:
   * - `include()`/`thenInclude()` are not populated during streaming.
   *   Use `toListAsync()` when eager loading is required.
   * - `NoTrackingWithIdentityResolution` falls back to no-tracking (no in-memory deduplication
   *   across chunks) to preserve memory bounds.
   *
   * @param signal Optional AbortSignal to cancel streaming between chunks.
   *
   * @example
   * for await (const post of context.posts.asAsyncEnumerable()) {
   *   await exportRow(post);
   * }
   */
  public asAsyncEnumerable(signal?: AbortSignal): AsyncIterable<T> {
    return this._streaming.stream(
      this.prepareQueryModel(),
      this._trackingMode,
      this._entityAttacher,
      signal
    );
  }

  /**
   * Executes an async action for each entity in the query result, streaming
   * from the database without buffering the full result set in memory.
   *
   * Mirrors EF Core's `ForEachAsync()` extension method.
   *
   * @param action Synchronous or async callback invoked for each entity.
   * @param signal Optional AbortSignal to cancel streaming between chunks.
   *
   * @example
   * await context.posts
   *   .where(p => p.isPublished)
   *   .forEachAsync(p => exportToCsv(p));
   */
  public async forEachAsync(
    action: (entity: T) => void | Promise<void>,
    signal?: AbortSignal
  ): Promise<void> {
    for await (const entity of this.asAsyncEnumerable(signal)) {
      await action(entity);
    }
  }

  /**
   * Materializes the query result into a `Map` keyed by `keySelector`.
   * Throws if two entities produce the same key (mirrors EF Core behavior).
   *
   * Mirrors EF Core's `ToDictionaryAsync(keySelector)` overload.
   *
   * @param keySelector Lambda that extracts the map key from each entity.
   * @param signal      Optional AbortSignal to cancel streaming.
   *
   * @example
   * const byId = await context.posts.toDictionaryAsync(p => p.id);
   */
  public async toDictionaryAsync<K>(
    keySelector: (entity: T) => K,
    signal?: AbortSignal
  ): Promise<Map<K, T>>;

  /**
   * Materializes the query result into a `Map` keyed by `keySelector` with
   * values projected by `elementSelector`.
   * Throws if two entities produce the same key.
   *
   * Mirrors EF Core's `ToDictionaryAsync(keySelector, elementSelector)` overload.
   *
   * @param keySelector     Lambda that extracts the map key from each entity.
   * @param elementSelector Lambda that projects the map value from each entity.
   * @param signal          Optional AbortSignal to cancel streaming.
   *
   * @example
   * const titleById = await context.posts.toDictionaryAsync(p => p.id, p => p.title);
   */
  public async toDictionaryAsync<K, V>(
    keySelector: (entity: T) => K,
    elementSelector: (entity: T) => V,
    signal?: AbortSignal
  ): Promise<Map<K, V>>;

  public async toDictionaryAsync<K, V = T>(
    keySelector: (entity: T) => K,
    elementSelectorOrSignal?: ((entity: T) => V) | AbortSignal,
    signal?: AbortSignal
  ): Promise<Map<K, V>> {
    let elementSelector: ((entity: T) => V) | undefined;
    let resolvedSignal: AbortSignal | undefined;

    if (typeof elementSelectorOrSignal === 'function') {
      elementSelector = elementSelectorOrSignal;
      resolvedSignal = signal;
    } else {
      resolvedSignal = elementSelectorOrSignal ?? signal;
    }

    return this._streaming.collectDictionary(
      this.asAsyncEnumerable(resolvedSignal),
      keySelector,
      elementSelector
    );
  }

  /** Executes the query and returns materialized entities.
   * @example
   * const items = await context.products.where(p => p.stock > 0).toArray();
   */
  public async toArray(): Promise<T[]> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const queryModel = this.prepareQueryModel();
    const filteredIncludes = this._filteredIncludes.size ? this._filteredIncludes : undefined;
    const entities = await this._executor.executeAndMaterialize(
      queryModel,
      this._includes,
      this._cte,
      this.effectiveSplittingBehavior,
      filteredIncludes
    );
    return this._applyTracking(entities);
  }

  /** Returns the first entity or throws if none.
   * @example
   * const first = await context.books.orderBy('id').first();
   */
  public async first(): Promise<T> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const queryModel = this.prepareQueryModel();
    queryModel.limit = 1;
    const filteredIncludes = this._filteredIncludes.size ? this._filteredIncludes : undefined;
    const entities = await this._executor.executeAndMaterialize(
      queryModel,
      this._includes,
      this._cte,
      this.effectiveSplittingBehavior,
      filteredIncludes
    );
    const tracked = this._applyTracking(entities);
    if (!tracked.length) throw new Error('Sequence contains no elements');
    return tracked[0];
  }

  /** Returns the first entity or null.
   * @example
   * const maybe = await context.books.where(b => b.id > 10000).firstOrDefault();
   */
  public async firstOrDefault(): Promise<T | null> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const queryModel = this.prepareQueryModel();
    queryModel.limit = 1;
    const filteredIncludes = this._filteredIncludes.size ? this._filteredIncludes : undefined;
    const entities = await this._executor.executeAndMaterialize(
      queryModel,
      this._includes,
      this._cte,
      this.effectiveSplittingBehavior,
      filteredIncludes
    );
    const tracked = this._applyTracking(entities);
    return tracked[0] ?? null;
  }

  /** Ensures exactly one result; throws if 0 or more than 1.
   * @example
   * const book = await context.books.where(b => b.id === 1).single();
   */
  public async single(): Promise<T> {
    const results = await this.toArray();
    if (results.length === 0) throw new Error('Sequence contains no elements');
    if (results.length > 1) throw new Error('Sequence contains more than one element');
    return results[0];
  }

  /** Returns one or null; throws if more than 1.
   * @example
   * const maybe = await context.books.where(b => b.id === 9999).singleOrDefault();
   */
  public async singleOrDefault(): Promise<T | null> {
    const results = await this.toArray();
    if (results.length > 1) throw new Error('Sequence contains more than one element');
    return results[0] ?? null;
  }

  /** Returns the number of rows that match the current query.
   * @example
   * const count = await context.products.where(p => p.price >= 100).count();
   */
  public async count(): Promise<number> {
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata) throw new Error(`Entity metadata not found for ${this._entityClass.name}`);
    return this._countCoordinator.count({
      entityName: this._entityClass.name,
      tableName: metadata.tableName,
      whereSignature: this._whereSignature,
      performance: this._performance,
      provider: this._provider,
      executor: this._executor,
      inflightCounts: this._inflightCounts,
      externalCountCache: this._externalCountCache,
      prepareModel: () => this.prepareQueryModel()
    });
  }

  /** Resolve a TypeScript property name to its database column name via entity metadata. */
  protected resolveColumnName(propName: string): string {
    const meta = MetadataStorage.getEntity(this._entityClass);
    return meta?.columns.find((c) => c.propertyName === propName)?.columnName ?? propName;
  }

  /** Returns true if at least one row matches the query.
   * @example
   * const exists = await context.products.where(p => p.name === 'Laptop').any();
   */
  public async any(): Promise<boolean> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const queryModel = this.prepareQueryModel();
    queryModel.limit = 1;
    const filteredIncludes = this._filteredIncludes.size ? this._filteredIncludes : undefined;
    const entities = await this._executor.executeAndMaterialize(
      queryModel,
      this._includes,
      this._cte,
      this.effectiveSplittingBehavior,
      filteredIncludes
    );
    return entities.length > 0;
  }

  /**
   * Builds a ColumnResolver that maps TypeScript property names to SQL column names
   * using entity metadata. Falls back to the property name when no mapping is found.
   *
   * For multi-segment paths (u.profile.city), only the last segment is resolved
   * against the entity's own columns; prefix segments are left as-is.
   */
  private buildColumnResolver(): ColumnResolver | undefined {
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata || metadata.columns.length === 0) return undefined;

    return (node: PropertyNode): string => {
      const lastSegment = node.name ?? node.path?.[node.path.length - 1];
      const col =
        lastSegment !== undefined
          ? metadata.columns.find((c) => c.propertyName === lastSegment)
          : undefined;
      const resolvedName = col?.columnName ?? lastSegment;

      if (node.name !== undefined) {
        return resolvedName ?? node.name;
      }
      if (node.path !== undefined && node.path.length > 0) {
        if (resolvedName === undefined) return node.path.join('.');
        return [...node.path.slice(0, -1), resolvedName].join('.');
      }
      return '';
    };
  }

  /**
   * Builds a ConverterResolver that maps a TypeScript property name to its registered
   * ValueConverter (via `HasConversion`), mirroring {@link buildColumnResolver}.
   *
   * Without this, value converters are silently ignored in WHERE/HAVING predicates: a literal
   * compared against a converted column is emitted unconverted, producing wrong results. The
   * resolver feeds {@link SqlVisitorFactory} so `BinaryVisitor` can lift literals to their
   * provider representation. Returns `undefined` when the entity registers no converters.
   */
  private buildConverterResolver(): ConverterResolver | undefined {
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (!metadata || metadata.columns.length === 0) return undefined;
    const hasConverter = metadata.columns.some((c) => c.converter !== undefined);
    if (!hasConverter) return undefined;

    return (propertyName: string) =>
      metadata.columns.find((c) => c.propertyName === propertyName)?.converter;
  }

  /** Assembles a fully-configured SqlVisitor (dialect translators + metadata converters/rewriters). */
  private createSqlVisitor(): SqlVisitor {
    return this._context.visitorFactory.create({
      metadata: MetadataStorage.getEntity(this._entityClass),
      dialect: this._provider.getDialect(),
      converterResolver: this.buildConverterResolver()
    });
  }

  /** Attach an AbortSignal to cancel execution before hitting the provider. */
  public withAbort(signal: AbortSignal): Queryable<T> {
    return this.withModel((_model, draft) => {
      draft._abortSignal = signal;
    });
  }

  /** Calculate average of a numeric property */
  public async average<K extends keyof T>(key: K): Promise<number> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const colName = this.resolveColumnName(key as string);
    const queryModel = this.prepareQueryModel();
    return this._aggregates.average(queryModel, colName);
  }

  /** Calculate sum of a numeric property */
  public async sum<K extends keyof T>(key: K): Promise<number> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const colName = this.resolveColumnName(key as string);
    const queryModel = this.prepareQueryModel();
    return this._aggregates.sum(queryModel, colName);
  }

  /** Find minimum value of a property */
  public async min<K extends keyof T>(key: K): Promise<T[K]> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const colName = this.resolveColumnName(key as string);
    const queryModel = this.prepareQueryModel();
    return this._aggregates.min<K>(queryModel, colName);
  }

  /** Find maximum value of a property */
  public async max<K extends keyof T>(key: K): Promise<T[K]> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const colName = this.resolveColumnName(key as string);
    const queryModel = this.prepareQueryModel();
    return this._aggregates.max<K>(queryModel, colName);
  }

  /** Check if the sequence contains a specific element */
  public async contains(item: T): Promise<boolean> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const queryModel = this.prepareQueryModel();
    return this._aggregates.contains(queryModel, item, async () => this.toArray());
  }

  /** Get elements that are in this sequence but not in the other (SQL EXCEPT). */
  public except(other: Queryable<T>): Queryable<T> {
    return this.withModel((model) => {
      model.unions = model.unions ?? [];
      model.unions.push(this._setOps.build('except', other._model, other._entityClass));
    });
  }

  /** Get elements that are in both sequences (SQL INTERSECT). */
  public intersect(other: Queryable<T>): Queryable<T> {
    return this.withModel((model) => {
      model.unions = model.unions ?? [];
      model.unions.push(this._setOps.build('intersect', other._model, other._entityClass));
    });
  }

  /** Concatenate with another sequence, preserving order (SQL UNION ALL). */
  public concat(other: Queryable<T>): Queryable<T> {
    return this.withModel((model) => {
      model.unions = model.unions ?? [];
      model.unions.push(this._setOps.build('concat', other._model, other._entityClass));
    });
  }

  /**
   * Executes a bulk UPDATE without materialising entities (EF Core ExecuteUpdateAsync parity).
   * Returns the number of rows affected.
   *
   * @throws if `include()` was called before this — bulk DML does not support eager loading.
   *
   * @example
   * const n = await ctx.users
   *   .where(u => u.isActive)
   *   .executeUpdate(s => s.setProperty(u => u.name, 'Locked'));
   */
  public async executeUpdate(
    setters: (s: ISetPropertyCalls<T>) => ISetPropertyCalls<T>
  ): Promise<number> {
    return this._bulkDml.update(
      setters,
      this._includes.length > 0 || this._filteredIncludes.size > 0,
      () => this.prepareQueryModel()
    );
  }

  /**
   * Executes a bulk DELETE without materialising entities (EF Core ExecuteDeleteAsync parity).
   * Returns the number of rows affected.
   *
   * @throws if `include()` was called before this — bulk DML does not support eager loading.
   *
   * @example
   * const n = await ctx.logs
   *   .where(l => l.createdAt < cutoff)
   *   .executeDelete();
   */
  public async executeDelete(): Promise<number> {
    return this._bulkDml.delete(this._includes.length > 0 || this._filteredIncludes.size > 0, () =>
      this.prepareQueryModel()
    );
  }

  private _addJoinOn<TOther>(
    type: 'INNER' | 'LEFT',
    otherCtor: new () => TOther,
    leftKey: string,
    rightKey: string,
    alias?: string
  ): void {
    const leftMeta = MetadataStorage.getEntity(this._entityClass);
    const rightMeta = MetadataStorage.getEntity(otherCtor);
    if (!leftMeta || !rightMeta) throw new Error('ts-linq: entity metadata not found for join');
    const leftCol = leftMeta.columns.find((c) => c.propertyName === leftKey)?.columnName ?? leftKey;
    const rightCol =
      rightMeta.columns.find((c) => c.propertyName === rightKey)?.columnName ?? rightKey;
    this._model.joins = this._model.joins ?? [];
    // Emit a structured equi-join; the dialect renders the ON clause and quotes each identifier.
    this._model.joins.push({
      type,
      table: rightMeta.tableName,
      onColumns: [
        {
          left: { table: leftMeta.tableName, column: leftCol },
          right: { table: rightMeta.tableName, column: rightCol }
        }
      ],
      alias
    });
  }
}

/**
 * Returned by `Queryable.orderBy` / `orderByDescending`. Exposes `thenBy` and
 * `thenByDescending` as the only compile-time-safe way to add secondary sort keys,
 * mirroring LINQ-to-Objects `IOrderedEnumerable<T>`.
 *
 * Instances are created exclusively via `OrderedQueryable._fromQueryable(source)` —
 * never by calling `new OrderedQueryable(...)` directly.
 */
export class OrderedQueryable<T> extends Queryable<T> {
  /**
   * Factory that wraps an existing `Queryable<T>` in an `OrderedQueryable<T>` without
   * re-running the heavyweight constructor. Uses `Object.create` + `Object.assign` to
   * copy all own enumerable properties (the private `_model`, `_executor`, etc.) onto a
   * new object whose prototype chain includes `OrderedQueryable.prototype`.
   */
  static _fromQueryable<T>(source: Queryable<T>): OrderedQueryable<T> {
    const ordered = Object.create(OrderedQueryable.prototype) as OrderedQueryable<T>;
    Object.assign(ordered, source);
    return ordered;
  }

  /**
   * Adds a secondary ascending sort. Only available after `orderBy` or `orderByDescending`.
   *
   * @param keyOrSelector - A property key string **or** a single-property lambda (`entity => entity.name`).
   */
  public thenBy<K extends keyof T>(
    keyOrSelector: K | ((entity: T) => T[keyof T])
  ): OrderedQueryable<T> {
    const column = this.resolveColumnName(extractKey(keyOrSelector));
    const draft = this.withModel((model) => {
      model.orderBy = model.orderBy || [];
      model.orderBy.push({ column, direction: 'ASC' });
    });
    return OrderedQueryable._fromQueryable(draft);
  }

  /**
   * Adds a secondary descending sort. Only available after `orderBy` or `orderByDescending`.
   *
   * @param keyOrSelector - A property key string **or** a single-property lambda (`entity => entity.name`).
   */
  public thenByDescending<K extends keyof T>(
    keyOrSelector: K | ((entity: T) => T[keyof T])
  ): OrderedQueryable<T> {
    const column = this.resolveColumnName(extractKey(keyOrSelector));
    const draft = this.withModel((model) => {
      model.orderBy = model.orderBy || [];
      model.orderBy.push({ column, direction: 'DESC' });
    });
    return OrderedQueryable._fromQueryable(draft);
  }
}
