import { generateMigrationFromDiff } from './DialectMigrationSql';

test('generateMigrationFromDiff: indexCreates/indexDrops (Postgres with WHERE)', () => {
  const diff = {
    tables: [
      {
        table: 'Users',
        indexCreates: [
          { name: 'idx_users_active', columns: ['active'], unique: false, where: 'active = 1' }
        ],
        indexDrops: ['idx_old']
      }
    ]
  } as const;
  const res = generateMigrationFromDiff(diff as any, 'postgresql').up.join('\n');
  expect(res).toContain('CREATE INDEX "idx_users_active" ON "Users" ("active") WHERE active = 1');
  expect(res).toContain('DROP INDEX IF EXISTS "idx_old"');
});

test('generateMigrationFromDiff: indexCreates/indexDrops (MySQL, WHERE ignored)', () => {
  const diff = {
    tables: [
      {
        table: 'Users',
        indexCreates: [
          { name: 'idx_users_active', columns: ['active'], unique: false, where: 'active = 1' }
        ],
        indexDrops: ['idx_old']
      }
    ]
  } as const;
  const res = generateMigrationFromDiff(diff as any, 'mysql').up.join('\n');
  expect(res).toContain('CREATE INDEX `idx_users_active` ON `Users` (`active`)');
  expect(res).not.toContain('WHERE active = 1');
  expect(res).toContain('DROP INDEX `idx_old`');
});


