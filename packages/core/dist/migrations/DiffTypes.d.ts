export interface ColumnDef {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: unknown;
    isPrimaryKey?: boolean;
}
export interface IndexDef {
    name: string;
    columns: string[];
    unique: boolean;
}
export interface ForeignKeyDef {
    name?: string;
    columns: string[];
    refTable: string;
    refColumns: string[];
    onDelete?: string;
    onUpdate?: string;
}
export interface TableSnapshot {
    name: string;
    columns: ColumnDef[];
    primaryKeys: string[];
    indexes: IndexDef[];
    foreignKeys: ForeignKeyDef[];
}
export interface SchemaSnapshot {
    tables: TableSnapshot[];
}
export interface ColumnChange {
    kind: 'add' | 'alter' | 'drop';
    column: ColumnDef;
    prev?: ColumnDef;
}
export interface TableDiff {
    table: string;
    create?: TableSnapshot;
    drop?: boolean;
    /** Rename this table to a new name. */
    renameTo?: string;
    columnChanges?: ColumnChange[];
    /** Rename columns within an existing table. */
    columnRenames?: Array<{
        from: string;
        to: string;
    }>;
    /** Create these indexes on the existing table. */
    indexCreates?: IndexDef[];
    /** Drop these index names from the existing table. */
    indexDrops?: string[];
    /** Create these foreign keys on the existing table. */
    fkCreates?: ForeignKeyDef[];
    /** Drop these foreign key constraint names from the existing table. */
    fkDrops?: string[];
}
export interface SchemaDiff {
    tables: TableDiff[];
}
export declare function compareSchemas(expected: SchemaSnapshot, actual: SchemaSnapshot): SchemaDiff;
//# sourceMappingURL=DiffTypes.d.ts.map