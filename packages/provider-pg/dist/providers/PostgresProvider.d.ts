import type {
  EntityMetadata,
  RetryPolicy,
  SqlParameter,
  OrmMiddleware,
  SoftDeleteOptions,
  SqlLogger,
  SqlDialect
} from '@ts-linq/core';
import { DatabaseProvider } from '@ts-linq/core';
export declare class PostgresProvider extends DatabaseProvider {
  private pool;
  private qb;
  private ddl;
  private mapRowToEntity;
  constructor(
    connectionString: string,
    logger?: SqlLogger,
    middlewares?: OrmMiddleware[],
    softDelete?: SoftDeleteOptions,
    retryPolicy?: RetryPolicy
  );
  private coerceToSqlParameter;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createTable(entityMetadata: EntityMetadata): Promise<void>;
  insert<T extends object>(entity: T, entityClass: Function): Promise<T>;
  update<T extends object>(entity: T, entityClass: Function): Promise<T>;
  upsert<T extends object>(entity: T, entityClass: Function): Promise<T>;
  delete<T extends object>(entity: T, entityClass: Function): Promise<void>;
  getDialect(): SqlDialect;
  findById<T extends object>(id: unknown, entityClass: new () => T): Promise<T | null>;
  findAll<T extends object>(entityClass: new () => T): Promise<T[]>;
  findWhere<T extends object>(
    entityClass: new () => T,
    conditions: Record<string, unknown>
  ): Promise<T[]>;
  findWhereIn<T extends object>(
    entityClass: new () => T,
    column: string,
    values: unknown[]
  ): Promise<T[]>;
  protected doExecuteQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]>;
  protected doExecuteNonQuery(sql: string, params?: readonly SqlParameter[]): Promise<number>;
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
}
//# sourceMappingURL=PostgresProvider.d.ts.map
