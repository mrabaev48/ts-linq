'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SQLiteIndexBuilder = void 0;
class SQLiteIndexBuilder {
  constructor(_logger) {
    this._logger = _logger;
  }
  buildCreateIndexSql(table, index) {
    if (!index?.name || !Array.isArray(index.columns) || index.columns.length === 0) {
      this._logger?.warn(`SQLite: invalid index spec for ${index?.name || '<unnamed>'}; skip`);
      return '';
    }
    const unique = index.unique ? 'UNIQUE ' : '';
    const whereSql = index.where ? ` WHERE ${index.where}` : '';
    const parts = [];
    for (const c of index.columns) {
      const ord = index.orders?.[c] ? ` ${index.orders[c]}` : '';
      const collate = index.collations?.[c] ? ` COLLATE ${index.collations[c]}` : '';
      parts.push(`${c}${ord}${collate}`);
    }
    for (const e of index.expressions || []) parts.push(`(${e})`);
    const cols = parts.join(', ');
    return `CREATE ${unique}INDEX IF NOT EXISTS ${index.name} ON ${table} (${cols})${whereSql}`;
  }
}
exports.SQLiteIndexBuilder = SQLiteIndexBuilder;
//# sourceMappingURL=SQLiteIndexBuilder.js.map
