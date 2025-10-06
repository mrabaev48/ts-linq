'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.createMssqlPool = createMssqlPool;
function createMssqlPool(connectionString) {
  const mssql = safeRequireMssql();
  return new mssql.ConnectionPool(connectionString);
}
function safeRequireMssql() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('mssql');
  } catch {
    throw new Error('Package "mssql" is required. Install it with: npm install mssql');
  }
}
//# sourceMappingURL=PoolAdapter.js.map
