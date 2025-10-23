"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteWhereEmitter = void 0;
class SQLiteWhereEmitter {
    emit(parameters, options) {
        if (!options.where)
            return '';
        const whereArray = Array.isArray(options.where) ? options.where : [options.where];
        if (whereArray.length === 0)
            return '';
        const whereClauses = whereArray.map((w) => w.condition);
        for (const w of whereArray)
            parameters.push(...w.parameters);
        return ` WHERE ${whereClauses.join(' AND ')}`;
    }
}
exports.SQLiteWhereEmitter = SQLiteWhereEmitter;
//# sourceMappingURL=SQLiteWhereEmitter.js.map