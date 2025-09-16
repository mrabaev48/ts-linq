import { DatabaseProvider, EntityMetadata, SqlLogger, RetryPolicy, SqlParameter, OrmMiddleware, SoftDeleteOptions, SqlDialect } from '@ts-linq/core';
/**
 * Microsoft SQL Server provider based on the `mssql` package.
 *
 * Responsibilities:
 * - Connection pooling and lifecycle
 * - DDL generation for basic table/index creation
 * - DML helpers for insert/update/delete/find operations
 * - Transaction management (begin/commit/rollback)
 * - Parameter style mapping (`?` → `@p1..@pn`)
 *
 * @example
 * import 'reflect-metadata';
 * import { DbContext, DbSet, Entity, Column, PrimaryKey } from '../src';
 *
 * @Entity({ name: 'Users' })
 * class User {
 *   @PrimaryKey({ autoIncrement: true }) id!: number;
 *   @Column({ type: 'TEXT', nullable: false }) name!: string;
 * }
 *
 * class AppCtx extends DbContext {
 *   public users!: DbSet<User>;
 *   constructor() { super({ provider: 'mssql', connectionString: process.env.MSSQL_URL! }); }
 * }
 *
 * async function run() {
 *   const ctx = new AppCtx();
 *   await ctx.ensureCreated();
 *   const user = new User(); user.name = 'Alice';
 *   ctx.users.add(u);
 *   await ctx.saveChanges();
 *   const all = await ctx.users.toArray();
 *   await ctx.dispose();
 * }
 */
export declare class MssqlProvider extends DatabaseProvider {
    private pool;
    private tx;
    private ddl;
    /** Create provider with MSSQL connection string. */
    constructor(connectionString: string, logger?: SqlLogger, middlewares?: OrmMiddleware[], softDelete?: SoftDeleteOptions, retryPolicy?: RetryPolicy);
    /** Open a connection pool to MSSQL server. */
    connect(): Promise<void>;
    /** Close transaction (if any) and dispose the pool. */
    disconnect(): Promise<void>;
    /** Create table and indexes using entity metadata if absent. */
    createTable(entityMetadata: EntityMetadata): Promise<void>;
    /** Insert entity row; when PK is IDENTITY, sets generated value via SCOPE_IDENTITY(). */
    insert<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Update entity row by primary key. Throws if no rows affected. */
    update<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Delete entity row by primary key. Throws if no rows affected. */
    delete<T extends object>(entity: T, entityClass: Function): Promise<void>;
    /** Upsert using MERGE statement (simplified). */
    upsert<T extends object>(entity: T, entityClass: Function): Promise<T>;
    /** Find a single entity by its primary key value. */
    findById<T extends object>(id: unknown, entityClass: new () => T): Promise<T | null>;
    /** Return all entities of the given type. */
    findAll<T extends object>(entityClass: new () => T): Promise<T[]>;
    /** Find entities by simple conditions object (column equals). */
    findWhere<T extends object>(entityClass: new () => T, conditions: Record<string, unknown>): Promise<T[]>;
    /** Find entities where a column value is in the given array (IN clause). */
    findWhereIn<T extends object>(entityClass: new () => T, column: string, values: unknown[]): Promise<T[]>;
    /** Execute a SQL query and return the recordset rows. */
    protected doExecuteQuery<T>(_sql: string, _params?: readonly SqlParameter[]): Promise<T[]>;
    /** Execute a non-query SQL statement and return affected rows count. */
    protected doExecuteNonQuery(_sql: string, _params?: readonly SqlParameter[]): Promise<number>;
    /** Begin a database transaction. */
    beginTransaction(): Promise<void>;
    /** Commit the current transaction. */
    commitTransaction(): Promise<void>;
    /** Roll back the current transaction. */
    rollbackTransaction(): Promise<void>;
    /** Provide SQL dialect for this provider. */
    getDialect(): SqlDialect;
    private generateInsertSql;
    private generateUpdateSql;
    private generateDeleteSql;
    private mapRowToEntity;
    private coerceToSqlParameter;
}
export declare function mapTypeToMssql(type: string): string;
//# sourceMappingURL=MssqlProvider.d.ts.map