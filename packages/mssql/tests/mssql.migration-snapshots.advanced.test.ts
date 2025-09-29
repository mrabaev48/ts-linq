import { generateMigrationFromDiff } from '@ts-linq/core';
import type { SchemaDiff } from '@ts-linq/core';

function normalize(lines: string[]): string {
  return lines.join('\n');
}

describe('MSSQL advanced index DDL (SchemaDiff → SQL)', () => {
  test('Index INCLUDE and filtered (WHERE)', () => {
    const diff: SchemaDiff = {
      tables: [
        {
          table: 'orders',
          indexCreates: [
            {
              name: 'idx_orders_user',
              columns: ['userId'],
              include: ['createdAt'],
              where: 'deleted = 0',
              unique: false
            }
          ]
        }
      ]
    };
    const sql = generateMigrationFromDiff(diff, 'mssql' as any).up;
    const text = normalize(sql);
    expect(text).toContain(
      'CREATE INDEX [idx_orders_user] ON [orders] ([userId]) INCLUDE ([createdAt]) WHERE deleted = 0'
    );
  });
});
