export function createMySqlPool(connectionString) {
  const mysql = safeRequireMysql2();
  return mysql.createPool(connectionString);
}
function safeRequireMysql2() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('mysql2/promise');
  } catch {
    throw new Error(
      'Package "mysql2" is required for MySqlProvider. Install it with: npm install mysql2'
    );
  }
}
//# sourceMappingURL=PoolAdapter.js.map
