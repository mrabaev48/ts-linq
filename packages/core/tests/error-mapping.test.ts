import 'reflect-metadata';
import { SQLiteProvider } from '@ts-linq/sqlite';
import { UniqueConstraintError, ForeignKeyConstraintError } from '../src/types';

describe('SQLite error mapping', () => {
  it('maps UNIQUE constraint violation to UniqueConstraintError', async () => {
    const p = new SQLiteProvider(':memory:');
    await p.connect();
    await p.executeNonQuery('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT UNIQUE)');
    await p.executeNonQuery('INSERT INTO t (name) VALUES (?)', ['A']);
    await expect(p.executeNonQuery('INSERT INTO t (name) VALUES (?)', ['A'])).rejects.toThrow();
    await p.disconnect();
  });

  it('maps FOREIGN KEY violation to ForeignKeyConstraintError', async () => {
    const p = new SQLiteProvider(':memory:');
    await p.connect();
    // foreign keys are enabled in connect()
    await p.executeNonQuery('CREATE TABLE parent (id INTEGER PRIMARY KEY)');
    await p.executeNonQuery(
      'CREATE TABLE child (id INTEGER PRIMARY KEY, parentId INTEGER, FOREIGN KEY(parentId) REFERENCES parent(id))'
    );
    await expect(
      p.executeNonQuery('INSERT INTO child (parentId) VALUES (?)', [999])
    ).rejects.toThrow();
    await p.disconnect();
  });
});
