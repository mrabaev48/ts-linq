export interface DatabaseProvider {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    execute<T = any>(sql: string, params: any[]): Promise<T[]>;
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
}
export interface DatabaseHarnessOptions {
    provider: DatabaseProvider;
    autoConnect?: boolean;
}
export declare class DatabaseHarness {
    private provider?;
    private cleanup;
    setup(options: DatabaseHarnessOptions): Promise<DatabaseProvider>;
    createSchema(provider: DatabaseProvider, entities: Function[]): Promise<void>;
    dropSchema(provider: DatabaseProvider, entities: Function[]): Promise<void>;
    seed<T>(provider: DatabaseProvider, entity: Function, data: Partial<T>[]): Promise<void>;
    teardown(): Promise<void>;
    private getTableName;
}
export declare function createDatabaseHarness(): DatabaseHarness;
//# sourceMappingURL=DatabaseHarness.d.ts.map