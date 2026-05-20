import type {
  IDbCommandInterceptor,
  IDbConnectionInterceptor,
  IDbTransactionInterceptor,
  IMaterializationInterceptor,
  ISaveChangesInterceptor
} from '@ts-linq/core';

// ── Duck-typing guards ────────────────────────────────────────────────────────
// Use 'in' operator — class methods live on the prototype chain, so 'in' is correct.

function isCommandInterceptor(v: object): v is IDbCommandInterceptor {
  return (
    'readerExecuting' in v ||
    'readerExecuted' in v ||
    'nonQueryExecuting' in v ||
    'nonQueryExecuted' in v
  );
}

function isSaveChangesInterceptor(v: object): v is ISaveChangesInterceptor {
  return 'savingChanges' in v || 'savedChanges' in v || 'saveChangesFailed' in v;
}

function isMaterializationInterceptor(v: object): v is IMaterializationInterceptor {
  return 'initializing' in v || 'initialized' in v;
}

function isConnectionInterceptor(v: object): v is IDbConnectionInterceptor {
  return (
    'connectionOpening' in v ||
    'connectionOpened' in v ||
    'connectionClosing' in v ||
    'connectionClosed' in v
  );
}

function isTransactionInterceptor(v: object): v is IDbTransactionInterceptor {
  return (
    'transactionStarting' in v ||
    'transactionStarted' in v ||
    'transactionCommitting' in v ||
    'transactionCommitted' in v ||
    'transactionRollingBack' in v ||
    'transactionRolledBack' in v
  );
}

// ── Registry ─────────────────────────────────────────────────────────────────

/**
 * Holds all registered interceptors for a single DbContext instance.
 *
 * Interceptors are partitioned by interface at construction time so that
 * per-pipeline calls are O(n) over only the relevant subset.
 *
 * An interceptor object may implement multiple interfaces and will appear
 * in multiple partitions (same reference, multiple arrays).
 *
 * The `isEmpty` flag provides a fast-path: callers can skip all iteration when
 * no interceptors are registered, imposing ~0 overhead on undecorated contexts.
 */
export class InterceptorRegistry {
  /** True when no interceptors are registered; callers may skip iteration. */
  public readonly isEmpty: boolean;

  private readonly _command: IDbCommandInterceptor[];
  private readonly _saveChanges: ISaveChangesInterceptor[];
  private readonly _materialization: IMaterializationInterceptor[];
  private readonly _connection: IDbConnectionInterceptor[];
  private readonly _transaction: IDbTransactionInterceptor[];

  constructor(interceptors: object[]) {
    this.isEmpty = interceptors.length === 0;

    if (this.isEmpty) {
      this._command = [];
      this._saveChanges = [];
      this._materialization = [];
      this._connection = [];
      this._transaction = [];
      return;
    }

    this._command = interceptors.filter(isCommandInterceptor);
    this._saveChanges = interceptors.filter(isSaveChangesInterceptor);
    this._materialization = interceptors.filter(isMaterializationInterceptor);
    this._connection = interceptors.filter(isConnectionInterceptor);
    this._transaction = interceptors.filter(isTransactionInterceptor);
  }

  forEachCommand(): IDbCommandInterceptor[] {
    return this._command;
  }

  forEachSaveChanges(): ISaveChangesInterceptor[] {
    return this._saveChanges;
  }

  forEachMaterialization(): IMaterializationInterceptor[] {
    return this._materialization;
  }

  forEachConnection(): IDbConnectionInterceptor[] {
    return this._connection;
  }

  forEachTransaction(): IDbTransactionInterceptor[] {
    return this._transaction;
  }
}
