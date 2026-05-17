import 'reflect-metadata';

import { describe, expect, it, jest } from '@jest/globals';

import { SoftDeleteInterceptor } from '../src/services/SoftDeleteInterceptor';

// ── Mock helpers ─────────────────────────────────────────────────────────────

function makeMeta(columns: Array<{ propertyName: string; columnName?: string }>) {
  return { columns };
}

function makeChange(entity: Record<string, unknown>) {
  return { entity, entityClass: class Entity {} };
}

function makeUpdate() {
  return jest.fn(async (_entity: Record<string, unknown>, _cls: Function): Promise<void> => {});
}

function makeCacheUpdate() {
  return jest.fn((_change: { entity: Record<string, unknown>; entityClass: Function }): void => {});
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SoftDeleteInterceptor', () => {
  describe('apply() — disabled soft delete', () => {
    it('returns false when softDelete is undefined', async () => {
      const interceptor = new SoftDeleteInterceptor(
        undefined,
        () => makeMeta([{ propertyName: 'isDeleted' }]),
        makeUpdate(),
        makeCacheUpdate()
      );
      const result = await interceptor.apply(makeChange({}));
      expect(result).toBe(false);
    });

    it('returns false when softDelete.enabled is false', async () => {
      const interceptor = new SoftDeleteInterceptor(
        { enabled: false },
        () => makeMeta([{ propertyName: 'isDeleted' }]),
        makeUpdate(),
        makeCacheUpdate()
      );
      const result = await interceptor.apply(makeChange({}));
      expect(result).toBe(false);
    });

    it('returns false when getMeta returns undefined', async () => {
      const interceptor = new SoftDeleteInterceptor(
        { enabled: true },
        () => undefined,
        makeUpdate(),
        makeCacheUpdate()
      );
      const result = await interceptor.apply(makeChange({}));
      expect(result).toBe(false);
    });

    it('returns false when entity has no soft-delete flag column', async () => {
      const interceptor = new SoftDeleteInterceptor(
        { enabled: true },
        () => makeMeta([{ propertyName: 'name' }]),
        makeUpdate(),
        makeCacheUpdate()
      );
      const result = await interceptor.apply(makeChange({ name: 'test' }));
      expect(result).toBe(false);
    });
  });

  describe('apply() — enabled soft delete with default columns', () => {
    it('sets isDeleted=true and returns true', async () => {
      const update = makeUpdate();
      const cacheUpdate = makeCacheUpdate();
      const interceptor = new SoftDeleteInterceptor(
        { enabled: true },
        () => makeMeta([{ propertyName: 'isDeleted' }]),
        update,
        cacheUpdate
      );
      const entity: Record<string, unknown> = {};
      const change = makeChange(entity);
      const result = await interceptor.apply(change);

      expect(result).toBe(true);
      expect(entity['isDeleted']).toBe(true);
    });

    it('calls executeUpdate with the entity', async () => {
      const update = makeUpdate();
      const interceptor = new SoftDeleteInterceptor(
        { enabled: true },
        () => makeMeta([{ propertyName: 'isDeleted' }]),
        update,
        makeCacheUpdate()
      );
      const change = makeChange({});
      await interceptor.apply(change);

      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(change.entity, change.entityClass);
    });

    it('calls onCacheUpdate after update', async () => {
      const cacheUpdate = makeCacheUpdate();
      const interceptor = new SoftDeleteInterceptor(
        { enabled: true },
        () => makeMeta([{ propertyName: 'isDeleted' }]),
        makeUpdate(),
        cacheUpdate
      );
      const change = makeChange({});
      await interceptor.apply(change);

      expect(cacheUpdate).toHaveBeenCalledTimes(1);
      expect(cacheUpdate).toHaveBeenCalledWith(change);
    });

    it('sets deletedAt when entity has that column', async () => {
      const before = new Date();
      const interceptor = new SoftDeleteInterceptor(
        { enabled: true },
        () => makeMeta([{ propertyName: 'isDeleted' }, { propertyName: 'deletedAt' }]),
        makeUpdate(),
        makeCacheUpdate()
      );
      const entity: Record<string, unknown> = {};
      await interceptor.apply(makeChange(entity));
      const after = new Date();

      expect(entity['isDeleted']).toBe(true);
      expect(entity['deletedAt']).toBeInstanceOf(Date);
      const deletedAt = entity['deletedAt'] as Date;
      expect(deletedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(deletedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('does not set deletedAt when entity lacks that column', async () => {
      const interceptor = new SoftDeleteInterceptor(
        { enabled: true },
        () => makeMeta([{ propertyName: 'isDeleted' }]),
        makeUpdate(),
        makeCacheUpdate()
      );
      const entity: Record<string, unknown> = {};
      await interceptor.apply(makeChange(entity));

      expect('deletedAt' in entity).toBe(false);
    });
  });

  describe('apply() — custom column names', () => {
    it('uses custom flag column name', async () => {
      const interceptor = new SoftDeleteInterceptor(
        { enabled: true, column: 'archived' },
        () => makeMeta([{ propertyName: 'archived' }]),
        makeUpdate(),
        makeCacheUpdate()
      );
      const entity: Record<string, unknown> = {};
      await interceptor.apply(makeChange(entity));

      expect(entity['archived']).toBe(true);
      expect('isDeleted' in entity).toBe(false);
    });

    it('uses custom deletedAt column name', async () => {
      const interceptor = new SoftDeleteInterceptor(
        { enabled: true, column: 'isDeleted', deletedAtColumn: 'removed_at' },
        () => makeMeta([{ propertyName: 'isDeleted' }, { propertyName: 'removed_at' }]),
        makeUpdate(),
        makeCacheUpdate()
      );
      const entity: Record<string, unknown> = {};
      await interceptor.apply(makeChange(entity));

      expect(entity['removed_at']).toBeInstanceOf(Date);
      expect('deletedAt' in entity).toBe(false);
    });

    it('matches by columnName when propertyName differs', async () => {
      const interceptor = new SoftDeleteInterceptor(
        { enabled: true },
        () => makeMeta([{ propertyName: 'is_deleted', columnName: 'isDeleted' }]),
        makeUpdate(),
        makeCacheUpdate()
      );
      const entity: Record<string, unknown> = {};
      const result = await interceptor.apply(makeChange(entity));

      expect(result).toBe(true);
      expect(entity['isDeleted']).toBe(true);
    });
  });
});
