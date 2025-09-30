import type { SchemaDiff, TableDiff } from './DiffTypes';
import type { Dialect } from './Dialect';
// no local SQL utils needed here; builders render SQL
import { TablesSqlBuilder } from './builders/TablesSqlBuilder';
import { IndexesSqlBuilder } from './builders/IndexesSqlBuilder';
import { ForeignKeysSqlBuilder } from './builders/ForeignKeysSqlBuilder';
import { ColumnsSqlBuilder } from './builders/ColumnsSqlBuilder';

// Dialect type moved to ./migrations/Dialect

export function generateMigrationFromDiff(
  diff: SchemaDiff,
  dialect: Dialect
): { up: string[]; down: string[] } {
  return new MigrationSqlBuilder(dialect).build(diff);
}

class MigrationSqlBuilder {
  private readonly dialect: Dialect;
  private readonly tables: TablesSqlBuilder;
  private readonly indexes: IndexesSqlBuilder;
  private readonly fks: ForeignKeysSqlBuilder;
  private readonly columns: ColumnsSqlBuilder;
  constructor(dialect: Dialect) {
    this.dialect = dialect;
    this.tables = new TablesSqlBuilder(dialect);
    this.indexes = new IndexesSqlBuilder(dialect);
    this.fks = new ForeignKeysSqlBuilder(dialect);
    this.columns = new ColumnsSqlBuilder(dialect);
  }

  public build(diff: SchemaDiff): { up: string[]; down: string[] } {
    const up: string[] = [];
    const down: string[] = [];
    for (const tableDiff of diff.tables) this.handleTable(tableDiff, up, down);
    return { up, down };
  }

  private handleTable(tableDiff: TableDiff, up: string[], down: string[]): void {
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
