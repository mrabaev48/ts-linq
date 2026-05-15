import { SoftDeleteMiddleware } from '../src/SoftDeleteMiddleware';
import {
  withSoftDelete,
  restore,
  isSoftDeleted,
  markForHardDelete,
  isMarkedForHardDelete
} from '../src/utils';

jest.mock('@ts-linq/metadata', () => {
  const columns = new Set<string>();
  return {
    MetadataStorage: {
      getEntity: (_cls: Function) => {
        if (columns.size === 0) return undefined;
        return {
          columns: Array.from(columns.values()).map((name) => ({
            propertyName: name,
            columnName: name
          }))
        };
      },
      __setColumns: (list: string[]) => {
        columns.clear();
        for (const c of list) columns.add(c);
      }
    }
  };
});

const { MetadataStorage } = jest.requireMock('@ts-linq/metadata');

describe('plugin-soft-delete: utils', () => {
  test('withSoftDelete returns defaults merged with overrides', () => {
    const opts = withSoftDelete({ column: 'deleted', type: 'timestamp' });
    expect(opts.enabled).toBe(true);
    expect(opts.column).toBe('deleted');
    expect(opts.type).toBe('timestamp');
  });

  test('restore resets deleted flags', () => {
    const e: Record<string, unknown> = { isDeleted: true, deletedAt: new Date() };
    restore(e);
    expect(e.isDeleted).toBe(false);
    expect(e.deletedAt).toBeNull();
  });

  test('isSoftDeleted works for boolean and timestamp types', () => {
    const e1: Record<string, unknown> = { isDeleted: true };
    expect(isSoftDeleted(e1, { type: 'boolean' })).toBe(true);
    const e2: Record<string, unknown> = { deletedAt: null };
    expect(isSoftDeleted(e2, { type: 'timestamp' })).toBe(false);
    const e3: Record<string, unknown> = { deletedAt: new Date() };
    expect(isSoftDeleted(e3, { type: 'timestamp' })).toBe(true);
  });

  test('markForHardDelete / isMarkedForHardDelete', () => {
    const e: Record<string, unknown> = {};
    expect(isMarkedForHardDelete(e)).toBe(false);
    markForHardDelete(e);
    expect(isMarkedForHardDelete(e)).toBe(true);
  });
});

describe('plugin-soft-delete: SoftDeleteMiddleware', () => {
  beforeEach(() => {
    MetadataStorage.__setColumns(['isDeleted', 'deletedAt']);
  });

  test('handleSoftDelete marks entity on delete operation', async () => {
    const e: Record<string, unknown> = {};
    const mw = new SoftDeleteMiddleware();
    const handled = await mw.handleSoftDelete({
      entity: e,
      entityClass: class Post {},
      operation: 'delete',

      state: 'deleted',
    });
    expect(handled).toBe(true);
    expect(e.isDeleted).toBe(true);
    expect(e.deletedAt instanceof Date).toBe(true);
  });

  test('handleSoftDelete restores on restore operation', async () => {
    const e: Record<string, unknown> = { isDeleted: true, deletedAt: new Date() };
    const mw = new SoftDeleteMiddleware();
    const handled = await mw.handleSoftDelete({
      entity: e,
      entityClass: class Post {},
      operation: 'restore',

      state: 'modified',
    });
    expect(handled).toBe(true);
    expect(e.isDeleted).toBe(false);
    expect(e.deletedAt).toBeNull();
  });

  test('handleSoftDelete returns false when disabled or no columns', async () => {
    const e: Record<string, unknown> = {};
    const mwDisabled = new SoftDeleteMiddleware({ enabled: false });
    const r1 = await mwDisabled.handleSoftDelete({
      entity: e,
      entityClass: class A {},
      operation: 'delete',

      state: 'deleted',
    });
    expect(r1).toBe(false);
    MetadataStorage.__setColumns([]); // no meta
    const mw = new SoftDeleteMiddleware();
    const r2 = await mw.handleSoftDelete({
      entity: e,
      entityClass: class B {},
      operation: 'delete',

      state: 'deleted',
    });
    expect(r2).toBe(false);
  });

  test('isSoftDeleted mirrors options type', () => {
    const mw1 = new SoftDeleteMiddleware({ type: 'boolean' });
    expect(mw1.isSoftDeleted({ isDeleted: true })).toBe(true);
    const mw2 = new SoftDeleteMiddleware({ type: 'timestamp' });
    expect(mw2.isSoftDeleted({ deletedAt: new Date() })).toBe(true);
  });

  test('getFilterCondition builds proper condition or empty when filter disabled', () => {
    const mw1 = new SoftDeleteMiddleware({ type: 'boolean' });
    expect(mw1.getFilterCondition()).toBe('isDeleted = 0 OR isDeleted IS NULL');
    const mw2 = new SoftDeleteMiddleware({ type: 'timestamp' });
    expect(mw2.getFilterCondition()).toBe('deletedAt IS NULL');
    const mw3 = new SoftDeleteMiddleware({ filterDeleted: false });
    expect(mw3.getFilterCondition()).toBe('');
  });
});
