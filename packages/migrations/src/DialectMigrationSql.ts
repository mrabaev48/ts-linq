import { ColumnsSqlBuilder } from './builders/ColumnsSqlBuilder';
import { ForeignKeysSqlBuilder } from './builders/ForeignKeysSqlBuilder';
import { IndexesSqlBuilder } from './builders/IndexesSqlBuilder';
import { SeedsSqlBuilder } from './builders/SeedsSqlBuilder';
import { SequencesSqlBuilder } from './builders/SequencesSqlBuilder';
// no local SQL utils needed here; builders render SQL
import { TablesSqlBuilder } from './builders/TablesSqlBuilder';
import { UniqueConstraintsSqlBuilder } from './builders/UniqueConstraintsSqlBuilder';
import type { Dialect } from './Dialect';
import type { MigrationSql, SchemaDiff, TableDiff } from './DiffTypes';

// Re-export Dialect for backward compatibility
export type { Dialect };

export function generateMigrationFromDiff(diff: SchemaDiff, dialect: Dialect): MigrationSql {
  return new MigrationSqlBuilder(dialect).build(diff);
}

class MigrationSqlBuilder {
  private readonly dialect: Dialect;
  private readonly tables: TablesSqlBuilder;
  private readonly indexes: IndexesSqlBuilder;
  private readonly fks: ForeignKeysSqlBuilder;
  private readonly columns: ColumnsSqlBuilder;
  private readonly seeds: SeedsSqlBuilder;
  private readonly uniqueConstraints: UniqueConstraintsSqlBuilder;
  private readonly sequences: SequencesSqlBuilder;
  constructor(dialect: Dialect) {
    this.dialect = dialect;
    this.tables = new TablesSqlBuilder(dialect);
    this.indexes = new IndexesSqlBuilder(dialect);
    this.fks = new ForeignKeysSqlBuilder(dialect);
    this.columns = new ColumnsSqlBuilder(dialect);
    this.seeds = new SeedsSqlBuilder(dialect);
    this.uniqueConstraints = new UniqueConstraintsSqlBuilder(dialect);
    this.sequences = new SequencesSqlBuilder(dialect);
  }

  public build(diff: SchemaDiff): MigrationSql {
    const up: string[] = [];
    const down: string[] = [];
    // Sequences are created before tables (tables may reference them via DEFAULT expressions).
    this.sequences.generate(diff, up, down);
    for (const tableDiff of diff.tables) this.handleTable(tableDiff, up, down);
    if (diff.seedOps?.length) {
      this.seeds.generate(diff.seedOps, up, down);
    }
    return { up, down };
  }

  private handleTable(tableDiff: TableDiff, up: string[], down: string[]): void {
    this.tables.rename(tableDiff, up);
    if (this.tables.create(tableDiff, up, down)) return;
    if (this.tables.drop(tableDiff, up)) return;
    this.uniqueConstraints.drop(tableDiff, up);
    this.uniqueConstraints.create(tableDiff, up);
    this.indexes.create(tableDiff, up);
    this.indexes.drop(tableDiff, up);
    this.fks.create(tableDiff, up);
    this.fks.drop(tableDiff, up);
    this.columns.changes(tableDiff, up, down);
    this.columns.renames(tableDiff, up);
  }
}
