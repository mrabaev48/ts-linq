export class PgIndexBuilder {
    constructor(logger) {
        this.logger = logger;
    }
    buildCreateIndexSql(table, index) {
        if (!this.isValidIndexSpec(index)) {
            this.logger?.warn(`Postgres: invalid index spec for ${index?.name || '<unnamed>'}; skip`);
            return '';
        }
        this.warnIfCollationWithNonBtree(index);
        const uniqueKeyword = this.buildUniqueKeyword(index);
        const concurrently = this.buildConcurrently(index);
        const using = this.buildUsing(index);
        const columnsListSql = this.buildIndexColumnsList(index);
        const withSql = this.buildWithParams(index.withParams);
        const whereSql = this.buildWhere(index);
        return this.composeCreateIndexSql(table, index.name, uniqueKeyword, concurrently, using, columnsListSql, withSql, whereSql);
    }
    isValidIndexSpec(index) {
        if (!index || !index.name)
            return false;
        const hasColumns = Array.isArray(index.columns) && index.columns.length > 0;
        const hasExpr = Array.isArray(index.expressions) && index.expressions.length > 0;
        return hasColumns || hasExpr;
    }
    warnIfCollationWithNonBtree(index) {
        const hasCollations = !!index.collations && Object.keys(index.collations).length > 0;
        const method = index.using || 'btree';
        if (hasCollations && method !== 'btree') {
            this.logger?.warn(`Postgres: COLLATE is only meaningful with BTREE; using=${method} for index ${index.name}`);
        }
    }
    buildIndexColumnsList(index) {
        const parts = [];
        for (const col of index.columns)
            parts.push(this.formatIndexColumn(col, index));
        for (const expr of index.expressions || [])
            parts.push(`(${expr})`);
        return parts.join(', ');
    }
    buildWithParams(withParams) {
        if (!withParams || Object.keys(withParams).length === 0)
            return '';
        const body = Object.entries(withParams)
            .map(([k, v]) => `${k}=${typeof v === 'string' ? `'${v}'` : String(v)}`)
            .join(', ');
        return ` WITH (${body})`;
    }
    formatIndexColumn(column, index) {
        const ord = index.orders?.[column] ? ` ${index.orders[column]}` : '';
        const coll = index.collations?.[column] ? ` COLLATE ${index.collations[column]}` : '';
        const nulls = index.nulls?.[column] ? ` NULLS ${index.nulls[column]}` : '';
        return `"${column}"${ord}${coll}${nulls}`;
    }
    buildUniqueKeyword(index) {
        return index.unique ? 'UNIQUE ' : '';
    }
    buildConcurrently(index) {
        return index.concurrently ? ' CONCURRENTLY' : '';
    }
    buildUsing(index) {
        return index.using ? ` USING ${index.using.toUpperCase()}` : '';
    }
    buildWhere(index) {
        return index.where ? ` WHERE ${index.where}` : '';
    }
    composeCreateIndexSql(table, name, unique, concurrently, using, columnsListSql, withSql, whereSql) {
        return `CREATE ${unique}INDEX${concurrently} IF NOT EXISTS "${name}" ON "${table}"${using} (${columnsListSql})${withSql}${whereSql}`;
    }
}
//# sourceMappingURL=PgIndexBuilder.js.map