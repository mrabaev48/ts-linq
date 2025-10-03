// no local SQL utils needed here; builders render SQL
import { TablesSqlBuilder } from './builders/TablesSqlBuilder';
import { IndexesSqlBuilder } from './builders/IndexesSqlBuilder';
import { ForeignKeysSqlBuilder } from './builders/ForeignKeysSqlBuilder';
import { ColumnsSqlBuilder } from './builders/ColumnsSqlBuilder';
export function generateMigrationFromDiff(diff, dialect) {
    return new MigrationSqlBuilder(dialect).build(diff);
}
class MigrationSqlBuilder {
    constructor(dialect) {
        this.dialect = dialect;
        this.tables = new TablesSqlBuilder(dialect);
        this.indexes = new IndexesSqlBuilder(dialect);
        this.fks = new ForeignKeysSqlBuilder(dialect);
        this.columns = new ColumnsSqlBuilder(dialect);
    }
    build(diff) {
        const up = [];
        const down = [];
        for (const tableDiff of diff.tables)
            this.handleTable(tableDiff, up, down);
        return { up, down };
    }
    handleTable(tableDiff, up, down) {
        this.tables.rename(tableDiff, up);
        if (this.tables.create(tableDiff, up, down))
            return;
        if (this.tables.drop(tableDiff, up))
            return;
        this.indexes.create(tableDiff, up);
        this.indexes.drop(tableDiff, up);
        this.fks.create(tableDiff, up);
        this.fks.drop(tableDiff, up);
        this.columns.changes(tableDiff, up, down);
        this.columns.renames(tableDiff, up);
    }
}
//# sourceMappingURL=DialectMigrationSql.js.map