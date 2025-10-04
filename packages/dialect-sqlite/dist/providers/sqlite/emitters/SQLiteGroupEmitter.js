"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteGroupEmitter = void 0;
class SQLiteGroupEmitter {
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
exports.SQLiteGroupEmitter = SQLiteGroupEmitter;
//# sourceMappingURL=SQLiteGroupEmitter.js.map