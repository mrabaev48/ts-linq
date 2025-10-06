'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
require('reflect-metadata');
const DbContext_1 = require('../src/context/DbContext');
describe('DbContext provider selection', () => {
  class CSqlite extends DbContext_1.DbContext {
    constructor() {
      super({ connectionString: ':memory:', provider: 'sqlite' });
    }
  }
  class CPostgres extends DbContext_1.DbContext {
    constructor() {
      super({ connectionString: 'postgres://x', provider: 'postgresql' });
    }
  }
  class CMssql extends DbContext_1.DbContext {
    constructor() {
      super({ connectionString: 'mssql://x', provider: 'mssql' });
    }
  }
  class CMySql extends DbContext_1.DbContext {
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
//# sourceMappingURL=provider-selection.test.js.map
