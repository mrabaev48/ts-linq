'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MySqlWhereEmitter = void 0;
class MySqlWhereEmitter {
  emit(parameters, options) {
    if (!options.where || options.where.length === 0) return '';
    const whereClauses = options.where.map((w) => w.condition);
    for (const w of options.where) parameters.push(...w.parameters);
    return ` WHERE ${whereClauses.join(' AND ')}`;
  }
}
exports.MySqlWhereEmitter = MySqlWhereEmitter;
//# sourceMappingURL=MySqlWhereEmitter.js.map
