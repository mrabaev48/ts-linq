import { QueryBuilder } from './QueryBuilder';
import type { SqlDialect } from './SqlDialect';
import type { QueryOptions, WhereClause, SqlParameter } from '../types';

class DummyEntity { id!: number; name!: string }

const dummyDialect: SqlDialect = {
  provider: 'sqlite',
  buildSelect: (_: new () => unknown, opts: QueryOptions): { query: string; parameters: readonly SqlParameter[] } => {
    const selectList: readonly string[] = (opts.select as readonly string[] | undefined) ?? ['*'];
    const select = selectList.join(', ');
    const whereClauses: readonly WhereClause[] = opts.where ?? [];
    const where = whereClauses.length > 0
      ? ' WHERE ' + whereClauses.map((w: WhereClause) => w.condition).join(' AND ')
      : '';
    const parameters: readonly SqlParameter[] = whereClauses.flatMap((w: WhereClause) => (w.parameters ?? [])) as readonly SqlParameter[];
    return { query: `SELECT ${select} FROM Dummy${where}`, parameters } as const;
  }
} as unknown as SqlDialect;

test('QueryBuilder: basic SELECT SQL snapshot', () => {
  const qb = new QueryBuilder(dummyDialect);
  const sql = qb.generateSql(DummyEntity, {
    select: ['id', 'name'],
    where: [{ condition: 'id = ?', parameters: [1] }]
  });
  expect(sql).toMatchInlineSnapshot(`
{
  "parameters": [
    1,
  ],
  "query": "SELECT id, name FROM Dummy WHERE id = ?",
}
`);
});


