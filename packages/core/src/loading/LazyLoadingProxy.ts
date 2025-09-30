import { MetadataStorage } from '../metadata/MetadataStorage';
import type { DatabaseProvider } from '../DatabaseProvider';
import type { RelationshipMetadata } from '../types';

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
 * Interface for lazy loading state tracking
 */
interface LazyLoadingState {
  [propertyName: string]: {
    isLoaded: boolean;
    isLoading: boolean;
    loadingPromise?: Promise<unknown>;
  };
}

/**
 * Entity Framework-style lazy loading implementation using ES6 Proxies.
 * Automatically loads related entities when navigation properties are first accessed.
 */
export class LazyLoadingProxy {
  /**
   * Create a lazy loading proxy for an entity.
   * When navigation properties are accessed, they will be automatically loaded from the database.
   */
  static create<T extends object>(
    entity: T,
    entityClass: new () => T,
    provider: DatabaseProvider
  ): T {
    if (this.isLazyProxy(entity)) {
      return entity; // Already a lazy proxy
    }

    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata || metadata.relationships.length === 0) {
      return entity; // No relationships to lazy load
    }

    // Initialize lazy loading state
    const state: LazyLoadingState = {};
    for (const relationship of metadata.relationships) {
      state[relationship.propertyName] = {
        isLoaded: false,
        isLoading: false
      };

      // Check if property is already loaded (has non-null value)
      const currentValue = (entity as Record<string, unknown>)[relationship.propertyName];
      if (currentValue !== undefined && currentValue !== null) {
        state[relationship.propertyName].isLoaded = true;
      }
    }

    return new Proxy(entity, {
      get: (target, prop, receiver) =>
        LazyLoadingProxy.proxyGet(target, prop, receiver, provider, entityClass, metadata, state),
      set: (target, prop, value, receiver) =>
        LazyLoadingProxy.proxySet(target, prop, value, receiver, metadata, state),
      has: (target, prop) => LazyLoadingProxy.proxyHas(target, prop),
      ownKeys: (target) => LazyLoadingProxy.proxyOwnKeys(target),
      getOwnPropertyDescriptor: (target, prop) =>
        LazyLoadingProxy.proxyGetOwnPropertyDescriptor(target, prop)
    });
  }

  private static proxyGet(
    target: object,
    prop: PropertyKey,
    receiver: unknown,
    provider: DatabaseProvider,
    entityClass: new () => object,
    metadata: ReturnType<typeof MetadataStorage.getEntity>,
    state: LazyLoadingState
  ): unknown {
    if (prop === LAZY_LOADING_TARGET) return target;
    if (prop === LAZY_LOADING_PROVIDER) return provider;
    if (prop === LAZY_LOADING_PROXY) return true;
    if (prop === LAZY_LOADING_STATE) return state;

    const propName = String(prop);
    const relationship = metadata!.relationships.find((r) => r.propertyName === propName);
    if (relationship && !state[propName].isLoaded && !state[propName].isLoading) {
      state[propName].isLoading = true;
      state[propName].loadingPromise = LazyLoadingProxy.loadRelationship(
        target,
        entityClass,
        relationship,
        provider
      )
        .then((result) => {
          (target as Record<string, unknown>)[propName] = result;
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
      return state[propName].loadingPromise;
    }
    if (relationship && state[propName].isLoading) {
      return state[propName].loadingPromise;
    }
    return Reflect.get(target, prop, receiver);
  }

  private static proxySet(
    target: object,
    prop: PropertyKey,
    value: unknown,
    receiver: unknown,
    metadata: ReturnType<typeof MetadataStorage.getEntity>,
    state: LazyLoadingState
  ): boolean {
    const propName = String(prop);
    const relationship = metadata!.relationships.find((r) => r.propertyName === propName);
    if (relationship) {
      state[propName].isLoaded = true;
      state[propName].isLoading = false;
      delete state[propName].loadingPromise;
    }
    return Reflect.set(target, prop, value, receiver as object);
  }

  private static proxyHas(target: object, prop: PropertyKey): boolean {
    if (
      prop === LAZY_LOADING_PROXY ||
      prop === LAZY_LOADING_TARGET ||
      prop === LAZY_LOADING_PROVIDER ||
      prop === LAZY_LOADING_STATE
    ) {
      return true;
    }
    return Reflect.has(target, prop);
  }

  private static proxyOwnKeys(target: object): Array<string | symbol> {
    const keys = Reflect.ownKeys(target);
    return keys.filter(
      (key) =>
        key !== LAZY_LOADING_TARGET &&
        key !== LAZY_LOADING_PROVIDER &&
        key !== LAZY_LOADING_PROXY &&
        key !== LAZY_LOADING_STATE
    );
  }

  private static proxyGetOwnPropertyDescriptor(
    target: object,
    prop: PropertyKey
  ): PropertyDescriptor | undefined {
    if (
      prop === LAZY_LOADING_PROXY ||
      prop === LAZY_LOADING_TARGET ||
      prop === LAZY_LOADING_PROVIDER ||
      prop === LAZY_LOADING_STATE
    ) {
      return { configurable: true, enumerable: false, writable: false, value: true };
    }
    return Reflect.getOwnPropertyDescriptor(target, prop);
  }

  /**
   * Create lazy loading proxies for multiple entities.
   */
  static createMany<T extends object>(
    entities: T[],
    entityClass: new () => T,
    provider: DatabaseProvider
  ): T[] {
    return entities.map((entity) => this.create(entity, entityClass, provider));
  }

  /**
   * Check if an entity is a lazy loading proxy.
   */
  static isLazyProxy(entity: unknown): boolean {
    return !!(entity as Record<string, unknown>)?.[LAZY_LOADING_PROXY as unknown as string];
  }

  /**
   * Get the original target entity from a lazy proxy.
   */
  static getTarget<T>(entity: T): T {
    if (this.isLazyProxy(entity)) {
      return (entity as Record<string, unknown>)[LAZY_LOADING_TARGET as unknown as string] as T;
    }
    return entity;
  }

  /**
   * Get the loading state for a lazy proxy.
   */
  static getLoadingState(entity: unknown): LazyLoadingState | null {
    if (this.isLazyProxy(entity)) {
      return (entity as Record<string, unknown>)[
        LAZY_LOADING_STATE as unknown as string
      ] as LazyLoadingState;
    }
    return null;
  }

  /**
   * Check if a specific relationship property is loaded.
   */
  static isRelationshipLoaded(entity: unknown, propertyName: string): boolean {
    const state = this.getLoadingState(entity);
    return state?.[propertyName]?.isLoaded ?? false;
  }

  /**
   * Preload specific relationships to avoid N+1 queries.
   */
  static async preloadRelationships<T extends object>(
    entities: T[],
    entityClass: new () => T,
    propertyNames: string[],
    provider: DatabaseProvider
  ): Promise<void> {
    if (entities.length === 0) return;

    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return;

    // Group entities by whether they're already proxies
    const proxiedEntities: T[] = [];
    const nonProxiedEntities: T[] = [];

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
  private static async loadRelationship<T>(
    entity: T,
    entityClass: new () => T,
    relationship: RelationshipMetadata,
    provider: DatabaseProvider
  ): Promise<unknown> {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return null;

    const targetCtor = this.resolveTargetEntity(relationship.targetEntity) as new () => object;

    switch (relationship.type) {
      case 'many-to-one':
      case 'one-to-one': {
        const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
        const foreignKeyValue = (entity as Record<string, unknown>)[foreignKeyName];

        if (foreignKeyValue === undefined || foreignKeyValue === null) {
          return null;
        }

        const relatedEntity = await provider.findById(foreignKeyValue, targetCtor);
        return relatedEntity ? this.create(relatedEntity, targetCtor, provider) : null;
      }

      case 'one-to-many': {
        const parentPkProperty = metadata.primaryKeys[0];
        if (!parentPkProperty) return [];

        const parentPkValue = (entity as Record<string, unknown>)[parentPkProperty];
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
  private static async batchLoadRelationship<T>(
    entities: T[],
    entityClass: new () => T,
    relationship: RelationshipMetadata,
    provider: DatabaseProvider
  ): Promise<void> {
    if (entities.length === 0) return;

    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return;

    const targetCtor = this.resolveTargetEntity(relationship.targetEntity) as new () => object;

    switch (relationship.type) {
      case 'many-to-one':
      case 'one-to-one': {
        await this.batchLoadToOne(entities, relationship, provider, metadata, targetCtor);
        break;
      }

      case 'one-to-many': {
        await this.batchLoadOneToMany(
          entities,
          entityClass,
          relationship,
          provider,
          metadata,
          targetCtor
        );
        break;
      }
    }
  }

  private static async batchLoadToOne<T>(
    entities: T[],
    relationship: RelationshipMetadata,
    provider: DatabaseProvider,
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    targetCtor: new () => object
  ): Promise<void> {
    const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(targetCtor);
    const fkValues = entities
      .map((e) => (e as Record<string, unknown>)[foreignKeyName])
      .filter((v) => v !== undefined && v !== null);
    const uniqueFkValues = Array.from(new Set(fkValues));
    if (uniqueFkValues.length === 0) return;

    const targetPkColumn =
      meta.columns.find((c) => c.propertyName === meta.primaryKeys[0])?.columnName ||
      meta.primaryKeys[0];
    const related = await provider.findWhereIn(targetCtor, targetPkColumn, uniqueFkValues);
    const relatedProxies = this.createMany(related, targetCtor, provider);

    const byId = new Map();
    const targetMeta = MetadataStorage.getEntity(targetCtor);
    const targetPk = targetMeta?.primaryKeys[0];
    if (!targetPk) return;
    for (const relatedEntity of relatedProxies) {
      const t = this.getTarget(relatedEntity);
      byId.set((t as Record<string, unknown>)[targetPk], relatedEntity);
    }

    for (const entity of entities) {
      const fk = (entity as Record<string, unknown>)[foreignKeyName];
      if (fk === undefined || fk === null) continue;
      (entity as Record<string, unknown>)[relationship.propertyName] =
        (byId.get(fk) as unknown) || null;
      const state = this.getLoadingState(entity);
      if (state) {
        state[relationship.propertyName].isLoaded = true;
        state[relationship.propertyName].isLoading = false;
      }
    }
  }

  private static async batchLoadOneToMany<T>(
    entities: T[],
    entityClass: new () => T,
    relationship: RelationshipMetadata,
    provider: DatabaseProvider,
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    targetCtor: new () => object
  ): Promise<void> {
    const parentPkProperty = meta.primaryKeys[0];
    if (!parentPkProperty) return;
    const parentIds = entities
      .map((e) => (e as Record<string, unknown>)[parentPkProperty])
      .filter((v) => v !== undefined && v !== null);
    const uniqueParentIds = Array.from(new Set(parentIds));
    if (uniqueParentIds.length === 0) return;

    const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
    const related = (await provider.findWhereIn(targetCtor, foreignKeyName, uniqueParentIds)) || [];
    const relatedProxies = this.createMany(related, targetCtor, provider);

    const grouped = new Map<unknown, unknown[]>();
    for (const relatedEntity of relatedProxies) {
      const t = this.getTarget(relatedEntity);
      const key = (t as Record<string, unknown>)[foreignKeyName];
      const arr = grouped.get(key) || [];
      arr.push(relatedEntity);
      grouped.set(key, arr);
    }

    for (const entity of entities) {
      const parentId = (entity as Record<string, unknown>)[parentPkProperty];
      (entity as Record<string, unknown>)[relationship.propertyName] =
        (grouped.get(parentId) as unknown) || [];
      const state = this.getLoadingState(entity);
      if (state) {
        state[relationship.propertyName].isLoaded = true;
        state[relationship.propertyName].isLoading = false;
      }
    }
  }

  /**
   * Resolve a relationship target entity.
   */
  private static resolveTargetEntity(target: Function | (() => Function)) {
    const maybeCtor = target as { prototype?: unknown } | (() => Function);
    if (typeof maybeCtor === 'function' && 'prototype' in maybeCtor && maybeCtor.prototype) {
      return maybeCtor;
    }
    return (target as () => Function)();
  }

  /**
   * Generate default foreign key name.
   */
  private static defaultForeignKeyFor(type: Function): string {
    const name = type.name || 'id';
    const camel = name.charAt(0).toLowerCase() + name.slice(1);
    return `${camel}Id`;
  }
}

/**
 * Type guard to check if an entity is a lazy loading proxy.
 */
export function isLazyProxy<T>(entity: T): entity is T & { [LAZY_LOADING_PROXY]: true } {
  return LazyLoadingProxy.isLazyProxy(entity);
}

/**
 * Get the original target from a lazy proxy.
 */
export function getLazyTarget<T>(entity: T): T {
  return LazyLoadingProxy.getTarget(entity);
}

/**
 * Utility to await lazy loading promises when accessing navigation properties.
 * Usage: await awaitLazyLoad(user.posts) to ensure posts are loaded.
 */
export async function awaitLazyLoad<T>(propertyValue: T | Promise<T>): Promise<T> {
  if (propertyValue instanceof Promise) {
    return await propertyValue;
  }
  return propertyValue;
}
