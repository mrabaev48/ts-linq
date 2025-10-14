import { Queryable } from '../query/Queryable';
import { TypedQueryable } from '../query/TypedQueryable';
import { MetadataStorage } from '../metadata/MetadataStorage';
/**
 * Represents a typed set of entities and provides CRUD and LINQ-like operations
 * for a specific entity type.
 */
export class DbSet {
    constructor(entityClass, provider, changeTracker, entityLoader, entityCache, performance, globalFilters) {
        this._entityClass = entityClass;
        this._provider = provider;
        this._changeTracker = changeTracker;
        this._entityLoader = entityLoader;
        this._entityCache = entityCache;
        this._performance = performance;
        this._globalFilters = globalFilters;
    }
    /** Add an entity to be inserted */
    add(entity) {
        this._changeTracker.add(entity, this._entityClass);
        return entity;
    }
    /** Update an entity */
    update(entity) {
        this._changeTracker.update(entity, this._entityClass);
        return entity;
    }
    /** Remove an entity */
    remove(entity) {
        this._changeTracker.remove(entity, this._entityClass);
        return entity;
    }
    /** Add multiple entities at once to ChangeTracker. */
    addRange(entities) {
        for (const entity of entities)
            this._changeTracker.add(entity, this._entityClass);
        return entities;
    }
    /** Update multiple entities at once to ChangeTracker. */
    updateRange(entities) {
        for (const entity of entities)
            this._changeTracker.update(entity, this._entityClass);
        return entities;
    }
    /** Remove multiple entities at once to ChangeTracker. */
    removeRange(entities) {
        for (const entity of entities)
            this._changeTracker.remove(entity, this._entityClass);
        return entities;
    }
    /** Find an entity by its primary key (convention: property named `id`) */
    async find(id, options) {
        if (this._entityLoader && options) {
            return await this._entityLoader.loadEntity(this._entityClass, id, options);
        }
        // Route via Queryable to leverage L2 cache and global filters
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (!metadata || metadata.primaryKeys.length === 0) {
            return await this._provider.findById(id, this._entityClass);
        }
        const pk = metadata.primaryKeys[0];
        return await new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters)
            .where((e) => e[pk] === id)
            .firstOrDefault();
    }
    /** Get all entities */
    async toArray(options) {
        if (this._entityLoader && options) {
            return await this._entityLoader.loadEntities(this._entityClass, options);
        }
        return await new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).toArray();
    }
    /** Fetch multiple entities by their primary keys in one query when supported. */
    async findByIds(ids) {
        if (!ids || ids.length === 0)
            return [];
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (!metadata || metadata.primaryKeys.length === 0) {
            // Fallback: issue sequential finds (kept for completeness; generally not used)
            const results = [];
            for (const id of ids) {
                const found = await this.find(id);
                if (found)
                    results.push(found);
            }
            return results;
        }
        const pk = metadata.primaryKeys[0];
        const column = metadata.columns.find((c) => c.propertyName === pk)?.columnName || pk;
        // Cross-query optimization: deduplicate and chunk large IN lists
        const uniqueIds = Array.from(new Set(ids));
        if (uniqueIds.length === 0)
            return [];
        const chunkSize = this._performance?.inClauseChunkSize ?? DbSet.DEFAULT_IN_CHUNK_SIZE;
        if (uniqueIds.length <= chunkSize) {
            return await this._provider.findWhereIn(this._entityClass, column, uniqueIds);
        }
        const aggregated = [];
        const total = uniqueIds.length;
        let chunks = 0;
        for (let i = 0; i < uniqueIds.length; i += chunkSize) {
            const chunk = uniqueIds.slice(i, i + chunkSize);
            const part = await this._provider.findWhereIn(this._entityClass, column, chunk);
            aggregated.push(...part);
            chunks++;
        }
        try {
            this._provider.loggerRef?.crossQuery?.({
                op: 'IN-chunk',
                chunks,
                size: total,
                entity: this._entityClass.name || 'Unknown',
                column,
                provider: this._provider.providerLabel
            });
        }
        catch {
            /* ignore */
        }
        return aggregated;
    }
    /**
     * Type-safe IN query by entity property. Maps property to column via metadata.
     * Example: users.findWhereIn('id', [userId]) or users.findWhereIn('name', ['Alice'])
     */
    async findWhereIn(property, values) {
        if (!values || values.length === 0)
            return [];
        const metadata = MetadataStorage.getEntity(this._entityClass);
        const columnName = metadata
            ? metadata.columns.find((c) => c.propertyName === property || c.columnName === property)
                ?.columnName || String(property)
            : String(property);
        // Cross-query optimization: deduplicate inputs and split into chunks
        const uniqueValues = Array.from(new Set(values));
        if (uniqueValues.length === 0)
            return [];
        const chunkSize = this._performance?.inClauseChunkSize ?? DbSet.DEFAULT_IN_CHUNK_SIZE;
        if (uniqueValues.length <= chunkSize) {
            return await this._provider.findWhereIn(this._entityClass, columnName, uniqueValues);
        }
        const aggregated = [];
        const total = uniqueValues.length;
        let chunks = 0;
        for (let i = 0; i < uniqueValues.length; i += chunkSize) {
            const chunk = uniqueValues.slice(i, i + chunkSize);
            const part = await this._provider.findWhereIn(this._entityClass, columnName, chunk);
            aggregated.push(...part);
            chunks++;
        }
        try {
            this._provider.loggerRef?.crossQuery?.({
                op: 'IN-chunk',
                chunks,
                size: total,
                entity: this._entityClass.name || 'Unknown',
                column: columnName,
                provider: this._provider.providerLabel
            });
        }
        catch {
            /* ignore */
        }
        return aggregated;
    }
    /** Create a fluent `TypedQueryable` for LINQ-like operations (EF-style) */
    where(predicate) {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).where(predicate);
        return TypedQueryable.from(queryable);
    }
    /** Proxy: WHERE EXISTS (subquery). */
    whereExists(subquery) {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).whereExists(subquery);
        return TypedQueryable.from(queryable);
    }
    /** Proxy: column IN (subquery). */
    whereInSubquery(column, subquery) {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).whereInSubquery(column, subquery);
        return TypedQueryable.from(queryable);
    }
    /** Select specific properties (EF-style with type safety) */
    select(selector) {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).select(selector);
        return TypedQueryable.from(queryable);
    }
    /** Order by a property (EF-style with type safety) */
    orderBy(keySelector) {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).orderBy(keySelector);
        return TypedQueryable.from(queryable);
    }
    /** Order by descending (EF-style with type safety) */
    orderByDescending(keySelector) {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).orderByDescending(keySelector);
        return TypedQueryable.from(queryable);
    }
    /** Take a specific number of entities (EF-style) */
    take(count) {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).take(count);
        return TypedQueryable.from(queryable);
    }
    /** Skip a specific number of entities (EF-style) */
    skip(count) {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).skip(count);
        return TypedQueryable.from(queryable);
    }
    /** Get distinct entities (EF-style) */
    distinct() {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).distinct();
        return TypedQueryable.from(queryable);
    }
    /** Proxy: UNION of two queries of the same DbSet. */
    union(other) {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).union(other);
        return TypedQueryable.from(queryable);
    }
    /** Proxy: UNION ALL of two queries of the same DbSet. */
    unionAll(other) {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).unionAll(other);
        return TypedQueryable.from(queryable);
    }
    /** Get the first entity or throw if none exists */
    async first() {
        return await new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).first();
    }
    /** Get the first entity or null if none exists */
    async firstOrDefault() {
        return await new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).firstOrDefault();
    }
    /** Get a single entity or throw if none or multiple exist */
    async single() {
        return await new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).single();
    }
    /** Get a single entity or null if none exists, throw if multiple exist */
    async singleOrDefault() {
        return await new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).singleOrDefault();
    }
    /** Count entities */
    async count() {
        return await new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).count();
    }
    /** Check if any entities exist */
    async any() {
        return await new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).any();
    }
    /** Start a query with eager includes using a property selector. */
    /** Include related entities for eager loading (EF-style with type safety) */
    include(selector) {
        const queryable = new Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters).include(selector);
        return TypedQueryable.from(queryable);
    }
    /** Provider-level bulk insert within a transaction. */
    async insertMany(entities) {
        return await this._provider.insertMany(entities, this._entityClass);
    }
    /** Provider-level bulk update within a transaction. */
    async updateMany(entities) {
        return await this._provider.updateMany(entities, this._entityClass);
    }
    /** Upsert single entity by primary key existence check (ChangeTracker-based). */
    async upsert(entity) {
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (!metadata || metadata.primaryKeys.length === 0)
            throw new Error(`No primary key defined for ${this._entityClass.name}`);
        const pk = metadata.primaryKeys[0];
        const id = entity[pk];
        if (id === undefined || id === null) {
            // No PK value — treat as insert
            this.add(entity);
            return entity;
        }
        const existing = await this._provider.findById(id, this._entityClass);
        if (existing) {
            this.update(entity);
        }
        else {
            this.add(entity);
        }
        return entity;
    }
    /** Upsert many entities via per-entity PK existence check. */
    async upsertMany(entities) {
        const metadata = MetadataStorage.getEntity(this._entityClass);
        if (!metadata || metadata.primaryKeys.length === 0)
            throw new Error(`No primary key defined for ${this._entityClass.name}`);
        const pk = metadata.primaryKeys[0];
        // Build list of ids present
        const pairs = entities.map((e) => ({
            entity: e,
            id: e[pk]
        }));
        const ids = pairs.filter((p) => p.id !== undefined && p.id !== null).map((p) => p.id);
        if (ids.length > 0) {
            // Fetch existing ids in one go if provider supports findWhereIn for PK column
            const pkCol = metadata.columns.find((c) => c.propertyName === pk);
            const existingRows = await this._provider.findWhereIn(this._entityClass, pkCol ? pkCol.propertyName : pk, ids);
            const existingIdSet = new Set(existingRows.map((r) => r[pk]));
            for (const { entity, id } of pairs) {
                if (id === undefined || id === null) {
                    this.add(entity);
                    continue;
                }
                if (existingIdSet.has(id))
                    this.update(entity);
                else
                    this.add(entity);
            }
        }
        else {
            // All new
            this.addRange(entities);
        }
        return entities;
    }
}
// Default chunk size; can be overridden via PerformanceOptions.inClauseChunkSize
DbSet.DEFAULT_IN_CHUNK_SIZE = 1000;
//# sourceMappingURL=DbSet.js.map