"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySqlIndexBuilder = void 0;
class MySqlIndexBuilder {
    constructor(logger) {
        this.logger = logger;
    }
    buildCreateIndexSql(table, index) {
        if (!this.isValidIndexSpec(index)) {
            this.logger?.warn(`MySQL: invalid index spec for ${index?.name || '<unnamed>'}; skip`);
            return '';
        }
        this.warnUnsupportedOptions(index);
        const kind = this.buildKind(index);
        const cols = this.buildColumnsList(index);
        const vis = index.mysqlVisibility ? ` ${index.mysqlVisibility}` : '';
        return `CREATE ${kind}INDEX IF NOT EXISTS ${index.name} ON ${table} (${cols})${vis}`;
    }
    isValidIndexSpec(index) {
        if (!index || !index.name)
            return false;
        const hasColumns = Array.isArray(index.columns) && index.columns.length > 0;
        const hasExpr = Array.isArray(index.expressions) && index.expressions.length > 0;
        return hasColumns || hasExpr;
    }
    warnUnsupportedOptions(index) {
        if (index.where) {
            this.logger?.warn(`MySQL: partial index WHERE is not supported and will be ignored for ${index.name}`);
        }
        if (index.nulls && Object.keys(index.nulls).length > 0) {
            this.logger?.warn(`MySQL: NULLS FIRST/LAST is not supported and will be ignored for ${index.name}`);
        }
    }
    buildKind(index) {
        if (index.mysqlType)
            return `${index.mysqlType} `;
        return index.unique ? 'UNIQUE ' : '';
    }
    buildColumnsList(index) {
        const parts = [];
        for (const c of index.columns)
            parts.push(index.orders?.[c] ? `${c} ${index.orders[c]}` : c);
        for (const e of index.expressions || [])
            parts.push(`(${e})`);
        return parts.join(', ');
    }
}
exports.MySqlIndexBuilder = MySqlIndexBuilder;
//# sourceMappingURL=MySqlIndexBuilder.js.map