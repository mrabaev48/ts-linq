export interface ColumnDef {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: any;
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
    columnChanges?: ColumnChange[];
    // future: indexChanges, fkChanges
}

export interface SchemaDiff {
    tables: TableDiff[];
}

export function compareSchemas(expected: SchemaSnapshot, actual: SchemaSnapshot): SchemaDiff {
    const diffs: TableDiff[] = [];
    const actualByName = new Map(actual.tables.map(t => [t.name, t] as const));
    const expectedNames = new Set(expected.tables.map(t => t.name));

    // New or altered tables
    for (const e of expected.tables) {
        const a = actualByName.get(e.name);
        if (!a) {
            diffs.push({ table: e.name, create: e });
            continue;
        }
        const changes: ColumnChange[] = [];
        const actualColsByName = new Map(a.columns.map(c => [c.name, c] as const));
        for (const ec of e.columns) {
            const ac = actualColsByName.get(ec.name);
            if (!ac) {
                changes.push({ kind: 'add', column: ec });
            } else {
                const typeChanged = normalizeType(ec.type) !== normalizeType((ac as any).type);
                // Compare by nullable flag when available in snapshot
                const nullableChanged = (typeof (ac as any).nullable === 'boolean') ? (ec.nullable !== (ac as any).nullable) : false;
                const needsAlter = typeChanged || nullableChanged;
                if (needsAlter) {
                    changes.push({ kind: 'alter', column: ec, prev: ac });
                }
            }
        }
        // Drops
        const expectedColsByName = new Map(e.columns.map(c => [c.name, c] as const));
        for (const ac of a.columns) {
            if (!expectedColsByName.has(ac.name)) {
                changes.push({ kind: 'drop', column: ac });
            }
        }
        if (changes.length > 0) diffs.push({ table: e.name, columnChanges: changes });
    }
    // Dropped tables
    const expectedByName = new Map(expected.tables.map(t => [t.name, t] as const));
    for (const a of actual.tables) {
        if (!expectedByName.has(a.name)) {
            diffs.push({ table: a.name, drop: true });
        }
    }
    return { tables: diffs };
}

function normalizeType(t: string): string {
    return String(t || '').trim().toUpperCase();
}


