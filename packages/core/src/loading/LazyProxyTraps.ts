import type { MetadataStorage } from '@ts-linq/metadata';
import type { RelationshipMetadata } from '@ts-linq/types';

import type { DatabaseProvider } from '../DatabaseProvider';
import {
  defaultValueFor,
  getOrInitStateEntry,
  type LazyLoadingState,
  markLoaded,
  markLoading,
  resetLoading
} from './LazyLoadingState';
import {
  LAZY_LOADING_PROVIDER,
  LAZY_LOADING_PROXY,
  LAZY_LOADING_STATE,
  LAZY_LOADING_TARGET
} from './LazyLoadingSymbols';
import type { RelationshipLoader } from './RelationshipLoader';

export function buildProxyTraps(
  provider: DatabaseProvider,
  entityClass: new () => object,
  metadata: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
  state: LazyLoadingState,
  loader: RelationshipLoader,
  logWarn: (message: string, error?: unknown) => void
): ProxyHandler<object> {
  return {
    get: (target, prop, receiver) =>
      proxyGet(target, prop, receiver, provider, entityClass, metadata, state, loader, logWarn),
    set: (target, prop, value, receiver) =>
      proxySet(target, prop, value, receiver, metadata, state),
    has: (target, prop) => proxyHas(target, prop),
    ownKeys: (target) => proxyOwnKeys(target),
    getOwnPropertyDescriptor: (target, prop) => proxyGetOwnPropertyDescriptor(target, prop)
  };
}

function proxyGet(
  target: object,
  prop: PropertyKey,
  receiver: unknown,
  provider: DatabaseProvider,
  entityClass: new () => object,
  metadata: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
  state: LazyLoadingState,
  loader: RelationshipLoader,
  logWarn: (message: string, error?: unknown) => void
): unknown {
  if (prop === LAZY_LOADING_TARGET) return target;
  if (prop === LAZY_LOADING_PROVIDER) return provider;
  if (prop === LAZY_LOADING_PROXY) return true;
  if (prop === LAZY_LOADING_STATE) return state;

  const propName = String(prop);
  const relationship = metadata.relationships.find(
    (r: RelationshipMetadata) => r.propertyName === propName
  );

  if (relationship) {
    const s = getOrInitStateEntry(state, propName);
    if (!s.isLoaded && !s.isLoading) {
      const promise = loader
        .loadSingle(target, entityClass, relationship)
        .then((result) => {
          (target as Record<string, unknown>)[propName] = result;
          markLoaded(state, propName);
          return result;
        })
        .catch((error) => {
          logWarn(`Failed to lazy load ${propName}:`, error);
          resetLoading(state, propName);
          return defaultValueFor(relationship);
        });
      markLoading(state, propName, promise);
      return promise;
    }
    if (s.isLoading) return s.loadingPromise;
  }

  return Reflect.get(target, prop, receiver);
}

function proxySet(
  target: object,
  prop: PropertyKey,
  value: unknown,
  receiver: unknown,
  metadata: NonNullable<ReturnType<typeof MetadataStorage.getEntity>>,
  state: LazyLoadingState
): boolean {
  const propName = String(prop);
  const relationship = metadata.relationships.find(
    (r: RelationshipMetadata) => r.propertyName === propName
  );
  if (relationship) markLoaded(state, propName);
  return Reflect.set(target, prop, value, receiver);
}

function proxyHas(target: object, prop: PropertyKey): boolean {
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

function proxyOwnKeys(target: object): Array<string | symbol> {
  return Reflect.ownKeys(target).filter(
    (key) =>
      key !== LAZY_LOADING_TARGET &&
      key !== LAZY_LOADING_PROVIDER &&
      key !== LAZY_LOADING_PROXY &&
      key !== LAZY_LOADING_STATE
  );
}

function proxyGetOwnPropertyDescriptor(
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
