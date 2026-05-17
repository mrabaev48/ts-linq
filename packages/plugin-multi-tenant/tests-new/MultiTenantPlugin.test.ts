import { MultiTenantMiddleware } from '../src/MultiTenantMiddleware';
import {
  createTenantScope,
  getTenantId,
  hasTenantColumn,
  setTenantId,
  withTenant
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

describe('plugin-multi-tenant: utils', () => {
  test('withTenant returns defaults merged with overrides', () => {
    const opts = withTenant({ tenantIdColumn: 'tenant_id', strictMode: false });
    expect(opts.enabled).toBe(true);
    expect(opts.tenantIdColumn).toBe('tenant_id');
    expect(opts.strictMode).toBe(false);
  });

  test('getTenantId / hasTenantColumn / setTenantId', () => {
    const e: Record<string, unknown> = {};
    expect(hasTenantColumn(e)).toBe(false);
    setTenantId(e, 'acme');
    expect(getTenantId(e)).toBe('acme');
    expect(hasTenantColumn(e)).toBe(true);
  });

  test('createTenantScope wraps async function', async () => {
    const fn = createTenantScope('t1', async () => 5);
    const v = await fn();
    expect(v).toBe(5);
  });
});

describe('plugin-multi-tenant: MultiTenantMiddleware', () => {
  beforeEach(() => {
    MetadataStorage.__setColumns(['tenantId', 'name']);
  });

  test('setTenant/getTenant/clearTenant', async () => {
    const mw = new MultiTenantMiddleware();
    mw.setTenant('t1');
    await expect(mw.getTenant()).resolves.toBe('t1');
    mw.clearTenant();
    await expect(mw.getTenant()).resolves.toBeUndefined();
  });

  test('getTenant falls back to getCurrentTenant option', async () => {
    const mw = new MultiTenantMiddleware({ getCurrentTenant: () => 123 });
    await expect(mw.getTenant()).resolves.toBe(123);
  });

  test('applyTenant sets tenant on insert/update, respects strictMode', async () => {
    const entity: Record<string, unknown> = {};
    const mw = new MultiTenantMiddleware({ strictMode: true });
    mw.setTenant('ACME');
    await mw.applyTenant({
      entity,
      entityClass: class Org {},
      operation: 'insert',

      state: 'added'
    });
    expect(entity.tenantId).toBe('ACME');
  });

  test('applyTenant throws in strictMode when no tenant available', async () => {
    const entity: Record<string, unknown> = {};
    const mw = new MultiTenantMiddleware({ strictMode: true });
    await expect(
      mw.applyTenant({
        entity,
        entityClass: class Org {},
        operation: 'insert',

        state: 'added'
      })
    ).rejects.toThrow('No tenant context available');
  });

  test('applyTenant is no-op if entity has no tenant column', async () => {
    MetadataStorage.__setColumns(['name']);
    const entity: Record<string, unknown> = {};
    const mw = new MultiTenantMiddleware({ strictMode: true });
    await mw.applyTenant({
      entity,
      entityClass: class Org {},
      operation: 'insert',

      state: 'added'
    });
    expect(Object.keys(entity).length).toBe(0);
  });

  test('getFilterCondition builds SQL or throws if strict with no tenant', async () => {
    const mw = new MultiTenantMiddleware();
    mw.setTenant(7);
    await expect(mw.getFilterCondition()).resolves.toBe('tenantId = 7');
    const mw2 = new MultiTenantMiddleware({ strictMode: true });
    await expect(mw2.getFilterCondition()).rejects.toThrow('No tenant context available');
  });

  test('getFilterCondition returns null when isolate=false', async () => {
    const mw = new MultiTenantMiddleware({ isolate: false });
    await expect(mw.getFilterCondition()).resolves.toBeNull();
  });

  test('belongsToTenant compares entity vs current tenant', async () => {
    const mw = new MultiTenantMiddleware();
    mw.setTenant('X');
    await expect(mw.belongsToTenant({ tenantId: 'X' })).resolves.toBe(true);
    await expect(mw.belongsToTenant({ tenantId: 'Y' })).resolves.toBe(false);
  });
});
