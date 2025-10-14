"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityLoader = void 0;
const LoadingStrategy_1 = require("./LoadingStrategy");
const MetadataStorage_1 = require("../metadata/MetadataStorage");
/**
 * Service responsible for loading entities with either lazy or eager strategy,
 * including recursive loading of relationships based on provided options.
 */
class EntityLoader {
    /**
     * @param provider Database provider used for underlying queries.
     */
    constructor(provider, logger) {
        this._defaultStrategy = LoadingStrategy_1.LoadingStrategy.Lazy;
        this._inChunkSize = 1000;
        this._provider = provider;
        this._logger = logger;
    }
    /** Configure IN() chunk size from PerformanceOptions. */
    setInChunkSize(size) {
        if (typeof size === 'number' && size > 0)
            this._inChunkSize = size;
    }
    /**
     * Set the default loading strategy for operations.
     */
    setDefaultStrategy(strategy) {
        this._defaultStrategy = strategy;
    }
    /**
     * Load a single entity by id with optional eager includes or lazy loading.
     */
    async loadEntity(entityClass, id, options) {
        const entity = await this._provider.findById(id, entityClass);
        if (!entity)
            return null;
        const loadingOptions = {
            strategy: this._defaultStrategy,
            ...options
        };
        if (loadingOptions.strategy === LoadingStrategy_1.LoadingStrategy.Eager || loadingOptions.includes) {
            await this.loadRelationships(entity, entityClass, loadingOptions);
            return entity;
        }
        else if (loadingOptions.strategy === LoadingStrategy_1.LoadingStrategy.Lazy) {
            // Leave navigation properties untouched (undefined) for strict lazy behavior
            return entity;
        }
        return entity;
    }
    /**
     * Load all entities for a given type with optional eager includes or lazy loading.
     */
    async loadEntities(entityClass, options) {
        const entities = await this._provider.findAll(entityClass);
        const loadingOptions = {
            strategy: this._defaultStrategy,
            ...options
        };
        if (loadingOptions.strategy === LoadingStrategy_1.LoadingStrategy.Eager || loadingOptions.includes) {
            await this.loadRelationshipsBatched(entities, entityClass, loadingOptions);
            return entities;
        }
        else if (loadingOptions.strategy === LoadingStrategy_1.LoadingStrategy.Lazy) {
            // Keep plain entities for strict lazy behavior
            return entities;
        }
        return entities;
    }
    /**
     * Populate relationship properties on an entity according to options.
     */
    async loadRelationships(entity, entityClass, options) {
        this.ensureStage3Init(entityClass);
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            return;
        const depth = options.depth ?? 1;
        if (depth <= 0)
            return;
        this.validateIncludes(metadata, options.includes);
        for (const relationship of metadata.relationships) {
            if (!this.shouldInclude(relationship.propertyName, options.includes))
                continue;
            await this.loadRelationshipByType(entity, entityClass, metadata, relationship, options, depth);
        }
    }
    /** Batched variant to reduce N+1 queries when loading many entities. */
    async loadRelationshipsBatched(entities, entityClass, options) {
        if (entities.length === 0)
            return;
        this.ensureStage3Init(entityClass);
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            return;
        const depth = options.depth ?? 1;
        if (depth <= 0)
            return;
        // Validate provided includes against metadata to fail fast on typos/mistakes
        this.validateIncludes(metadata, options.includes);
        for (const relationship of metadata.relationships) {
            if (!this.shouldInclude(relationship.propertyName, options.includes))
                continue;
            await this.loadRelationshipBatchedByType(entities, entityClass, metadata, relationship, options, depth);
        }
    }
    /**
     * Public helper to populate specified relationships on a single entity instance.
     * Useful for post-processing entities fetched by custom queries.
     */
    async populateRelationships(entity, entityClass, options) {
        await this.loadRelationships(entity, entityClass, options);
    }
    /**
     * Public helper to populate relationships for many entities in a batched way.
     * Reduces N+1 queries by grouping related fetches.
     */
    async populateRelationshipsMany(entities, entityClass, options) {
        await this.loadRelationshipsBatched(entities, entityClass, options);
    }
    /**
     * Resolve a relationship target that may be provided either as a constructor
     * or as a lazy callback returning the constructor.
     * @param target Constructor or thunk returning a constructor
     * @returns Concrete constructor function for the target entity
     */
    resolveTargetEntity(target) {
        const maybeCtor = target;
        if (typeof maybeCtor === 'function' && 'prototype' in maybeCtor && maybeCtor.prototype) {
            return maybeCtor;
        }
        const resolved = target();
        return resolved;
    }
    /**
     * Compute a default foreign key name for a given type using the convention
     * camelCase(typeName) + 'Id', e.g., User -> userId.
     * @param type Target constructor
     * @returns Conventional foreign key column name
     */
    defaultForeignKeyFor(type) {
        const name = type.name || 'id';
        const camel = name.charAt(0).toLowerCase() + name.slice(1);
        return `${camel}Id`;
    }
    // ===== Helper methods extracted to reduce complexity =====
    ensureStage3Init(entityClass) {
        try {
            void new entityClass();
        }
        catch {
            /* ignore */
        }
    }
    validateIncludes(metadata, includes) {
        if (!includes)
            return;
        for (const inc of includes) {
            const exists = metadata.relationships.some((r) => r.propertyName === inc);
            if (!exists)
                throw new Error(`Invalid include '${inc}' for ${metadata.target.name}`);
        }
    }
    shouldInclude(property, includes) {
        return !includes || includes.includes(property);
    }
    async loadToOne(entity, relationship, targetCtor, nextOptions) {
        const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
        const foreignKeyValue = entity[foreignKeyName];
        if (foreignKeyValue === undefined || foreignKeyValue === null)
            return;
        const relatedEntity = await this.loadEntity(targetCtor, foreignKeyValue, nextOptions);
        if (relatedEntity)
            entity[relationship.propertyName] = relatedEntity;
    }
    async loadOneToMany(entity, metadata, relationship, entityClass, targetCtor) {
        const parentPkProperty = metadata.primaryKeys[0];
        if (!parentPkProperty)
            return;
        const parentPkValue = entity[parentPkProperty];
        if (parentPkValue === undefined || parentPkValue === null)
            return;
        const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
        const relatedEntities = await this._provider.findWhere(targetCtor, {
            [foreignKeyName]: parentPkValue
        });
        entity[relationship.propertyName] = relatedEntities;
    }
    getPrimaryKeyColumnName(meta) {
        const pkProp = meta.primaryKeys[0];
        return meta.columns.find((c) => c.propertyName === pkProp)?.columnName || pkProp;
    }
    async loadRelationshipByType(entity, entityClass, metadata, relationship, options, depth) {
        try {
            const targetCtor = this.resolveTargetEntity(relationship.targetEntity);
            if (relationship.type === 'one-to-many') {
                await this.loadOneToMany(entity, metadata, relationship, entityClass, targetCtor);
            }
            else {
                await this.loadToOne(entity, relationship, targetCtor, { ...options, depth: depth - 1 });
            }
        }
        catch (error) {
            this._logger?.warn(`Failed to load relationship ${relationship.propertyName}:`, error);
        }
    }
    async loadRelationshipBatchedByType(entities, entityClass, metadata, relationship, options, depth) {
        const targetCtor = this.resolveTargetEntity(relationship.targetEntity);
        if (relationship.type === 'one-to-many') {
            await this.loadOneToManyBatched(entities, { primaryKeys: metadata.primaryKeys }, relationship, entityClass, targetCtor, options, depth);
            return;
        }
        await this.loadToOneBatched(entities, { columns: metadata.columns ?? [], primaryKeys: metadata.primaryKeys }, relationship, targetCtor, options, depth);
    }
    async loadToOneBatched(entities, meta, relationship, targetCtor, options, depth) {
        const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
        const fkValues = entities
            .map((e) => e[foreignKeyName])
            .filter((v) => v !== undefined && v !== null);
        const uniqueFkValues = Array.from(new Set(fkValues));
        if (uniqueFkValues.length === 0)
            return;
        const targetPkColumn = this.getPrimaryKeyColumnName(meta);
        // Chunk large IN lists to avoid parameter limits
        const chunkSize = this._inChunkSize;
        let related = [];
        if (uniqueFkValues.length <= chunkSize) {
            related = await this._provider.findWhereIn(targetCtor, targetPkColumn, uniqueFkValues);
        }
        else {
            const acc = [];
            let chunks = 0;
            for (let i = 0; i < uniqueFkValues.length; i += chunkSize) {
                const chunk = uniqueFkValues.slice(i, i + chunkSize);
                const part = await this._provider.findWhereIn(targetCtor, targetPkColumn, chunk);
                acc.push(...part);
                chunks++;
            }
            related = acc;
            try {
                this._provider.loggerRef?.crossQuery?.({
                    op: 'IN-chunk',
                    chunks,
                    size: uniqueFkValues.length,
                    entity: targetCtor.name || 'Unknown',
                    column: targetPkColumn,
                    provider: this._provider.providerLabel
                });
            }
            catch {
                /* ignore */
            }
        }
        const byId = new Map();
        const targetMeta = MetadataStorage_1.MetadataStorage.getEntity(targetCtor);
        const targetPk = targetMeta?.primaryKeys[0];
        for (const relatedEntity of related)
            byId.set(relatedEntity[targetPk], relatedEntity);
        for (const entityItem of entities) {
            const fk = entityItem[foreignKeyName];
            if (fk !== undefined && fk !== null)
                entityItem[relationship.propertyName] = byId.get(fk);
        }
        if (depth - 1 > 0)
            await this.loadRelationshipsBatched(Array.from(byId.values()), targetCtor, {
                ...options,
                depth: depth - 1
            });
    }
    async loadOneToManyBatched(entities, meta, relationship, entityClass, targetCtor, options, depth) {
        const parentPkProperty = meta.primaryKeys[0];
        if (!parentPkProperty)
            return;
        const parentIds = entities
            .map((e) => e[parentPkProperty])
            .filter((v) => v !== undefined && v !== null);
        const uniqueParentIds = Array.from(new Set(parentIds));
        if (uniqueParentIds.length === 0)
            return;
        const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
        // Chunk large IN lists to avoid parameter limits
        const chunkSize2 = this._inChunkSize;
        let related = [];
        if (uniqueParentIds.length <= chunkSize2) {
            related = await this._provider.findWhereIn(targetCtor, foreignKeyName, uniqueParentIds);
        }
        else {
            const acc = [];
            let chunks = 0;
            for (let i = 0; i < uniqueParentIds.length; i += chunkSize2) {
                const chunk = uniqueParentIds.slice(i, i + chunkSize2);
                const part = await this._provider.findWhereIn(targetCtor, foreignKeyName, chunk);
                acc.push(...part);
                chunks++;
            }
            related = acc;
            try {
                this._provider.loggerRef?.crossQuery?.({
                    op: 'IN-chunk',
                    chunks,
                    size: uniqueParentIds.length,
                    entity: targetCtor.name || 'Unknown',
                    column: foreignKeyName,
                    provider: this._provider.providerLabel
                });
            }
            catch {
                /* ignore */
            }
        }
        const grouped = new Map();
        for (const relatedEntity of related) {
            const key = relatedEntity[foreignKeyName];
            const arr = grouped.get(key) || [];
            arr.push(relatedEntity);
            grouped.set(key, arr);
        }
        for (const entityItem of entities) {
            const parentId = entityItem[parentPkProperty];
            entityItem[relationship.propertyName] = (grouped.get(parentId) ||
                []);
        }
        if (depth - 1 > 0)
            await this.loadRelationshipsBatched(related, targetCtor, {
                ...options,
                depth: depth - 1
            });
    }
}
exports.EntityLoader = EntityLoader;
// DbSetWithIncludes was removed in favor of predicate-based include API on Queryable
//# sourceMappingURL=EntityLoader.js.map