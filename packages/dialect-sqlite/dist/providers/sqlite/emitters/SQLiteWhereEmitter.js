'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SQLiteWhereEmitter = void 0;
class SQLiteWhereEmitter {
  emit(parameters, options) {
    if (!options.where || options.where.length === 0) return '';
    const whereClauses = options.where.map((w) => w.condition);
    for (const w of options.where) parameters.push(...w.parameters);
    return ` WHERE ${whereClauses.join(' AND ')}`;
  }
}
exports.SQLiteWhereEmitter = SQLiteWhereEmitter;
//# sourceMappingURL=SQLiteWhereEmitter.js.map
