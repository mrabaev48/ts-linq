"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteGroupEmitter = void 0;
class SQLiteGroupEmitter {
    emit(parameters, options) {
        if (!options.groupBy)
            return '';
        const groupBy = Array.isArray(options.groupBy)
            ? { columns: options.groupBy }
            : options.groupBy;
        let sql = ` GROUP BY ${groupBy.columns.join(', ')}`;
        if (groupBy.having) {
            sql += ` HAVING ${groupBy.having.condition}`;
            parameters.push(...groupBy.having.parameters);
        }
        return sql;
    }
}
exports.SQLiteGroupEmitter = SQLiteGroupEmitter;
//# sourceMappingURL=SQLiteGroupEmitter.js.map