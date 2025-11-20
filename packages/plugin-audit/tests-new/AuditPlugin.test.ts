import { AuditMiddleware } from '../src/AuditMiddleware';
import { withAudit, getAuditInfo, hasBeenModified, timeSinceUpdate } from '../src/utils';

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

describe('plugin-audit: utils', () => {
  test('withAudit returns defaults merged with overrides', () => {
    const opts = withAudit({ createdAtColumn: 'created_on' });
    expect(opts.enabled).toBe(true);
    expect(opts.createdAtColumn).toBe('created_on');
    expect(opts.updatedAtColumn).toBe('updatedAt');
  });

  test('getAuditInfo reads fields using configured column names', () => {
    const entity: Record<string, unknown> = {
      created_on: new Date('2020-01-01T00:00:00Z'),
      updated_on: new Date('2020-01-02T00:00:00Z'),
      createdBy: 1,
      updatedBy: 2
    };
    const info = getAuditInfo(entity, {
      createdAtColumn: 'created_on',
      updatedAtColumn: 'updated_on'
    });
    expect(info.createdAt?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    expect(info.updatedAt?.toISOString()).toBe('2020-01-02T00:00:00.000Z');
    expect(info.createdBy).toBe(1);
    expect(info.updatedBy).toBe(2);
  });

  test('hasBeenModified compares updatedAt > createdAt', () => {
    const entity: Record<string, unknown> = {
      createdAt: new Date('2020-01-01T00:00:00Z'),
      updatedAt: new Date('2020-01-01T00:00:01Z')
    };
    expect(hasBeenModified(entity)).toBe(true);
    const entity2: Record<string, unknown> = {
      createdAt: new Date('2020-01-01T00:00:01Z'),
      updatedAt: new Date('2020-01-01T00:00:01Z')
    };
    expect(hasBeenModified(entity2)).toBe(false);
  });

  test('timeSinceUpdate returns ms since update or null', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-20T12:00:10Z'));
    const entity: Record<string, unknown> = { updatedAt: new Date('2025-11-20T12:00:00Z') };
    expect(timeSinceUpdate(entity)).toBe(10_000);
    expect(timeSinceUpdate({})).toBeNull();
    jest.useRealTimers();
  });
});

describe('plugin-audit: AuditMiddleware', () => {
  beforeEach(() => {
    MetadataStorage.__setColumns(['createdAt', 'updatedAt', 'createdBy', 'updatedBy']);
  });

  test('applyAudit sets createdAt/createdBy on added', async () => {
    const entity: Record<string, unknown> = {};
    const mw = new AuditMiddleware({
      clock: () => new Date('2025-01-01T00:00:00Z'),
      getCurrentUser: () => 42
    });
    await mw.applyAudit({
      entity,
      entityClass: class User {},
      state: 'added'
    });
    expect(entity.createdAt instanceof Date).toBe(true);
    expect(entity.updatedAt instanceof Date).toBe(true);
    expect(entity.createdBy).toBe(42);
    expect(entity.updatedBy).toBe(42);
  });

  test('applyAudit sets only updated* on modified', async () => {
    const entity: Record<string, unknown> = {};
    const mw = new AuditMiddleware({
      clock: () => new Date('2025-01-01T00:00:00Z'),
      getCurrentUser: () => 'u1'
    });
    await mw.applyAudit({
      entity,
      entityClass: class User {},
      state: 'modified'
    });
    expect(entity.createdAt).toBeUndefined();
    expect(entity.createdBy).toBeUndefined();
    expect(entity.updatedAt instanceof Date).toBe(true);
    expect(entity.updatedBy).toBe('u1');
  });

  test('respects custom column remapping via timeColumns/userColumns', async () => {
    MetadataStorage.__setColumns(['created_on', 'updated_on', 'c_by', 'u_by']);
    const entity: Record<string, unknown> = {};
    const mw = new AuditMiddleware({
      timeColumns: { createdAt: 'created_on', updatedAt: 'updated_on' },
      userColumns: { createdBy: 'c_by', updatedBy: 'u_by' },
      getCurrentUser: () => 7
    });
    await mw.applyAudit({
      entity,
      entityClass: class Order {},
      state: 'added'
    });
    expect(entity.created_on instanceof Date).toBe(true);
    expect(entity.updated_on instanceof Date).toBe(true);
    expect(entity.c_by).toBe(7);
    expect(entity.u_by).toBe(7);
  });

  test('does nothing if disabled', async () => {
    const entity: Record<string, unknown> = {};
    const mw = new AuditMiddleware({ enabled: false });
    await mw.applyAudit({
      entity,
      entityClass: class User {},
      state: 'added'
    });
    expect(Object.keys(entity).length).toBe(0);
  });
});
