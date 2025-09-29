import type { DatabaseProvider } from '@ts-linq/core';
export declare function normalizeDbType(label: string, dbTypeRaw: string): string;
export declare function tsTypeForOrm(colType: string): string;
export declare function inspectTable(provider: DatabaseProvider, label: string, table: string, schema?: string): Promise<Array<{
    name: string;
    dbType: string;
    ormType: string;
    nullable: boolean;
    isPrimary: boolean;
}>>;
export declare function listAllTables(provider: DatabaseProvider, label: string, schema?: string): Promise<string[]>;
//# sourceMappingURL=schema-inspect.d.ts.map