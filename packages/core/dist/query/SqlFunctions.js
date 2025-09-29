"use strict";
/**
 * Minimal SQL window/functions DSL to help build expressions in a type-safe-ish way
 * without coupling to predicate parser. String-based columns to keep it simple.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = void 0;
class WindowBuilder {
    constructor(funcCall) {
        this.partitions = [];
        this.orders = [];
        this.funcCall = funcCall;
    }
    partitionBy(columns) {
        const cols = Array.isArray(columns) ? columns : [columns];
        this.partitions.push(...cols);
        return this;
    }
    orderBy(column, direction = 'ASC') {
        this.orders.push({ column, direction });
        return this;
    }
    toString() {
        const parts = [];
        if (this.partitions.length)
            parts.push(`PARTITION BY ${this.partitions.join(', ')}`);
        if (this.orders.length)
            parts.push(`ORDER BY ${this.orders.map((o) => `${o.column} ${o.direction}`).join(', ')}`);
        return `${this.funcCall} OVER (${parts.join(' ')})`;
    }
    as(alias) {
        return `${this.toString()} AS ${alias}`;
    }
}
class RankFunction {
    over() {
        return new WindowBuilder('RANK()');
    }
}
class DenseRankFunction {
    over() {
        return new WindowBuilder('DENSE_RANK()');
    }
}
class RowNumberFunction {
    over() {
        return new WindowBuilder('ROW_NUMBER()');
    }
}
exports.sql = {
    rank() {
        return new RankFunction();
    },
    denseRank() {
        return new DenseRankFunction();
    },
    rowNumber() {
        return new RowNumberFunction();
    },
    // JSON helpers (dialect-specific rendering expected downstream)
    jsonExtract(column, path) {
        // Postgres: column #>> '{a,b}', MySQL: JSON_EXTRACT(column, '$.a.b')
        return new ExprBuilder(`JSON_EXTRACT(${column}, ?)`, [path]);
    },
    jsonContains(column, json) {
        return new ExprBuilder(`JSON_CONTAINS(${column}, ?)`, [json]);
    },
    // Full-text search DSL (vendor-aware by convention; dialect may remap)
    mysqlMatchAgainst(columns, query, mode = 'natural') {
        const cols = Array.isArray(columns) ? columns.join(', ') : columns;
        const modeSql = mode === 'boolean'
            ? ' IN BOOLEAN MODE'
            : mode === 'query expansion'
                ? ' WITH QUERY EXPANSION'
                : ' IN NATURAL LANGUAGE MODE';
        return new ExprBuilder(`MATCH(${cols}) AGAINST (?${modeSql})`, [query]);
    },
    pgToTsVector(columns, config = 'simple') {
        const cols = Array.isArray(columns) ? columns : [columns];
        const coalesced = cols.map((c) => `COALESCE(${c}, '')`).join(` || ' ' || `);
        return new ExprBuilder(`to_tsvector(?, ${coalesced})`, [config]);
    },
    pgPlainToTsQuery(query, config = 'simple') {
        return new ExprBuilder(`plainto_tsquery(?, ?)`, [config, query]);
    },
    pgWebsearchToTsQuery(query, config = 'simple') {
        return new ExprBuilder(`websearch_to_tsquery(?, ?)`, [config, query]);
    },
    pgRank(vectorExpr, queryExpr) {
        return new ExprBuilder(`ts_rank(${vectorExpr}, ${queryExpr})`);
    }
};
class ExprBuilder {
    constructor(expr, params = []) {
        this.expr = expr;
        this.params = params;
    }
    toString() {
        return this.expr;
    }
    getParameters() {
        return this.params;
    }
    as(alias) {
        return new ExprBuilder(`${this.expr} AS ${alias}`, this.params);
    }
}
//# sourceMappingURL=SqlFunctions.js.map