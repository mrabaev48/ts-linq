import { generateMigrationFromDiff } from './DialectMigrationSql';
class TableBuilder {
    constructor(name) {
        this.columns = [];
        this.primaryKeys = [];
        this.indexes = [];
        this.foreignKeys = [];
        this.name = name;
    }
    column(name, type, opts) {
        this.columns.push({
            name,
            type,
            nullable: opts?.nullable ?? true,
            defaultValue: opts?.defaultValue
        });
        return this;
    }
    primaryKey(...cols) {
        this.primaryKeys = cols;
        return this;
    }
    index(name, columns, unique = false) {
        this.indexes.push({ name, columns, unique });
        return this;
    }
    foreignKey(def) {
        this.foreignKeys.push(def);
        return this;
    }
}
export class MigrationBuilder {
    constructor() {
        this.creates = new Map();
        this.drops = new Set();
        this.columnAdds = [];
        this.columnAlters = [];
        this.columnDrops = [];
        this.indexCreates = [];
        this.indexDrops = [];
        this.fkCreates = [];
        this.fkDrops = [];
        this.tableRenames = [];
        this.columnRenames = [];
    }
    createTable(name, build) {
        const tb = new TableBuilder(name);
        build(tb);
        this.creates.set(name, tb);
        return this;
    }
    dropTable(name) {
        this.drops.add(name);
        return this;
    }
    alterTable(name, ops) {
        const api = {
            addColumn: (colName, type, opts) => {
                this.columnAdds.push({
                    table: name,
                    col: {
                        name: colName,
                        type,
                        nullable: opts?.nullable ?? true,
                        defaultValue: opts?.defaultValue
                    }
                });
            },
            alterColumn: (colName, type, opts) => {
                const target = {
                    name: colName,
                    type: type ?? 'TEXT',
                    nullable: opts?.nullable ?? true,
                    defaultValue: opts?.defaultValue
                };
                // Provide a synthetic prev to force emission of ALTER statements when prior state is unknown
                const prev = {
                    name: colName,
                    type: type ? '__DIFF_FORCE__' : target.type,
                    // Flip nullable if provided to ensure difference is detected; otherwise leave undefined
                    nullable: typeof opts?.nullable === 'boolean' ? !opts.nullable : target.nullable
                };
                this.columnAlters.push({ table: name, col: target, prev });
            },
            dropColumn: (colName) => {
                this.columnDrops.push({ table: name, name: colName });
            }
        };
        ops(api);
        return this;
    }
    createIndex(table, name, columns, unique = false) {
        this.indexCreates.push({ table, index: { name, columns, unique } });
        return this;
    }
    dropIndex(table, name) {
        this.indexDrops.push({ table, name });
        return this;
    }
    addForeignKey(table, fk) {
        this.fkCreates.push({ table, fk });
        return this;
    }
    dropForeignKey(table, name) {
        this.fkDrops.push({ table, name });
        return this;
    }
    renameTable(from, to) {
        this.tableRenames.push({ from, to });
        return this;
    }
    renameColumn(table, from, to) {
        this.columnRenames.push({ table, from, to });
        return this;
    }
    toDiff() {
        const tables = [];
        for (const [name, tb] of this.creates) {
            tables.push({
                table: name,
                create: {
                    name,
                    columns: tb.columns.map((c) => ({
                        name: c.name,
                        columnName: c.name,
                        type: c.type,
                        nullable: c.nullable ?? true,
                        defaultValue: c.defaultValue
                    })),
                    primaryKeys: tb.primaryKeys,
                    indexes: tb.indexes.map((i) => ({
                        name: i.name,
                        columns: i.columns,
                        unique: !!i.unique
                    })),
                    foreignKeys: tb.foreignKeys.map((f) => ({
                        name: f.name,
                        columns: f.columns,
                        refTable: f.refTable,
                        refColumns: f.refColumns,
                        onDelete: f.onDelete,
                        onUpdate: f.onUpdate
                    }))
                }
            });
        }
        for (const name of this.drops) {
            tables.push({ table: name, drop: true });
        }
        // Column changes
        const byTable = new Map();
        const ensure = (t) => {
            let td = byTable.get(t);
            if (!td) {
                td = { table: t, columnChanges: [] };
                byTable.set(t, td);
                tables.push(td);
            }
            return td;
        };
        for (const add of this.columnAdds) {
            ensure(add.table).columnChanges.push({
                kind: 'add',
                column: {
                    name: add.col.name,
                    type: add.col.type,
                    nullable: add.col.nullable ?? true,
                    defaultValue: add.col.defaultValue
                }
            });
        }
        for (const alt of this.columnAlters) {
            ensure(alt.table).columnChanges.push({
                kind: 'alter',
                column: {
                    name: alt.col.name,
                    type: alt.col.type,
                    nullable: alt.col.nullable ?? true,
                    defaultValue: alt.col.defaultValue
                },
                prev: alt.prev
            });
        }
        for (const drop of this.columnDrops) {
            ensure(drop.table).columnChanges.push({
                kind: 'drop',
                column: { name: drop.name, type: 'TEXT', nullable: true }
            });
        }
        // Index creates/drops
        for (const indexCreate of this.indexCreates) {
            const tableDiff = ensure(indexCreate.table);
            tableDiff.indexCreates = tableDiff.indexCreates ?? [];
            tableDiff.indexCreates.push({
                name: indexCreate.index.name,
                columns: indexCreate.index.columns,
                unique: !!indexCreate.index.unique
            });
        }
        for (const indexDrop of this.indexDrops) {
            const tableDiff = ensure(indexDrop.table);
            tableDiff.indexDrops = tableDiff.indexDrops ?? [];
            tableDiff.indexDrops.push(indexDrop.name);
        }
        // FK creates/drops
        for (const foreignKeyCreate of this.fkCreates) {
            const tableDiff = ensure(foreignKeyCreate.table);
            tableDiff.fkCreates = tableDiff.fkCreates ?? [];
            tableDiff.fkCreates.push(foreignKeyCreate.fk);
        }
        for (const foreignKeyDrop of this.fkDrops) {
            const tableDiff = ensure(foreignKeyDrop.table);
            tableDiff.fkDrops = tableDiff.fkDrops ?? [];
            tableDiff.fkDrops.push(foreignKeyDrop.name);
        }
        // Renames
        for (const tableRename of this.tableRenames) {
            const tableDiff = ensure(tableRename.from);
            tableDiff.renameTo = tableRename.to;
        }
        for (const columnRename of this.columnRenames) {
            const tableDiff = ensure(columnRename.table);
            tableDiff.columnRenames = tableDiff.columnRenames ?? [];
            tableDiff.columnRenames.push({ from: columnRename.from, to: columnRename.to });
        }
        return { tables };
    }
    toSql(dialect) {
        return generateMigrationFromDiff(this.toDiff(), dialect);
    }
}
//# sourceMappingURL=MigrationBuilder.js.map