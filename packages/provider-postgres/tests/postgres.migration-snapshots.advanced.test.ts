import { generateMigrationFromDiff } from '@ts-linq/migrations';
import type { SchemaDiff } from '@ts-linq/migrations';

function normalize(lines: string[]): string {
  return lines.join('\n');
}

describe('PostgreSQL advanced index DDL (SchemaDiff → SQL)', () => {
  test('Partial index (WHERE), USING GIN, CONCURRENTLY, WITH params, expressions, NULLS', () => {
    const diff: SchemaDiff = {
      tables: [
        {
          table: 'users',
          indexCreates: [
            {
              name: 'idx_users_email_active',
              columns: ['email'],
              unique: true,
              where: 'active = true'
            },
            {
              name: 'idx_users_tags_gin',
              columns: ['tags'],
              unique: false,
              using: 'gin',
              concurrently: true,
              withParams: { fastupdate: 'on', fillfactor: 90 }
            },
            {
              name: 'idx_users_expr',
              columns: ['created_at'],
              expressions: ['(LOWER(email))'],
              orders: { created_at: 'DESC' },
              collations: { email: 'en_US' },
              nulls: { created_at: 'LAST' },
              unique: false
            }
          ]
        }
      ]
    };
    const sql = generateMigrationFromDiff(diff, 'postgresql' as any).up;
    const text = normalize(sql);
    expect(text).toContain(
      'CREATE UNIQUE INDEX "idx_users_email_active" ON "users" ("email") WHERE active = true'
    );
    expect(text).toContain(
      `CREATE INDEX CONCURRENTLY "idx_users_tags_gin" ON "users" USING GIN ("tags") WITH (fastupdate='on', fillfactor=90)`
    );
    // expressions and NULLS/COLLATE rendering
    expect(text).toContain(
      'CREATE INDEX "idx_users_expr" ON "users" ("created_at" DESC NULLS LAST, ((LOWER(email))))'
    );
  });
});
