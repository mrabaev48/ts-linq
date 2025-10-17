"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MssqlGroupEmitter = void 0;
class MssqlGroupEmitter {
    emit(parameters, options) {
        if (!options.groupBy)
            return '';
        let sql = '';
        if (options.groupBy.columns && options.groupBy.columns.length > 0) {
            sql += ` GROUP BY ${options.groupBy.columns.join(', ')}`;
        }
        if (options.groupBy.having) {
            sql += ` HAVING ${options.groupBy.having.condition}`;
            if (options.groupBy.having.parameters)
                parameters.push(...options.groupBy.having.parameters);
        }
        return sql;
    }
}
exports.MssqlGroupEmitter = MssqlGroupEmitter;
//# sourceMappingURL=MssqlGroupEmitter.js.map