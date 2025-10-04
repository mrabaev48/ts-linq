import { MssqlProvider } from '../src';

jest.mock('mssql', () => {
  function Transaction(this: any) {
    this.begin = async () => undefined;
    this.commit = async () => undefined;
    this.rollback = async () => undefined;
  }
  function Request(this: any) {
    this.input = () => this;
    this.query = async () => ({ rowsAffected: [1], recordset: [] });
  }
  function ConnectionPool(this: any) {}
  return { Transaction, Request, ConnectionPool };
}, { virtual: true });

test('begin/commit/rollback no connection errors (mocked)', async () => {
  const p = new MssqlProvider('mssql://user:pass@localhost/db');
  // @ts-expect-error override connected flag
  p.isConnected = true;
  // @ts-expect-error override request factory
  p['getRequest'] = () => ({ input: () => ({ input: () => ({}) }), query: async () => ({ rowsAffected: [1] }) });
  await p.beginTransaction();
  await p.commitTransaction();
  await p.beginTransaction();
  await p.rollbackTransaction();
});


