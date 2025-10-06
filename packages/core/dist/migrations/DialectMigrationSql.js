'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.generateMigrationFromDiff = generateMigrationFromDiff;
// no local SQL utils needed here; builders render SQL
const TablesSqlBuilder_1 = require('./builders/TablesSqlBuilder');
const IndexesSqlBuilder_1 = require('./builders/IndexesSqlBuilder');
const ForeignKeysSqlBuilder_1 = require('./builders/ForeignKeysSqlBuilder');
const ColumnsSqlBuilder_1 = require('./builders/ColumnsSqlBuilder');
function generateMigrationFromDiff(diff, dialect) {
  return new MigrationSqlBuilder(dialect).build(diff);
}
class MigrationSqlBuilder {
  constructor(dialect) {
    this.dialect = dialect;
    this.tables = new TablesSqlBuilder_1.TablesSqlBuilder(dialect);
    this.indexes = new IndexesSqlBuilder_1.IndexesSqlBuilder(dialect);
    this.fks = new ForeignKeysSqlBuilder_1.ForeignKeysSqlBuilder(dialect);
    this.columns = new ColumnsSqlBuilder_1.ColumnsSqlBuilder(dialect);
  }
  build(diff) {
    const up = [];
    const down = [];
    for (const tableDiff of diff.tables) this.handleTable(tableDiff, up, down);
    return { up, down };
  }
  handleTable(tableDiff, up, down) {
    this.tables.rename(tableDiff, up);
    if (this.tables.create(tableDiff, up, down)) return;
    if (this.tables.drop(tableDiff, up)) return;
    this.indexes.create(tableDiff, up);
    this.indexes.drop(tableDiff, up);
    this.fks.create(tableDiff, up);
    this.fks.drop(tableDiff, up);
    this.columns.changes(tableDiff, up, down);
    this.columns.renames(tableDiff, up);
  }
}
//# sourceMappingURL=DialectMigrationSql.js.map
