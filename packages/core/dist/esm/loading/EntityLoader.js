import { LoadingStrategy } from './LoadingStrategy';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { LazyLoadingProxy } from './LazyLoadingProxy';
/**
 * Service responsible for loading entities with either lazy or eager strategy,
 * including recursive loading of relationships based on provided options.
 */
export class EntityLoader {
    /**
     * @param provider Database provider used for underlying queries.
     */
    constructor(provider) {
        this._defaultStrategy = LoadingStrategy.Lazy;
        this._provider = provider;
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
        if (loadingOptions.strategy === LoadingStrategy.Eager || loadingOptions.includes) {
            await this.loadRelationships(entity, entityClass, loadingOptions);
            return entity;
        }
        else if (loadingOptions.strategy === LoadingStrategy.Lazy) {
            // Return a lazy loading proxy for Entity Framework style navigation
            return LazyLoadingProxy.create(entity, entityClass, this._provider);
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
        if (loadingOptions.strategy === LoadingStrategy.Eager || loadingOptions.includes) {
            await this.loadRelationshipsBatched(entities, entityClass, loadingOptions);
            return entities;
        }
        else if (loadingOptions.strategy === LoadingStrategy.Lazy) {
            // Return lazy loading proxies for Entity Framework style navigation
            return LazyLoadingProxy.createMany(entities, entityClass, this._provider);
        }
        return entities;
    }
    /**
     * Populate relationship properties on an entity according to options.
     */
    async loadRelationships(entity, entityClass, options) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            return;
        const depth = options.depth ?? 1;
        if (depth <= 0)
            return;
        for (const relationship of metadata.relationships) {
            if (options.includes) {
                // Validate includes against metadata upfront
                for (const inc of options.includes) {
                    const exists = metadata.relationships.some((r) => r.propertyName === inc);
                    if (!exists)
                        throw new Error(`Invalid include '${inc}' for ${metadata.target.name}`);
                }
            }
            const shouldInclude = !options.includes || options.includes.includes(relationship.propertyName);
            if (!shouldInclude)
                continue;
            try {
                const targetCtor = this.resolveTargetEntity(relationship.targetEntity);
                switch (relationship.type) {
                    case 'many-to-one':
                    case 'one-to-one': {
                        const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
                        const foreignKeyValue = entity[foreignKeyName];
                        if (foreignKeyValue === undefined || foreignKeyValue === null) {
                            break;
                        }
                        const relatedEntity = await this.loadEntity(targetCtor, foreignKeyValue, { ...options, depth: depth - 1 });
                        if (relatedEntity) {
                            entity[relationship.propertyName] =
                                relatedEntity;
                        }
                        break;
                    }
                    case 'one-to-many': {
                        const parentPkProperty = metadata.primaryKeys[0];
                        if (!parentPkProperty) {
                            break;
                        }
                        const parentPkValue = entity[parentPkProperty];
                        if (parentPkValue === undefined || parentPkValue === null) {
                            break;
                        }
                        const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
                        const relatedEntities = await this._provider.findWhere(targetCtor, {
                            [foreignKeyName]: parentPkValue
                        });
                        entity[relationship.propertyName] =
                            relatedEntities;
                        break;
                    }
                }
            }
            catch (error) {
                console.warn(`Failed to load relationship ${relationship.propertyName}:`, error);
            }
        }
    }
    /** Batched variant to reduce N+1 queries when loading many entities. */
    async loadRelationshipsBatched(entities, entityClass, options) {
        if (entities.length === 0)
            return;
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata)
            return;
        const depth = options.depth ?? 1;
        if (depth <= 0)
            return;
        for (const relationship of metadata.relationships) {
            const shouldInclude = !options.includes || options.includes.includes(relationship.propertyName);
            if (!shouldInclude)
                continue;
            const targetCtor = this.resolveTargetEntity(relationship.targetEntity);
            switch (relationship.type) {
                case 'many-to-one':
                case 'one-to-one': {
                    const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
                    const fkValues = entities
                        .map((e) => e[foreignKeyName])
                        .filter((v) => v !== undefined && v !== null);
                    const uniqueFkValues = Array.from(new Set(fkValues));
                    if (uniqueFkValues.length === 0)
                        break;
                    const related = await this._provider.findWhereIn(targetCtor, metadata.columns.find((c) => c.propertyName === metadata.primaryKeys[0])?.columnName ||
                        metadata.primaryKeys[0], uniqueFkValues);
                    const byId = new Map();
                    const targetMeta = MetadataStorage.getEntity(targetCtor);
                    const targetPk = targetMeta?.primaryKeys[0];
                    for (const relatedEntity of related)
                        byId.set(relatedEntity[targetPk], relatedEntity);
                    for (const entityItem of entities) {
                        const fk = entityItem[foreignKeyName];
                        if (fk !== undefined && fk !== null) {
                            entityItem[relationship.propertyName] =
                                byId.get(fk);
                        }
                    }
                    // Recurse for next depth level on distinct related
                    if (depth - 1 > 0) {
                        await this.loadRelationshipsBatched(Array.from(byId.values()), targetCtor, {
                            ...options,
                            depth: depth - 1
                        });
                    }
                    break;
                }
                case 'one-to-many': {
                    const parentPkProperty = metadata.primaryKeys[0];
                    if (!parentPkProperty)
                        break;
                    const parentIds = entities
                        .map((e) => e[parentPkProperty])
                        .filter((v) => v !== undefined && v !== null);
                    const uniqueParentIds = Array.from(new Set(parentIds));
                    if (uniqueParentIds.length === 0)
                        break;
                    const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
                    const related = await this._provider.findWhereIn(targetCtor, foreignKeyName, uniqueParentIds);
                    const grouped = new Map();
                    for (const relatedEntity of related) {
                        const key = relatedEntity[foreignKeyName];
                        const arr = grouped.get(key) || [];
                        arr.push(relatedEntity);
                        grouped.set(key, arr);
                    }
                    for (const entityItem of entities) {
                        const parentId = entityItem[parentPkProperty];
                        entityItem[relationship.propertyName] =
                            (grouped.get(parentId) || []);
                    }
                    if (depth - 1 > 0) {
                        await this.loadRelationshipsBatched(related, targetCtor, {
                            ...options,
                            depth: depth - 1
                        });
                    }
                    break;
                }
            }
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
}
// DbSetWithIncludes was removed in favor of predicate-based include API on Queryable
//# sourceMappingURL=EntityLoader.js.map