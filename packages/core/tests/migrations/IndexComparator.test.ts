import { isIndexEqual, diffIndexes } from '../../src/migrations/comparators/IndexComparator';
import type { TableSnapshot, IndexDef } from '../../src/migrations/DiffTypes';

describe('IndexComparator', () => {
  test('isIndexEqual compares columns, unique and where', () => {
    const a: IndexDef = { name: 'i1', columns: ['a'], unique: true, where: 'a > 0' };
    const b: IndexDef = { name: 'i1', columns: ['a'], unique: true, where: 'a > 0' };
    expect(isIndexEqual(a, b)).toBe(true);
    const c: IndexDef = { name: 'i1', columns: ['a'], unique: false };
    expect(isIndexEqual(a, c)).toBe(false);
  });

  test('diffIndexes detects create and drop', () => {
    const expected: TableSnapshot = {
      name: 'T',
      columns: [] as any,
      primaryKeys: [],
      indexes: [{ name: 'i1', columns: ['a'], unique: false }],
      foreignKeys: []
    };
    const actual: TableSnapshot = {
      name: 'T',
      columns: [] as any,
      primaryKeys: [],
      indexes: [{ name: 'old', columns: ['b'], unique: false }],
      foreignKeys: []
    };
    const { creates, drops } = diffIndexes(expected, actual);
    expect(creates.map((i) => i.name)).toContain('i1');
    expect(drops).toContain('old');
  });
});
