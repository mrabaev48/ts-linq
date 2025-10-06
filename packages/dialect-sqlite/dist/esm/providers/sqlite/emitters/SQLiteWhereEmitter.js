export class SQLiteWhereEmitter {
  emit(parameters, options) {
    if (!options.where || options.where.length === 0) return '';
    const whereClauses = options.where.map((w) => w.condition);
    for (const w of options.where) parameters.push(...w.parameters);
    return ` WHERE ${whereClauses.join(' AND ')}`;
  }
}
//# sourceMappingURL=SQLiteWhereEmitter.js.map
