import { MetadataStorage } from '@ts-linq/core';
import type { DatabaseProvider, RelationshipMetadata } from '@ts-linq/core';

export const LAZY_LOADING_TARGET = Symbol('lazyLoadingTarget');
export const LAZY_LOADING_PROVIDER = Symbol('lazyLoadingProvider');
export const LAZY_LOADING_PROXY = Symbol('lazyLoadingProxy');
export const LAZY_LOADING_STATE = Symbol('lazyLoadingState');

interface LazyLoadingState {
  [propertyName: string]: {
    isLoaded: boolean;
    isLoading: boolean;
    loadingPromise?: Promise<unknown>;
  };
}

export class LazyLoadingProxy {
  private static _logger?: { warn(message: string, error?: unknown): void };
  static setLogger(logger?: { warn(message: string, error?: unknown): void }): void {
    this._logger = logger;
  }
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
    return { warn: (message: string, error?: unknown) => console.warn(message, error) };
  }
  static create<T extends object>(
    entity: T,
    entityClass: new () => T,
    provider: DatabaseProvider
  ): T {
    if (this.isLazyProxy(entity)) return entity;
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata || metadata.relationships.length === 0) return entity;
    const state: LazyLoadingState = {};
    for (const relationship of metadata.relationships) {
      state[relationship.propertyName] = { isLoaded: false, isLoading: false };
      const currentValue = (entity as Record<string, unknown>)[relationship.propertyName];
      if (currentValue !== undefined && currentValue !== null)
        state[relationship.propertyName].isLoaded = true;
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
      if (s.isLoading) return s.loadingPromise;
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
        if (foreignKeyValue === undefined || foreignKeyValue === null) return null;
        const relatedEntity = await provider.findById(foreignKeyValue, targetCtor);
        return relatedEntity ? this.create(relatedEntity, targetCtor, provider) : null;
      }
      case 'one-to-many': {
        const parentPkProperty = metadata.primaryKeys[0];
        if (!parentPkProperty) return [];
        const parentPkValue = (entity as Record<string, unknown>)[parentPkProperty];
        if (parentPkValue === undefined || parentPkValue === null) return [];
        const foreignKeyName = relationship.foreignKey || this.defaultForeignKeyFor(entityClass);
        const relatedEntities = await provider.findWhere(targetCtor, {
          [foreignKeyName]: parentPkValue
        });
        return this.createMany(relatedEntities, targetCtor, provider);
      }
      case 'many-to-many': {
        // Through table with sourceFk and targetFk
        const parentPkProperty = metadata.primaryKeys[0];
        if (!parentPkProperty) return [];
        const parentPkValue = (entity as Record<string, unknown>)[parentPkProperty];
        if (parentPkValue === undefined || parentPkValue === null) return [];
        const through = (
          relationship as unknown as {
            through?: { table: string; sourceFk: string; targetFk: string };
          }
        ).through;
        if (!through) return [];
        const { table, sourceFk, targetFk } = through;
        // Fetch target ids from the join table
        const rows = await provider.executeQuery<{ id: unknown }>(
          `SELECT ${targetFk} as id FROM ${table} WHERE ${sourceFk} = ?`,
          [parentPkValue as unknown]
        );
        const targetIds = rows.map((r) => r.id);
        if (targetIds.length === 0) return [];
        const targetMeta = MetadataStorage.getEntity(targetCtor);
        const targetPk = targetMeta?.primaryKeys?.[0] ?? 'id';
        const related = await provider.findWhereIn(targetCtor, targetPk, targetIds);
        return this.createMany(related, targetCtor, provider);
      }
      default:
        return null;
    }
  }
  private static resolveTargetEntity(target: Function | (() => Function)) {
    const maybeCtor = target as { prototype?: unknown } | (() => Function);
    if (typeof maybeCtor === 'function' && 'prototype' in maybeCtor && maybeCtor.prototype)
      return maybeCtor;
    return (target as () => Function)();
  }
  private static defaultForeignKeyFor(type: Function): string {
    const name = type.name || 'id';
    const camel = name.charAt(0).toLowerCase() + name.slice(1);
    return `${camel}Id`;
  }
  static createMany<T extends object>(
    entities: T[],
    entityClass: new () => T,
    provider: DatabaseProvider
  ): T[] {
    return entities.map((entity) => this.create(entity, entityClass, provider));
  }
  static isLazyProxy(entity: unknown): boolean {
    return !!(entity as Record<string, unknown>)?.[LAZY_LOADING_PROXY as unknown as string];
  }
  static getTarget<T>(entity: T): T {
    if (this.isLazyProxy(entity)) {
      return (entity as Record<string, unknown>)[LAZY_LOADING_TARGET as unknown as string] as T;
    }
    return entity;
  }
  static getLoadingState(entity: unknown): LazyLoadingState | null {
    if (this.isLazyProxy(entity)) {
      return (entity as Record<string, unknown>)[
        LAZY_LOADING_STATE as unknown as string
      ] as LazyLoadingState;
    }
    return null;
  }
  static isRelationshipLoaded(entity: unknown, propertyName: string): boolean {
    const state = this.getLoadingState(entity);
    return state?.[propertyName]?.isLoaded ?? false;
  }

  /**
   * Preload specified relationships for a collection of entities in batches.
   * Supports one-to-many batching via findWhereIn; other types fall back to per-entity.
   */
  static async preloadRelationships<T extends object>(
    entities: Array<T>,
    entityClass: new () => T,
    includes: string[],
    provider: DatabaseProvider
  ): Promise<void> {
    if (!entities.length || !includes.length) return;
    const meta = MetadataStorage.getEntity(entityClass);
    if (!meta) return;
    const pk = meta.primaryKeys[0];
    if (!pk) return;

    for (const include of includes) {
      const rel = meta.relationships.find((r) => r.propertyName === include);
      if (!rel) continue;
      const targetCtor = this.resolveTargetEntity(rel.targetEntity) as new () => object;
      if (rel.type === 'one-to-many') {
        const ids = entities
          .map((e) => (e as Record<string, unknown>)[pk])
          .filter((v) => v !== undefined && v !== null) as unknown[];
        if (ids.length === 0) continue;
        const foreignKeyName = rel.foreignKey || this.defaultForeignKeyFor(entityClass);
        const rows = await provider.findWhereIn(targetCtor, foreignKeyName, ids);
        // group by fk
        const groups = new Map<unknown, object[]>();
        for (const row of rows) {
          const fkValue = (row as Record<string, unknown>)[foreignKeyName];
          if (!groups.has(fkValue)) groups.set(fkValue, []);
          groups.get(fkValue)!.push(row);
        }
        for (const entity of entities) {
          const id = (entity as Record<string, unknown>)[pk];
          const related = groups.get(id) ?? [];
          const proxied = this.createMany(related, targetCtor, provider);
          (entity as Record<string, unknown>)[include] = proxied as unknown;
        }
      } else {
        // Fallback per-entity loading
        for (const entity of entities) {
          const value = await this.loadRelationship(entity, entityClass, rel, provider);
          (entity as Record<string, unknown>)[include] = value;
        }
      }
    }
  }
}

export function isLazyProxy<T>(entity: T): entity is T & { [LAZY_LOADING_PROXY]: true } {
  return LazyLoadingProxy.isLazyProxy(entity);
}
export function getLazyTarget<T>(entity: T): T {
  return LazyLoadingProxy.getTarget(entity);
}
export async function awaitLazyLoad<T>(propertyValue: T | Promise<T>): Promise<T> {
  if (propertyValue instanceof Promise) return await propertyValue;
  return propertyValue;
}
