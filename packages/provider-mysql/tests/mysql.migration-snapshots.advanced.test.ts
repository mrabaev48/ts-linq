import type { SchemaDiff } from '@ts-linq/migrations';
import { generateMigrationFromDiff } from '@ts-linq/migrations';

function normalize(lines: string[]): string {
  return lines.join('\n');
}

describe('MySQL advanced index DDL (SchemaDiff → SQL)', () => {
  test('Visibility (INVISIBLE), UNIQUE, basic create/drop ordering', () => {
    const diff: SchemaDiff = {
      tables: [
        {
          table: 'users',
          indexCreates: [
            {
              name: 'idx_users_email',
              columns: ['email'],
              unique: true,
              mysqlVisibility: 'INVISIBLE'
            }
          ],
          indexDrops: ['idx_old']
        }
      ]
    };
    const sql = generateMigrationFromDiff(diff, 'mysql').up;
    const text = normalize(sql);
    expect(text).toContain('CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`) INVISIBLE');
    expect(text).toContain('ALTER TABLE `users` DROP INDEX `idx_old`');
  });
});
