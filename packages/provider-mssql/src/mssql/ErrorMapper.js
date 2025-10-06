'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.mapMssqlError = mapMssqlError;
const core_1 = require('@ts-linq/core');
function mapMssqlError(err) {
  const anyErr = err;
  const number = anyErr?.number;
  const message = anyErr?.message || String(err);
  if (number === 2627 || number === 2601)
    return new core_1.UniqueConstraintError(message, String(number));
  return new core_1.DatabaseError(message, String(number));
}
//# sourceMappingURL=ErrorMapper.js.map
