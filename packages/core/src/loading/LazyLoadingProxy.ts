import { MetadataStorage } from '@ts-linq/metadata';

import type { DatabaseProvider } from '../DatabaseProvider';
import { type LazyLoadingState } from './LazyLoadingState';
import { LAZY_LOADING_PROXY, LAZY_LOADING_STATE, LAZY_LOADING_TARGET } from './LazyLoadingSymbols';
import { buildProxyTraps } from './LazyProxyTraps';
import { RelationshipLoader } from './RelationshipLoader';

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

  static create<T extends object>(
    entity: T,
    entityClass: new () => T,
    provider: DatabaseProvider
  ): T {
    if (this.isLazyProxy(entity)) return entity;

    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata || metadata.relationships.length === 0) return entity;

    const state: LazyLoadingState = {};
    for (const rel of metadata.relationships) {
      state[rel.propertyName] = { isLoaded: false, isLoading: false };
      const currentValue = (entity as Record<string, unknown>)[rel.propertyName];
      if (currentValue !== undefined && currentValue !== null) {
        state[rel.propertyName].isLoaded = true;
      }
    }

    const loader = new RelationshipLoader(
      provider,
      LazyLoadingProxy.create.bind(LazyLoadingProxy) as <U extends object>(
        e: U,
        ctor: new () => U,
        p: DatabaseProvider
      ) => U,
      LazyLoadingProxy.createMany.bind(LazyLoadingProxy) as <U extends object>(
        entities: U[],
        ctor: new () => U,
        p: DatabaseProvider
      ) => U[]
    );

    const traps = buildProxyTraps(
      provider,
      entityClass as unknown as new () => object,
      metadata,
      state,
      loader,
      (msg, err) => LazyLoadingProxy.getLogger().warn(msg, err)
    );

    return new Proxy(entity, traps as ProxyHandler<T>);
  }

  static createMany<T extends object>(
    entities: T[],
    entityClass: new () => T,
    provider: DatabaseProvider
  ): T[] {
    return entities.map((entity) => this.create(entity, entityClass, provider));
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

  static async preloadRelationships<T extends object>(
    entities: T[],
    entityClass: new () => T,
    propertyNames: string[],
    provider: DatabaseProvider
  ): Promise<void> {
    if (entities.length === 0) return;
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) return;

    const loader = new RelationshipLoader(
      provider,
      LazyLoadingProxy.create.bind(LazyLoadingProxy) as <U extends object>(
        e: U,
        ctor: new () => U,
        p: DatabaseProvider
      ) => U,
      LazyLoadingProxy.createMany.bind(LazyLoadingProxy) as <U extends object>(
        entities: U[],
        ctor: new () => U,
        p: DatabaseProvider
      ) => U[]
    );

    const proxiedEntities = entities.filter((e) => this.isLazyProxy(e));
    const nonProxiedEntities = entities.filter((e) => !this.isLazyProxy(e));

    for (const propertyName of propertyNames) {
      const relationship = metadata.relationships.find((r) => r.propertyName === propertyName);
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
