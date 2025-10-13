"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbSet = void 0;
const Queryable_1 = require("@ts-linq/core/dist/query/Queryable");
const TypedQueryable_1 = require("@ts-linq/core/dist/query/TypedQueryable");
const LoadingStrategy_1 = require("@ts-linq/core/dist/loading/LoadingStrategy");
const MetadataStorage_1 = require("@ts-linq/core/dist/metadata/MetadataStorage");
class DbSet {
    constructor(entityClass, provider, changeTracker, entityLoader, entityCache, performance, globalFilters) {
        this._entityClass = entityClass;
        this._provider = provider;
        this._changeTracker = changeTracker;
        this._entityLoader = entityLoader;
        this._entityCache = entityCache;
        this._performance = performance;
        this._globalFilters = globalFilters;
    }
    add(entity) {
        this._changeTracker.add(entity, this._entityClass);
        return entity;
    }
    update(entity) {
        this._changeTracker.update(entity, this._entityClass);
        return entity;
    }
    remove(entity) {
        this._changeTracker.remove(entity, this._entityClass);
        return entity;
    }
    addRange(entities) {
        for (const e of entities)
            this.add(e);
        return entities;
    }
    updateRange(entities) {
        for (const e of entities)
            this.update(e);
        return entities;
    }
    removeRange(entities) {
        for (const e of entities)
            this.remove(e);
        return entities;
    }
    async find(id, options) {
        const entity = await this._provider.findById(id, this._entityClass);
        if (!entity)
            return null;
        return await this.applyLoading(entity, options);
    }
    async toArray(options) {
        const entities = await this._provider.findAll(this._entityClass);
        return await this.applyLoadingMany(entities, options);
    }
    async findByIds(ids) {
        if (ids.length === 0)
            return [];
        const pk = MetadataStorage_1.MetadataStorage.getEntity(this._entityClass)?.primaryKeys[0];
        if (!pk)
            return [];
        const col = MetadataStorage_1.MetadataStorage.getEntity(this._entityClass)?.columns.find((c) => c.propertyName === pk)?.columnName || pk;
        const rows = await this._provider.findWhereIn(this._entityClass, col, ids);
        return this.applyLoadingMany(rows, { strategy: LoadingStrategy_1.LoadingStrategy.Eager });
    }
    query() {
        const raw = new Queryable_1.Queryable(this._entityClass, this._provider, this._entityLoader, this._entityCache, this._performance, this._globalFilters);
        return TypedQueryable_1.TypedQueryable.from(raw);
    }
    async applyLoading(entity, options) {
        const strategy = options?.strategy ?? (this._entityLoader ? LoadingStrategy_1.LoadingStrategy.Eager : undefined);
        // Note: EntityLoader in core exposes high-level load methods; for simplicity here we skip
        // invoking internal methods and just return the entity. Eager loading is handled by queries.
        return entity;
    }
    async applyLoadingMany(entities, options) {
        if (entities.length === 0)
            return entities;
        const strategy = options?.strategy ?? (this._entityLoader ? LoadingStrategy_1.LoadingStrategy.Eager : undefined);
        // See note above: eager loading resolved at query time.
        return entities;
    }
}
exports.DbSet = DbSet;
//# sourceMappingURL=DbSet.js.map