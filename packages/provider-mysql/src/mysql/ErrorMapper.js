'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.mapMySqlError = mapMySqlError;
const core_1 = require('@ts-linq/core');
function mapMySqlError(err) {
  const anyErr = err;
  const code = anyErr?.code;
  const message = anyErr?.message || String(err);
  if (code === 'ER_DUP_ENTRY') return new core_1.UniqueConstraintError(message, code);
  return new core_1.DatabaseError(message, code);
}
//# sourceMappingURL=ErrorMapper.js.map
