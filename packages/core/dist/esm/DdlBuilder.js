/**
 * Small facade over a DdlStrategy to generate CREATE TABLE and INDEX statements
 * in a consistent, testable way.
 */
export class DdlBuilder {
  constructor(strategy) {
    this.strategy = strategy;
  }
  buildCreateTableSql(metadata) {
    return this.strategy.generateCreateTableSql(metadata);
  }
  buildCreateIndexesSql(metadata) {
    const result = [];
    for (const idx of metadata.indexes || []) {
      result.push(
        this.strategy.generateCreateIndexSql(metadata.tableName, {
          name: idx.name,
          columns: idx.columns,
          unique: idx.unique
        })
      );
    }
    return result;
  }
  buildAll(metadata) {
    return {
      tableSql: this.buildCreateTableSql(metadata),
      indexSqls: this.buildCreateIndexesSql(metadata)
    };
  }
}
//# sourceMappingURL=DdlBuilder.js.map
