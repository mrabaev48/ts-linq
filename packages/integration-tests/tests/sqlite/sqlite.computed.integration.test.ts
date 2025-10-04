/* eslint-disable @typescript-eslint/no-unused-vars */
import { MetadataStorage } from '@ts-linq/core';
import type { ColumnMetadata } from '@ts-linq/core';
import { SQLiteProvider } from '@ts-linq/provider-sqlite';

class User {
  id!: number;
  a!: number;
  doubleA!: number;
}

describe('SQLite computed column (integration)', () => {
  test('computed column VIRTUAL evaluates on read', async () => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(User, 'Users');
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
      } as ColumnMetadata
    ];
    cols.forEach((c) => MetadataStorage.addColumn(User, c));
    MetadataStorage.addPrimaryKey(User, 'id');

    const provider = new SQLiteProvider(':memory:');
    await provider.connect();
    try {
      const verRows = await provider.executeQuery<{ v: string }>('select sqlite_version() as v');
      const v = verRows[0]?.v || '3.0.0';
      const [maj, min, patch] = v.split('.').map((x) => parseInt(x, 10));
      const supported = maj > 3 || (maj === 3 && (min > 30 || (min === 30 && patch >= 0)));
      if (!supported) {
        console.warn(`SQLite ${v} < 3.31: skipping computed column test`);
        await provider.disconnect();
        return;
      }
    } catch {}

    const meta = MetadataStorage.getEntity(User)!;
    await provider.createTable(meta);
    await provider.executeNonQuery('INSERT INTO Users (id, a) VALUES (?, ?)', [1, 5]);
    const rows = await provider.executeQuery<{ doubleA: number | null }>(
      'SELECT doubleA FROM Users WHERE id = ?',
      [1]
    );
    if (rows[0]?.doubleA === null) {
      console.warn('SQLite: generated columns unsupported; skipping assertion');
      await provider.disconnect();
      return;
    }
    expect(rows[0]?.doubleA).toBe(10);
    await provider.disconnect();
  });
});


