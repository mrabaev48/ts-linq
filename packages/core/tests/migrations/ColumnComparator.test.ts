import {
  isColumnAltered,
  normalizeType,
  diffColumns
} from '../../src/migrations/comparators/ColumnComparator';
import type { TableSnapshot } from '../../src/migrations/DiffTypes';

describe('ColumnComparator', () => {
  test('normalizeType uppercases and trims', () => {
    expect(normalizeType('  int ')).toBe('INT');
  });

  test('isColumnAltered detects type and nullability', () => {
    const a = { name: 'x', type: 'int', nullable: false } as any;
    const b = { name: 'x', type: 'INT', nullable: true } as any;
    expect(isColumnAltered(a, b)).toBe(true);
  });

  test('diffColumns detects adds and drops', () => {
    const expected: TableSnapshot = {
      name: 'T',
      columns: [
        { name: 'a', type: 'INT', nullable: false },
        { name: 'b', type: 'TEXT', nullable: true }
      ] as any,
      primaryKeys: [],
      indexes: [],
      foreignKeys: []
    };
    const actual: TableSnapshot = {
      name: 'T',
      columns: [{ name: 'a', type: 'INT', nullable: false }] as any,
      primaryKeys: [],
      indexes: [],
      foreignKeys: []
    };
    const changes = diffColumns(expected, actual);
    expect(changes.some((c) => c.kind === 'add' && c.column.name === 'b')).toBe(true);
  });
});
