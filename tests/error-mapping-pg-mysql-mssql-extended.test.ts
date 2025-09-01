import 'reflect-metadata';
import { ForeignKeyConstraintError, DatabaseError } from '../src/types';
import { PostgresProvider } from '../src/providers/PostgresProvider';
import { MySqlProvider } from '../src/providers/MySqlProvider';
import { MssqlProvider } from '../src/providers/MssqlProvider';

class PgFK extends PostgresProvider {
  public async connect() { (this as any).pool = { query: async () => { const e: any = new Error('insert or update on table violates foreign key constraint'); e.code = '23503'; throw e; } }; this['isConnected'] = true; }
  public async disconnect() { this['isConnected'] = false; }
}

class MyTimeout extends MySqlProvider {
  public async connect() { (this as any).pool = { query: async () => { const e: any = new Error('timeout'); e.code = 'PROTOCOL_SEQUENCE_TIMEOUT'; throw e; }, execute: async () => { const e: any = new Error('timeout'); e.code = 'PROTOCOL_SEQUENCE_TIMEOUT'; throw e; } }; this['isConnected'] = true; }
  public async disconnect() { this['isConnected'] = false; }
}

class MsTimeout extends MssqlProvider {
  public async connect() { this['isConnected'] = true; }
  public async disconnect() { this['isConnected'] = false; }
  protected async doExecuteNonQuery(): Promise<number> { throw new DatabaseError('timeout'); }
}

describe('Extended error mapping (FK/timeout)', () => {
  test('Postgres maps 23503 to ForeignKeyConstraintError', async () => {
    const p = new PgFK('postgres://fake');
    await p.connect();
    await expect(p.executeNonQuery('INSERT INTO child VALUES (1)')).rejects.toBeInstanceOf(ForeignKeyConstraintError);
    await p.disconnect();
  });

  test('MySQL timeout surfaces as DatabaseError', async () => {
    const p = new MyTimeout('mysql://fake');
    await p.connect();
    await expect(p.executeNonQuery('SELECT 1')).rejects.toBeInstanceOf(DatabaseError);
    await p.disconnect();
  });

  test('MSSQL timeout surfaces as DatabaseError', async () => {
    const p = new MsTimeout('mssql://fake');
    await p.connect();
    await expect(p.executeNonQuery('SELECT 1')).rejects.toBeInstanceOf(DatabaseError);
    await p.disconnect();
  });
});


