import { DatabaseProvider } from '@ts-linq/core';
import type {
  EntityMetadata,
  QueryOptions,
  SqlDialect,
  SqlParameter,
  SqlQueryResult
} from '@ts-linq/types';

/** Thrown when any operation is attempted on the stub provider. */
export class UnsupportedInStubProviderError extends Error {
  constructor(method: string) {
    super(
      `StubDatabaseProvider.${method}() is not supported. ` +
        `This provider exists only for compiled-model extraction during "dbcontext optimize".`
    );
    this.name = 'UnsupportedInStubProviderError';
  }
}

const STUB_DIALECT: SqlDialect = {
  buildSelect<T>(_entityClass: new () => T, _options: QueryOptions): SqlQueryResult {
    throw new UnsupportedInStubProviderError('dialect.buildSelect');
  },
  quoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }
};

/**
 * Minimal no-op DatabaseProvider used by DbContextOptimizeCommand to instantiate
 * a user's DbContext without a real database connection. Triggers decorator
 * processing and onModelCreating so the MetadataRegistry can be drained.
 *
 * All query/mutation methods throw UnsupportedInStubProviderError.
 */
export class StubDatabaseProvider extends DatabaseProvider {
  public constructor() {
    super('stub://localhost');
  }

  public override get providerLabel(): string {
    return 'stub';
  }

  protected async doConnect(): Promise<void> {
    // no-op
  }

  protected async doDisconnect(): Promise<void> {
    // no-op
  }

  public getDialect(): SqlDialect {
    return STUB_DIALECT;
  }

  public async createTable(_entityMetadata: EntityMetadata): Promise<void> {
    throw new UnsupportedInStubProviderError('createTable');
  }

  public async insert<T extends object>(_entity: T, _entityClass: Function): Promise<T> {
    throw new UnsupportedInStubProviderError('insert');
  }

  public async update<T extends object>(_entity: T, _entityClass: Function): Promise<T> {
    throw new UnsupportedInStubProviderError('update');
  }

  public async delete<T extends object>(_entity: T, _entityClass: Function): Promise<void> {
    throw new UnsupportedInStubProviderError('delete');
  }

  public async findById<T extends object>(
    _id: unknown,
    _entityClass: new () => T
  ): Promise<T | null> {
    throw new UnsupportedInStubProviderError('findById');
  }

  public async findAll<T extends object>(_entityClass: new () => T): Promise<T[]> {
    throw new UnsupportedInStubProviderError('findAll');
  }

  public async findWhere<T extends object>(
    _entityClass: new () => T,
    _conditions: Record<string, unknown>
  ): Promise<T[]> {
    throw new UnsupportedInStubProviderError('findWhere');
  }

  public async findWhereIn<T extends object>(
    _entityClass: new () => T,
    _column: string,
    _values: unknown[]
  ): Promise<T[]> {
    throw new UnsupportedInStubProviderError('findWhereIn');
  }

  protected async doExecuteQuery<T>(_sql: string, _params?: readonly SqlParameter[]): Promise<T[]> {
    throw new UnsupportedInStubProviderError('doExecuteQuery');
  }

  protected async doExecuteNonQuery(
    _sql: string,
    _params?: readonly SqlParameter[]
  ): Promise<number> {
    throw new UnsupportedInStubProviderError('doExecuteNonQuery');
  }

  protected async doBeginTransaction(): Promise<void> {
    throw new UnsupportedInStubProviderError('doBeginTransaction');
  }

  protected async doCommitTransaction(): Promise<void> {
    throw new UnsupportedInStubProviderError('doCommitTransaction');
  }

  protected async doRollbackTransaction(): Promise<void> {
    throw new UnsupportedInStubProviderError('doRollbackTransaction');
  }

  public streamRows(
    _baseSql: string,
    _params: readonly SqlParameter[],
    _startOffset: number,
    _maxRows: number | undefined,
    _signal?: AbortSignal
  ): AsyncIterable<Record<string, unknown>> {
    throw new UnsupportedInStubProviderError('streamRows');
  }
}
