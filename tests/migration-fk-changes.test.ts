import { generateMigrationFromDiff } from '../src/migrations/DialectMigrationSql';
import { SchemaDiff } from '../src/migrations/DiffTypes';

describe('FK add/drop SQL generation', () => {
  test('postgres add/drop fk', () => {
    const diff: SchemaDiff = {
      tables: [
        {
          table: 'orders',
          fkCreates: [
            {
              name: 'fk_orders_users',
              columns: ['user_id'],
              refTable: 'users',
              refColumns: ['id'],
              onDelete: 'CASCADE'
            }
          ] as any
        },
        { table: 'orders', fkDrops: ['fk_old'] as unknown as string[] }
      ]
    } as unknown as { tables: Array<{ table: string; fkCreates?: Array<{ columns: string[]; refTable: string; refColumns: string[]; onDelete?: string }>; fkDrops?: string[] }> };
    const { up } = generateMigrationFromDiff(diff, 'postgresql');
    expect(
      up.some((s) =>
        s.includes('ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_users" FOREIGN KEY')
      )
    ).toBeTruthy();
    expect(up.some((s) => s.includes('DROP CONSTRAINT "fk_old"'))).toBeTruthy();
  });

  test('mysql add/drop fk', () => {
    const diff: SchemaDiff = {
      tables: [
        {
          table: 'orders',
          fkCreates: [{ columns: ['user_id'], refTable: 'users', refColumns: ['id'] }]
        },
        { table: 'orders', fkDrops: ['fk_old'] as unknown as string[] }
      ]
    } as unknown as { tables: Array<{ table: string; fkCreates?: Array<{ columns: string[]; refTable: string; refColumns: string[] }>; fkDrops?: string[] }> };
    const { up } = generateMigrationFromDiff(diff, 'mysql');
    expect(
      up.some((s) =>
        s.includes('ALTER TABLE `orders` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)')
      )
    ).toBeTruthy();
    expect(up.some((s) => s.includes('DROP FOREIGN KEY `fk_old`'))).toBeTruthy();
  });

  test('sqlite emits comments for fk add/drop', () => {
    const diff: SchemaDiff = {
      tables: [
        {
          table: 'orders',
          fkCreates: [{ columns: ['user_id'], refTable: 'users', refColumns: ['id'] }]
        },
        { table: 'orders', fkDrops: ['fk_old'] as unknown as string[] }
      ]
    } as unknown as { tables: Array<{ table: string; fkCreates?: Array<{ columns: string[]; refTable: string; refColumns: string[] }>; fkDrops?: string[] }> };
    const { up } = generateMigrationFromDiff(diff, 'sqlite');
    expect(up.some((s) => s.startsWith('-- SQLite requires table rebuild'))).toBeTruthy();
  });
});
