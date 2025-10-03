import { generateMigrationFromDiff } from '../../src/migrations/DialectMigrationSql';

test('FK add/drop for Postgres and SQLite comment', () => {
  const diff = {
    tables: [
      {
        table: 'Orders',
        fkCreates: [
          {
            name: 'fk_orders_user',
            columns: ['userId'],
            refTable: 'Users',
            refColumns: ['id'],
            onDelete: 'CASCADE'
          }
        ],
        fkDrops: ['fk_old']
      }
    ]
  } as const;

  const pg = generateMigrationFromDiff(diff as any, 'postgresql').up.join('\n');
  expect(pg).toContain(
    'ALTER TABLE "Orders" ADD CONSTRAINT "fk_orders_user" FOREIGN KEY ("userId") REFERENCES "Users" ("id") ON DELETE CASCADE'
  );
  expect(pg).toContain('ALTER TABLE "Orders" DROP CONSTRAINT "fk_old"');

  const sqlite = generateMigrationFromDiff(diff as any, 'sqlite').up.join('\n');
  expect(sqlite).toContain('SQLite requires table rebuild');
});
