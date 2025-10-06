'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.PgGroupEmitter = void 0;
class PgGroupEmitter {
  emit(parameters, options) {
    if (!options.groupBy) return '';
    let sql = ` GROUP BY ${options.groupBy.columns.join(', ')}`;
    if (options.groupBy.having) {
      sql += ` HAVING ${options.groupBy.having.condition}`;
      parameters.push(...options.groupBy.having.parameters);
    }
    return sql;
  }
}
exports.PgGroupEmitter = PgGroupEmitter;
//# sourceMappingURL=PgGroupEmitter.js.map
