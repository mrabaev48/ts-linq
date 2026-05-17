import { MetadataStorage } from '@ts-linq/metadata';
import { PostgresProvider } from '@ts-linq/provider-postgres';
import type { ColumnMetadata } from '@ts-linq/types';

class User {
  id!: number;
  a!: number;
  doubleA!: number;
}

describe('Postgres computed column (integration)', () => {
  const url = process.env.POSTGRES_URL;
  it('STORED generated column evaluates on read', async () => {
    if (!url) return;
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(User, 'users_cc');
    const cols: ColumnMetadata[] = [
      { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false },
      { propertyName: 'a', columnName: 'a', type: 'INTEGER', nullable: false },
      {
        propertyName: 'doubleA',
        columnName: 'doublea',
        type: 'INTEGER',
        nullable: true,
        isComputed: true,
        computedExpression: 'a * 2'
      }
    ];
    cols.forEach((c) => MetadataStorage.addColumn(User, c));
    MetadataStorage.addPrimaryKey(User, 'id');

    const provider = new PostgresProvider({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD
    });
    await provider.connect();
    const meta = MetadataStorage.getEntity(User)!;
    await provider.executeNonQuery('DROP TABLE IF EXISTS users_cc');
    await provider.createTable(meta);
    await provider.executeNonQuery('INSERT INTO users_cc (id, a) VALUES ($1, $2)', [1, 7]);
    const rows = await provider.executeQuery<{ doublea: number }>(
      'SELECT doublea FROM users_cc WHERE id=$1',
      [1]
    );
    expect(rows[0]?.doublea).toBe(14);
    await provider.disconnect();
  });
});
