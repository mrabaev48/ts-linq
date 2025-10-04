import { createMssqlPool } from '../src/mssql/PoolAdapter';

test('safe require throws friendly message when driver absent', () => {
  const orig = jest.requireActual;
  jest.isolateModules(() => {
    jest.mock('mssql', () => { throw new Error('not installed'); }, { virtual: true });
    expect(() => createMssqlPool('mssql://a')).toThrow('Package "mssql" is required');
  });
});


