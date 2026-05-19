import {
  defaultValueFor,
  getOrInitStateEntry,
  type LazyLoadingState,
  markLoaded,
  markLoading,
  resetLoading
} from '../src/loading/LazyLoadingState';

describe('LazyLoadingState helpers', () => {
  describe('getOrInitStateEntry', () => {
    it('initialises a new entry with isLoaded=false, isLoading=false', () => {
      const state: LazyLoadingState = {};
      const entry = getOrInitStateEntry(state, 'posts');
      expect(entry).toEqual({ isLoaded: false, isLoading: false });
    });

    it('returns the existing entry without overwriting it', () => {
      const state: LazyLoadingState = { posts: { isLoaded: true, isLoading: false } };
      const entry = getOrInitStateEntry(state, 'posts');
      expect(entry.isLoaded).toBe(true);
    });
  });

  describe('markLoading', () => {
    it('sets isLoading=true and stores the promise', () => {
      const state: LazyLoadingState = {};
      const p = Promise.resolve('x');
      markLoading(state, 'posts', p);
      expect(state['posts'].isLoading).toBe(true);
      expect(state['posts'].loadingPromise).toBe(p);
    });

    it('works without a promise argument', () => {
      const state: LazyLoadingState = {};
      markLoading(state, 'posts');
      expect(state['posts'].isLoading).toBe(true);
      expect(state['posts'].loadingPromise).toBeUndefined();
    });
  });

  describe('markLoaded', () => {
    it('sets isLoaded=true, isLoading=false and removes the promise', () => {
      const state: LazyLoadingState = {
        posts: { isLoaded: false, isLoading: true, loadingPromise: Promise.resolve() }
      };
      markLoaded(state, 'posts');
      expect(state['posts'].isLoaded).toBe(true);
      expect(state['posts'].isLoading).toBe(false);
      expect(state['posts'].loadingPromise).toBeUndefined();
    });
  });

  describe('resetLoading', () => {
    it('sets isLoading=false and removes the promise without touching isLoaded', () => {
      const state: LazyLoadingState = {
        posts: { isLoaded: false, isLoading: true, loadingPromise: Promise.resolve() }
      };
      resetLoading(state, 'posts');
      expect(state['posts'].isLoading).toBe(false);
      expect(state['posts'].isLoaded).toBe(false);
      expect(state['posts'].loadingPromise).toBeUndefined();
    });
  });

  describe('defaultValueFor', () => {
    it('returns [] for one-to-many', () => {
      expect(defaultValueFor({ type: 'one-to-many' } as any)).toEqual([]);
    });

    it('returns [] for many-to-many', () => {
      expect(defaultValueFor({ type: 'many-to-many' } as any)).toEqual([]);
    });

    it('returns null for many-to-one', () => {
      expect(defaultValueFor({ type: 'many-to-one' } as any)).toBeNull();
    });

    it('returns null for one-to-one', () => {
      expect(defaultValueFor({ type: 'one-to-one' } as any)).toBeNull();
    });
  });
});
