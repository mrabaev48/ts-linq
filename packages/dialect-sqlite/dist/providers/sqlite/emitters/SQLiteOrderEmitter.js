'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SQLiteOrderEmitter = void 0;
class SQLiteOrderEmitter {
  emit(options) {
    if (!options.orderBy || options.orderBy.length === 0) return '';
    const orderByClauses = options.orderBy.map((o) => `${o.column} ${o.direction}`);
    return ` ORDER BY ${orderByClauses.join(', ')}`;
  }
}
exports.SQLiteOrderEmitter = SQLiteOrderEmitter;
//# sourceMappingURL=SQLiteOrderEmitter.js.map
