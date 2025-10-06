'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MssqlWhereEmitter = void 0;
class MssqlWhereEmitter {
  emit(parameters, options) {
    if (!options.where || options.where.length === 0) return '';
    const whereClauses = options.where.map((w) => w.condition);
    for (const w of options.where) parameters.push(...w.parameters);
    return ` WHERE ${whereClauses.join(' AND ')}`;
  }
}
exports.MssqlWhereEmitter = MssqlWhereEmitter;
//# sourceMappingURL=MssqlWhereEmitter.js.map
