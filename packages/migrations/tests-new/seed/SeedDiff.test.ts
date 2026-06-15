import { OrmErrorCode, SnapshotValidationError } from '@ts-linq/types';

import { diffSeeds, topoSortSeedOps } from '../../src/seed/SeedDiff';
import type { ModelTableSnapshot } from '../../src/snapshot/model-snapshot';

function makeTable(
  name: string,
  pkColumns: string[],
  rows?: Record<string, unknown>[]
): ModelTableSnapshot {
  return {
    name,
    columns: pkColumns.map((pk) => ({
      name: pk,
      type: 'INTEGER',
      nullable: false,
      isPrimaryKey: true
    })),
    primaryKeys: pkColumns,
    indexes: [],
    ...(rows ? { seedData: rows } : {})
  };
}

describe('diffSeeds', () => {
  it('emits INSERT for rows added in current', () => {
    const prev = [makeTable('roles', ['id'])];
    const current = [makeTable('roles', ['id'], [{ id: 1, name: 'admin' }])];

    const ops = diffSeeds(prev, current);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({
      kind: 'insert',
      table: 'roles',
      pkColumns: ['id'],
      row: { id: 1, name: 'admin' }
    });
  });

  it('emits DELETE for rows removed in current', () => {
    const prev = [makeTable('roles', ['id'], [{ id: 1, name: 'admin' }])];
    const current = [makeTable('roles', ['id'])];

    const ops = diffSeeds(prev, current);
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('delete');
    expect((ops[0] as { row: unknown }).row).toEqual({ id: 1, name: 'admin' });
  });

  it('emits UPDATE for rows with changed non-PK columns', () => {
    const prev = [makeTable('roles', ['id'], [{ id: 1, name: 'admin' }])];
    const current = [makeTable('roles', ['id'], [{ id: 1, name: 'superadmin' }])];

    const ops = diffSeeds(prev, current);
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('update');
    expect((ops[0] as { row: unknown }).row).toEqual({ id: 1, name: 'superadmin' });
    expect((ops[0] as { prev: unknown }).prev).toEqual({ id: 1, name: 'admin' });
  });

  it('emits no ops when seed rows unchanged', () => {
    const rows = [{ id: 1, name: 'admin' }];
    const prev = [makeTable('roles', ['id'], rows)];
    const current = [makeTable('roles', ['id'], rows)];

    const ops = diffSeeds(prev, current);
    expect(ops).toHaveLength(0);
  });

  it('handles composite primary keys', () => {
    const prev = [makeTable('perms', ['userId', 'roleId'], [{ userId: 1, roleId: 2, level: 1 }])];
    const current = [
      makeTable(
        'perms',
        ['userId', 'roleId'],
        [
          { userId: 1, roleId: 2, level: 2 },
          { userId: 2, roleId: 3, level: 1 }
        ]
      )
    ];

    const ops = diffSeeds(prev, current);
    expect(ops).toHaveLength(2);
    expect(ops.find((op) => op.kind === 'update')).toBeTruthy();
    expect(ops.find((op) => op.kind === 'insert')).toBeTruthy();
  });

  it('throws a typed SnapshotValidationError if a seed row is missing a PK column', () => {
    const prev: ModelTableSnapshot[] = [];
    const current = [makeTable('roles', ['id'], [{ name: 'admin' }])]; // no id

    expect(() => diffSeeds(prev, current)).toThrow(SnapshotValidationError);
    try {
      diffSeeds(prev, current);
    } catch (e) {
      expect(e).toBeInstanceOf(SnapshotValidationError);
      expect((e as SnapshotValidationError).code).toBe(OrmErrorCode.SnapshotValidation);
      expect((e as SnapshotValidationError).details).toEqual({
        table: 'roles',
        missingColumns: ['id']
      });
    }
  });

  it('emits DELETE for rows from a table that no longer exists in current', () => {
    const prev = [makeTable('old_table', ['id'], [{ id: 1 }])];
    const current: ModelTableSnapshot[] = [];

    const ops = diffSeeds(prev, current);
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('delete');
  });
});

describe('topoSortSeedOps', () => {
  it('returns empty array for empty input', () => {
    expect(topoSortSeedOps([], new Map())).toEqual([]);
  });

  it('sorts inserts so referenced tables come first', () => {
    const ops = [
      { kind: 'insert' as const, table: 'orders', pkColumns: ['id'], row: { id: 1 } },
      { kind: 'insert' as const, table: 'customers', pkColumns: ['id'], row: { id: 1 } }
    ];
    // orders depends on customers
    const fkGraph = new Map([['orders', ['customers']]]);
    const sorted = topoSortSeedOps(ops, fkGraph);
    const tables = sorted.map((op) => op.table);
    expect(tables.indexOf('customers')).toBeLessThan(tables.indexOf('orders'));
  });

  it('sorts deletes in reverse dependency order (dependents before dependencies)', () => {
    const ops = [
      { kind: 'delete' as const, table: 'customers', pkColumns: ['id'], row: { id: 1 } },
      { kind: 'delete' as const, table: 'orders', pkColumns: ['id'], row: { id: 1 } }
    ];
    // orders depends on customers
    const fkGraph = new Map([['orders', ['customers']]]);
    const sorted = topoSortSeedOps(ops, fkGraph);
    const tables = sorted.map((op) => op.table);
    // orders (dependent) should be deleted before customers
    expect(tables.indexOf('orders')).toBeLessThan(tables.indexOf('customers'));
  });

  it('falls back to original order when cycle detected', () => {
    const ops = [
      { kind: 'insert' as const, table: 'a', pkColumns: ['id'], row: { id: 1 } },
      { kind: 'insert' as const, table: 'b', pkColumns: ['id'], row: { id: 1 } }
    ];
    // Circular: a depends on b, b depends on a
    const fkGraph = new Map([
      ['a', ['b']],
      ['b', ['a']]
    ]);
    // Should not throw, just return some order
    expect(() => topoSortSeedOps(ops, fkGraph)).not.toThrow();
  });
});
