"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteDialect = void 0;
const core_1 = require("@ts-linq/core");
const SQLiteWhereEmitter_1 = require("../providers/sqlite/emitters/SQLiteWhereEmitter");
const SQLiteJoinEmitter_1 = require("../providers/sqlite/emitters/SQLiteJoinEmitter");
const SQLiteOrderEmitter_1 = require("../providers/sqlite/emitters/SQLiteOrderEmitter");
const SQLiteGroupEmitter_1 = require("../providers/sqlite/emitters/SQLiteGroupEmitter");
class SQLiteDialect {
    constructor() {
        this.whereEmitter = new SQLiteWhereEmitter_1.SQLiteWhereEmitter();
        this.joinEmitter = new SQLiteJoinEmitter_1.SQLiteJoinEmitter();
        this.orderEmitter = new SQLiteOrderEmitter_1.SQLiteOrderEmitter();
        this.groupEmitter = new SQLiteGroupEmitter_1.SQLiteGroupEmitter();
    }
    quoteIdentifier(identifier) {
        return identifier;
    }
    buildSelect(entityClass, options) {
        const metadata = core_1.MetadataStorage.getEntity(entityClass);
        if (!metadata)
            throw new Error(`Entity metadata not found for ${entityClass.name}`);
        const parameters = [];
        let query = this.buildSelectHead(options);
        query += this.buildFromClause(options.from ?? metadata.tableName);
        query += this.joinEmitter.emit(options);
        this.collectSelectParams(parameters, options);
        query += this.whereEmitter.emit(parameters, options);
        query += this.groupEmitter.emit(parameters, options);
        query += this.orderEmitter.emit(options);
        query += this.buildLimitOffset(options);
        return { query, parameters };
    }
    buildSelectHead(options) {
        let head = 'SELECT ';
        if (options.distinct)
            head += 'DISTINCT ';
        head += options.select && options.select.length ? options.select.join(', ') : '*';
        return head;
    }
    buildFromClause(tableName) {
        return ` FROM ${tableName}`;
    }
    collectSelectParams(parameters, options) {
        if (options.selectParams?.length)
            parameters.push(...options.selectParams);
    }
    buildLimitOffset(options) {
        const hasLimit = options.limit !== undefined && options.limit !== null;
        const hasOffset = options.offset !== undefined && options.offset !== null;
        if (hasLimit)
            return ` LIMIT ${options.limit}` + (hasOffset ? ` OFFSET ${options.offset}` : '');
        if (hasOffset)
            return ` LIMIT -1 OFFSET ${options.offset}`;
        return '';
    }
}
exports.SQLiteDialect = SQLiteDialect;
//# sourceMappingURL=SQLiteDialect.js.map