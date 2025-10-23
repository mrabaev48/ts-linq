import { MetadataStorage } from '@ts-linq/metadata';
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
  private static _logger?: { warn(message: string, error?: unknown): void };

  static setLogger(logger?: { warn(message: string, error?: unknown): void }): void {
    this._logger = logger;
  }

  // --- State helpers ------------------------------------------------------
  private static getOrInitStateEntry(state: LazyLoadingState, propName: string) {
    state[propName] ||= { isLoaded: false, isLoading: false };
    return state[propName];
  }

  private static markLoading(
    state: LazyLoadingState,
    propName: string,
    promise?: Promise<unknown>
  ) {
    const s = this.getOrInitStateEntry(state, propName);
    s.isLoading = true;
    s.loadingPromise = promise;
  }

  private static markLoaded(state: LazyLoadingState, propName: string) {
    const s = this.getOrInitStateEntry(state, propName);
    s.isLoaded = true;
    s.isLoading = false;
    delete s.loadingPromise;
  }

  private static resetLoading(state: LazyLoadingState, propName: string) {
    const s = this.getOrInitStateEntry(state, propName);
    s.isLoading = false;
    delete s.loadingPromise;
  }

  private static defaultValueFor(relationship: RelationshipMetadata): unknown {
    return relationship.type === 'one-to-many' || relationship.type === 'many-to-many' ? [] : null;
  }

  private static getLogger(): { warn(message: string, error?: unknown): void } {
    if (this._logger) return this._logger;
    return {
      warn: (message: string, error?: unknown) => {
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
    if (relationship) {
      const s = this.getOrInitStateEntry(state, propName);
      if (!s.isLoaded && !s.isLoading) {
        const promise = LazyLoadingProxy.loadRelationship(
          target,
          entityClass,
          relationship,
          provider
        )
          .then((result) => {
            (target as Record<string, unknown>)[propName] = result;
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
    if (relationship) this.markLoaded(state, propName);
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
        return await this.loadManyToMany(
          entity,
          entityClass,
          metadata,
          relationship,
          targetCtor,
          provider
        );
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

      case 'many-to-many': {
        await this.batchLoadManyToMany(
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
      meta.columns.find((c: any) => c.propertyName === meta.primaryKeys[0])?.columnName ||
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
      if (state) this.markLoaded(state, relationship.propertyName);
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
      if (state) this.markLoaded(state, relationship.propertyName);
    }
  }

  private static async loadManyToMany<T>(
    entity: T,
    entityClass: new () => T,
    metadata: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    relationship: RelationshipMetadata,
    targetCtor: new () => object,
    provider: DatabaseProvider
  ): Promise<unknown> {
    const sourcePk = metadata.primaryKeys[0];
    const targetPk = (MetadataStorage.getEntity(targetCtor)?.primaryKeys || [])[0];
    const through = relationship as RelationshipMetadata & {
      through?: { table: string; sourceFk?: string; targetFk?: string };
    };
    if (!through.through?.table || !sourcePk || !targetPk) return [];

    const jt = through.through.table;
    const sourceFk = through.through.sourceFk || this.defaultForeignKeyFor(entityClass);
    const targetFk = through.through.targetFk || this.defaultForeignKeyFor(targetCtor);
    const sourceId = (entity as Record<string, unknown>)[sourcePk];
    if (sourceId === undefined || sourceId === null) return [];

    const targetIds = await this.fetchTargetIdsFromJunction(
      provider,
      jt,
      sourceFk,
      targetFk,
      sourceId
    );
    if (targetIds.length === 0) return [];

    const targetCol = this.getColumnNameForPk(targetCtor, targetPk);
    const related = await provider.findWhereIn(targetCtor, targetCol, targetIds);
    return this.createMany(related, targetCtor, provider);
  }

  private static async fetchTargetIdsFromJunction(
    provider: DatabaseProvider,
    junctionTable: string,
    sourceFk: string,
    targetFk: string,
    sourceId: unknown
  ): Promise<unknown[]> {
    const rows = await provider.executeQuery<{ id: unknown }>(
      `SELECT ${targetFk} as id FROM ${junctionTable} WHERE ${sourceFk} = ?`,
      [sourceId as string | number | boolean | Date | null]
    );
    return rows.map((r) => r.id).filter((v) => v !== undefined && v !== null);
  }

  private static getColumnNameForPk(targetCtor: new () => object, targetPk: string): string {
    return (
      (MetadataStorage.getEntity(targetCtor)?.columns || []).find(
        (c) => c.propertyName === targetPk
      )?.columnName || targetPk
    );
  }

  private static async batchLoadManyToMany<T>(
    entities: T[],
    entityClass: new () => T,
    relationship: RelationshipMetadata,
    provider: DatabaseProvider,
    meta: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
    targetCtor: new () => object
  ): Promise<void> {
    const sourcePk = meta.primaryKeys[0];
    if (!sourcePk) return;
    const through = relationship as RelationshipMetadata & {
      through?: { table: string; sourceFk?: string; targetFk?: string };
    };
    if (!through.through?.table) return;
    const targetPk = (MetadataStorage.getEntity(targetCtor)?.primaryKeys || [])[0];
    if (!targetPk) return;

    const jt = through.through.table;
    const sourceFk = through.through.sourceFk || this.defaultForeignKeyFor(entityClass);
    const targetFk = through.through.targetFk || this.defaultForeignKeyFor(targetCtor);

    const sourceIds = this.extractSourceIds(entities, sourcePk);
    if (sourceIds.length === 0) return;

    const { bySource, targetIds } = await this.fetchJunctionMappings(
      provider,
      jt,
      sourceFk,
      targetFk,
      sourceIds
    );

    if (targetIds.size === 0) {
      this.assignEmptyCollections(entities, relationship.propertyName);
      return;
    }

    const relById = await this.fetchAndMapTargets(
      provider,
      targetCtor,
      targetPk,
      Array.from(targetIds)
    );
    this.assignManyToManyCollections(
      entities,
      relationship.propertyName,
      sourcePk,
      bySource,
      relById
    );
  }

  private static extractSourceIds<T>(entities: T[], sourcePk: string): unknown[] {
    const ids = entities
      .map((e) => (e as Record<string, unknown>)[sourcePk])
      .filter((v) => v !== undefined && v !== null);
    return Array.from(new Set(ids));
  }

  private static async fetchJunctionMappings(
    provider: DatabaseProvider,
    junctionTable: string,
    sourceFk: string,
    targetFk: string,
    sourceIds: unknown[]
  ): Promise<{ bySource: Map<unknown, unknown[]>; targetIds: Set<unknown> }> {
    const rows = await provider.executeQuery<{ s: unknown; t: unknown }>(
      `SELECT ${sourceFk} as s, ${targetFk} as t FROM ${junctionTable} WHERE ${sourceFk} IN (${sourceIds
        .map(() => '?')
        .join(',')})`,
      sourceIds as Array<string | number | boolean | Date | null>
    );
    const bySource = new Map<unknown, unknown[]>();
    const targetIds = new Set<unknown>();
    for (const r of rows) {
      targetIds.add(r.t);
      const arr = bySource.get(r.s) || [];
      arr.push(r.t);
      bySource.set(r.s, arr);
    }
    return { bySource, targetIds };
  }

  private static assignEmptyCollections<T>(entities: T[], propName: string): void {
    for (const entity of entities) {
      (entity as Record<string, unknown>)[propName] = [];
      const state = this.getLoadingState(entity);
      if (state) this.markLoaded(state, propName);
    }
  }

  private static async fetchAndMapTargets(
    provider: DatabaseProvider,
    targetCtor: new () => object,
    targetPk: string,
    targetIds: unknown[]
  ): Promise<Map<unknown, unknown>> {
    const targetCol = this.getColumnNameForPk(targetCtor, targetPk);
    const related = await provider.findWhereIn(targetCtor, targetCol, targetIds);
    const relProxies = this.createMany(related, targetCtor, provider);
    const relById = new Map<unknown, unknown>();
    for (const rp of relProxies) {
      const t = this.getTarget(rp);
      relById.set((t as Record<string, unknown>)[targetPk], rp);
    }
    return relById;
  }

  private static assignManyToManyCollections<T>(
    entities: T[],
    propName: string,
    sourcePk: string,
    bySource: Map<unknown, unknown[]>,
    relById: Map<unknown, unknown>
  ): void {
    for (const entity of entities) {
      const sid = (entity as Record<string, unknown>)[sourcePk];
      const idList = (bySource.get(sid) as unknown[]) || [];
      (entity as Record<string, unknown>)[propName] = idList
        .map((id) => relById.get(id))
        .filter(Boolean) as unknown;
      const state = this.getLoadingState(entity);
      if (state) this.markLoaded(state, propName);
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
