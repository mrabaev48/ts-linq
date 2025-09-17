import { SQLiteProvider } from '@ts-linq/sqlite';
import path from 'node:path';
import fs from 'node:fs';

describe('SQLiteProvider integration (smoke)', () => {
  const dbPath = path.join(process.cwd(), 'size-tests', 'tmp', 'test.db');
  beforeAll(() => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  });
  afterAll(() => {
    try { fs.unlinkSync(dbPath); } catch {}
  });
  it('connects and runs simple query', async () => {
    const provider = new SQLiteProvider(dbPath);
    await provider.connect();
    const rows = await provider.executeQuery<{ one: number }>('SELECT 1 as one');
    expect(rows[0]?.one).toBe(1);
    await provider.disconnect();
  });
});
