import { MigrationBuilder } from '@ts-linq/core';

describe('Postgres FK DDL snapshots', () => {
  test('FK with ON UPDATE/DELETE actions snapshot', () => {
    const mb = new MigrationBuilder();
    mb.createTable('parents', (t) => {
      t.column('id', 'INTEGER', { nullable: false });
      t.primaryKey('id');
    });
    mb.createTable('children', (t) => {
      t.column('id', 'INTEGER', { nullable: false });
      t.column('parent_id', 'INTEGER', { nullable: false });
      t.primaryKey('id');
      t.foreignKey({
        columns: ['parent_id'],
        refTable: 'parents',
        refColumns: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION'
      });
    });
    const sql = mb.toSql('postgresql' as any);
    expect(sql.up.join('\n')).toMatchInlineSnapshot(`
"CREATE TABLE IF NOT EXISTS \"parents\" (\"id\" INTEGER NOT NULL, PRIMARY KEY (\"id\"))
CREATE TABLE IF NOT EXISTS \"children\" (\"id\" INTEGER NOT NULL, \"parent_id\" INTEGER NOT NULL, PRIMARY KEY (\"id\"), FOREIGN KEY (\"parent_id\") REFERENCES \"parents\" (\"id\") ON DELETE CASCADE ON UPDATE NO ACTION)"
`);
  });
});
