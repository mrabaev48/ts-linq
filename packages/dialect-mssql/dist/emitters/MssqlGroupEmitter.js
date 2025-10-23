"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MssqlGroupEmitter = void 0;
class MssqlGroupEmitter {
    emit(parameters, options) {
        if (!options.groupBy)
            return '';
        const groupBy = Array.isArray(options.groupBy)
            ? { columns: options.groupBy }
            : options.groupBy;
        let sql = '';
        if (groupBy.columns && groupBy.columns.length > 0) {
            sql += ` GROUP BY ${groupBy.columns.join(', ')}`;
        }
        if (groupBy.having) {
            sql += ` HAVING ${groupBy.having.condition}`;
            if (groupBy.having.parameters)
                parameters.push(...groupBy.having.parameters);
        }
        return sql;
    }
}
exports.MssqlGroupEmitter = MssqlGroupEmitter;
//# sourceMappingURL=MssqlGroupEmitter.js.map