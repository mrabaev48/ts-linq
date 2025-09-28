import { MetadataStorage } from '../metadata/MetadataStorage';
/**
 * Symbol to store original entity data without triggering lazy loading
 */
export const LAZY_LOADING_TARGET = Symbol('lazyLoadingTarget');
/**
 * Symbol to store the database provider for lazy loading
 */
export const LAZY_LOADING_PROVIDER = Symbol('lazyLoadingProvider');
/**
 * Symbol to mark entities as lazy loading proxies
 */
export const LAZY_LOADING_PROXY = Symbol('lazyLoadingProxy');
/**
 * Symbol to store loading state for each property
 */
export const LAZY_LOADING_STATE = Symbol('lazyLoadingState');
/**
 * Entity Framework-style lazy loading implementation using ES6 Proxies.
 * Automatically loads related entities when navigation properties are first accessed.
 */
export class LazyLoadingProxy {
  /**
   * Create a lazy loading proxy for an entity.
   * When navigation properties are accessed, they will be automatically loaded from the database.
   */
  static create(entity, entityClass, provider) {
    if (this.isLazyProxy(entity)) {
      return entity; // Already a lazy proxy
    }
    const metadata = MetadataStorage.getEntity(entityClass);
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
      get(target, prop, receiver) {
        // Handle lazy loading symbols
        if (prop === LAZY_LOADING_TARGET) return target;
        if (prop === LAZY_LOADING_PROVIDER) return provider;
        if (prop === LAZY_LOADING_PROXY) return true;
        if (prop === LAZY_LOADING_STATE) return state;
        const propName = String(prop);
        const relationship = metadata.relationships.find((r) => r.propertyName === propName);
        if (relationship && !state[propName].isLoaded && !state[propName].isLoading) {
          // Start lazy loading this relationship
          state[propName].isLoading = true;
          state[propName].loadingPromise = LazyLoadingProxy.loadRelationship(
            target,
            entityClass,
            relationship,
            provider
          )
            .then((result) => {
              // Set the loaded value
              target[propName] = result;
              state[propName].isLoaded = true;
              state[propName].isLoading = false;
              delete state[propName].loadingPromise;
              return result;
            })
            .catch((error) => {
              console.warn(`Failed to lazy load ${propName}:`, error);
              state[propName].isLoading = false;
              delete state[propName].loadingPromise;
              return relationship.type === 'one-to-many' ? [] : null;
            });
          // For synchronous access, return promise (EF style async access)
          // Or return undefined and load in background
          return state[propName].loadingPromise;
        }
        // If currently loading, return the promise
        if (relationship && state[propName].isLoading) {
          return state[propName].loadingPromise;
        }
        // Default property access
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value, receiver) {
        const propName = String(prop);
        const relationship = metadata.relationships.find((r) => r.propertyName === propName);
        if (relationship) {
          // Mark as loaded when manually set
          state[propName].isLoaded = true;
          state[propName].isLoading = false;
          delete state[propName].loadingPromise;
        }
        return Reflect.set(target, prop, value, receiver);
      },
      has(target, prop) {
        if (
          prop === LAZY_LOADING_PROXY ||
          prop === LAZY_LOADING_TARGET ||
          prop === LAZY_LOADING_PROVIDER ||
          prop === LAZY_LOADING_STATE
        ) {
          return true;
        }
        return Reflect.has(target, prop);
      },
      ownKeys(target) {
        const keys = Reflect.ownKeys(target);
        // Don't include lazy loading symbols in enumeration
        return keys.filter(
          (key) =>
            key !== LAZY_LOADING_TARGET &&
            key !== LAZY_LOADING_PROVIDER &&
            key !== LAZY_LOADING_PROXY &&
            key !== LAZY_LOADING_STATE
        );
      },
      getOwnPropertyDescriptor(target, prop) {
        if (
          prop === LAZY_LOADING_PROXY ||
          prop === LAZY_LOADING_TARGET ||
          prop === LAZY_LOADING_PROVIDER ||
          prop === LAZY_LOADING_STATE
        ) {
          return {
            configurable: true,
            enumerable: false,
            writable: false,
            value: true
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      }
    });
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
    return !!entity?.[LAZY_LOADING_PROXY];
  }
  /**
   * Get the original target entity from a lazy proxy.
   */
  static getTarget(entity) {
    if (this.isLazyProxy(entity)) {
      return entity[LAZY_LOADING_TARGET];
    }
    return entity;
  }
  /**
   * Get the loading state for a lazy proxy.
   */
  static getLoadingState(entity) {
    if (this.isLazyProxy(entity)) {
      return entity[LAZY_LOADING_STATE];
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
    if (entities.length === 0) return;
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return;
    // Group entities by whether they're already proxies
    const proxiedEntities = [];
    const nonProxiedEntities = [];
    for (const entity of entities) {
      if (this.isLazyProxy(entity)) {
        proxiedEntities.push(entity);
      } else {
        nonProxiedEntities.push(entity);
      }
    }
    // Preload for each specified property
    for (const propertyName of propertyNames) {
      const relationship = metadata.relationships.find((r) => r.propertyName === propertyName);
      if (!relationship) continue;
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
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return null;
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
        if (!parentPkProperty) return [];
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
        // TODO: Implement many-to-many lazy loading
        console.warn('Many-to-many lazy loading not yet implemented');
        return [];
      }
      default:
        return null;
    }
  }
  /**
   * Batch load relationships for multiple entities to avoid N+1 queries.
   */
  static async batchLoadRelationship(entities, entityClass, relationship, provider) {
    if (entities.length === 0) return;
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return;
    const targetCtor = this.resolveTargetEntity(relationship.targetEntity);
    switch (relationship.type) {
      case 'many-to-one':
      case 'one-to-one': {
        const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
        const fkValues = entities
          .map((e) => e[foreignKeyName])
          .filter((v) => v !== undefined && v !== null);
        const uniqueFkValues = Array.from(new Set(fkValues));
        if (uniqueFkValues.length === 0) break;
        const related = await provider.findWhereIn(
          targetCtor,
          metadata.columns.find((c) => c.propertyName === metadata.primaryKeys[0])?.columnName ||
            metadata.primaryKeys[0],
          uniqueFkValues
        );
        const relatedProxies = this.createMany(related, targetCtor, provider);
        const byId = new Map();
        const targetMeta = MetadataStorage.getEntity(targetCtor);
        const targetPk = targetMeta?.primaryKeys[0];
        if (!targetPk) break;
        for (const relatedEntity of relatedProxies) {
          const target = this.getTarget(relatedEntity);
          byId.set(target[targetPk], relatedEntity);
        }
        for (const entity of entities) {
          const fk = entity[foreignKeyName];
          if (fk !== undefined && fk !== null) {
            entity[relationship.propertyName] = byId.get(fk) || null;
            // Update loading state if it's a proxy
            const state = this.getLoadingState(entity);
            if (state) {
              state[relationship.propertyName].isLoaded = true;
              state[relationship.propertyName].isLoading = false;
            }
          }
        }
        break;
      }
      case 'one-to-many': {
        const parentPkProperty = metadata.primaryKeys[0];
        if (!parentPkProperty) break;
        const parentIds = entities
          .map((e) => e[parentPkProperty])
          .filter((v) => v !== undefined && v !== null);
        const uniqueParentIds = Array.from(new Set(parentIds));
        if (uniqueParentIds.length === 0) break;
        const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
        const related =
          (await provider.findWhereIn(targetCtor, foreignKeyName, uniqueParentIds)) || [];
        const relatedProxies = this.createMany(related, targetCtor, provider);
        const grouped = new Map();
        for (const relatedEntity of relatedProxies) {
          const target = this.getTarget(relatedEntity);
          const key = target[foreignKeyName];
          const arr = grouped.get(key) || [];
          arr.push(relatedEntity);
          grouped.set(key, arr);
        }
        for (const entity of entities) {
          const parentId = entity[parentPkProperty];
          entity[relationship.propertyName] = grouped.get(parentId) || [];
          // Update loading state if it's a proxy
          const state = this.getLoadingState(entity);
          if (state) {
            state[relationship.propertyName].isLoaded = true;
            state[relationship.propertyName].isLoading = false;
          }
        }
        break;
      }
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
/**
 * Type guard to check if an entity is a lazy loading proxy.
 */
export function isLazyProxy(entity) {
  return LazyLoadingProxy.isLazyProxy(entity);
}
/**
 * Get the original target from a lazy proxy.
 */
export function getLazyTarget(entity) {
  return LazyLoadingProxy.getTarget(entity);
}
/**
 * Utility to await lazy loading promises when accessing navigation properties.
 * Usage: await awaitLazyLoad(user.posts) to ensure posts are loaded.
 */
export async function awaitLazyLoad(propertyValue) {
  if (propertyValue instanceof Promise) {
    return await propertyValue;
  }
  return propertyValue;
}
//# sourceMappingURL=LazyLoadingProxy.js.map
