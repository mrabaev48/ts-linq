'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.handleIndexDrops = handleIndexDrops;
const SqlUtils_1 = require('../SqlUtils');
function handleIndexDrops(td, dialect, up) {
  const id = td.indexDrops;
  if (!id || id.length === 0) return;
  for (const nameRaw of id) {
    switch (dialect) {
      case 'postgresql':
        up.push(`DROP INDEX IF EXISTS ${(0, SqlUtils_1.q)(dialect, nameRaw)}`);
        break;
      case 'mysql':
        up.push(
          `ALTER TABLE ${(0, SqlUtils_1.q)(dialect, td.table)} DROP INDEX ${(0, SqlUtils_1.q)(dialect, nameRaw)}`
        );
        break;
      case 'mssql':
        up.push(
          `DROP INDEX ${(0, SqlUtils_1.q)(dialect, nameRaw)} ON ${(0, SqlUtils_1.q)(dialect, td.table)}`
        );
        break;
      default:
        up.push(`DROP INDEX IF EXISTS ${(0, SqlUtils_1.q)(dialect, nameRaw)}`);
    }
  }
}
//# sourceMappingURL=IndexHandlers.js.map
