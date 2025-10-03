import { generateMigrationFromDiff } from '../../src/migrations/DialectMigrationSql';

test('MigrationSqlBuilder order: rename → indexes → fks → columns → columnRenames', () => {
  const diff = {
    tables: [
      {
        table: 'Old',
        renameTo: 'New',
        // no create/drop to pass through the whole chain
        indexCreates: [{ name: 'idx_c', columns: ['c'] }],
        indexDrops: ['idx_old'],
        fkCreates: [{ columns: ['userId'], refTable: 'Users', refColumns: ['id'] }],
        fkDrops: ['fk_old'],
        columnChanges: [{ kind: 'add', column: { name: 'age', type: 'INTEGER', nullable: true } }],
        columnRenames: [{ from: 'oldCol', to: 'newCol' }]
      }
    ]
  } as const;

  const up = generateMigrationFromDiff(diff as any, 'postgresql').up;

  const iRename = up.findIndex((s) => s.includes('RENAME TO'));
  const iCreateIdx = up.findIndex((s) => s.includes('CREATE INDEX'));
  const iDropIdx = up.findIndex((s) => s.includes('DROP INDEX'));
  const iAddFk = up.findIndex((s) => s.includes('ADD CONSTRAINT') || s.includes('ADD FOREIGN KEY'));
  const iDropFk = up.findIndex((s) => s.includes('DROP CONSTRAINT') && s.includes('fk_old'));
  const iColChange = up.findIndex((s) => s.includes('ADD COLUMN') && s.includes('age'));
  const iColRename = up.findIndex((s) => s.includes('RENAME COLUMN') && s.includes('oldCol'));

  expect(iRename).toBeGreaterThanOrEqual(0);
  expect(iCreateIdx).toBeGreaterThan(iRename);
  expect(iDropIdx).toBeGreaterThan(iCreateIdx);
  expect(iAddFk).toBeGreaterThan(iDropIdx);
  expect(iDropFk).toBeGreaterThan(iAddFk);
  expect(iColChange).toBeGreaterThan(iDropFk);
  expect(iColRename).toBeGreaterThan(iColChange);
});
