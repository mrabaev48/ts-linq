import 'reflect-metadata';
import { generateMigrationFromDiff } from '../src/migrations/DialectMigrationSql';
import type { SchemaDiff } from '../src/migrations/DiffTypes';

describe('generateMigration SQL', () => {
  it('creates up SQL with PK, index and FK (postgresql)', () => {
    const diff: SchemaDiff = {
      tables: [
        {
          table: 'Orders',
          create: {
            name: 'Orders',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false },
              { name: 'userId', type: 'INTEGER', nullable: false },
              { name: 'note', type: 'TEXT', nullable: true }
            ],
            primaryKeys: ['id'],
            indexes: [{ name: 'idx_orders_user', columns: ['userId'], unique: false }],
            foreignKeys: [
              { columns: ['userId'], refTable: 'Users', refColumns: ['id'], onDelete: 'CASCADE' }
            ]
          }
        }
      ]
    };
    const { up } = generateMigrationFromDiff(diff, 'postgresql');
    const expected =
      'CREATE TABLE IF NOT EXISTS "Orders" ("id" INTEGER NOT NULL, "userId" INTEGER NOT NULL, "note" TEXT, PRIMARY KEY ("id"), FOREIGN KEY ("userId") REFERENCES "Users" ("id") ON DELETE CASCADE)\nCREATE INDEX "idx_orders_user" ON "Orders" ("userId")';
    expect(up.join('\n')).toBe(expected);
  });
});
