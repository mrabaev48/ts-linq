import { DatabaseProvider } from '../../src/DatabaseProvider';
import type { EntityMetadata } from '../../src/types';
import type { SqlDialect } from '../../src/query/SqlDialect';
import type { SqlParameter } from '../../src/types';
export declare class ProviderStub extends DatabaseProvider {
    constructor(connectionString: string, logger?: any, middlewares?: any, softDelete?: any, retryPolicy?: any);
    private readonly data;
    private readonly seq;
    private readonly dialect;
    private txBackup?;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    createTable(entityMetadata: EntityMetadata): Promise<void>;
    getDialect(): SqlDialect;
    insert<T extends object>(entity: T, entityClass: Function): Promise<T>;
    update<T extends object>(entity: T, entityClass: Function): Promise<T>;
    delete<T extends object>(entity: T, entityClass: Function): Promise<void>;
    findById<T extends object>(id: unknown, entityClass: new () => T): Promise<T | null>;
    findAll<T extends object>(entityClass: new () => T): Promise<T[]>;
    findWhere<T extends object>(entityClass: new () => T, conditions: Record<string, unknown>): Promise<T[]>;
    findWhereIn<T extends object>(entityClass: new () => T, column: string, values: unknown[]): Promise<T[]>;
    protected doExecuteQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]>;
    protected doExecuteNonQuery(sql: string, _params?: readonly SqlParameter[]): Promise<number>;
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
    private ensureTable;
    private materialize;
}
//# sourceMappingURL=ProviderStub.d.ts.map