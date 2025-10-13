"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LazyLoadingProxy = exports.LAZY_LOADING_STATE = exports.LAZY_LOADING_PROXY = exports.LAZY_LOADING_PROVIDER = exports.LAZY_LOADING_TARGET = void 0;
exports.isLazyProxy = isLazyProxy;
exports.getLazyTarget = getLazyTarget;
exports.awaitLazyLoad = awaitLazyLoad;
const MetadataStorage_1 = require("../metadata/MetadataStorage");
/**
 * Symbol to store original entity data without triggering lazy loading
 */
exports.LAZY_LOADING_TARGET = Symbol('lazyLoadingTarget');
/**
 * Symbol to store the database provider for lazy loading
 */
exports.LAZY_LOADING_PROVIDER = Symbol('lazyLoadingProvider');
/**
 * Symbol to mark entities as lazy loading proxies
 */
exports.LAZY_LOADING_PROXY = Symbol('lazyLoadingProxy');
/**
 * Symbol to store loading state for each property
 */
exports.LAZY_LOADING_STATE = Symbol('lazyLoadingState');
/**
 * Entity Framework-style lazy loading implementation using ES6 Proxies.
 * Automatically loads related entities when navigation properties are first accessed.
 */
class LazyLoadingProxy {
    static setLogger(logger) {
        this._logger = logger;
    }
    // --- State helpers ------------------------------------------------------
    static getOrInitStateEntry(state, propName) {
        state[propName] || (state[propName] = { isLoaded: false, isLoading: false });
        return state[propName];
    }
    static markLoading(state, propName, promise) {
        const s = this.getOrInitStateEntry(state, propName);
        s.isLoading = true;
        s.loadingPromise = promise;
    }
    static markLoaded(state, propName) {
        const s = this.getOrInitStateEntry(state, propName);
        s.isLoaded = true;
        s.isLoading = false;
        delete s.loadingPromise;
    }
    static resetLoading(state, propName) {
        const s = this.getOrInitStateEntry(state, propName);
        s.isLoading = false;
        delete s.loadingPromise;
    }
    static defaultValueFor(relationship) {
        return relationship.type === 'one-to-many' || relationship.type === 'many-to-many' ? [] : null;
    }
    static getLogger() {
        if (this._logger)
            return this._logger;
        return {
            warn: (message, error) => {
                // Backward compatible fallback to console.warn for existing tests
                // and environments where DI logger is not provided.
                // eslint-disable-next-line no-console
                console.warn(message, error);
            }
        };
    }
    /**
     * Create a lazy loading proxy for an entity.
     * When navigation properties are accessed, they will be automatically loaded from the database.
     */
    static create(entity, entityClass, provider) {
        if (this.isLazyProxy(entity)) {
            return entity; // Already a lazy proxy
        }
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        if (!metadata || metadata.relationships.length === 0) {
            return entity; // No relationships to lazy load
        }
        // Initialize lazy loading state
        const state = {};
        for (const relationship of metadata.relationships) {
            state[relationship.propertyName] = {
                isLoaded: false,
                isLoading: false
            };
            // Check if property is already loaded (has non-null value)
            const currentValue = entity[relationship.propertyName];
            if (currentValue !== undefined && currentValue !== null) {
                state[relationship.propertyName].isLoaded = true;
            }
        }
        return new Proxy(entity, {
            get: (target, prop, receiver) => LazyLoadingProxy.proxyGet(target, prop, receiver, provider, entityClass, metadata, state),
            set: (target, prop, value, receiver) => LazyLoadingProxy.proxySet(target, prop, value, receiver, metadata, state),
            has: (target, prop) => LazyLoadingProxy.proxyHas(target, prop),
            ownKeys: (target) => LazyLoadingProxy.proxyOwnKeys(target),
            getOwnPropertyDescriptor: (target, prop) => LazyLoadingProxy.proxyGetOwnPropertyDescriptor(target, prop)
        });
    }
    static proxyGet(target, prop, receiver, provider, entityClass, metadata, state) {
        if (prop === exports.LAZY_LOADING_TARGET)
            return target;
        if (prop === exports.LAZY_LOADING_PROVIDER)
            return provider;
        if (prop === exports.LAZY_LOADING_PROXY)
            return true;
        if (prop === exports.LAZY_LOADING_STATE)
            return state;
        const propName = String(prop);
        const relationship = metadata.relationships.find((r) => r.propertyName === propName);
        if (relationship) {
            const s = this.getOrInitStateEntry(state, propName);
            if (!s.isLoaded && !s.isLoading) {
                const promise = LazyLoadingProxy.loadRelationship(target, entityClass, relationship, provider)
                    .then((result) => {
                    target[propName] = result;
                    this.markLoaded(state, propName);
                    return result;
                })
                    .catch((error) => {
                    LazyLoadingProxy.getLogger().warn(`Failed to lazy load ${propName}:`, error);
                    this.resetLoading(state, propName);
                    return this.defaultValueFor(relationship);
                });
                this.markLoading(state, propName, promise);
                return promise;
            }
            if (s.isLoading) {
                return s.loadingPromise;
            }
        }
        return Reflect.get(target, prop, receiver);
    }
    static proxySet(target, prop, value, receiver, metadata, state) {
        const propName = String(prop);
        const relationship = metadata.relationships.find((r) => r.propertyName === propName);
        if (relationship)
            this.markLoaded(state, propName);
        return Reflect.set(target, prop, value, receiver);
    }
    static proxyHas(target, prop) {
        if (prop === exports.LAZY_LOADING_PROXY ||
            prop === exports.LAZY_LOADING_TARGET ||
            prop === exports.LAZY_LOADING_PROVIDER ||
            prop === exports.LAZY_LOADING_STATE) {
            return true;
        }
        return Reflect.has(target, prop);
    }
    static proxyOwnKeys(target) {
        const keys = Reflect.ownKeys(target);
        return keys.filter((key) => key !== exports.LAZY_LOADING_TARGET &&
            key !== exports.LAZY_LOADING_PROVIDER &&
            key !== exports.LAZY_LOADING_PROXY &&
            key !== exports.LAZY_LOADING_STATE);
    }
    static proxyGetOwnPropertyDescriptor(target, prop) {
        if (prop === exports.LAZY_LOADING_PROXY ||
            prop === exports.LAZY_LOADING_TARGET ||
            prop === exports.LAZY_LOADING_PROVIDER ||
            prop === exports.LAZY_LOADING_STATE) {
            return { configurable: true, enumerable: false, writable: false, value: true };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
    }
    /**
     * Create lazy loading proxies for multiple entities.
     */
    static createMany(entities, entityClass, provider) {
        return entities.map((entity) => this.create(entity, entityClass, provider));
    }
    /**
     * Check if an entity is a lazy loading proxy.
     */
    static isLazyProxy(entity) {
        return !!entity?.[exports.LAZY_LOADING_PROXY];
    }
    /**
     * Get the original target entity from a lazy proxy.
     */
    static getTarget(entity) {
        if (this.isLazyProxy(entity)) {
            return entity[exports.LAZY_LOADING_TARGET];
        }
        return entity;
    }
    /**
     * Get the loading state for a lazy proxy.
     */
    static getLoadingState(entity) {
        if (this.isLazyProxy(entity)) {
            return entity[exports.LAZY_LOADING_STATE];
        }
        return null;
    }
    /**
     * Check if a specific relationship property is loaded.
     */
    static isRelationshipLoaded(entity, propertyName) {
        const state = this.getLoadingState(entity);
        return state?.[propertyName]?.isLoaded ?? false;
    }
    /**
     * Preload specific relationships to avoid N+1 queries.
     */
    static async preloadRelationships(entities, entityClass, propertyNames, provider) {
        if (entities.length === 0)
            return;
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            return;
        // Group entities by whether they're already proxies
        const proxiedEntities = [];
        const nonProxiedEntities = [];
        for (const entity of entities) {
            if (this.isLazyProxy(entity)) {
                proxiedEntities.push(entity);
            }
            else {
                nonProxiedEntities.push(entity);
            }
        }
        // Preload for each specified property
        for (const propertyName of propertyNames) {
            const relationship = metadata.relationships.find((r) => r.propertyName === propertyName);
            if (!relationship)
                continue;
            // Filter entities that need loading for this property
            const entitiesToLoad = proxiedEntities.filter((entity) => {
                const state = this.getLoadingState(entity);
                return state && !state[propertyName].isLoaded && !state[propertyName].isLoading;
            });
            if (entitiesToLoad.length > 0) {
                await this.batchLoadRelationship(entitiesToLoad, entityClass, relationship, provider);
            }
            // Also load for non-proxied entities (direct loading)
            if (nonProxiedEntities.length > 0) {
                await this.batchLoadRelationship(nonProxiedEntities, entityClass, relationship, provider);
            }
        }
    }
    /**
     * Load a single relationship for an entity.
     */
    static async loadRelationship(entity, entityClass, relationship, provider) {
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            return null;
        const targetCtor = this.resolveTargetEntity(relationship.targetEntity);
        switch (relationship.type) {
            case 'many-to-one':
            case 'one-to-one': {
                const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
                const foreignKeyValue = entity[foreignKeyName];
                if (foreignKeyValue === undefined || foreignKeyValue === null) {
                    return null;
                }
                const relatedEntity = await provider.findById(foreignKeyValue, targetCtor);
                return relatedEntity ? this.create(relatedEntity, targetCtor, provider) : null;
            }
            case 'one-to-many': {
                const parentPkProperty = metadata.primaryKeys[0];
                if (!parentPkProperty)
                    return [];
                const parentPkValue = entity[parentPkProperty];
                if (parentPkValue === undefined || parentPkValue === null) {
                    return [];
                }
                const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
                const relatedEntities = await provider.findWhere(targetCtor, {
                    [foreignKeyName]: parentPkValue
                });
                return this.createMany(relatedEntities, targetCtor, provider);
            }
            case 'many-to-many': {
                return await this.loadManyToMany(entity, entityClass, metadata, relationship, targetCtor, provider);
            }
            default:
                return null;
        }
    }
    /**
     * Batch load relationships for multiple entities to avoid N+1 queries.
     */
    static async batchLoadRelationship(entities, entityClass, relationship, provider) {
        if (entities.length === 0)
            return;
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            return;
        const targetCtor = this.resolveTargetEntity(relationship.targetEntity);
        switch (relationship.type) {
            case 'many-to-one':
            case 'one-to-one': {
                await this.batchLoadToOne(entities, relationship, provider, metadata, targetCtor);
                break;
            }
            case 'one-to-many': {
                await this.batchLoadOneToMany(entities, entityClass, relationship, provider, metadata, targetCtor);
                break;
            }
            case 'many-to-many': {
                await this.batchLoadManyToMany(entities, entityClass, relationship, provider, metadata, targetCtor);
                break;
            }
        }
    }
    static async batchLoadToOne(entities, relationship, provider, meta, targetCtor) {
        const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
        const fkValues = entities
            .map((e) => e[foreignKeyName])
            .filter((v) => v !== undefined && v !== null);
        const uniqueFkValues = Array.from(new Set(fkValues));
        if (uniqueFkValues.length === 0)
            return;
        const targetPkColumn = meta.columns.find((c) => c.propertyName === meta.primaryKeys[0])?.columnName ||
            meta.primaryKeys[0];
        const related = await provider.findWhereIn(targetCtor, targetPkColumn, uniqueFkValues);
        const relatedProxies = this.createMany(related, targetCtor, provider);
        const byId = new Map();
        const targetMeta = MetadataStorage_1.MetadataStorage.getEntity(targetCtor);
        const targetPk = targetMeta?.primaryKeys[0];
        if (!targetPk)
            return;
        for (const relatedEntity of relatedProxies) {
            const t = this.getTarget(relatedEntity);
            byId.set(t[targetPk], relatedEntity);
        }
        for (const entity of entities) {
            const fk = entity[foreignKeyName];
            if (fk === undefined || fk === null)
                continue;
            entity[relationship.propertyName] =
                byId.get(fk) || null;
            const state = this.getLoadingState(entity);
            if (state)
                this.markLoaded(state, relationship.propertyName);
        }
    }
    static async batchLoadOneToMany(entities, entityClass, relationship, provider, meta, targetCtor) {
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
        const related = (await provider.findWhereIn(targetCtor, foreignKeyName, uniqueParentIds)) || [];
        const relatedProxies = this.createMany(related, targetCtor, provider);
        const grouped = new Map();
        for (const relatedEntity of relatedProxies) {
            const t = this.getTarget(relatedEntity);
            const key = t[foreignKeyName];
            const arr = grouped.get(key) || [];
            arr.push(relatedEntity);
            grouped.set(key, arr);
        }
        for (const entity of entities) {
            const parentId = entity[parentPkProperty];
            entity[relationship.propertyName] =
                grouped.get(parentId) || [];
            const state = this.getLoadingState(entity);
            if (state)
                this.markLoaded(state, relationship.propertyName);
        }
    }
    static async loadManyToMany(entity, entityClass, metadata, relationship, targetCtor, provider) {
        const sourcePk = metadata.primaryKeys[0];
        const targetPk = (MetadataStorage_1.MetadataStorage.getEntity(targetCtor)?.primaryKeys || [])[0];
        const through = relationship;
        if (!through.through?.table || !sourcePk || !targetPk)
            return [];
        const jt = through.through.table;
        const sourceFk = through.through.sourceFk || this.defaultForeignKeyFor(entityClass);
        const targetFk = through.through.targetFk || this.defaultForeignKeyFor(targetCtor);
        const sourceId = entity[sourcePk];
        if (sourceId === undefined || sourceId === null)
            return [];
        const targetIds = await this.fetchTargetIdsFromJunction(provider, jt, sourceFk, targetFk, sourceId);
        if (targetIds.length === 0)
            return [];
        const targetCol = this.getColumnNameForPk(targetCtor, targetPk);
        const related = await provider.findWhereIn(targetCtor, targetCol, targetIds);
        return this.createMany(related, targetCtor, provider);
    }
    static async fetchTargetIdsFromJunction(provider, junctionTable, sourceFk, targetFk, sourceId) {
        const rows = await provider.executeQuery(`SELECT ${targetFk} as id FROM ${junctionTable} WHERE ${sourceFk} = ?`, [sourceId]);
        return rows.map((r) => r.id).filter((v) => v !== undefined && v !== null);
    }
    static getColumnNameForPk(targetCtor, targetPk) {
        return ((MetadataStorage_1.MetadataStorage.getEntity(targetCtor)?.columns || []).find((c) => c.propertyName === targetPk)?.columnName || targetPk);
    }
    static async batchLoadManyToMany(entities, entityClass, relationship, provider, meta, targetCtor) {
        const sourcePk = meta.primaryKeys[0];
        if (!sourcePk)
            return;
        const through = relationship;
        if (!through.through?.table)
            return;
        const targetPk = (MetadataStorage_1.MetadataStorage.getEntity(targetCtor)?.primaryKeys || [])[0];
        if (!targetPk)
            return;
        const jt = through.through.table;
        const sourceFk = through.through.sourceFk || this.defaultForeignKeyFor(entityClass);
        const targetFk = through.through.targetFk || this.defaultForeignKeyFor(targetCtor);
        const sourceIds = this.extractSourceIds(entities, sourcePk);
        if (sourceIds.length === 0)
            return;
        const { bySource, targetIds } = await this.fetchJunctionMappings(provider, jt, sourceFk, targetFk, sourceIds);
        if (targetIds.size === 0) {
            this.assignEmptyCollections(entities, relationship.propertyName);
            return;
        }
        const relById = await this.fetchAndMapTargets(provider, targetCtor, targetPk, Array.from(targetIds));
        this.assignManyToManyCollections(entities, relationship.propertyName, sourcePk, bySource, relById);
    }
    static extractSourceIds(entities, sourcePk) {
        const ids = entities
            .map((e) => e[sourcePk])
            .filter((v) => v !== undefined && v !== null);
        return Array.from(new Set(ids));
    }
    static async fetchJunctionMappings(provider, junctionTable, sourceFk, targetFk, sourceIds) {
        const rows = await provider.executeQuery(`SELECT ${sourceFk} as s, ${targetFk} as t FROM ${junctionTable} WHERE ${sourceFk} IN (${sourceIds
            .map(() => '?')
            .join(',')})`, sourceIds);
        const bySource = new Map();
        const targetIds = new Set();
        for (const r of rows) {
            targetIds.add(r.t);
            const arr = bySource.get(r.s) || [];
            arr.push(r.t);
            bySource.set(r.s, arr);
        }
        return { bySource, targetIds };
    }
    static assignEmptyCollections(entities, propName) {
        for (const entity of entities) {
            entity[propName] = [];
            const state = this.getLoadingState(entity);
            if (state)
                this.markLoaded(state, propName);
        }
    }
    static async fetchAndMapTargets(provider, targetCtor, targetPk, targetIds) {
        const targetCol = this.getColumnNameForPk(targetCtor, targetPk);
        const related = await provider.findWhereIn(targetCtor, targetCol, targetIds);
        const relProxies = this.createMany(related, targetCtor, provider);
        const relById = new Map();
        for (const rp of relProxies) {
            const t = this.getTarget(rp);
            relById.set(t[targetPk], rp);
        }
        return relById;
    }
    static assignManyToManyCollections(entities, propName, sourcePk, bySource, relById) {
        for (const entity of entities) {
            const sid = entity[sourcePk];
            const idList = bySource.get(sid) || [];
            entity[propName] = idList
                .map((id) => relById.get(id))
                .filter(Boolean);
            const state = this.getLoadingState(entity);
            if (state)
                this.markLoaded(state, propName);
        }
    }
    /**
     * Resolve a relationship target entity.
     */
    static resolveTargetEntity(target) {
        const maybeCtor = target;
        if (typeof maybeCtor === 'function' && 'prototype' in maybeCtor && maybeCtor.prototype) {
            return maybeCtor;
        }
        return target();
    }
    /**
     * Generate default foreign key name.
     */
    static defaultForeignKeyFor(type) {
        const name = type.name || 'id';
        const camel = name.charAt(0).toLowerCase() + name.slice(1);
        return `${camel}Id`;
    }
}
exports.LazyLoadingProxy = LazyLoadingProxy;
/**
 * Type guard to check if an entity is a lazy loading proxy.
 */
function isLazyProxy(entity) {
    return LazyLoadingProxy.isLazyProxy(entity);
}
/**
 * Get the original target from a lazy proxy.
 */
function getLazyTarget(entity) {
    return LazyLoadingProxy.getTarget(entity);
}
/**
 * Utility to await lazy loading promises when accessing navigation properties.
 * Usage: await awaitLazyLoad(user.posts) to ensure posts are loaded.
 */
async function awaitLazyLoad(propertyValue) {
    if (propertyValue instanceof Promise) {
        return await propertyValue;
    }
    return propertyValue;
}
//# sourceMappingURL=LazyLoadingProxy.js.map