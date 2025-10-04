test('throws friendly error if sqlite3 is missing', () => {
  jest.isolateModules(() => {
    jest.doMock('sqlite3', () => {
      throw new Error('not installed');
    }, { virtual: true });
    // require after mocking within the isolated registry
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createSqliteDb } = require('../src/sqlite/PoolAdapter');
    expect(() => createSqliteDb(':memory:')).toThrow('Package "sqlite3" is required');
  });
});


