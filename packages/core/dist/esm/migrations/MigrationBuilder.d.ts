import type { SchemaDiff } from './DiffTypes';
import type { Dialect } from './DialectMigrationSql';
interface ColumnDef {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: unknown;
    defaultExpression?: string;
}
interface IndexDef {
    name: string;
    columns: string[];
    unique?: boolean;
}
interface ForeignKeyDef {
    name?: string;
    columns: string[];
    refTable: string;
    refColumns: string[];
    onDelete?: string;
    onUpdate?: string;
}
declare class TableBuilder {
    readonly name: string;
    columns: ColumnDef[];
    primaryKeys: string[];
    indexes: IndexDef[];
    foreignKeys: ForeignKeyDef[];
    constructor(name: string);
    column(name: string, type: string, opts?: {
        nullable?: boolean;
        defaultValue?: unknown;
        defaultExpression?: string;
    }): this;
    primaryKey(...cols: string[]): this;
    index(name: string, columns: string[], unique?: boolean): this;
    foreignKey(def: ForeignKeyDef): this;
}
export declare class MigrationBuilder {
    private creates;
    private drops;
    private columnAdds;
    private columnAlters;
    private columnDrops;
    private indexCreates;
    private indexDrops;
    private fkCreates;
    private fkDrops;
    private tableRenames;
    private columnRenames;
    createTable(name: string, build: (t: TableBuilder) => void): this;
    dropTable(name: string): this;
    alterTable(name: string, ops: (t: {
        addColumn: (name: string, type: string, opts?: {
            nullable?: boolean;
            defaultValue?: unknown;
        }) => void;
        alterColumn: (name: string, type?: string, opts?: {
            nullable?: boolean;
            defaultValue?: unknown;
        }) => void;
        dropColumn: (name: string) => void;
    }) => void): this;
    createIndex(table: string, name: string, columns: string[], unique?: boolean): this;
    dropIndex(table: string, name: string): this;
    addForeignKey(table: string, fk: {
        name?: string;
        columns: string[];
        refTable: string;
        refColumns: string[];
        onDelete?: string;
        onUpdate?: string;
    }): this;
    dropForeignKey(table: string, name: string): this;
    renameTable(from: string, to: string): this;
    renameColumn(table: string, from: string, to: string): this;
    toDiff(): SchemaDiff;
    toSql(dialect: Dialect): {
        up: string[];
        down: string[];
    };
}
export {};
//# sourceMappingURL=MigrationBuilder.d.ts.map