import { generateMigrationFromDiff } from '../../src/migrations/DialectMigrationSql';

test('ignores index create with empty columns', () => {
  const diff = {
    tables: [
      {
        table: 'T',
        indexCreates: [
          // @ts-expect-error: intentionally invalid shape for robustness
          { name: 'i_bad', columns: [] }
        ]
      }
    ]
  } as const;
  expect(() => generateMigrationFromDiff(diff as any, 'postgresql')).not.toThrow();
  const sql = generateMigrationFromDiff(diff as any, 'postgresql').up.join('\n');
  expect(sql).not.toContain('CREATE INDEX');
});

test('ignores FK create missing columns/refColumns', () => {
  const diff = {
    tables: [
      {
        table: 'T',
        // @ts-expect-error invalid on purpose
        fkCreates: [{ name: 'fk_bad', columns: [], refTable: 'R', refColumns: [] }]
      }
    ]
  } as const;
  expect(() => generateMigrationFromDiff(diff as any, 'postgresql')).not.toThrow();
  const sql = generateMigrationFromDiff(diff as any, 'postgresql').up.join('\n');
  expect(sql).not.toContain('ADD CONSTRAINT');
});

test('unknown column change kind is ignored', () => {
  const diff = {
    tables: [
      {
        table: 'T',
        // @ts-expect-error invalid on purpose
        columnChanges: [{ kind: 'unknown', column: { name: 'a', type: 'INTEGER', nullable: true } }]
      }
    ]
  } as const;
  expect(() => generateMigrationFromDiff(diff as any, 'postgresql')).not.toThrow();
  const res = generateMigrationFromDiff(diff as any, 'postgresql');
  expect(res.up.length).toBe(0);
});

test('ignores malformed column rename', () => {
  const diff = {
    tables: [
      {
        table: 'T',
        // @ts-expect-error invalid on purpose
        columnRenames: [{ from: '', to: '' }]
      }
    ]
  } as const;
  expect(() => generateMigrationFromDiff(diff as any, 'postgresql')).not.toThrow();
  const sql = generateMigrationFromDiff(diff as any, 'postgresql').up.join('\n');
  expect(sql).not.toContain('RENAME COLUMN');
});
