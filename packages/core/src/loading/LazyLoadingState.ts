import type { RelationshipMetadata } from '@ts-linq/types';

export interface LazyLoadingState {
  [propertyName: string]: {
    isLoaded: boolean;
    isLoading: boolean;
    loadingPromise?: Promise<unknown>;
  };
}

export function getOrInitStateEntry(
  state: LazyLoadingState,
  propName: string
): LazyLoadingState[string] {
  state[propName] ||= { isLoaded: false, isLoading: false };
  return state[propName];
}

export function markLoading(
  state: LazyLoadingState,
  propName: string,
  promise?: Promise<unknown>
): void {
  const s = getOrInitStateEntry(state, propName);
  s.isLoading = true;
  s.loadingPromise = promise;
}

export function markLoaded(state: LazyLoadingState, propName: string): void {
  const s = getOrInitStateEntry(state, propName);
  s.isLoaded = true;
  s.isLoading = false;
  delete s.loadingPromise;
}

export function resetLoading(state: LazyLoadingState, propName: string): void {
  const s = getOrInitStateEntry(state, propName);
  s.isLoading = false;
  delete s.loadingPromise;
}

export function defaultValueFor(relationship: RelationshipMetadata): unknown {
  return relationship.type === 'one-to-many' || relationship.type === 'many-to-many' ? [] : null;
}
