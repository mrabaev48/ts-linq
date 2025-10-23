"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySqlGroupEmitter = void 0;
class MySqlGroupEmitter {
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
exports.MySqlGroupEmitter = MySqlGroupEmitter;
//# sourceMappingURL=MySqlGroupEmitter.js.map