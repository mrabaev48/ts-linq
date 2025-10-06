'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.mapSqliteError = mapSqliteError;
const core_1 = require('@ts-linq/core');
function mapSqliteError(err) {
  const anyErr = err;
  const code = anyErr?.code;
  const message = anyErr?.message || String(err);
  if (!code) return new core_1.DatabaseError(message);
  if (message && message.toLowerCase().includes('foreign key'))
    return new core_1.ForeignKeyConstraintError(message, code);
  if (code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE')
    return new core_1.UniqueConstraintError(message, code);
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || code === 'SQLITE_CONSTRAINT_TRIGGER')
    return new core_1.ForeignKeyConstraintError(message, code);
  return new core_1.DatabaseError(message, code);
}
//# sourceMappingURL=ErrorMapper.js.map
