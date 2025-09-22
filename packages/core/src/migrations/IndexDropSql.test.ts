import { generateMigrationFromDiff } from './DialectMigrationSql';

const diff = {
  tables: [
    {
      table: 'Users',
      indexDrops: ['idx_users_active']
    }
  ]
} as const;

test('DROP INDEX SQL is dialect-specific', () => {
  const pg = generateMigrationFromDiff(diff as any, 'postgresql').up.join('\n');
  expect(pg).toContain('DROP INDEX IF EXISTS "idx_users_active"');

  const sqlite = generateMigrationFromDiff(diff as any, 'sqlite').up.join('\n');
  expect(sqlite).toContain('DROP INDEX IF EXISTS idx_users_active');

  const mysql = generateMigrationFromDiff(diff as any, 'mysql').up.join('\n');
  expect(mysql).toContain('ALTER TABLE `Users` DROP INDEX `idx_users_active`');

  const mssql = generateMigrationFromDiff(diff as any, 'mssql').up.join('\n');
  expect(mssql).toContain('DROP INDEX [idx_users_active] ON [Users]');
});


