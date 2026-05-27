import { describe, expect, it } from '@jest/globals';

import { ModelSnapshotDiff } from '../../src/snapshot/diff';
import type { ModelSnapshot } from '../../src/snapshot/model-snapshot';

function makeSnapshot(
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; nullable: boolean; isPrimaryKey: boolean }>;
    primaryKeys?: string[];
  }>
): ModelSnapshot {
  return {
    version: 1,
    tables: tables.map((t) => ({
      name: t.name,
      columns: t.columns,
      primaryKeys: t.primaryKeys ?? [],
      indexes: []
    }))
  };
}

describe('ModelSnapshotDiff', () => {
  const differ = new ModelSnapshotDiff();

  describe('identical snapshots', () => {
    it('returns no differences for identical snapshots', () => {
      const snap = makeSnapshot([
        {
          name: 'users',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }],
          primaryKeys: ['id']
        }
      ]);

      const result = differ.compare(snap, snap);

      expect(result.hasDifferences).toBe(false);
      expect(result.tableDiffs).toHaveLength(0);
    });
  });

  describe('table-level changes', () => {
    it('detects an added table', () => {
      const before = makeSnapshot([]);
      const after = makeSnapshot([
        {
          name: 'users',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }]
        }
      ]);

      const result = differ.compare(before, after);

      expect(result.hasDifferences).toBe(true);
      const diff = result.tableDiffs.find((d) => d.table === 'users');
      expect(diff?.kind).toBe('added');
    });

    it('detects a removed table', () => {
      const before = makeSnapshot([
        {
          name: 'users',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }]
        }
      ]);
      const after = makeSnapshot([]);

      const result = differ.compare(before, after);

      expect(result.hasDifferences).toBe(true);
      const diff = result.tableDiffs.find((d) => d.table === 'users');
      expect(diff?.kind).toBe('removed');
    });
  });

  describe('column-level changes', () => {
    it('detects an added column', () => {
      const before = makeSnapshot([
        {
          name: 'users',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }]
        }
      ]);
      const after = makeSnapshot([
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
            { name: 'email', type: 'TEXT', nullable: true, isPrimaryKey: false }
          ]
        }
      ]);

      const result = differ.compare(before, after);

      expect(result.hasDifferences).toBe(true);
      const tableDiff = result.tableDiffs.find((d) => d.table === 'users');
      expect(tableDiff?.kind).toBe('changed');

      const colDiff = tableDiff?.columnDiffs?.find((c) => c.column === 'email');
      expect(colDiff?.kind).toBe('added');
    });

    it('detects a removed column', () => {
      const before = makeSnapshot([
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
            { name: 'email', type: 'TEXT', nullable: true, isPrimaryKey: false }
          ]
        }
      ]);
      const after = makeSnapshot([
        {
          name: 'users',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }]
        }
      ]);

      const result = differ.compare(before, after);

      const tableDiff = result.tableDiffs.find((d) => d.table === 'users');
      const colDiff = tableDiff?.columnDiffs?.find((c) => c.column === 'email');
      expect(colDiff?.kind).toBe('removed');
    });

    it('detects a column type change', () => {
      const before = makeSnapshot([
        {
          name: 'users',
          columns: [{ name: 'age', type: 'INTEGER', nullable: true, isPrimaryKey: false }]
        }
      ]);
      const after = makeSnapshot([
        {
          name: 'users',
          columns: [{ name: 'age', type: 'TEXT', nullable: true, isPrimaryKey: false }]
        }
      ]);

      const result = differ.compare(before, after);

      const tableDiff = result.tableDiffs.find((d) => d.table === 'users');
      const colDiff = tableDiff?.columnDiffs?.find((c) => c.column === 'age');
      expect(colDiff?.kind).toBe('changed');
      expect(colDiff?.before?.type).toBe('INTEGER');
      expect(colDiff?.after?.type).toBe('TEXT');
    });

    it('detects nullable change', () => {
      const before = makeSnapshot([
        {
          name: 'users',
          columns: [{ name: 'name', type: 'TEXT', nullable: true, isPrimaryKey: false }]
        }
      ]);
      const after = makeSnapshot([
        {
          name: 'users',
          columns: [{ name: 'name', type: 'TEXT', nullable: false, isPrimaryKey: false }]
        }
      ]);

      const result = differ.compare(before, after);

      const tableDiff = result.tableDiffs.find((d) => d.table === 'users');
      const colDiff = tableDiff?.columnDiffs?.find((c) => c.column === 'name');
      expect(colDiff?.kind).toBe('changed');
    });
  });

  describe('complex scenarios', () => {
    it('reports multiple table changes in one diff', () => {
      const before = makeSnapshot([
        {
          name: 'users',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }]
        },
        {
          name: 'posts',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }]
        }
      ]);
      const after = makeSnapshot([
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
            { name: 'email', type: 'TEXT', nullable: true, isPrimaryKey: false }
          ]
        },
        {
          name: 'comments',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true }]
        }
      ]);

      const result = differ.compare(before, after);

      expect(result.hasDifferences).toBe(true);
      // users changed (email added), posts removed, comments added
      expect(result.tableDiffs.length).toBeGreaterThanOrEqual(3);
    });
  });
});
