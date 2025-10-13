"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySqlGroupEmitter = void 0;
class MySqlGroupEmitter {
    emit(parameters, options) {
        if (!options.groupBy)
            return '';
        let sql = ` GROUP BY ${options.groupBy.columns.join(', ')}`;
        if (options.groupBy.having) {
            sql += ` HAVING ${options.groupBy.having.condition}`;
            parameters.push(...options.groupBy.having.parameters);
        }
        return sql;
    }
}
exports.MySqlGroupEmitter = MySqlGroupEmitter;
//# sourceMappingURL=MySqlGroupEmitter.js.map