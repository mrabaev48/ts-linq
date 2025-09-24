import { MetadataStorage } from '../metadata/MetadataStorage';
import { ok, err } from '../types';
import { QueryBuilder } from './QueryBuilder';
import { PredicateParser } from './PredicateParser';
import { SqlVisitor } from './ast/SqlVisitor';
import { QueryModel } from './QueryModel';
import { LoadingStrategy } from '../loading/LoadingStrategy';
import { JoinPredicateParser } from './JoinPredicateParser';
import { GlobalFilterApplier } from './GlobalFilterApplier';
import { safeCache, safeCacheEvicted, safeCacheSize } from '../utils/MetricsSafe';
/**
 * Fluent query builder over a given entity type. Accumulates query intent
 * in a QueryModel and delegates SQL generation to QueryBuilder.
 */
export class Queryable {
    /**
     * Create a new Queryable bound to an entity type and provider.
     * @param entityClass Entity constructor.
     * @param provider Database provider used for execution.
     * @param entityLoader Optional entity loader for eager includes.
     */
    constructor(entityClass, provider, entityLoader, entityCache, performance, globalFilters) {
        this._model = new QueryModel();
        this._fallbackPredicates = [];
        this._includes = [];
        this._globalFilterApplier = new GlobalFilterApplier();
        // Lightweight signature of WHERE clauses for fast count() cache keys
        this._whereSignature = '[]';
        this._entityClass = entityClass;
        this._provider = provider;
        this._entityLoader = entityLoader;
        this._entityCache = entityCache;
        this._performance = performance;
        this._globalFilters = globalFilters;
        this._externalCountCache = performance?.countCache;
        this._sqlBuilder = new QueryBuilder(provider.getDialect(), provider.loggerRef, provider.providerLabel, performance?.sqlCache);
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
        const parser = new PredicateParser();
        const ast = parser.parse(predicate);
        if (ast) {
            const visitor = new SqlVisitor();
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
        const metadata = MetadataStorage.getEntity(this._entityClass);
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
            return ok(value);
        }
        catch (error) {
            return err(error);
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
            return ok(value);
        }
        catch (error) {
            return err(error);
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
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${this._entityClass.name}`);
        if (this._performance?.enableCountCache) {
            const key = this.buildCountCacheKey(metadata.tableName);
            const ttl = this._performance.countCacheTtlMs ?? 0;
            const hit = this._externalCountCache?.get(key) ?? Queryable._countCache.get(key);
            if (hit && (ttl <= 0 || Date.now() - hit.ts <= ttl)) {
                // LRU touch for internal cache
                if (!this._externalCountCache) {
                    Queryable._countCache.delete(key);
                    Queryable._countCache.set(key, hit);
                }
                safeCache(this._provider.loggerRef, {
                    cache: 'count',
                    hit: true,
                    provider: this._provider.providerLabel,
                    ttl: ttl > 0
                });
                return hit.value;
            }
            const value = await this.executeCountQuery(metadata.tableName);
            const entry = { value, ts: Date.now() };
            if (this._externalCountCache)
                this._externalCountCache.set(key, entry);
            else {
                if (Queryable._countCache.size >= Queryable._COUNT_CACHE_MAX) {
                    const firstKey = Queryable._countCache.keys().next().value;
                    if (firstKey !== undefined) {
                        Queryable._countCache.delete(firstKey);
                        safeCacheEvicted(this._provider.loggerRef, {
                            cache: 'count',
                            provider: this._provider.providerLabel
                        });
                    }
                }
                Queryable._countCache.set(key, entry);
            }
            safeCacheSize(this._provider.loggerRef, {
                cache: 'count',
                size: this._externalCountCache ? -1 : Queryable._countCache.size,
                provider: this._provider.providerLabel
            });
            safeCache(this._provider.loggerRef, {
                cache: 'count',
                hit: false,
                provider: this._provider.providerLabel
            });
            return value;
        }
        return this.executeCountQuery(metadata.tableName);
    }
    buildCountCacheKey(table) {
        return `${this._entityClass.name}|count|${table}|${this._whereSignature}`;
    }
    async executeCountQuery(table) {
        let query = `SELECT COUNT(*) as count FROM ${table}`;
        const parameters = [];
        const queryModel = this._model.clone();
        this.applyGlobalFiltersToModel(queryModel);
        if (queryModel.where && queryModel.where.length > 0) {
            // Build WHERE and parameters in a single pass to reduce allocations
            let isFirstCondition = true;
            query += ' WHERE ';
            for (const whereClause of queryModel.where) {
                if (!isFirstCondition)
                    query += ' AND ';
                isFirstCondition = false;
                query += whereClause.condition;
                const clauseParams = whereClause.parameters;
                for (let paramIndex = 0; paramIndex < clauseParams.length; paramIndex++)
                    parameters.push(clauseParams[paramIndex]);
            }
        }
        const results = await this._provider.executeQuery(query, parameters);
        return results[0]?.count ?? 0;
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
        const parser = new PredicateParser();
        const ast = parser.parse(predicate);
        if (!ast) {
            this._fallbackPredicates.push(predicate);
            return;
        }
        const visitor = new SqlVisitor();
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
        const rows = await this._provider.executeQuery(sql.query, sql.parameters);
        let entities = rows.map((row) => this.mapRowToEntity(row));
        entities = this.applyFallbackPredicates(entities);
        if (this._entityLoader && this._includes.length > 0 && model.limit !== 1) {
            await this._entityLoader.populateRelationshipsMany(entities, this._entityClass, {
                strategy: LoadingStrategy.Eager,
                includes: this._includes,
                depth: 1
            });
        }
        return entities;
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
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (this._performance?.enableEntityCache &&
            this._entityCache &&
            metadata &&
            metadata.primaryKeys.length > 0) {
            const pkProp = metadata.primaryKeys[0];
            const pkCol = metadata.columns.find((c) => c.propertyName === pkProp);
            const idValue = pkCol
                ? row[pkCol.columnName]
                : row[pkProp];
            const cached = this._entityCache.get(this._entityClass, idValue);
            if (cached) {
                this._provider.loggerRef?.cache?.({
                    cache: 'entityL2',
                    hit: true,
                    provider: this._provider.providerLabel
                });
                return cached;
            }
            const entity = new this._entityClass();
            for (const column of metadata.columns) {
                if (row.hasOwnProperty(column.columnName)) {
                    entity[column.propertyName] = this.convertValue(row[column.columnName], column.type);
                }
            }
            this._entityCache.set(this._entityClass, idValue, entity);
            this._provider.loggerRef?.cache?.({
                cache: 'entityL2',
                hit: false,
                provider: this._provider.providerLabel
            });
            // optional size metric via duck-typed logger method if present
            try {
                this._provider.loggerRef?.cacheSize?.({
                    cache: 'entityL2',
                    size: this._entityCache.size?.() ?? -1,
                    provider: this._provider.providerLabel
                });
            }
            catch (e) {
                try {
                    const { warnIfLoggerDebug } = require('../utils/MetricsSafe');
                    warnIfLoggerDebug('notify:entityMaterialized', e);
                }
                catch {
                    /* ignore */
                }
            }
            // notify middleware via provider hook
            try {
                this._provider.notifyEntityMaterialized?.(entity, metadata);
            }
            catch (e) {
                try {
                    const { warnIfLoggerDebug } = require('../utils/MetricsSafe');
                    warnIfLoggerDebug('notify:entityMaterialized', e);
                }
                catch {
                    /* ignore */
                }
            }
            return entity;
        }
        const entity = new this._entityClass();
        if (metadata) {
            for (const column of metadata.columns) {
                if (row.hasOwnProperty(column.columnName)) {
                    entity[column.propertyName] = this.convertValue(row[column.columnName], column.type);
                }
            }
        }
        else {
            Object.assign(entity, row);
        }
        // notify middleware via provider hook
        try {
            if (metadata)
                this._provider.notifyEntityMaterialized?.(entity, metadata);
        }
        catch (e) {
            try {
                const { warnIfLoggerDebug } = require('../utils/MetricsSafe');
                warnIfLoggerDebug('notify:entityMaterialized', e);
            }
            catch {
                /* ignore */
            }
        }
        return entity;
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
        const violatingElement = await this.where(entity => !predicate(entity)).firstOrDefault();
        return violatingElement === null;
    }
    /** Calculate average of a numeric property (EF-style) */
    async average(selector) {
        if (this._abortSignal?.aborted)
            throw new Error('Operation aborted');
        const entities = await this.toArray();
        if (entities.length === 0)
            throw new Error('Sequence contains no elements');
        const values = entities.map(e => {
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
        const values = entities.map(e => {
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
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (metadata && metadata.primaryKeys.length > 0) {
            const pk = metadata.primaryKeys[0];
            const itemId = item[pk];
            if (itemId !== undefined && itemId !== null) {
                // Use primary key based comparison for efficiency
                const entities = await this.toArray();
                return entities.some(entity => entity[pk] === itemId);
            }
        }
        // Fallback to deep equality comparison using JSON serialization
        const entities = await this.toArray();
        const itemJson = JSON.stringify(item);
        return entities.some(entity => JSON.stringify(entity) === itemJson);
    }
    /** Get elements that are in this sequence but not in the other (EF-style) */
    except(other) {
        // Implement using client-side filtering since SQL EXCEPT support varies by provider
        const cloned = this.clone();
        // Add a custom filter to exclude elements that exist in the other sequence
        const originalToArray = cloned.toArray;
        cloned.toArray = async function () {
            const thisResults = await originalToArray.call(this);
            const otherResults = await other.toArray();
            // Create a Set for O(1) lookup performance
            const otherSet = new Set(otherResults.map(item => JSON.stringify(item)));
            return thisResults.filter(item => !otherSet.has(JSON.stringify(item)));
        }.bind(cloned);
        return cloned;
    }
    /** Get elements that are in both sequences (EF-style) */
    intersect(other) {
        // Implement using client-side filtering since SQL INTERSECT support varies by provider
        const cloned = this.clone();
        // Add a custom filter to include only elements that exist in both sequences
        const originalToArray = cloned.toArray;
        cloned.toArray = async function () {
            const thisResults = await originalToArray.call(this);
            const otherResults = await other.toArray();
            // Create a Set for O(1) lookup performance
            const otherSet = new Set(otherResults.map(item => JSON.stringify(item)));
            return thisResults.filter(item => otherSet.has(JSON.stringify(item)));
        }.bind(cloned);
        return cloned;
    }
    /** Concatenate with another sequence (EF-style) */
    concat(other) {
        // Implement proper concatenation by combining results in order
        const cloned = this.clone();
        // Override toArray to concatenate results while maintaining order
        const originalToArray = cloned.toArray;
        cloned.toArray = async function () {
            const thisResults = await originalToArray.call(this);
            const otherResults = await other.toArray();
            // Concatenate maintaining order: this sequence first, then other
            return [...thisResults, ...otherResults];
        }.bind(cloned);
        return cloned;
    }
    /** Add a JOIN clause into the model using simple predicate parsing. */
    addJoin(type, otherCtor, on, alias) {
        const leftMeta = MetadataStorage.getEntity(this._entityClass);
        const rightMeta = MetadataStorage.getEntity(otherCtor);
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
        return JoinPredicateParser.parse(onStr, leftTable, rightTable, leftMeta, rightMeta);
    }
    /** Apply configured global filters to the provided query model. */
    applyGlobalFiltersToModel(model) {
        this._globalFilterApplier.apply(this._entityClass, model, this._provider.softDeleteOptions, this._globalFilters);
    }
}
Queryable._countCache = new Map();
Queryable._COUNT_CACHE_MAX = 2000;
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
//# sourceMappingURL=Queryable.js.map