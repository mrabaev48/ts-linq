import type { MetadataSource } from '@ts-linq/types';

import type { DatabaseProvider } from '../DatabaseProvider';
import { getDefaultMetadataSource } from '../defaultMetadataSource';
import { type LazyLoadingState } from './LazyLoadingState';
import { LAZY_LOADING_PROXY, LAZY_LOADING_STATE, LAZY_LOADING_TARGET } from './LazyLoadingSymbols';
import { buildProxyTraps } from './LazyProxyTraps';
import { RelationshipLoader } from './RelationshipLoader';
import { getProp } from './support/EntityRecord';

// Re-export symbols as part of the public API
export {
  LAZY_LOADING_PROVIDER,
  LAZY_LOADING_PROXY,
  LAZY_LOADING_STATE,
  LAZY_LOADING_TARGET
} from './LazyLoadingSymbols';

export class LazyLoadingProxy {
  private static _logger?: { warn(message: string, error?: unknown): void };

  static setLogger(logger?: { warn(message: string, error?: unknown): void }): void {
    this._logger = logger;
  }

  private static getLogger(): { warn(message: string, error?: unknown): void } {
    return (
      this._logger ?? {
        warn: (message: string, error?: unknown) => console.warn(message, error)
      }
    );
  }

  /**
   * @param metadata Metadata source used to resolve relationship metadata.
   *   Defaults to the global singleton for backward compatibility; the
   *   composition root injects the per-context registry to preserve isolation.
   *
   * @deprecated Relying on the implicit global-singleton default defeats
   *   per-context isolation — pass an explicit `MetadataSource`.
   */
  static create<T extends object>(
    entity: T,
    entityClass: new () => T,
    provider: DatabaseProvider,
    metadata: MetadataSource = getDefaultMetadataSource()
  ): T {
    if (this.isLazyProxy(entity)) return entity;

    const entityMetadata = metadata.getEntity(entityClass);
    if (!entityMetadata || entityMetadata.relationships.length === 0) return entity;

    const state: LazyLoadingState = {};
    for (const rel of entityMetadata.relationships) {
      state[rel.propertyName] = { isLoaded: false, isLoading: false };
      const currentValue = getProp(entity, rel.propertyName);
      if (currentValue !== undefined && currentValue !== null) {
        state[rel.propertyName].isLoaded = true;
      }
    }

    const loader = new RelationshipLoader(
      provider,
      (<U extends object>(e: U, ctor: new () => U, p: DatabaseProvider): U =>
        LazyLoadingProxy.create(e, ctor, p, metadata)) as <U extends object>(
        e: U,
        ctor: new () => U,
        p: DatabaseProvider
      ) => U,
      (<U extends object>(entities: U[], ctor: new () => U, p: DatabaseProvider): U[] =>
        LazyLoadingProxy.createMany(entities, ctor, p, metadata)) as <U extends object>(
        entities: U[],
        ctor: new () => U,
        p: DatabaseProvider
      ) => U[],
      metadata
    );

    const traps = buildProxyTraps(
      provider,
      entityClass,
      entityMetadata,
      state,
      loader,
      (msg, err) => LazyLoadingProxy.getLogger().warn(msg, err)
    );

    return new Proxy(entity, traps as ProxyHandler<T>);
  }

  /**
   * @deprecated Relying on the implicit global-singleton default defeats
   *   per-context isolation — pass an explicit `MetadataSource`.
   */
  static createMany<T extends object>(
    entities: T[],
    entityClass: new () => T,
    provider: DatabaseProvider,
    metadata: MetadataSource = getDefaultMetadataSource()
  ): T[] {
    return entities.map((entity) => this.create(entity, entityClass, provider, metadata));
  }

  static isLazyProxy(entity: unknown): boolean {
    return !!(entity as Record<symbol, unknown>)?.[LAZY_LOADING_PROXY];
  }

  static getTarget<T>(entity: T): T {
    if (this.isLazyProxy(entity)) {
      return (entity as Record<symbol, unknown>)[LAZY_LOADING_TARGET] as T;
    }
    return entity;
  }

  static getLoadingState(entity: unknown): LazyLoadingState | null {
    if (this.isLazyProxy(entity)) {
      return (entity as Record<symbol, unknown>)[LAZY_LOADING_STATE] as LazyLoadingState;
    }
    return null;
  }

  static isRelationshipLoaded(entity: unknown, propertyName: string): boolean {
    return this.getLoadingState(entity)?.[propertyName]?.isLoaded ?? false;
  }

  /**
   * @deprecated Relying on the implicit global-singleton default defeats
   *   per-context isolation — pass an explicit `MetadataSource`.
   */
  static async preloadRelationships<T extends object>(
    entities: T[],
    entityClass: new () => T,
    propertyNames: string[],
    provider: DatabaseProvider,
    metadata: MetadataSource = getDefaultMetadataSource()
  ): Promise<void> {
    if (entities.length === 0) return;
    const entityMetadata = metadata.getEntity(entityClass);
    if (!entityMetadata) return;

    const loader = new RelationshipLoader(
      provider,
      (<U extends object>(e: U, ctor: new () => U, p: DatabaseProvider): U =>
        LazyLoadingProxy.create(e, ctor, p, metadata)) as <U extends object>(
        e: U,
        ctor: new () => U,
        p: DatabaseProvider
      ) => U,
      (<U extends object>(entities: U[], ctor: new () => U, p: DatabaseProvider): U[] =>
        LazyLoadingProxy.createMany(entities, ctor, p, metadata)) as <U extends object>(
        entities: U[],
        ctor: new () => U,
        p: DatabaseProvider
      ) => U[],
      metadata
    );

    const proxiedEntities = entities.filter((e) => this.isLazyProxy(e));
    const nonProxiedEntities = entities.filter((e) => !this.isLazyProxy(e));

    for (const propertyName of propertyNames) {
      const relationship = entityMetadata.relationships.find(
        (r) => r.propertyName === propertyName
      );
      if (!relationship) continue;

      const entitiesToLoad = proxiedEntities.filter((entity) => {
        const state = this.getLoadingState(entity);
        return state && !state[propertyName]?.isLoaded && !state[propertyName]?.isLoading;
      });

      if (entitiesToLoad.length > 0) {
        await loader.loadBatch(entitiesToLoad, entityClass, relationship);
      }
      if (nonProxiedEntities.length > 0) {
        await loader.loadBatch(nonProxiedEntities, entityClass, relationship);
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
