'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PgWhereEmitter = void 0;
class PgWhereEmitter {
  emit(parameters, options) {
    if (!options.where || options.where.length === 0) return '';
    const whereClauses = options.where.map((w) => w.condition);
    for (const w of options.where) parameters.push(...w.parameters);
    return ` WHERE ${whereClauses.join(' AND ')}`;
  }
}
exports.PgWhereEmitter = PgWhereEmitter;
//# sourceMappingURL=PgWhereEmitter.js.map
