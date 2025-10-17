"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Queryable = void 0;
const MetadataStorage_1 = require("../metadata/MetadataStorage");
const types_1 = require("../types");
const QueryBuilder_1 = require("./QueryBuilder");
const PredicateParser_1 = require("./PredicateParser");
const SqlVisitor_1 = require("./ast/SqlVisitor");
const QueryModel_1 = require("./QueryModel");
// LoadingStrategy not used directly here; keep imports minimal
const RowMaterializer_1 = require("./RowMaterializer");
const IncludePlanner_1 = require("./IncludePlanner");
const JoinPredicateParser_1 = require("./JoinPredicateParser");
const GlobalFilterApplier_1 = require("./GlobalFilterApplier");
const metrics_safe_1 = require("@ts-linq/metrics-safe");
const InternalLogger_1 = require("../utils/InternalLogger");
/**
 * Fluent query builder over a given entity type. Accumulates query intent
 * in a QueryModel and delegates SQL generation to QueryBuilder.
 */
class Queryable {
    /**
     * Create a new Queryable bound to an entity type and provider.
     * @param entityClass Entity constructor.
     * @param provider Database provider used for execution.
     * @param entityLoader Optional entity loader for eager includes.
     */
    constructor(entityClass, provider, entityLoader, entityCache, performance, globalFilters) {
        this._model = new QueryModel_1.QueryModel();
        this._fallbackPredicates = [];
        this._includes = [];
        this._globalFilterApplier = new GlobalFilterApplier_1.GlobalFilterApplier();
        this._fallbacks = [];
        // Lightweight signature of WHERE clauses for fast count() cache keys
        this._whereSignature = '[]';
        this._entityClass = entityClass;
        this._provider = provider;
        this._entityLoader = entityLoader;
        this._entityCache = entityCache;
        this._performance = performance;
        this._globalFilters = globalFilters;
        this._externalCountCache = performance?.countCache;
        this._sqlBuilder = new QueryBuilder_1.QueryBuilder(provider.getDialect(), provider.loggerRef, provider.providerLabel, performance?.sqlCache, performance?.cacheNamespace);
        this._materializer = new RowMaterializer_1.RowMaterializer(this._entityClass, this._provider, this._entityCache, this._performance);
        this._includePlanner = new IncludePlanner_1.IncludePlanner(this._entityLoader, this._entityClass);
        // Initialize fallback policy defaults
        if (!this._performance?.fallbackPolicy?.allowOps) {
            const defaults = {
                allowOps: ['select', 'count', 'first', 'single', 'any', 'aggregate']
            };
            this._performance = {
                ...this._performance,
                fallbackPolicy: { ...defaults, ...(this._performance?.fallbackPolicy || {}) }
            };
        }
    }
    /** Clear global count() cache (used on transaction rollback to avoid stale values). */
    static clearCountCache() {
        Queryable._countCache.clear();
        // We don't have a global logger here; size metric is emitted by callers when appropriate.
    }
    /** Create a shallow clone sharing provider/loader but copying model. */
    clone() {
        const clonedQueryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters);
        clonedQueryable._model = this._model.clone();
        // preserve where signature for accurate count cache keys
        clonedQueryable._whereSignature = this._whereSignature;
        // preserve includes, fallbacks and client-side predicates
        clonedQueryable._includes = [...this._includes];
        clonedQueryable._fallbacks = [...this._fallbacks];
        clonedQueryable._fallbackPredicates = [...this._fallbackPredicates];
        return clonedQueryable;
    }
    /**
     * Add INNER JOIN to the query.
     * @param otherCtor Joined entity constructor
     * @param on Predicate (a,b) => a.prop === b.prop
     * @param alias Optional alias for the joined table
     */
    innerJoin(otherCtor, on, alias) {
        this.addJoin('INNER', otherCtor, on, alias);
        return this;
    }
    /**
     * Add LEFT JOIN to the query.
     * @param otherCtor Joined entity constructor
     * @param on Predicate (a,b) => a.prop === b.prop
     * @param alias Optional alias for the joined table
     */
    leftJoin(otherCtor, on, alias) {
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
    where(predicate) {
        this.addWhereOrFallback(predicate);
        return this;
    }
    /**
     * Register a graceful-degradation fallback source to be used when the primary provider is unavailable.
     * Fallbacks are tried in the order they are registered until one succeeds.
     */
    fallbackTo(source) {
        this._fallbacks.push(source);
        return this;
    }
    /** Configure per-query fallback policy overrides. */
    withFallbackPolicy(policy) {
        const cloned = this.clone();
        const base = cloned._performance?.fallbackPolicy || {};
        cloned._performance = {
            ...cloned._performance,
            fallbackPolicy: { ...base, ...policy }
        };
        return cloned;
    }
    /** Add EXISTS (subquery) predicate. */
    whereExists(subquery) {
        const subqueryBuilder = subquery._sqlBuilder;
        const subqueryModel = subquery._model;
        const subqueryEntity = subquery._entityClass;
        const { query, parameters } = subqueryBuilder.generateFromModel(subqueryEntity, subqueryModel);
        this._model.where = this._model.where || [];
        const clause = { condition: `EXISTS (${query})`, parameters };
        this._model.where.push(clause);
        this._whereSignature += `|${clause.condition}:${JSON.stringify(clause.parameters)}`;
        return this;
    }
    /** Add IN (subquery) predicate for a column. */
    whereInSubquery(column, subquery) {
        const subqueryBuilder = subquery._sqlBuilder;
        const subqueryModel = subquery._model;
        const subqueryEntity = subquery._entityClass;
        const { query, parameters } = subqueryBuilder.generateFromModel(subqueryEntity, subqueryModel);
        this._model.where = this._model.where || [];
        const clause = { condition: `${column} IN (${query})`, parameters };
        this._model.where.push(clause);
        this._whereSignature += `|${clause.condition}:${JSON.stringify(clause.parameters)}`;
        return this;
    }
    /** With CTE support: define a named subquery and return a Queryable bound to that CTE. */
    withCte(name, subquery) {
        // Build subquery SQL once and stash into model via FROM override
        const { query } = subquery._sqlBuilder.generateFromModel(subquery._entityClass, subquery._model);
        const cloned = this.clone();
        // naive: store CTE name; real provider should prepend WITH clause at execution time
        cloned._model.from = name;
        // store CTE definition also in options-compatible form for dialects
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
    select(selector) {
        const next = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance);
        next._model = this._model.clone();
        const selectorStr = selector.toString();
        const properties = this.extractPropertiesFromSelector(selectorStr);
        next._model.select = properties;
        // propagate fallbacks so projections also degrade gracefully
        next._fallbacks = [
            ...(this._fallbacks || [])
        ];
        return next;
    }
    /**
     * Adds ASC ordering by key selector.
     * @param keySelector Sort key selector.
     *
     * @example
     * const ordered = await context.books.orderBy(b => b.title).toArray();
     */
    orderBy(keySelector) {
        const keySelectorStr = keySelector.toString();
        const column = this.extractPropertyFromKeySelector(keySelectorStr);
        const orderByClause = { column, direction: 'ASC' };
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
    orderByDescending(keySelector) {
        const keySelectorStr = keySelector.toString();
        const column = this.extractPropertyFromKeySelector(keySelectorStr);
        const orderByClause = { column, direction: 'DESC' };
        this._model.orderBy = this._model.orderBy || [];
        this._model.orderBy.push(orderByClause);
        return this;
    }
    /**
     * Adds secondary ASC ordering. Must be used after orderBy() or orderByDescending().
     * @param keySelector Sort key selector for secondary sort.
     *
     * @example
     * const sorted = await context.users.orderBy(u => u.lastName).thenBy(u => u.firstName).toArray();
     */
    thenBy(keySelector) {
        const keySelectorStr = keySelector.toString();
        const column = this.extractPropertyFromKeySelector(keySelectorStr);
        const orderByClause = { column, direction: 'ASC' };
        this._model.orderBy = this._model.orderBy || [];
        this._model.orderBy.push(orderByClause);
        return this;
    }
    /**
     * Adds secondary DESC ordering. Must be used after orderBy() or orderByDescending().
     * @param keySelector Sort key selector for secondary sort.
     *
     * @example
     * const sorted = await context.users.orderBy(u => u.lastName).thenByDescending(u => u.age).toArray();
     */
    thenByDescending(keySelector) {
        const keySelectorStr = keySelector.toString();
        const column = this.extractPropertyFromKeySelector(keySelectorStr);
        const orderByClause = { column, direction: 'DESC' };
        this._model.orderBy = this._model.orderBy || [];
        this._model.orderBy.push(orderByClause);
        return this;
    }
    /** Limits the number of returned rows.
     * @example
     * const top10 = await context.products.take(10).toArray();
     */
    take(count) {
        this._model.limit = count;
        return this;
    }
    /** Skips given number of rows.
     * @example
     * const page2 = await context.products.orderBy(p => p.id).skip(10).take(10).toArray();
     */
    skip(count) {
        this._model.offset = count;
        return this;
    }
    /** Ensures distinct rows.
     * @example
     * const titles = await context.books.select(b => b.title).distinct().toArray();
     */
    distinct() {
        this._model.distinct = true;
        return this;
    }
    /** UNION with another queryable of the same entity. */
    union(other) {
        this._model.unions = this._model.unions || [];
        this._model.unions.push({
            all: false,
            other: other._model.clone(),
            entity: other._entityClass
        });
        return this;
    }
    /** UNION ALL with another queryable of the same entity. */
    unionAll(other) {
        this._model.unions = this._model.unions || [];
        this._model.unions.push({
            all: true,
            other: other._model.clone(),
            entity: other._entityClass
        });
        return this;
    }
    /**
     * Group results by selected columns.
     * @example
     * const q = context.books.groupBy(b => b.authorId);
     */
    groupBy(selector) {
        const selectorStr = selector.toString();
        const columns = this.extractPropertiesFromSelector(selectorStr);
        this._model.groupBy = { columns };
        return this;
    }
    /**
     * Apply HAVING predicate to an existing groupBy.
     * @example
     * const q = context.books.groupBy(b => b.authorId).having(() => true);
     */
    having(predicate) {
        if (!this._model.groupBy) {
            throw new Error('having() requires a preceding groupBy()');
        }
        const parser = new PredicateParser_1.PredicateParser();
        const ast = parser.parse(predicate);
        if (ast) {
            const visitor = new SqlVisitor_1.SqlVisitor();
            const { condition, parameters } = visitor.toSql(ast);
            this._model.groupBy.having = { condition, parameters };
        }
        else {
            // Fallback to a tautology if cannot parse; predicates on aggregates are not parsed yet
            this._model.groupBy.having = { condition: '1=1', parameters: [] };
        }
        return this;
    }
    /**
     * Paginate by page number and size. Applies ORDER BY fallback if missing.
     * @example
     * const page1 = await context.books.orderBy(b => b.id).paginate(1, 20);
     */
    async paginate(page, size) {
        if (page < 1 || size < 1)
            throw new Error('paginate requires page >= 1 and size >= 1');
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
    async keysetPaginate(key, after, size) {
        if (size < 1)
            throw new Error('keysetPaginate requires size >= 1');
        const queryModel = this._model.clone();
        // Ensure order by key ASC (append if missing)
        queryModel.orderBy = queryModel.orderBy || [];
        const hasOrderByKey = queryModel.orderBy.some((o) => o.column === String(key));
        if (!hasOrderByKey)
            queryModel.orderBy.push({ column: String(key), direction: 'ASC' });
        queryModel.limit = size;
        if (after !== null && after !== undefined) {
            // Add where key > after
            const whereClause = {
                condition: `${String(key)} > ?`,
                parameters: [after]
            };
            queryModel.where = queryModel.where || [];
            queryModel.where.push(whereClause);
        }
        this.applyGlobalFiltersToModel(queryModel);
        const items = await this.executeAndMaterialize(queryModel);
        const last = items.length > 0 ? items[items.length - 1] : null;
        const nextAfter = last ? last[String(key)] : null;
        return { items, pageSize: size, nextAfter };
    }
    /**
     * Adds eager-loading of a relationship using a property selector.
     * Validates the relationship against entity metadata.
     *
     * @example
     * const authors = await context.authors.include(a => a.books).where(a => a.id === 1).toArray();
     */
    include(selector) {
        const prop = this.extractIncludeProperty(selector);
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(this._entityClass);
        const valid = metadata?.relationships.some((r) => r.propertyName === prop);
        if (!valid) {
            throw new Error(`Invalid include '${prop}' for ${this._entityClass.name}. Define relationship '${prop}' via decorators or fix the name.`);
        }
        if (!this._includes.includes(prop))
            this._includes.push(prop);
        return this;
    }
    /** Executes the query and returns materialized entities.
     * @example
     * const items = await context.products.where(p => p.stock > 0).toArray();
     */
    async toArray() {
        if (this._abortSignal?.aborted)
            throw new Error('Operation aborted');
        const queryModel = this._model.clone();
        this.applyGlobalFiltersToModel(queryModel);
        return this.executeAndMaterialize(queryModel);
    }
    /** Returns the first entity or throws if none.
     * @example
     * const first = await context.books.orderBy(b => b.id).first();
     */
    async first() {
        if (this._abortSignal?.aborted)
            throw new Error('Operation aborted');
        const queryModel = this._model.clone();
        queryModel.limit = 1;
        this.applyGlobalFiltersToModel(queryModel);
        const entities = await this.executeAndMaterialize(queryModel);
        if (!entities.length)
            throw new Error('Sequence contains no elements');
        return entities[0];
    }
    /** Try-version of first without throwing exceptions. */
    async tryFirst() {
        try {
            const value = await this.first();
            return (0, types_1.ok)(value);
        }
        catch (error) {
            return (0, types_1.err)(error);
        }
    }
    /** Returns the first entity or null.
     * @example
     * const maybe = await context.books.where(b => b.id > 10000).firstOrDefault();
     */
    async firstOrDefault() {
        if (this._abortSignal?.aborted)
            throw new Error('Operation aborted');
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
    async single() {
        const results = await this.toArray();
        if (results.length === 0)
            throw new Error('Sequence contains no elements');
        if (results.length > 1)
            throw new Error('Sequence contains more than one element');
        return results[0];
    }
    /** Try-version of single without throwing exceptions. */
    async trySingle() {
        try {
            const value = await this.single();
            return (0, types_1.ok)(value);
        }
        catch (error) {
            return (0, types_1.err)(error);
        }
    }
    /** Returns one or null; throws if more than 1.
     * @example
     * const maybe = await context.books.where(b => b.id === 9999).singleOrDefault();
     */
    async singleOrDefault() {
        const results = await this.toArray();
        if (results.length > 1)
            throw new Error('Sequence contains more than one element');
        return results[0] ?? null;
    }
    /** Returns the number of rows that match the current query.
     * @example
     * const count = await context.products.where(p => p.price >= 100).count();
     */
    async count() {
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(this._entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${this._entityClass.name}`);
        if (this._performance?.enableCountCache) {
            const key = this.buildCountCacheKey(metadata.tableName);
            const inflight = Queryable._inflightCounts.get(key);
            if (inflight)
                return inflight;
            const ttl = this._performance.countCacheTtlMs ?? 0;
            const hit = this._externalCountCache?.get(key) ?? Queryable._countCache.get(key);
            if (hit && (ttl <= 0 || Date.now() - hit.ts <= ttl)) {
                // LRU touch for internal cache
                if (!this._externalCountCache) {
                    Queryable._countCache.delete(key);
                    Queryable._countCache.set(key, hit);
                }
                (0, metrics_safe_1.safeCache)(this._provider.loggerRef, {
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
            const pending = this.executeCountQuery(metadata.tableName);
            Queryable._inflightCounts.set(key, pending);
            let value;
            try {
                value = await pending;
            }
            finally {
                Queryable._inflightCounts.delete(key);
            }
            const entry = { value, ts: Date.now() };
            if (this._externalCountCache)
                this._externalCountCache.set(key, entry);
            else {
                if (Queryable._countCache.size >= Queryable._COUNT_CACHE_MAX) {
                    const firstKey = Queryable._countCache.keys().next().value;
                    if (firstKey !== undefined) {
                        Queryable._countCache.delete(firstKey);
                        (0, metrics_safe_1.safeCacheEvicted)(this._provider.loggerRef, {
                            cache: 'count',
                            provider: this._provider.providerLabel
                        });
                    }
                }
                Queryable._countCache.set(key, entry);
            }
            (0, metrics_safe_1.safeCacheSize)(this._provider.loggerRef, {
                cache: 'count',
                size: this._externalCountCache ? -1 : Queryable._countCache.size,
                provider: this._provider.providerLabel
            });
            (0, metrics_safe_1.safeCache)(this._provider.loggerRef, {
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
        return this.executeCountQuery(metadata.tableName);
    }
    buildCountCacheKey(table) {
        const provider = this._provider?.providerLabel ? `${this._provider.providerLabel}|` : '';
        const ns = this._performance?.cacheNamespace ? `${this._performance.cacheNamespace}|` : '';
        return `${ns}${provider}${this._entityClass.name}|count|${table}|${this._whereSignature}`;
    }
    async executeCountQuery(table) {
        const queryModel = this._model.clone();
        this.applyGlobalFiltersToModel(queryModel);
        const { sql: query, params: parameters } = this.buildCountSqlAndParams(queryModel, table);
        // Hedged count race if enabled
        const hedge = this._performance?.fallbackPolicy?.hedged;
        if (hedge?.enabled && this._fallbacks.length > 0 && this.isOpAllowedForFallback('count')) {
            const hedged = await this.racePrimaryWithFallbackCount(query, parameters, queryModel);
            if (hedged !== null)
                return hedged;
        }
        try {
            const results = await this._provider.executeQuery(query, parameters);
            return results[0]?.count ?? 0;
        }
        catch (error) {
            if (!this.isDegradableError(error) || this._fallbacks.length === 0)
                throw error;
            if (!this.tryEnterFallbackThrottle())
                throw error;
            const n = await this.tryFallbackCountSequential(queryModel);
            if (n !== null)
                return n;
            throw error;
        }
    }
    /** Build COUNT SQL and params from a query model in a single pass. */
    buildCountSqlAndParams(queryModel, table) {
        const tableName = table;
        let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
        const params = [];
        if (queryModel.where && queryModel.where.length > 0) {
            let first = true;
            sql += ' WHERE ';
            for (const wc of queryModel.where) {
                if (!first)
                    sql += ' AND ';
                first = false;
                sql += wc.condition;
                for (let i = 0; i < wc.parameters.length; i++)
                    params.push(wc.parameters[i]);
            }
        }
        return { sql, params };
    }
    /** Sequential fallback for count(): server-count if available, else SELECT length. */
    async tryFallbackCountSequential(queryModel) {
        const normal = this._sqlBuilder.generateFromModel(this._entityClass, queryModel);
        const req = {
            entity: this._entityClass,
            sql: normal.query,
            params: normal.parameters
        };
        for (const fb of this._fallbacks) {
            try {
                this._provider.loggerRef?.fallback?.({
                    provider: this._provider.providerLabel,
                    fallback: fb.label,
                    attempted: true
                });
                if (typeof fb.fetchCount === 'function') {
                    const n = await fb.fetchCount(req);
                    if (typeof n === 'number')
                        return n;
                }
                const data = await fb.fetch(req);
                if (data && data.length >= 0)
                    return data.length;
            }
            catch (fbErr) {
                this._provider.loggerRef?.fallback?.({
                    provider: this._provider.providerLabel,
                    fallback: fb.label,
                    attempted: true,
                    succeeded: false,
                    error: fbErr
                });
                continue;
            }
        }
        return null;
    }
    /** Race primary COUNT with delayed fallback count (server-side if available). */
    async racePrimaryWithFallbackCount(countSql, params, queryModel) {
        const hedge = this._performance?.fallbackPolicy?.hedged;
        if (!hedge?.enabled)
            return null;
        const normal = this._sqlBuilder.generateFromModel(this._entityClass, queryModel);
        const req = {
            entity: this._entityClass,
            sql: normal.query,
            params: normal.parameters
        };
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const fallbacks = this.getHedgedFallbacks();
        const fallbackCountPromise = (async () => {
            await sleep(Math.max(0, hedge.delayMs ?? 15));
            for (const fb of fallbacks) {
                try {
                    if (typeof fb.fetchCount === 'function') {
                        const n = await fb.fetchCount(req);
                        if (typeof n === 'number')
                            return n;
                    }
                    const data = await fb.fetch(req);
                    if (data && data.length >= 0)
                        return data.length;
                }
                catch (e) {
                    (0, InternalLogger_1.logInternalError)('hedged.startFallback.fetch', e);
                    continue;
                }
            }
            return -1;
        })();
        try {
            const primaryPromise = this._provider
                .executeQuery(countSql, params)
                .then((rows) => rows[0]?.count ?? 0);
            const winner = await Promise.race([
                primaryPromise.then((n) => ({ k: 'p', n })),
                fallbackCountPromise.then((n) => ({ k: 'f', n }))
            ]);
            if (winner.k === 'p')
                return winner.n;
            if (typeof winner.n === 'number' && winner.n >= 0) {
                try {
                    this._provider.loggerRef?.hedgedWin?.({
                        provider: this._provider.providerLabel,
                        operation: 'count',
                        fallback: 'unknown'
                    });
                    this._provider.loggerRef?.fallback?.({
                        provider: this._provider.providerLabel,
                        fallback: 'unknown',
                        attempted: true,
                        succeeded: true
                    });
                }
                catch (e) {
                    (0, InternalLogger_1.logInternalError)('hedged.select.hedgedWin', e);
                }
                return winner.n;
            }
            return await primaryPromise;
        }
        catch {
            return null;
        }
    }
    /** Returns true if at least one row matches the query.
     * @example
     * const exists = await context.products.where(p => p.name === 'Laptop').any();
     */
    async any() {
        if (this._abortSignal?.aborted)
            throw new Error('Operation aborted');
        const queryModel = this._model.clone();
        queryModel.limit = 1;
        this.applyGlobalFiltersToModel(queryModel);
        const entities = await this.executeAndMaterialize(queryModel);
        return entities.length > 0;
    }
    // helpers copied from previous QueryBuilder for parsing
    /** Adds a SQL where clause if possible, else stores predicate for in-memory filtering. */
    addWhereOrFallback(predicate) {
        const cacheKey = predicate.toString();
        const cached = Queryable._predicateSqlCache.get(cacheKey);
        if (cached) {
            this._model.where = this._model.where || [];
            // clone parameters array to avoid accidental mutations across queries
            this._model.where.push({ condition: cached.condition, parameters: [...cached.parameters] });
            // update where signature on cache hit as well
            this._whereSignature += `|${cached.condition}:${JSON.stringify(cached.parameters)}`;
            return;
        }
        const parser = new PredicateParser_1.PredicateParser();
        const ast = parser.parse(predicate);
        if (!ast) {
            this._fallbackPredicates.push(predicate);
            return;
        }
        const visitor = new SqlVisitor_1.SqlVisitor();
        const { condition, parameters } = visitor.toSql(ast);
        const whereClause = {
            condition,
            parameters
        };
        this._model.where = this._model.where || [];
        this._model.where.push(whereClause);
        // update where signature for faster count cache keys
        this._whereSignature += `|${whereClause.condition}:${JSON.stringify(whereClause.parameters)}`;
        // cache with simple FIFO eviction
        if (Queryable._predicateSqlCache.size >= Queryable.PREDICATE_CACHE_MAX) {
            const firstKey = Queryable._predicateSqlCache.keys().next().value;
            if (firstKey !== undefined)
                Queryable._predicateSqlCache.delete(firstKey);
        }
        Queryable._predicateSqlCache.set(cacheKey, {
            condition: whereClause.condition,
            parameters: [...whereClause.parameters]
        });
    }
    /** Applies all stored fallback predicates (runtime filters). */
    applyFallbackPredicates(entities) {
        if (this._fallbackPredicates.length === 0)
            return entities;
        let result = entities;
        for (const predicate of this._fallbackPredicates) {
            result = result.filter((entityItem) => {
                try {
                    return predicate(entityItem);
                }
                catch {
                    return false;
                }
            });
        }
        return result;
    }
    /** Executes provided model, maps rows to entities and applies fallback predicates. */
    async executeAndMaterialize(model) {
        // propagate CTE to options via from field when present
        if (this._cte) {
            // monkey-attach for dialects that look into QueryOptions
            model.cte = this._cte;
        }
        const sql = this._sqlBuilder.generateFromModel(this._entityClass, model);
        // Hedged requests: optionally race fallback after a short delay
        const hedge = this._performance?.fallbackPolicy?.hedged;
        if (hedge?.enabled && this._fallbacks.length > 0 && this.isOpAllowedForFallback('select')) {
            const winner = await this.racePrimaryWithFallback(() => this._provider.executeQuery(sql.query, sql.parameters), sql, hedge.delayMs ?? 15, this.getHedgedFallbacks());
            if (winner.source === 'primary') {
                return await this.handlePrimaryRows(model, winner.rows);
            }
            else {
                return await this.handleFallbackEntities(winner.rows.slice(), winner.label || 'unknown', model);
            }
        }
        try {
            const rows = await this._provider.executeQuery(sql.query, sql.parameters);
            return await this.handlePrimaryRows(model, rows);
        }
        catch (error) {
            if (!this.isOpAllowedForFallback('select'))
                throw error;
            if (!this.isDegradableError(error) || this._fallbacks.length === 0)
                throw error;
            if (!this.tryEnterFallbackThrottle())
                throw error;
            const entities = await this.tryFallbackSelectSequential(sql, model);
            if (entities)
                return entities;
            // Exhausted fallbacks; rethrow original error
            throw error;
        }
    }
    /** Decide whether a caught error qualifies for graceful degradation. */
    isDegradableError(error) {
        if (!error)
            return false;
        const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
        return (message.includes('circuit') ||
            message.includes('timeout') ||
            message.includes('connection') ||
            message.includes('too many connections') ||
            message.includes('econnreset'));
    }
    isOpAllowedForFallback(op) {
        const allow = this._performance?.fallbackPolicy?.allowOps;
        return !allow || allow.includes(op);
    }
    async handlePrimaryRows(model, rows) {
        let entities = rows.map((row) => this._materializer.mapRowToEntity(row));
        entities = this.applyFallbackPredicates(entities);
        await this._includePlanner.populateIncludes(entities, this._includes, model.limit);
        return entities;
    }
    async handleFallbackEntities(entities, label, model) {
        entities = this.applyFallbackPredicates(entities);
        if (this._performance?.fallbackPolicy?.allowIncludesOnFallback === 'attempt') {
            try {
                await this._includePlanner.populateIncludes(entities, this._includes, model.limit);
            }
            catch { }
        }
        this._provider.loggerRef?.fallback?.({
            provider: this._provider.providerLabel,
            fallback: label,
            attempted: true,
            succeeded: true,
            isStale: true,
            asOf: Date.now(),
            source: label
        });
        return entities;
    }
    async tryFallbackSelectSequential(sql, model) {
        const req = {
            entity: this._entityClass,
            sql: sql.query,
            params: sql.parameters
        };
        for (const fb of this._fallbacks) {
            try {
                this._provider.loggerRef?.fallback?.({
                    provider: this._provider.providerLabel,
                    fallback: fb.label,
                    attempted: true
                });
                const data = await fb.fetch(req);
                if (data && data.length >= 0) {
                    return await this.handleFallbackEntities(data.slice(), fb.label, model);
                }
            }
            catch (fbErr) {
                this._provider.loggerRef?.fallback?.({
                    provider: this._provider.providerLabel,
                    fallback: fb.label,
                    attempted: true,
                    succeeded: false,
                    error: fbErr
                });
                continue;
            }
        }
        return null;
    }
    /** Race primary query with a delayed fallback request; returns the earlier result. */
    async racePrimaryWithFallback(primary, sql, delayMs, fallbacks) {
        let fallbackStarted = false;
        const req = {
            entity: this._entityClass,
            sql: sql.query,
            params: sql.parameters
        };
        const startFallback = async () => {
            fallbackStarted = true;
            for (const fb of fallbacks) {
                try {
                    const data = await fb.fetch(req);
                    if (data && data.length >= 0)
                        return { rows: data, label: fb.label };
                }
                catch {
                    continue;
                }
            }
            // no data
            return { rows: [], label: 'none' };
        };
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const fallbackPromise = (async () => {
            await sleep(Math.max(0, delayMs));
            return await startFallback();
        })();
        try {
            const primaryPromise = primary();
            const winner = await Promise.race([
                primaryPromise.then((rows) => ({ k: 'p', rows })),
                fallbackPromise.then((v) => ({ k: 'f', rows: v.rows, label: v.label }))
            ]);
            if (winner.k === 'p') {
                return { source: 'primary', rows: winner.rows };
            }
            else {
                // record hedged win
                try {
                    this._provider.loggerRef?.hedgedWin?.({
                        provider: this._provider.providerLabel,
                        operation: 'select',
                        fallback: winner.label || 'unknown'
                    });
                }
                catch (e) {
                    (0, InternalLogger_1.logInternalError)('hedged.select.hedgedWin', e);
                }
                this._provider.loggerRef?.fallback?.({
                    provider: this._provider.providerLabel,
                    fallback: winner.label || 'unknown',
                    attempted: true,
                    succeeded: true
                });
                return { source: 'fallback', rows: winner.rows, label: winner.label || 'unknown' };
            }
        }
        catch {
            // If primary failed early and fallback not started yet, await fallback fully
            if (!fallbackStarted) {
                const v = await startFallback();
                return { source: 'fallback', rows: v.rows, label: v.label };
            }
            throw new Error('hedged failed');
        }
    }
    /** Select hedged fallbacks based on policy-specified source labels. */
    getHedgedFallbacks() {
        const src = this._performance?.fallbackPolicy?.hedged?.sources;
        if (!src || src.length === 0)
            return this._fallbacks;
        const wanted = new Set(src);
        return this._fallbacks.filter((fb) => wanted.has(fb.label));
    }
    /** Try to pass fallback throttle constraints; returns false when fallback should be skipped. */
    tryEnterFallbackThrottle() {
        const throttle = this._performance?.fallbackPolicy?.throttle;
        if (!throttle)
            return true;
        const now = Date.now();
        // minInterval guard
        const minInterval = Math.max(0, throttle.minIntervalMs ?? 0);
        const jitter = Math.max(0, Math.min(1, throttle.jitterRatio ?? 0));
        const effectiveInterval = minInterval > 0 && jitter > 0
            ? Math.floor(minInterval * (1 + Math.random() * jitter))
            : minInterval;
        if (minInterval > 0) {
            const since = now - Queryable._fallbackLastAttemptAt;
            if (since < effectiveInterval) {
                // emit throttled metric if available
                this._provider.loggerRef?.fallback?.({
                    provider: this._provider.providerLabel,
                    fallback: 'n/a',
                    attempted: false,
                    throttled: true
                });
                return false;
            }
        }
        // window counter guard (60s)
        const maxPerMinute = Math.max(0, throttle.maxPerMinute ?? 0);
        if (maxPerMinute > 0) {
            const windowMs = 60000;
            if (now - Queryable._fallbackWindowStart >= windowMs) {
                Queryable._fallbackWindowStart = now;
                Queryable._fallbackUsedInWindow = 0;
            }
            if (Queryable._fallbackUsedInWindow >= maxPerMinute)
                return false;
            Queryable._fallbackUsedInWindow += 1;
        }
        Queryable._fallbackLastAttemptAt = now;
        return true;
    }
    /** Extracts include property name from a lambda selector. */
    extractIncludeProperty(selector) {
        const selectorStr = selector.toString();
        const cached = Queryable._includePropCache.get(selectorStr);
        if (cached)
            return cached;
        const match = selectorStr.match(Queryable.REGEX_SINGLE_PROP);
        if (match && match[1]) {
            Queryable._includePropCache.set(selectorStr, match[1]);
            return match[1];
        }
        throw new Error(`Unable to parse include selector: ${selectorStr}`);
    }
    /**
     * Extract property names from a projection selector function string.
     * Supports single property, object destructuring, and simple object literal forms.
     */
    extractPropertiesFromSelector(selectorStr) {
        const cached = Queryable._selectorPropsCache.get(selectorStr);
        if (cached)
            return [...cached];
        const singleMatch = selectorStr.match(Queryable.REGEX_SINGLE_PROP);
        if (singleMatch)
            return [singleMatch[1]];
        const objectMatch = selectorStr.match(Queryable.REGEX_OBJECT);
        if (objectMatch) {
            const props = objectMatch[1].split(',');
            const result = props.map((prop) => {
                const match = prop.match(Queryable.REGEX_PROP_IN_OBJECT);
                return match ? match[1] : prop.trim();
            });
            Queryable._selectorPropsCache.set(selectorStr, [...result]);
            return result;
        }
        const simpleObjectMatch = selectorStr.match(Queryable.REGEX_SIMPLE_OBJECT);
        if (simpleObjectMatch) {
            const props = simpleObjectMatch[1].split(',');
            const result = props.map((prop) => {
                const match = prop.match(Queryable.REGEX_PROP_IN_OBJECT) || prop.match(Queryable.REGEX_ANY_PROP);
                return match ? match[1] : prop.trim();
            });
            Queryable._selectorPropsCache.set(selectorStr, [...result]);
            return result;
        }
        return ['*'];
    }
    /**
     * Extract a single property name from a key selector function string.
     * Throws if parsing fails.
     */
    extractPropertyFromKeySelector(keySelectorStr) {
        const cached = Queryable._keySelectorCache.get(keySelectorStr);
        if (cached)
            return cached;
        const match = keySelectorStr.match(Queryable.REGEX_SINGLE_PROP);
        if (match) {
            Queryable._keySelectorCache.set(keySelectorStr, match[1]);
            return match[1];
        }
        throw new Error(`Unable to parse key selector: ${keySelectorStr}`);
    }
    /**
     * Map a raw database row object to a new entity instance using metadata.
     * Falls back to shallow assign when no metadata is available.
     */
    mapRowToEntity(row) {
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(this._entityClass);
        if (this.shouldUseL2Cache(metadata)) {
            const cached = this.tryGetFromCache(row, metadata);
            if (cached)
                return cached;
            const entity = this.materializeEntity(row, metadata);
            this.rememberInCache(row, metadata, entity);
            this.notifyMaterialized(entity, metadata);
            return entity;
        }
        const entity = this.materializeEntity(row, metadata || null);
        this.notifyMaterialized(entity, metadata);
        return entity;
    }
    shouldUseL2Cache(metadata) {
        return (!!this._performance?.enableEntityCache &&
            !!this._entityCache &&
            !!metadata &&
            metadata.primaryKeys.length > 0);
    }
    tryGetFromCache(row, metadata) {
        const pkProp = metadata.primaryKeys[0];
        const pkCol = metadata.columns.find((c) => c.propertyName === pkProp);
        const idValue = pkCol
            ? row[pkCol.columnName]
            : row[pkProp];
        const cached = this._entityCache.get(this._entityClass, idValue);
        if (!cached) {
            this._provider.loggerRef?.cache?.({
                cache: 'entityL2',
                hit: false,
                provider: this._provider.providerLabel
            });
            return null;
        }
        this._provider.loggerRef?.cache?.({
            cache: 'entityL2',
            hit: true,
            provider: this._provider.providerLabel
        });
        return cached;
    }
    materializeEntity(row, metadata) {
        const entity = new this._entityClass();
        if (metadata) {
            for (const column of metadata.columns) {
                const r = row;
                const val = r.hasOwnProperty(column.columnName)
                    ? r[column.columnName]
                    : r[column.propertyName];
                if (val !== undefined) {
                    entity[column.propertyName] = this.convertValue(val, column.type);
                }
            }
        }
        else {
            Object.assign(entity, row);
        }
        return entity;
    }
    rememberInCache(row, metadata, entity) {
        const pkProp = metadata.primaryKeys[0];
        const pkCol = metadata.columns.find((c) => c.propertyName === pkProp);
        const idValue = pkCol
            ? row[pkCol.columnName]
            : row[pkProp];
        this._entityCache.set(this._entityClass, idValue, entity);
        this._provider.loggerRef?.cache?.({
            cache: 'entityL2',
            hit: false,
            provider: this._provider.providerLabel
        });
        try {
            this._provider.loggerRef?.cacheSize?.({
                cache: 'entityL2',
                size: this._entityCache.size?.() ?? -1,
                provider: this._provider.providerLabel
            });
        }
        catch {
            // ignore debug metric errors
        }
    }
    notifyMaterialized(entity, metadata) {
        try {
            if (metadata)
                this._provider.notifyEntityMaterialized?.(entity, metadata);
        }
        catch {
            // ignore debug metric errors
        }
    }
    /**
     * Convert a primitive DB value to a runtime value according to column type.
     */
    convertValue(value, type) {
        if (value == null)
            return value;
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
    withAbort(signal) {
        this._abortSignal = signal;
        return this;
    }
    // Additional Entity Framework-style LINQ methods
    /** Check if all elements satisfy a condition (EF-style) */
    async all(predicate) {
        if (this._abortSignal?.aborted)
            throw new Error('Operation aborted');
        // For efficiency, we'll check if any element does NOT satisfy the condition
        // If none exist that violate it, then all satisfy it
        const violatingElement = await this.where((entity) => !predicate(entity)).firstOrDefault();
        return violatingElement === null;
    }
    /** Calculate average of a numeric property (EF-style) */
    async average(selector) {
        if (this._abortSignal?.aborted)
            throw new Error('Operation aborted');
        const entities = await this.toArray();
        if (entities.length === 0)
            throw new Error('Sequence contains no elements');
        const values = entities.map((e) => {
            const value = selector(e);
            return typeof value === 'number' ? value : Number(value) || 0;
        });
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    /** Calculate sum of a numeric property (EF-style) */
    async sum(selector) {
        if (this._abortSignal?.aborted)
            throw new Error('Operation aborted');
        const entities = await this.toArray();
        const values = entities.map((e) => {
            const value = selector(e);
            return typeof value === 'number' ? value : Number(value) || 0;
        });
        return values.reduce((sum, val) => sum + val, 0);
    }
    /** Find minimum value of a property (EF-style) */
    async min(selector) {
        if (this._abortSignal?.aborted)
            throw new Error('Operation aborted');
        const entities = await this.toArray();
        if (entities.length === 0)
            throw new Error('Sequence contains no elements');
        let minValue = selector(entities[0]);
        for (let i = 1; i < entities.length; i++) {
            const value = selector(entities[i]);
            if (value < minValue)
                minValue = value;
        }
        return minValue;
    }
    /** Find maximum value of a property (EF-style) */
    async max(selector) {
        if (this._abortSignal?.aborted)
            throw new Error('Operation aborted');
        const entities = await this.toArray();
        if (entities.length === 0)
            throw new Error('Sequence contains no elements');
        let maxValue = selector(entities[0]);
        for (let i = 1; i < entities.length; i++) {
            const value = selector(entities[i]);
            if (value > maxValue)
                maxValue = value;
        }
        return maxValue;
    }
    /** Check if the sequence contains a specific element (EF-style) */
    async contains(item) {
        if (this._abortSignal?.aborted)
            throw new Error('Operation aborted');
        // For entities, use primary key comparison if available
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(this._entityClass);
        if (metadata && metadata.primaryKeys.length > 0) {
            const pk = metadata.primaryKeys[0];
            const itemId = item[pk];
            if (itemId !== undefined && itemId !== null) {
                // Use primary key based comparison for efficiency
                const entities = await this.toArray();
                return entities.some((entity) => entity[pk] === itemId);
            }
        }
        // Fallback to deep equality comparison using JSON serialization
        const entities = await this.toArray();
        const itemJson = JSON.stringify(item);
        return entities.some((entity) => JSON.stringify(entity) === itemJson);
    }
    /** Get elements that are in this sequence but not in the other (EF-style) */
    except(other) {
        // Implement using client-side filtering since SQL EXCEPT support varies by provider
        const cloned = this.clone();
        // Add a custom filter to exclude elements that exist in the other sequence
        const boundOriginal = cloned.toArray.bind(cloned);
        cloned.toArray = async function () {
            const thisResults = await boundOriginal();
            const otherResults = await other.toArray();
            // Create a Set for O(1) lookup performance
            const otherSet = new Set(otherResults.map((item) => JSON.stringify(item)));
            return thisResults.filter((item) => !otherSet.has(JSON.stringify(item)));
        }.bind(cloned);
        return cloned;
    }
    /** Get elements that are in both sequences (EF-style) */
    intersect(other) {
        // Implement using client-side filtering since SQL INTERSECT support varies by provider
        const cloned = this.clone();
        // Add a custom filter to include only elements that exist in both sequences
        const boundOriginal2 = cloned.toArray.bind(cloned);
        cloned.toArray = async function () {
            const thisResults = await boundOriginal2();
            const otherResults = await other.toArray();
            // Create a Set for O(1) lookup performance
            const otherSet = new Set(otherResults.map((item) => JSON.stringify(item)));
            return thisResults.filter((item) => otherSet.has(JSON.stringify(item)));
        }.bind(cloned);
        return cloned;
    }
    /** Concatenate with another sequence (EF-style) */
    concat(other) {
        // Implement proper concatenation by combining results in order
        const cloned = this.clone();
        // Override toArray to concatenate results while maintaining order
        const boundOriginal3 = cloned.toArray.bind(cloned);
        cloned.toArray = async function () {
            const thisResults = await boundOriginal3();
            const otherResults = await other.toArray();
            // Concatenate maintaining order: this sequence first, then other
            return [...thisResults, ...otherResults];
        }.bind(cloned);
        return cloned;
    }
    /** Add a JOIN clause into the model using simple predicate parsing. */
    addJoin(type, otherCtor, on, alias) {
        const leftMeta = MetadataStorage_1.MetadataStorage.getEntity(this._entityClass);
        const rightMeta = MetadataStorage_1.MetadataStorage.getEntity(otherCtor);
        if (!leftMeta || !rightMeta)
            throw new Error('Entity metadata not found for join');
        const onStr = this.parseJoinPredicate(on.toString(), leftMeta.tableName, rightMeta.tableName, leftMeta, rightMeta);
        this._model.joins = this._model.joins || [];
        this._model.joins.push({
            type: type,
            table: rightMeta.tableName,
            on: onStr,
            alias
        });
    }
    /**
     * Parse a two-parameter predicate into a SQL ON expression.
     * Supports pattern: (a,b) => a.prop === b.prop
     */
    parseJoinPredicate(onStr, leftTable, rightTable, leftMeta, rightMeta) {
        return JoinPredicateParser_1.JoinPredicateParser.parse(onStr, leftTable, rightTable, leftMeta, rightMeta);
    }
    /** Apply configured global filters to the provided query model. */
    applyGlobalFiltersToModel(model) {
        this._globalFilterApplier.apply(this._entityClass, model, this._provider.softDeleteOptions, this._globalFilters);
    }
}
exports.Queryable = Queryable;
Queryable._countCache = new Map();
Queryable._COUNT_CACHE_MAX = 2000;
// Single-flight deduplication for concurrent count() calls
Queryable._inflightCounts = new Map();
// Predicates and parsing optimizations
Queryable.REGEX_SINGLE_PROP = /=>\s*\w+\.(\w+)/;
Queryable.REGEX_OBJECT = /=>\s*\(\s*\{([^}]+)\}\s*\)/;
Queryable.REGEX_SIMPLE_OBJECT = /=>\s*\{([^}]+)\}/;
Queryable.REGEX_PROP_IN_OBJECT = /\w+:\s*\w+\.(\w+)/;
Queryable.REGEX_ANY_PROP = /(\w+)/;
Queryable.PREDICATE_CACHE_MAX = 1000;
Queryable._predicateSqlCache = new Map();
Queryable.SELECTOR_CACHE_MAX = 1000;
Queryable._selectorPropsCache = new Map();
Queryable._keySelectorCache = new Map();
Queryable._includePropCache = new Map();
// Global fallback throttle state (per-process)
Queryable._fallbackWindowStart = 0;
Queryable._fallbackUsedInWindow = 0;
Queryable._fallbackLastAttemptAt = 0;
//# sourceMappingURL=Queryable.js.map