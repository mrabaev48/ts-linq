export class SQLiteOrderEmitter {
  emit(options) {
    if (!options.orderBy || options.orderBy.length === 0) return '';
    const orderByClauses = options.orderBy.map((o) => `${o.column} ${o.direction}`);
    return ` ORDER BY ${orderByClauses.join(', ')}`;
  }
}
//# sourceMappingURL=SQLiteOrderEmitter.js.map
