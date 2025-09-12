import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';

describe('DbContext provider selection', () => {
  class CSqlite extends DbContext {
    constructor() {
      super({ connectionString: ':memory:', provider: 'sqlite' });
    }
  }
  class CPostgres extends DbContext {
    constructor() {
      super({ connectionString: 'postgres://x', provider: 'postgresql' });
    }
  }
  class CMssql extends DbContext {
    constructor() {
      super({ connectionString: 'mssql://x', provider: 'mssql' });
    }
  }
  class CMySql extends DbContext {
    constructor() {
      super({ connectionString: 'mysql://x', provider: 'mysql' });
    }
  }

  test('sqlite', () => {
    new CSqlite();
  });
  test('postgresql', () => {
    new CPostgres();
  });
  test('mssql', () => {
    new CMssql();
  });
  test('mysql', () => {
    new CMySql();
  });
});
