import 'reflect-metadata';

import type { LazyLoadingState } from '../src/loading/LazyLoadingState';
import {
  LAZY_LOADING_PROVIDER,
  LAZY_LOADING_PROXY,
  LAZY_LOADING_STATE,
  LAZY_LOADING_TARGET
} from '../src/loading/LazyLoadingSymbols';
import { buildProxyTraps } from '../src/loading/LazyProxyTraps';

function makeLoader(loadSingleResult: unknown = null): any {
  return {
    loadSingle: jest.fn().mockResolvedValue(loadSingleResult),
    loadBatch: jest.fn().mockResolvedValue(undefined)
  };
}

function makeMetadata(relationships: any[] = []): any {
  return {
    target: class Entity {},
    tableName: 'entities',
    primaryKeys: ['id'],
    columns: [],
    relationships
  };
}

function makeProvider(): any {
  return { findById: jest.fn() };
}

describe('buildProxyTraps', () => {
  it('get trap returns LAZY_LOADING_TARGET as the raw target object', () => {
    const target = { id: 1 };
    const state: LazyLoadingState = {};
    const traps = buildProxyTraps(
      makeProvider(),
      class E {},
      makeMetadata(),
      state,
      makeLoader(),
      jest.fn()
    );
    const proxy = new Proxy(target, traps);
    expect((proxy as any)[LAZY_LOADING_TARGET]).toBe(target);
  });

  it('get trap returns true for LAZY_LOADING_PROXY', () => {
    const target = { id: 1 };
    const state: LazyLoadingState = {};
    const traps = buildProxyTraps(
      makeProvider(),
      class E {},
      makeMetadata(),
      state,
      makeLoader(),
      jest.fn()
    );
    const proxy = new Proxy(target, traps);
    expect((proxy as any)[LAZY_LOADING_PROXY]).toBe(true);
  });

  it('get trap returns the state object for LAZY_LOADING_STATE', () => {
    const target = { id: 1 };
    const state: LazyLoadingState = { posts: { isLoaded: false, isLoading: false } };
    const traps = buildProxyTraps(
      makeProvider(),
      class E {},
      makeMetadata(),
      state,
      makeLoader(),
      jest.fn()
    );
    const proxy = new Proxy(target, traps);
    expect((proxy as any)[LAZY_LOADING_STATE]).toBe(state);
  });

  it('get trap returns the provider for LAZY_LOADING_PROVIDER', () => {
    const target = { id: 1 };
    const provider = makeProvider();
    const state: LazyLoadingState = {};
    const traps = buildProxyTraps(
      provider,
      class E {},
      makeMetadata(),
      state,
      makeLoader(),
      jest.fn()
    );
    const proxy = new Proxy(target, traps);
    expect((proxy as any)[LAZY_LOADING_PROVIDER]).toBe(provider);
  });

  it('get trap triggers loadSingle for a navigation property that is not loaded', async () => {
    const target: any = { id: 1, author: undefined };
    const state: LazyLoadingState = { author: { isLoaded: false, isLoading: false } };
    const loader = makeLoader({ id: 42, name: 'Author' });
    const relationships = [
      { propertyName: 'author', type: 'many-to-one', targetEntity: class Author {} }
    ];
    const traps = buildProxyTraps(
      makeProvider(),
      class Post {},
      makeMetadata(relationships),
      state,
      loader,
      jest.fn()
    );
    const proxy = new Proxy(target, traps);

    const promise = (proxy as any).author;
    expect(promise).toBeInstanceOf(Promise);
    expect(state['author'].isLoading).toBe(true);

    await promise;
    expect(loader.loadSingle).toHaveBeenCalledTimes(1);
  });

  it('get trap returns the same promise on repeated access while loading', () => {
    const target: any = { id: 1, author: undefined };
    const state: LazyLoadingState = { author: { isLoaded: false, isLoading: false } };
    const loader = makeLoader();
    const relationships = [
      { propertyName: 'author', type: 'many-to-one', targetEntity: class Author {} }
    ];
    const traps = buildProxyTraps(
      makeProvider(),
      class Post {},
      makeMetadata(relationships),
      state,
      loader,
      jest.fn()
    );
    const proxy = new Proxy(target, traps);

    const p1 = (proxy as any).author;
    const p2 = (proxy as any).author;
    expect(p1).toBe(p2);
    expect(loader.loadSingle).toHaveBeenCalledTimes(1);
  });

  it('set trap marks the navigation property as loaded', () => {
    const target: any = { id: 1, author: undefined };
    const state: LazyLoadingState = { author: { isLoaded: false, isLoading: false } };
    const relationships = [
      { propertyName: 'author', type: 'many-to-one', targetEntity: class Author {} }
    ];
    const traps = buildProxyTraps(
      makeProvider(),
      class Post {},
      makeMetadata(relationships),
      state,
      makeLoader(),
      jest.fn()
    );
    const proxy = new Proxy(target, traps);

    (proxy as any).author = { id: 42, name: 'Alice' };
    expect(state['author'].isLoaded).toBe(true);
  });

  it('has trap returns true for all LAZY_LOADING_* symbols', () => {
    const target = { id: 1 };
    const state: LazyLoadingState = {};
    const traps = buildProxyTraps(
      makeProvider(),
      class E {},
      makeMetadata(),
      state,
      makeLoader(),
      jest.fn()
    );
    const proxy = new Proxy(target, traps);
    expect(LAZY_LOADING_PROXY in proxy).toBe(true);
    expect(LAZY_LOADING_TARGET in proxy).toBe(true);
    expect(LAZY_LOADING_STATE in proxy).toBe(true);
    expect(LAZY_LOADING_PROVIDER in proxy).toBe(true);
  });

  it('ownKeys trap filters out LAZY_LOADING_* symbols', () => {
    const target = { id: 1, name: 'test' };
    const state: LazyLoadingState = {};
    const traps = buildProxyTraps(
      makeProvider(),
      class E {},
      makeMetadata(),
      state,
      makeLoader(),
      jest.fn()
    );
    const proxy = new Proxy(target, traps);
    const keys = Reflect.ownKeys(proxy);
    expect(keys).toContain('id');
    expect(keys).toContain('name');
    expect(keys).not.toContain(LAZY_LOADING_PROXY);
    expect(keys).not.toContain(LAZY_LOADING_STATE);
  });
});
