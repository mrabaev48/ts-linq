/* eslint-disable @typescript-eslint/no-unused-vars */
import { MetadataStorage } from '@ts-linq/metadata';
import type { ColumnMetadata } from '@ts-linq/types';
import { MssqlProvider } from '@ts-linq/provider-mssql';

class User {
  id!: number;
  a!: number;
  doubleA!: number;
}

describe('MSSQL computed column (integration)', () => {
  const url = process.env.MSSQL_URL;
  it('PERSISTED computed column evaluates on read', async () => {
    if (!url) return;
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(User, 'users_cc');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
      { propertyName: 'a', columnName: 'a', type: 'INTEGER', nullable: false },
      {
        propertyName: 'doubleA',
        columnName: 'doubleA',
        type: 'INTEGER',
        nullable: true,
        isComputed: true,
        computedExpression: 'a * 2'
        // computedStorage respected in DDL strategy
      } as ColumnMetadata
    ];
    cols.forEach((c) => MetadataStorage.addColumn(User, c));
    MetadataStorage.addPrimaryKey(User, 'id');

    const provider = new MssqlProvider({
      server: process.env.MSSQL_SERVER || 'localhost',
      port: process.env.MSSQL_PORT ? parseInt(process.env.MSSQL_PORT) : 1433,
      database: process.env.MSSQL_DB || 'test',
      user: process.env.MSSQL_USER,
      password: process.env.MSSQL_PASSWORD
    });
    await provider.connect();
    await provider.executeNonQuery(
      'IF OBJECT_ID(N"users_cc", N"U") IS NOT NULL DROP TABLE users_cc'
    );
    const meta = MetadataStorage.getEntity(User)!;
    await provider.createTable(meta);
    await provider.executeNonQuery('INSERT INTO users_cc (id, a) VALUES (@p1, @p2)', [1, 11]);
    const rows = await provider.executeQuery<{ doubleA: number }>(
      'SELECT doubleA FROM users_cc WHERE id = @p1',
      [1]
    );
    expect(rows[0]?.doubleA).toBe(22);
    await provider.disconnect();
  });
});
