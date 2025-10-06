'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const MigrationBuilder_1 = require('../../src/migrations/MigrationBuilder');
function normalizeSql(lines) {
  return lines.join('\n');
}
test('MigrationBuilder: create + add/alter/drop column SQL snapshot (postgresql)', () => {
  const mb = new MigrationBuilder_1.MigrationBuilder();
  mb.createTable('users', (t) => {
    t.column('id', 'INTEGER', { nullable: false });
    t.column('name', 'TEXT');
    t.primaryKey('id');
  });
  mb.alterTable('users', (t) => {
    t.addColumn('email', 'TEXT', { nullable: true });
    t.alterColumn('name', 'TEXT', { nullable: false });
    t.dropColumn('email');
  });
  const sql = mb.toSql('postgresql');
  expect(sql.up).toMatchInlineSnapshot(`
[
  "CREATE TABLE IF NOT EXISTS \"users\" (\"id\" INTEGER NOT NULL, \"name\" TEXT, PRIMARY KEY (\"id\"))",
  "ALTER TABLE \"users\" ADD COLUMN \"email\" TEXT",
  "ALTER TABLE \"users\" ALTER COLUMN \"name\" TYPE TEXT",
  "ALTER TABLE \"users\" ALTER COLUMN \"name\" SET NOT NULL",
  "ALTER TABLE \"users\" DROP COLUMN \"email\"",
]
`);
});
//# sourceMappingURL=MigrationBuilder.snapshot.test.js.map
