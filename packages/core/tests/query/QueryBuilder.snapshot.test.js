'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const QueryBuilder_1 = require('../../src/query/QueryBuilder');
class DummyEntity {}
const dummyDialect = {
  provider: 'sqlite',
  buildSelect: (_, opts) => {
    const selectList = opts.select ?? ['*'];
    const select = selectList.join(', ');
    const whereClauses = opts.where ?? [];
    const where =
      whereClauses.length > 0 ? ' WHERE ' + whereClauses.map((w) => w.condition).join(' AND ') : '';
    const parameters = whereClauses.flatMap((w) => w.parameters ?? []);
    return { query: `SELECT ${select} FROM Dummy${where}`, parameters };
  }
};
test('QueryBuilder: basic SELECT SQL snapshot', () => {
  const qb = new QueryBuilder_1.QueryBuilder(dummyDialect);
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
//# sourceMappingURL=QueryBuilder.snapshot.test.js.map
