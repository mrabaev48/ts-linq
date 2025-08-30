import 'reflect-metadata';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';
import { UniqueConstraintError } from '../src/types';

describe('SQLite error mapping', () => {
    test('unique constraint produces UniqueConstraintError', async () => {
        const provider = new SQLiteProvider(':memory:');
        await provider.connect();
        await provider.executeNonQuery('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)');
        await provider.executeNonQuery('INSERT INTO t (name) VALUES (?)', ['a']);
        await expect(provider.executeNonQuery('INSERT INTO t (name) VALUES (?)', ['a']))
            .rejects.toBeInstanceOf(UniqueConstraintError);
        await provider.disconnect();
    });
});


