'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.MssqlIndexBuilder = void 0;
class MssqlIndexBuilder {
  constructor(logger) {
    this.logger = logger;
  }
  buildCreateIndexSql(table, index) {
    if (!this.isValid(index)) {
      this.logger?.warn(`MSSQL: invalid index spec for ${index?.name || '<unnamed>'}; skip`);
      return '';
    }
    this.warnUnsupported(index);
    const unique = index.unique ? 'UNIQUE ' : '';
    const cols = index.columns
      .map((c) => (index.orders?.[c] ? `${c} ${index.orders[c]}` : c))
      .join(', ');
    const include =
      index.include && index.include.length > 0 ? ` INCLUDE (${index.include.join(', ')})` : '';
    const whereSql = index.where ? ` WHERE ${index.where}` : '';
    return `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='${index.name}' AND object_id=OBJECT_ID('${table}')) CREATE ${unique}INDEX ${index.name} ON ${table} (${cols})${include}${whereSql}`;
  }
  isValid(index) {
    return !!index?.name && Array.isArray(index.columns) && index.columns.length > 0;
  }
  warnUnsupported(index) {
    const unexpected = [];
    if (index.expressions && index.expressions.length > 0) unexpected.push('expressions');
    if (index.collations && Object.keys(index.collations).length > 0) unexpected.push('collations');
    if (index.nulls && Object.keys(index.nulls).length > 0) unexpected.push('nulls');
    if (unexpected.length > 0) {
      this.logger?.warn(
        `MSSQL: unsupported index options ignored for ${index.name}: ${unexpected.join(', ')}`
      );
    }
  }
}
exports.MssqlIndexBuilder = MssqlIndexBuilder;
//# sourceMappingURL=MssqlIndexBuilder.js.map
