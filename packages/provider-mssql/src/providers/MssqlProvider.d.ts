import type {
  EntityMetadata,
  SqlLogger,
  RetryPolicy,
  SqlParameter,
  OrmMiddleware,
  SoftDeleteOptions,
  SqlDialect
} from '@ts-linq/core';
import { DatabaseProvider } from '@ts-linq/core';
export declare class MssqlProvider extends DatabaseProvider {
  private pool;
  private tx;
  private ddl;
  constructor(
    connectionString: string,
    logger?: SqlLogger,
    middlewares?: OrmMiddleware[],
    softDelete?: SoftDeleteOptions,
    retryPolicy?: RetryPolicy
  );
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createTable(entityMetadata: EntityMetadata): Promise<void>;
  insert<T extends object>(entity: T, entityClass: Function): Promise<T>;
  update<T extends object>(entity: T, entityClass: Function): Promise<T>;
  delete<T extends object>(entity: T, entityClass: Function): Promise<void>;
  upsert<T extends object>(entity: T, entityClass: Function): Promise<T>;
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
  getDialect(): SqlDialect;
  private getRequest;
  private generateInsertSql;
  private generateUpdateSql;
  private generateDeleteSql;
  private mapRowToEntity;
  private coerceToSqlParameter;
}
//# sourceMappingURL=MssqlProvider.d.ts.map
