import { DatabaseProvider } from '../providers/DatabaseProvider';
import { MetadataStorage } from '../metadata/MetadataStorage';
import {
  WhereClause,
  OrderByClause,
  PerformanceOptions,
  Result,
  ok,
  err,
  GlobalFilter
} from '../types';
import { QueryBuilder } from './QueryBuilder';
import { PredicateParser } from './PredicateParser';
import { SqlVisitor } from './ast/SqlVisitor';
import { QueryModel } from './QueryModel';
import { EntityLoader } from '../loading/EntityLoader';
import { LoadingStrategy } from '../loading/LoadingStrategy';
import { EntityCache } from '../utils/EntityCache';

/**
 * Fluent query builder over a given entity type. Accumulates query intent
 * in a QueryModel and delegates SQL generation to QueryBuilder.
 */
export class Queryable<T> {
  private _entityClass: new () => T;
  private _provider: DatabaseProvider;
  private _model: QueryModel = new QueryModel();
  private _fallbackPredicates: Array<(entity: T) => boolean> = [];
  private _entityLoader?: EntityLoader;
  private _entityCache?: EntityCache;
  private _performance?: PerformanceOptions;
  private _includes: string[] = [];
  private _sqlBuilder: QueryBuilder;
  private static _countCache: Map<string, { value: number; ts: number }> = new Map();
  private _abortSignal?: AbortSignal;
  private _globalFilters?: GlobalFilter[];

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
    entityCache?: EntityCache,
    performance?: PerformanceOptions,
    globalFilters?: GlobalFilter[]
  ) {
    this._entityClass = entityClass;
    this._provider = provider;
    this._entityLoader = entityLoader;
    this._entityCache = entityCache;
    this._performance = performance;
    this._globalFilters = globalFilters;
    this._sqlBuilder = new QueryBuilder(
      undefined as any,
      provider.loggerRef,
      provider.providerLabel
    );
  }

  /** Clear global count() cache (used on transaction rollback to avoid stale values). */
  public static clearCountCache(): void {
    Queryable._countCache.clear();
  }

  /** Create a shallow clone sharing provider/loader but copying model. */
  public clone(): Queryable<T> {
    const clonedQueryable = new Queryable<T>(
      this._entityClass,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance,
      this._globalFilters
    );
    clonedQueryable._model = this._model.clone();
    return clonedQueryable;
  }

  /**
   * Add INNER JOIN to the query.
   * @param otherCtor Joined entity constructor
   * @param on Predicate (a,b) => a.prop === b.prop
   * @param alias Optional alias for the joined table
   */
  public innerJoin<TOther>(
    otherCtor: new () => TOther,
    on: (left: T, right: TOther) => boolean,
    alias?: string
  ): Queryable<T> {
    this.addJoin('INNER', otherCtor, on, alias);
    return this;
  }

  /**
   * Add LEFT JOIN to the query.
   * @param otherCtor Joined entity constructor
   * @param on Predicate (a,b) => a.prop === b.prop
   * @param alias Optional alias for the joined table
   */
  public leftJoin<TOther>(
    otherCtor: new () => TOther,
    on: (left: T, right: TOther) => boolean,
    alias?: string
  ): Queryable<T> {
    this.addJoin('LEFT', otherCtor, on, alias);
    return this;
  }

  /**
   * Adds a filter predicate to the query. If the predicate cannot be parsed
   * into SQL, it is stored and applied in-memory after fetching.
   *
   * @example
   * const cheap = await context.products.where(p => p.price < 100).toArray();
   */
  public where(predicate: (entity: T) => boolean): Queryable<T> {
    this.addWhereOrFallback(predicate);
    return this;
  }

  /** Add EXISTS (subquery) predicate. */
  public whereExists<TOther>(subquery: Queryable<TOther>): Queryable<T> {
    const subqueryBuilder = (subquery as any)._sqlBuilder as QueryBuilder;
    const subqueryModel = (subquery as any)._model as QueryModel;
    const subqueryEntity = (subquery as any)._entityClass as Function;
    const { query, parameters } = subqueryBuilder.generateFromModel(
      subqueryEntity as any,
      subqueryModel
    );
    this._model.where = this._model.where || [];
    this._model.where.push({ condition: `EXISTS (${query})`, parameters } as any);
    return this;
  }

  /** Add IN (subquery) predicate for a column. */
  public whereInSubquery<TOther>(
    column: keyof T & string,
    subquery: Queryable<TOther>
  ): Queryable<T> {
    const subqueryBuilder = (subquery as any)._sqlBuilder as QueryBuilder;
    const subqueryModel = (subquery as any)._model as QueryModel;
    const subqueryEntity = (subquery as any)._entityClass as Function;
    const { query, parameters } = subqueryBuilder.generateFromModel(
      subqueryEntity as any,
      subqueryModel
    );
    this._model.where = this._model.where || [];
    this._model.where.push({ condition: `${column} IN (${query})`, parameters } as any);
    return this;
  }

  /**
   * Projects selected properties. Returns a new Queryable of the projected type.
   * @param selector Projection selector.
   *
   * @example
   * const names = await context.authors.select(a => a.name).toArray();
   */
  public select<TResult>(selector: (entity: T) => TResult): Queryable<TResult> {
    const next = new Queryable<TResult>(
      this._entityClass as any,
      this._provider,
      this._entityLoader,
      this._entityCache,
      this._performance
    );
    next._model = this._model.clone() as any;
    const selectorStr = selector.toString();
    const properties = this.extractPropertiesFromSelector(selectorStr);
    next._model.select = properties;
    return next;
  }

  /**
   * Adds ASC ordering by key selector.
   * @param keySelector Sort key selector.
   *
   * @example
   * const ordered = await context.books.orderBy(b => b.title).toArray();
   */
  public orderBy<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
    const keySelectorStr = keySelector.toString();
    const column = this.extractPropertyFromKeySelector(keySelectorStr);
    const orderByClause: OrderByClause = { column, direction: 'ASC' };
    this._model.orderBy = this._model.orderBy || [];
    this._model.orderBy.push(orderByClause);
    return this;
  }

  /**
   * Adds DESC ordering by key selector.
   * @param keySelector Sort key selector.
   *
   * @example
   * const latest = await context.books.orderByDescending(b => b.id).take(5).toArray();
   */
  public orderByDescending<TKey>(keySelector: (entity: T) => TKey): Queryable<T> {
    const keySelectorStr = keySelector.toString();
    const column = this.extractPropertyFromKeySelector(keySelectorStr);
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
   * const page2 = await context.products.orderBy(p => p.id).skip(10).take(10).toArray();
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
      other: (other as any)._model.clone(),
      entity: (other as any)._entityClass
    });
    return this;
  }
  /** UNION ALL with another queryable of the same entity. */
  public unionAll(other: Queryable<T>): Queryable<T> {
    this._model.unions = this._model.unions || [];
    this._model.unions.push({
      all: true,
      other: (other as any)._model.clone(),
      entity: (other as any)._entityClass
    });
    return this;
  }

  /**
   * Group results by selected columns.
   * @example
   * const q = context.books.groupBy(b => b.authorId);
   */
  public groupBy(selector: (entity: T) => any): Queryable<T> {
    const selectorStr = selector.toString();
    const columns = this.extractPropertiesFromSelector(selectorStr);
    this._model.groupBy = { columns } as any;
    return this;
  }

  /**
   * Apply HAVING predicate to an existing groupBy.
   * @example
   * const q = context.books.groupBy(b => b.authorId).having(() => true);
   */
  public having(predicate: (entity: T) => boolean): Queryable<T> {
    if (!this._model.groupBy) {
      throw new Error('having() requires a preceding groupBy()');
    }
    const parser = new PredicateParser<T>();
    const ast = parser.parse(predicate);
    if (ast) {
      const visitor = new SqlVisitor();
      const { condition, parameters } = visitor.toSql(ast);
      (this._model.groupBy as any).having = { condition, parameters } as any;
    } else {
      // Fallback to a tautology if cannot parse; predicates on aggregates are not parsed yet
      (this._model.groupBy as any).having = { condition: '1=1', parameters: [] } as any;
    }
    return this;
  }

  /**
   * Paginate by page number and size. Applies ORDER BY fallback if missing.
   * @example
   * const page1 = await context.books.orderBy(b => b.id).paginate(1, 20);
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
    const items = await this.executeAndMaterialize(queryModel);

    const total = await this.count();
    return { items, total, page, size };
  }

  /**
   * Keyset pagination helper. Requires a monotonic key (e.g., id).
   * @example
   * const page = await context.books.orderBy(b => b.id).keysetPaginate('id', lastId, 20);
   */
  public async keysetPaginate<TKey extends keyof T>(
    key: TKey,
    after: T[TKey] | null,
    size: number
  ): Promise<{ items: T[]; pageSize: number; nextAfter: T[TKey] | null }> {
    if (size < 1) throw new Error('keysetPaginate requires size >= 1');
    const queryModel = this._model.clone();
    // Ensure order by key ASC (append if missing)
    (queryModel as any).orderBy = (queryModel as any).orderBy || [];
    const hasOrderByKey = (queryModel as any).orderBy.some((o: any) => o.column === String(key));
    if (!hasOrderByKey)
      (queryModel as any).orderBy.push({ column: String(key), direction: 'ASC' });
    queryModel.limit = size;
    if (after !== null && after !== undefined) {
      // Add where key > after
      const whereClause: any = { condition: `${String(key)} > ?`, parameters: [after] };
      queryModel.where = queryModel.where || [];
      queryModel.where.push(whereClause as any);
    }
    this.applyGlobalFiltersToModel(queryModel);
    const items = await this.executeAndMaterialize(queryModel);
    const nextAfter = items.length > 0 ? (items[items.length - 1] as any)[String(key)] : null;
    return { items, pageSize: size, nextAfter };
  }

  /**
   * Adds eager-loading of a relationship using a property selector.
   * Validates the relationship against entity metadata.
   *
   * @example
   * const authors = await context.authors.include(a => a.books).where(a => a.id === 1).toArray();
   */
  public include(selector: (entity: T) => any): Queryable<T> {
    const prop = this.extractIncludeProperty(selector);
    const metadata = MetadataStorage.getEntity(this._entityClass);
    const valid = metadata?.relationships.some((r) => r.propertyName === prop);
    if (!valid) {
      throw new Error(
        `Invalid include '${prop}' for ${this._entityClass.name}. Define relationship '${prop}' via decorators or fix the name.`
      );
    }
    if (!this._includes.includes(prop)) this._includes.push(prop);
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
    return this.executeAndMaterialize(queryModel);
  }

  /** Returns the first entity or throws if none.
   * @example
   * const first = await context.books.orderBy(b => b.id).first();
   */
  public async first(): Promise<T> {
    if (this._abortSignal?.aborted) throw new Error('Operation aborted');
    const queryModel = this._model.clone();
    queryModel.limit = 1;
    this.applyGlobalFiltersToModel(queryModel);
    const entities = await this.executeAndMaterialize(queryModel);
    if (!entities.length) throw new Error('Sequence contains no elements');
    return entities[0];
  }
  /** Try-версия first без исключений. */
  public async tryFirst(): Promise<Result<T, Error>> {
    try {
      const value = await this.first();
      return ok(value);
    } catch (error: any) {
      return err(error);
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
    const entities = await this.executeAndMaterialize(queryModel);
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
  /** Try-версия single без исключений. */
  public async trySingle(): Promise<Result<T, Error>> {
    try {
      const value = await this.single();
      return ok(value);
    } catch (error: any) {
      return err(error);
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
      const ttl = this._performance.countCacheTtlMs ?? 0;
      const hit = Queryable._countCache.get(key);
      if (hit && (ttl <= 0 || Date.now() - hit.ts <= ttl)) {
        (this._provider as any).loggerRef?.cache?.({
          cache: 'count',
          hit: true,
          provider: (this._provider as any).providerLabel
        });
        return hit.value;
      }
      const value = await this.executeCountQuery(metadata.tableName);
      Queryable._countCache.set(key, { value, ts: Date.now() });
      (this._provider as any).loggerRef?.cache?.({
        cache: 'count',
        hit: false,
        provider: (this._provider as any).providerLabel
      });
      return value;
    }
    return this.executeCountQuery(metadata.tableName);
  }

  private buildCountCacheKey(table: string): string {
    const normalizedWhere = (this._model.where || []).map((clause) => ({
      c: (clause as any).condition,
      p: (clause as any).parameters
    }));
    return `${this._entityClass.name}|count|${table}|${JSON.stringify(normalizedWhere)}`;
  }

  private async executeCountQuery(table: string): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM ${table}`;
    let parameters: any[] = [];
    const queryModel = this._model.clone();
    this.applyGlobalFiltersToModel(queryModel);
    if (queryModel.where && queryModel.where.length > 0) {
      const whereClauses = queryModel.where.map((w) => (w as any).condition);
      query += ` WHERE ${whereClauses.join(' AND ')}`;
      for (const clause of queryModel.where) parameters.push(...(clause as any).parameters);
    }
    const results = await this._provider.executeQuery<{ count: number }>(query, parameters);
    return results[0]?.count ?? 0;
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
    const entities = await this.executeAndMaterialize(queryModel);
    return entities.length > 0;
  }

  // helpers copied from previous QueryBuilder for parsing
  /** Adds a SQL where clause if possible, else stores predicate for in-memory filtering. */
  private addWhereOrFallback(predicate: (entity: T) => boolean): void {
    const parser = new PredicateParser<T>();
    const ast = parser.parse(predicate);
    if (ast) {
      const visitor = new SqlVisitor();
      const { condition, parameters } = visitor.toSql(ast);
      const whereClause: WhereClause = {
        condition: condition as any,
        parameters: parameters as any
      } as any;
      this._model.where = this._model.where || [];
      this._model.where.push(whereClause);
    } else {
      this._fallbackPredicates.push(predicate);
    }
  }

  /** Applies all stored fallback predicates (runtime filters). */
  private applyFallbackPredicates(entities: T[]): T[] {
    if (this._fallbackPredicates.length === 0) return entities;
    let result = entities;
    for (const predicate of this._fallbackPredicates) {
      result = result.filter((entityItem) => {
        try {
          return predicate(entityItem);
        } catch {
          return false;
        }
      });
    }
    return result;
  }

  /** Executes provided model, maps rows to entities and applies fallback predicates. */
  private async executeAndMaterialize(model: QueryModel): Promise<T[]> {
    const sql = this._sqlBuilder.generateFromModel(this._entityClass, model);
    const rows = await this._provider.executeQuery<any>(sql.query, sql.parameters);
    let entities = rows.map((r) => this.mapRowToEntity(r));
    entities = this.applyFallbackPredicates(entities);
    if (this._entityLoader && this._includes.length > 0 && (model as any).limit !== 1) {
      await this._entityLoader.populateRelationshipsMany(entities, this._entityClass, {
        strategy: LoadingStrategy.Eager,
        includes: this._includes,
        depth: 1
      });
    }
    return entities;
  }

  /** Extracts include property name from a lambda selector. */
  private extractIncludeProperty(selector: (entity: T) => any): string {
    const selectorStr = selector.toString();
    const match = selectorStr.match(/=>\s*\w+\.(\w+)/);
    if (match && match[1]) return match[1];
    throw new Error(`Unable to parse include selector: ${selectorStr}`);
  }

  /**
   * Extract property names from a projection selector function string.
   * Supports single property, object destructuring, and simple object literal forms.
   */
  private extractPropertiesFromSelector(selectorStr: string): string[] {
    const singleMatch = selectorStr.match(/=>\s*\w+\.(\w+)/);
    if (singleMatch) return [singleMatch[1]];
    const objectMatch = selectorStr.match(/=>\s*\(\s*\{([^}]+)\}\s*\)/);
    if (objectMatch) {
      const props = objectMatch[1].split(',');
      return props.map((prop) => {
        const match = prop.match(/\w+:\s*\w+\.(\w+)/);
        return match ? match[1] : prop.trim();
      });
    }
    const simpleObjectMatch = selectorStr.match(/=>\s*\{([^}]+)\}/);
    if (simpleObjectMatch) {
      const props = simpleObjectMatch[1].split(',');
      return props.map((prop) => {
        const match = prop.match(/\w+:\s*\w+\.(\w+)/) || prop.match(/(\w+)/);
        return match ? match[1] : prop.trim();
      });
    }
    return ['*'];
  }

  /**
   * Extract a single property name from a key selector function string.
   * Throws if parsing fails.
   */
  private extractPropertyFromKeySelector(keySelectorStr: string): string {
    const match = keySelectorStr.match(/=>\s*\w+\.(\w+)/);
    if (match) return match[1];
    throw new Error(`Unable to parse key selector: ${keySelectorStr}`);
  }

  /**
   * Map a raw database row object to a new entity instance using metadata.
   * Falls back to shallow assign when no metadata is available.
   */
  private mapRowToEntity(row: any): T {
    const metadata = MetadataStorage.getEntity(this._entityClass);
    if (
      this._performance?.enableEntityCache &&
      this._entityCache &&
      metadata &&
      metadata.primaryKeys.length > 0
    ) {
      const pkProp = metadata.primaryKeys[0];
      const pkCol = metadata.columns.find((c) => c.propertyName === pkProp);
      const idValue = pkCol ? row[pkCol.columnName] : row[pkProp as any];
      const cached = this._entityCache.get<T>(this._entityClass, idValue);
      if (cached) {
        (this._provider as any).loggerRef?.cache?.({
          cache: 'entityL2',
          hit: true,
          provider: (this._provider as any).providerLabel
        });
        return cached;
      }
      const entity = new this._entityClass();
      for (const column of metadata.columns) {
        if (row.hasOwnProperty(column.columnName)) {
          (entity as any)[column.propertyName] = this.convertValue(
            row[column.columnName],
            column.type
          );
        }
      }
      this._entityCache.set(this._entityClass, idValue, entity);
      (this._provider as any).loggerRef?.cache?.({
        cache: 'entityL2',
        hit: false,
        provider: (this._provider as any).providerLabel
      });
      // notify middleware via provider hook
      try {
        (this._provider as any).notifyEntityMaterialized?.(entity, metadata);
      } catch {
        /* ignore */
      }
      return entity;
    }
    const entity = new this._entityClass();
    if (metadata) {
      for (const column of metadata.columns) {
        if (row.hasOwnProperty(column.columnName)) {
          (entity as any)[column.propertyName] = this.convertValue(
            row[column.columnName],
            column.type
          );
        }
      }
    } else {
      Object.assign(entity as any, row);
    }
    // notify middleware via provider hook
    try {
      if (metadata) (this._provider as any).notifyEntityMaterialized?.(entity, metadata);
    } catch {
      /* ignore */
    }
    return entity;
  }
  /**
   * Convert a primitive DB value to a runtime value according to column type.
   */
  private convertValue(value: any, type: string): any {
    if (value == null) return value;
    switch (type.toUpperCase()) {
      case 'BOOLEAN':
        return Boolean(value);
      case 'INTEGER':
      case 'NUMBER':
        return Number(value);
      case 'DATETIME':
      case 'DATE':
        return new Date(value);
      default:
        return value;
    }
  }

  /** Attach an AbortSignal to cancel execution before hitting the provider. */
  public withAbort(signal: AbortSignal): Queryable<T> {
    this._abortSignal = signal;
    return this;
  }

  /** Add a JOIN clause into the model using simple predicate parsing. */
  private addJoin<TOther>(
    type: 'INNER' | 'LEFT',
    otherCtor: new () => TOther,
    on: (left: T, right: TOther) => boolean,
    alias?: string
  ): void {
    const leftMeta = MetadataStorage.getEntity(this._entityClass);
    const rightMeta = MetadataStorage.getEntity(otherCtor);
    if (!leftMeta || !rightMeta) throw new Error('Entity metadata not found for join');
    const onStr = this.parseJoinPredicate(
      on.toString(),
      leftMeta.tableName,
      rightMeta.tableName,
      leftMeta,
      rightMeta
    );
    (this._model as any).joins = (this._model as any).joins || [];
    (this._model as any).joins.push({ type, table: rightMeta.tableName, on: onStr, alias });
  }

  /**
   * Parse a two-parameter predicate into a SQL ON expression.
   * Supports pattern: (a,b) => a.prop === b.prop
   */
  private parseJoinPredicate(
    onStr: string,
    leftTable: string,
    rightTable: string,
    leftMeta: any,
    rightMeta: any
  ): string {
    // Extract identifiers and props using simple regex
    // e.g., (a, b) => a.authorId === b.id
    const match = onStr.match(/\((\w+)\s*,\s*(\w+)\)\s*=>\s*\1\.(\w+)\s*===?\s*\2\.(\w+)/);
    if (!match) throw new Error(`Unable to parse join predicate: ${onStr}`);
    const leftProp = match[3];
    const rightProp = match[4];
    const leftCol =
      leftMeta.columns.find((c: any) => c.propertyName === leftProp)?.columnName || leftProp;
    const rightCol =
      rightMeta.columns.find((c: any) => c.propertyName === rightProp)?.columnName || rightProp;
    return `${leftTable}.${leftCol} = ${rightTable}.${rightCol}`;
  }

  /** Apply configured global filters to the provided query model. */
  private applyGlobalFiltersToModel(model: QueryModel & { where?: WhereClause[] }): void {
    const selfMeta = MetadataStorage.getEntity(this._entityClass);
    if (!selfMeta) return;
    model.where = model.where || [];
    // Soft-delete guard if enabled at provider level and entity has the column
    const softDeleteOptions = (this._provider as any).softDeleteOptions as
      | { enabled?: boolean; column?: string }
      | undefined;
    if (softDeleteOptions?.enabled) {
      const flagPropOrCol = softDeleteOptions.column ?? 'isDeleted';
      const col = selfMeta.columns.find(
        (c) => c.propertyName === flagPropOrCol || c.columnName === flagPropOrCol
      );
      if (col) {
        model.where.push({ condition: `${col.columnName} = 0`, parameters: [] } as any);
      }
    }
    // Explicit global filters
    if (this._globalFilters && this._globalFilters.length > 0) {
      for (const globalFilter of this._globalFilters) {
        const filterMeta = MetadataStorage.getEntity(globalFilter.entity as any);
        if (filterMeta && selfMeta.tableName === filterMeta.tableName) {
          model.where.push({
            condition: globalFilter.where.condition,
            parameters: [...globalFilter.where.parameters]
          } as any);
        }
      }
    }
  }
}
