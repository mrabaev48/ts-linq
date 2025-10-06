'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SQLiteJoinEmitter = void 0;
class SQLiteJoinEmitter {
  emit(options) {
    if (!options.joins || options.joins.length === 0) return '';
    let out = '';
    for (const join of options.joins) {
      out += ` ${join.type} JOIN ${join.table}`;
      if (join.alias) out += ` AS ${join.alias}`;
      out += ` ON ${join.on}`;
    }
    return out;
  }
}
exports.SQLiteJoinEmitter = SQLiteJoinEmitter;
//# sourceMappingURL=SQLiteJoinEmitter.js.map
