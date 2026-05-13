import type { DatabaseProvider, EntityLoader } from '@ts-linq/core';
import { SqlVisitor, type ColumnResolver, type ExpressionNode, type PropertyNode } from '@ts-linq/ast';
import { safeCache, safeCacheSize } from '@ts-linq/metrics-safe';
import { MetadataStorage } from '@ts-linq/metadata';
import type {
  EntityCacheLike,
  FallbackPolicy,
  GlobalFilter,
  OrderByClause,
  PerformanceOptions,
  QueryFallback,
  Result,
  SqlParameter,
  WhereClause
} from '@ts-linq/types';
import type { CteDefinition } from '@ts-linq/types';
import { err, ok } from '@ts-linq/types';

import type { CountCache } from './CountCache';
import { AggregateOperations } from './AggregateOperations';
import { GlobalFilterApplier } from './GlobalFilterApplier';
import { IncludePlanner } from './IncludePlanner';
import { QueryBuilder } from './QueryBuilder';
import { QueryExecutor } from './QueryExecutor';
import { QueryModel } from './QueryModel';
import { RowMaterializer } from './RowMaterializer';

/**
 * Fluent query builder over a given entity type. Accumulates query intent
 * in a QueryModel and delegates SQL generation to QueryBuilder.
 */
export class Queryable<T> {
  /** Used by the compile-time transformer to identify Queryable instances. Do not use at runtime. */
  declare readonly __tsLinqWhereTransformerBrand: true;

  private _entityClass: new () => T;
  private _provider: DatabaseProvider;
  private _model: QueryModel = new QueryModel();
  private _entityLoader?: EntityLoader;
  private _entityCache?: EntityCacheLike;
  private _performance?: PerformanceOptions;
  private _includes: string[] = [];
  private _sqlBuilder: QueryBuilder;
  // Single-flight deduplication for concurrent count() calls (per-chain instance)
  private _inflightCounts: Map<string, Promise<number>> = new Map();
  private _externalCountCache?: CountCache;
  private _abortSignal?: AbortSignal;
  private _globalFilters?: GlobalFilter[];
  private _globalFilterApplier = new GlobalFilterApplier();
  private _materializer!: RowMaterializer<T>;
  private _includePlanner!: IncludePlanner<T>;
  private _fallbacks: Array<QueryFallback<T>> = [];
  // Internal storage for CTE info (used by providers that support WITH ...)
  private _cte?: CteDefinition;
  // Lightweight signature of WHERE clauses for fast count() cache keys
  private _whereSignature: string = '[]';
  // Per-chain fallback throttle state (shared by reference through clone())
  private _throttle = { windowStart: 0, usedInWindow: 0, lastAttemptAt: 0 };

  private _softDeleteOptions?: import('@ts-linq/types').SoftDeleteOptions;

  /** Execution delegate: primary + fallback + hedging paths. Re-created in clone() with shared throttle ref. */
  private _executor!: QueryExecutor<T>;
  /** Stateless aggregate operations. Shared by reference across all clones. */
  private _aggregates!: AggregateOperations<T>;

  /**
   * Create a new Queryable bound to an entity type and provider.
   * @param entityClass Entity constructor.
   * @param provider Database provider used for execution.
   * @param entityLoader Optional entity loader for eager includes.
   */
  constructor(
    entityClass: new () => T,
    provider: DatabaseProvider,
    entityLoader?: EntityLoader,
    entityCache?: EntityCacheLike,
    performance?: PerformanceOptions,
    globalFilters?: GlobalFilter[],
    softDeleteOptions?: import('@ts-linq/types').SoftDeleteOptions
  ) {
    this._entityClass = entityClass;
    this._provider = provider;
    this._entityLoader = entityLoader;
    this._entityCache = entityCache;
    this._performance = performance;
    this._globalFilters = globalFilters;
    this._softDeleteOptions = softDeleteOptions;
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
      this._fallbacks,
      this._performance,
      this._throttle
    );
    this._aggregates = new AggregateOperations<T>(
      this._entityClass,
      this._provider,
      this._sqlBuilder
    );
  }

  /**
   * @deprecated Count cache is now owned per-context via `PerformanceOptions.countCache`.
   * This method is a no-op kept for backward compatibility.
   */
  public static clearCountCache(): void {
    // no-op: count cache is now owned by the DbContext (per-context InMemoryCountCache).
  }

  /** Create a shallow clone sharing provider/loader but copying model. */
  public clone(): Queryable<T> {
    const clonedQueryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters,
      this._softDeleteOptions
    );
    clonedQueryable._model = this._model.clone();
    // preserve where signature for accurate count cache keys
    clonedQueryable._whereSignature = this._whereSignature;
    // preserve includes, fallbacks and client-side predicates
    clonedQueryable._includes = [...this._includes];
    clonedQueryable._fallbacks = [...this._fallbacks];
    // share throttle state by reference so all clones in a chain see the same counters
    clonedQueryable._throttle = this._throttle;
    // Re-create executor with the cloned fallbacks array and shared throttle reference
    clonedQueryable._executor = new QueryExecutor<T>(
      this._entityClass,
      this._provider,
      this._sqlBuilder,
      clonedQueryable._materializer,
      clonedQueryable._includePlanner,
      clonedQueryable._fallbacks,
      this._performance,
      this._throttle
    );
    // AggregateOperations is stateless — share the same instance
    clonedQueryable._aggregates = this._aggregates;
    return clonedQueryable;
  }

  /**
   * Adds a WHERE IN clause for a specific column.
   * Efficiently handles large lists of values.
   * filter: column IN (v1, v2, ...)
   */
  public whereIn<K extends keyof T & string>(column: K, values: ReadonlyArray<T[K]>): Queryable<T> {
    if (!values || values.length === 0) {
      // IN (empty) matches nothing; ensure we return empty set.
      // We add a condition "1 = 0"
      this._model.where = this._model.where || [];
      this._model.where.push({ condition: '1 = 0', parameters: [] });
      this._whereSignature += '|1=0:[]';
      return this;
    }

    // Resolve column name from metadata (if available) or use property name
    const metadata = MetadataStorage.getEntity(this._entityClass);
    const dbColumn = metadata
      ? metadata.columns.find((c) => c.propertyName === column || c.columnName === column)?.columnName || column
      : column;

    const quotedCol = this._provider.getDialect().quoteIdentifier(dbColumn);

    const whereClause: WhereClause = {
      condition: `${quotedCol} IN (${values.map(() => '?').join(', ')})`,
      parameters: values as unknown as SqlParameter[]
    };

    this._model.where = this._model.where || [];
    this._model.where.push(whereClause);
    const sigParams = values.length > 5 ? `[${values.length} values]` : JSON.stringify(values);
    this._whereSignature += `|${column}IN:${sigParams}`;

    return this;
  }

  /** Apply configured global filters to the provided query model. */
  private applyGlobalFiltersToModel(model: QueryModel & { where?: WhereClause[] }): void {
    this._globalFilterApplier.apply(
      this._entityClass,
      model,
      this._softDeleteOptions ?? this._provider.softDeleteOptions,
      this._globalFilters
    );
  }

  /**
   * @deprecated Runtime predicate parsing is not supported — use `innerJoinOn(leftKey, rightKey)`.
   */
  public innerJoin<TOther>(
    _otherCtor: new () => TOther,
    _on: (left: T, right: TOther) => boolean,
    _alias?: string
  ): Queryable<T> {
    throw new Error(
      "ts-linq(innerJoin): runtime predicate parsing is not supported. " +
      "Use innerJoinOn(leftKey, rightKey) for type-safe joins."
    );
  }

  /**
   * @deprecated Runtime predicate parsing is not supported — use `leftJoinOn(leftKey, rightKey)`.
   */
  public leftJoin<TOther>(
    _otherCtor: new () => TOther,
    _on: (left: T, right: TOther) => boolean,
    _alias?: string
  ): Queryable<T> {
    throw new Error(
      "ts-linq(leftJoin): runtime predicate parsing is not supported. " +
      "Use leftJoinOn(leftKey, rightKey) for type-safe joins."
    );
  }

  /**
   * Add a type-safe INNER JOIN on a single equality key pair.
   *
   * @example
   * context.books.innerJoinOn(Author, 'authorId', 'id')
   */
  public innerJoinOn<TOther>(
    otherCtor: new () => TOther,
    leftKey: keyof T & string,
    rightKey: keyof TOther & string,
    alias?: string
  ): Queryable<T> {
    this._addJoinOn('INNER', otherCtor, leftKey, rightKey, alias);
    return this;
  }

  /**
   * Add a type-safe LEFT JOIN on a single equality key pair.
   *
   * @example
   * context.books.leftJoinOn(Author, 'authorId', 'id')
   */
  public leftJoinOn<TOther>(
    otherCtor: new () => TOther,
    leftKey: keyof T & string,
    rightKey: keyof TOther & string,
    alias?: string
  ): Queryable<T> {
    this._addJoinOn('LEFT', otherCtor, leftKey, rightKey, alias);
    return this;
  }

  /**
   * Adds a filter predicate to the query.
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
    const visitor = new SqlVisitor();
    const { condition, parameters } = visitor.toSql(input.ast, input.parameters, this.buildColumnResolver());
    const whereClause: WhereClause = { condition, parameters };
    this._model.where = this._model.where || [];
    this._model.where.push(whereClause);
    this._whereSignature += `|${whereClause.condition}:${JSON.stringify(whereClause.parameters)}`;
    return this;
  }

  /**
   * Register a graceful-degradation fallback source to be used when the primary provider is unavailable.
   * Fallbacks are tried in the order they are registered until one succeeds.
   */
  public fallbackTo(source: QueryFallback<T>): Queryable<T> {
    this._fallbacks.push(source);
    return this;
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
    this._model.where = this._model.where || [];
    const clause: WhereClause = { condition: `EXISTS (${query})`, parameters };
    this._model.where.push(clause);
    this._whereSignature += `|${clause.condition}:${JSON.stringify(clause.parameters)}`;
    return this;
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
    this._model.where = this._model.where || [];
    const clause: WhereClause = { condition: `${column} IN (${query})`, parameters };
    this._model.where.push(clause);
    this._whereSignature += `|${clause.condition}:${JSON.stringify(clause.parameters)}`;
    return this;
  }

  /** With CTE support: define a named subquery and return a Queryable bound to that CTE. */
  public withCte(name: string, subquery: Queryable<unknown>): Queryable<T> {
    const { query } = subquery._sqlBuilder.generateFromModel(
      subquery._entityClass as unknown as new () => unknown,
      subquery._model
    );
    const cloned = this.clone();
    cloned._model.from = name;
    cloned._cte = { name, sql: query };
    return cloned;
  }

  /**
   * Projects selected properties. Returns a new Queryable of the projected type.
   * @param selector Projection selector.
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
  public selectCompiled<TResult>(input: { readonly fields: readonly string[] }): Queryable<TResult> {
    const next = new Queryable<TResult>(
      this._entityClass as unknown as new () => TResult,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance
    );
    next._model = this._model.clone();
    next._model.select = [...input.fields];
    (next as unknown as { _fallbacks: Array<QueryFallback<TResult>> })._fallbacks = [
      ...((this as unknown as { _fallbacks: Array<QueryFallback<TResult>> })._fallbacks || [])
    ];
    return next;
  }

  /**
   * Adds ASC ordering by property key.
   * @param key Property name of the entity to sort by.
   *
   * @example
   * const ordered = await context.books.orderBy('title').toArray();
   */
  public orderBy<K extends keyof T>(key: K): Queryable<T> {
    const column = this.resolveColumnName(key as string);
    const orderByClause: OrderByClause = { column, direction: 'ASC' };
    this._model.orderBy = this._model.orderBy || [];
    this._model.orderBy.push(orderByClause);
    return this;
  }

  /**
   * Adds DESC ordering by property key.
   * @param key Property name of the entity to sort by descending.
   *
   * @example
   * const latest = await context.books.orderByDescending('id').take(5).toArray();
   */
  public orderByDescending<K extends keyof T>(key: K): Queryable<T> {
    const column = this.resolveColumnName(key as string);
    const orderByClause: OrderByClause = { column, direction: 'DESC' };
    this._model.orderBy = this._model.orderBy || [];
    this._model.orderBy.push(orderByClause);
    return this;
  }

  /**
   * Adds secondary ASC ordering. Must be used after orderBy() or orderByDescending().
   * @param key Property name for the secondary sort.
   *
   * @example
   * const sorted = await context.users.orderBy('lastName').thenBy('firstName').toArray();
   */
  public thenBy<K extends keyof T>(key: K): Queryable<T> {
    const column = this.resolveColumnName(key as string);
    const orderByClause: OrderByClause = { column, direction: 'ASC' };
    this._model.orderBy = this._model.orderBy || [];
    this._model.orderBy.push(orderByClause);
    return this;
  }

  /**
   * Adds secondary DESC ordering. Must be used after orderBy() or orderByDescending().
   * @param key Property name for the secondary sort descending.
   *
   * @example
   * const sorted = await context.users.orderBy('lastName').thenByDescending('age').toArray();
   */
  public thenByDescending<K extends keyof T>(key: K): Queryable<T> {
    const column = this.resolveColumnName(key as string);
    const orderByClause: OrderByClause = { column, direction: 'DESC' };
    this._model.orderBy = this._model.orderBy || [];
    this._model.orderBy.push(orderByClause);
    return this;
  }

  /** Limits the number of returned rows.
   * @example
   * const top10 = await context.products.take(10).toArray();
   */
  public take(count: number): Queryable<T> {
    this._model.limit = count;
    return this;
  }
  /** Skips given number of rows.
   * @example
   * const page2 = await context.products.orderBy('id').skip(10).take(10).toArray();
   */
  public skip(count: number): Queryable<T> {
    this._model.offset = count;
    return this;
  }
  /** Ensures distinct rows.
   * @example
   * const titles = await context.books.select(b => b.title).distinct().toArray();
   */
  public distinct(): Queryable<T> {
    this._model.distinct = true;
    return this;
  }

  /** UNION with another queryable of the same entity. */
  public union(other: Queryable<T>): Queryable<T> {
    this._model.unions = this._model.unions || [];
    this._model.unions.push({
      all: false,
      other: other._model.clone(),
      entity: other._entityClass
    });
    return this;
  }
  /** UNION ALL with another queryable of the same entity. */
  public unionAll(other: Queryable<T>): Queryable<T> {
    this._model.unions = this._model.unions || [];
    this._model.unions.push({
      all: true,
      other: other._model.clone(),
      entity: other._entityClass
    });
    return this;
  }

  /**
   * Group results by a property key.
   * @example
   * const q = context.books.groupBy('authorId');
   */
  public groupBy<K extends keyof T>(key: K): Queryable<T> {
    const column = this.resolveColumnName(key as string);
    this._model.groupBy = { columns: [column] };
    return this;
  }

  /**
   * Apply HAVING predicate to an existing groupBy.
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
    const visitor = new SqlVisitor();
    const { condition, parameters } = visitor.toSql(input.ast, input.parameters, this.buildColumnResolver());
    this._model.groupBy.having = { condition, parameters };
    return this;
  }

  /**
   * Paginate by page number and size. Applies ORDER BY fallback if missing.
   * @example
   * const page1 = await context.books.orderBy('id').paginate(1, 20);
   */
  public async paginate(
    page: number,
    size: number
  ): Promise<{ items: T[]; total: number; page: number; size: number }> {
    if (page < 1 || size < 1) throw new Error('paginate requires page >= 1 and size >= 1');
    const queryModel = this._model.clone();
    this.applyGlobalFiltersToModel(queryModel);
    queryModel.limit = size;
    queryModel.offset = (page - 1) * size;
    const items = await this._executor.executeAndMaterialize(queryModel, this._includes, this._cte);
    const total = await this.count();
    return { items, total, page, size };
  }

  /**
   * Keyset pagination helper. Requires a monotonic key (e.g., id).
   * @example
   * const page = await context.books.orderBy('id').keysetPaginate('id', lastId, 20);
   */
  public async keysetPaginate<TKey extends keyof T>(
    key: TKey,
    after: T[TKey] | null,
    size: number
  ): Promise<{ items: T[]; pageSize: number; nextAfter: T[TKey] | null }> {
    if (size < 1) throw new Error('keysetPaginate requires size >= 1');
    const propName = String(key);
    const meta = MetadataStorage.getEntity(this._entityClass);
    const colName = meta?.columns.find((c) => c.propertyName === propName)?.columnName ?? propName;
    const quotedCol = this._provider.getDialect().quoteIdentifier(colName);

    const queryModel = this._model.clone();
    queryModel.orderBy = queryModel.orderBy ?? [];
    const hasOrderByKey = queryModel.orderBy.some(
      (o) => o.column === colName || o.column === propName
    );
    if (!hasOrderByKey) queryModel.orderBy.push({ column: colName, direction: 'ASC' });
    queryModel.limit = size;

    if (after !== null && after !== undefined) {
      queryModel.where = queryModel.where ?? [];
      queryModel.where.push({
        condition: `${quotedCol} > ?`,
        parameters: [after as unknown as SqlParameter]
      });
    }

    this.applyGlobalFiltersToModel(queryModel);
    const items = await this._executor.executeAndMaterialize(queryModel, this._includes, this._cte);
    const last =
      items.length > 0 ? (items[items.length - 1] as unknown as Record<string, unknown>) : null;
    const nextAfter = last ? (last[propName] as T[TKey] | null) : null;
    return { items, pageSize: size, nextAfter };
  }

  /**
   * Adds eager-loading of a relationship by property name.
   * Validates the relationship against entity metadata.
   *
   * @example
   * const authors = await context.authors.include('books').where(a => a.id === 1).toArray();
   */
  public include<K extends keyof T & string>(key: K): Queryable<T> {
    const metadata = MetadataStorage.getEntity(this._entityClass);
    const valid = metadata?.relationships.some((r) => r.propertyName === key);
    if (!valid) {
      throw new Error(
        `Invalid include '${key}' for ${this._entityClass.name}. Define relationship '${key}' via decorators or fix the name.`
      );
    }
    if (!this._includes.includes(key)) this._includes.push(key);
    return this;
  }

  /** Executes the query and returns materialized entities.
   * @example
   * const items = await context.products.where(p => p.stock > 0).toArray();
   */
  public async toArray(): Promise<T[]> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const queryModel = this._model.clone();
    this.applyGlobalFiltersToModel(queryModel);
    return this._executor.executeAndMaterialize(queryModel, this._includes, this._cte);
  }

  /** Returns the first entity or throws if none.
   * @example
   * const first = await context.books.orderBy('id').first();
   */
  public async first(): Promise<T> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const queryModel = this._model.clone();
    queryModel.limit = 1;
    this.applyGlobalFiltersToModel(queryModel);
    const entities = await this._executor.executeAndMaterialize(queryModel, this._includes, this._cte);
    if (!entities.length) throw new Error('Sequence contains no elements');
    return entities[0];
  }
  /** Try-version of first without throwing exceptions. */
  public async tryFirst(): Promise<Result<T, Error>> {
    try {
      const value = await this.first();
      return ok(value);
    } catch (error) {
      return err(error as Error);
    }
  }
  /** Returns the first entity or null.
   * @example
   * const maybe = await context.books.where(b => b.id > 10000).firstOrDefault();
   */
  public async firstOrDefault(): Promise<T | null> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const queryModel = this._model.clone();
    queryModel.limit = 1;
    this.applyGlobalFiltersToModel(queryModel);
    const entities = await this._executor.executeAndMaterialize(queryModel, this._includes, this._cte);
    return entities[0] ?? null;
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
  /** Try-version of single without throwing exceptions. */
  public async trySingle(): Promise<Result<T, Error>> {
    try {
      const value = await this.single();
      return ok(value);
    } catch (error) {
      return err(error as Error);
    }
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
    if (this._performance?.enableCountCache) {
      const key = this.buildCountCacheKey(metadata.tableName);
      const inflight = this._inflightCounts.get(key);
      if (inflight) return inflight;
      const ttl = this._performance.countCacheTtlMs ?? 0;
      const hit = this._externalCountCache?.get(key);
      if (hit && (ttl <= 0 || Date.now() - hit.ts <= ttl)) {
        safeCache(this._provider.loggerRef, {
          cache: 'count',
          hit: true,
          provider: this._provider.providerLabel,
          ttl: ttl > 0
        });
        this._provider.loggerRef?.cache?.({
          cache: 'count',
          hit: true,
          provider: this._provider.providerLabel
        });
        return hit.value;
      }
      const queryModel = this._model.clone();
      this.applyGlobalFiltersToModel(queryModel);
      const pending = this._executor.executeCount(metadata.tableName, queryModel);
      this._inflightCounts.set(key, pending);
      let value: number;
      try {
        value = await pending;
      } finally {
        this._inflightCounts.delete(key);
      }
      const entry = { value, ts: Date.now() };
      if (this._externalCountCache) this._externalCountCache.set(key, entry);
      safeCacheSize(this._provider.loggerRef, {
        cache: 'count',
        size: -1,
        provider: this._provider.providerLabel
      });
      safeCache(this._provider.loggerRef, {
        cache: 'count',
        hit: false,
        provider: this._provider.providerLabel
      });
      this._provider.loggerRef?.cache?.({
        cache: 'count',
        hit: false,
        provider: this._provider.providerLabel
      });
      return value;
    }
    const queryModel = this._model.clone();
    this.applyGlobalFiltersToModel(queryModel);
    return this._executor.executeCount(metadata.tableName, queryModel);
  }

  private buildCountCacheKey(table: string): string {
    const provider = this._provider?.providerLabel ? `${this._provider.providerLabel}|` : '';
    const ns = this._performance?.cacheNamespace ? `${this._performance.cacheNamespace}|` : '';
    return `${ns}${provider}${this._entityClass.name}|count|${table}|${this._whereSignature}`;
  }

  /** Resolve a TypeScript property name to its database column name via entity metadata. */
  private resolveColumnName(propName: string): string {
    const meta = MetadataStorage.getEntity(this._entityClass);
    return meta?.columns.find((c) => c.propertyName === propName)?.columnName ?? propName;
  }
  /** Returns true if at least one row matches the query.
   * @example
   * const exists = await context.products.where(p => p.name === 'Laptop').any();
   */
  public async any(): Promise<boolean> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const queryModel = this._model.clone();
    queryModel.limit = 1;
    this.applyGlobalFiltersToModel(queryModel);
    const entities = await this._executor.executeAndMaterialize(queryModel, this._includes, this._cte);
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
      const col = lastSegment !== undefined
        ? metadata.columns.find(c => c.propertyName === lastSegment)
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

  /** Attach an AbortSignal to cancel execution before hitting the provider. */
  public withAbort(signal: AbortSignal): Queryable<T> {
    this._abortSignal = signal;
    return this;
  }

  // Additional Entity Framework-style LINQ methods

  /** Check if all elements satisfy a condition (EF-style) */
  public async all(predicate: (entity: T) => boolean): Promise<boolean> {
    throw new Error(
      "ts-linq(all): compile-time transformer is required. Configure ts-patch plugin '@ts-linq/transformer'."
    );
  }

  /** Calculate average of a numeric property (EF-style) */
  public async average<K extends keyof T>(key: K): Promise<number> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const colName = this.resolveColumnName(key as string);
    const queryModel = this._model.clone();
    this.applyGlobalFiltersToModel(queryModel);
    return this._aggregates.average(queryModel, colName);
  }

  /** Calculate sum of a numeric property (EF-style) */
  public async sum<K extends keyof T>(key: K): Promise<number> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const colName = this.resolveColumnName(key as string);
    const queryModel = this._model.clone();
    this.applyGlobalFiltersToModel(queryModel);
    return this._aggregates.sum(queryModel, colName);
  }

  /** Find minimum value of a property (EF-style) */
  public async min<K extends keyof T>(key: K): Promise<T[K]> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const colName = this.resolveColumnName(key as string);
    const queryModel = this._model.clone();
    this.applyGlobalFiltersToModel(queryModel);
    return this._aggregates.min<K>(queryModel, colName);
  }

  /** Find maximum value of a property (EF-style) */
  public async max<K extends keyof T>(key: K): Promise<T[K]> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const colName = this.resolveColumnName(key as string);
    const queryModel = this._model.clone();
    this.applyGlobalFiltersToModel(queryModel);
    return this._aggregates.max<K>(queryModel, colName);
  }

  /** Check if the sequence contains a specific element (EF-style) */
  public async contains(item: T): Promise<boolean> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const queryModel = this._model.clone();
    this.applyGlobalFiltersToModel(queryModel);
    return this._aggregates.contains(queryModel, item, () => this.toArray());
  }

  /** Get elements that are in this sequence but not in the other (SQL EXCEPT). */
  public except(other: Queryable<T>): Queryable<T> {
    const cloned = this.clone();
    cloned._model.unions = cloned._model.unions ?? [];
    cloned._model.unions.push({
      all: false,
      setOp: 'EXCEPT',
      other: other._model.clone(),
      entity: other._entityClass as unknown as new () => unknown
    });
    return cloned;
  }

  /** Get elements that are in both sequences (SQL INTERSECT). */
  public intersect(other: Queryable<T>): Queryable<T> {
    const cloned = this.clone();
    cloned._model.unions = cloned._model.unions ?? [];
    cloned._model.unions.push({
      all: false,
      setOp: 'INTERSECT',
      other: other._model.clone(),
      entity: other._entityClass as unknown as new () => unknown
    });
    return cloned;
  }

  /** Concatenate with another sequence, preserving order (SQL UNION ALL). */
  public concat(other: Queryable<T>): Queryable<T> {
    const cloned = this.clone();
    cloned._model.unions = cloned._model.unions ?? [];
    cloned._model.unions.push({
      all: true,
      other: other._model.clone(),
      entity: other._entityClass as unknown as new () => unknown
    });
    return cloned;
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
    const leftCol = leftMeta.columns.find(c => c.propertyName === leftKey)?.columnName ?? leftKey;
    const rightCol = rightMeta.columns.find(c => c.propertyName === rightKey)?.columnName ?? rightKey;
    this._model.joins = this._model.joins ?? [];
    this._model.joins.push({
      type,
      table: rightMeta.tableName,
      on: `${leftMeta.tableName}.${leftCol} = ${rightMeta.tableName}.${rightCol}`,
      alias,
    });
  }

}
