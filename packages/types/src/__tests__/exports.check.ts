/**
 * Type-level export verification for @ts-linq/types.
 * Every symbol previously exported from the 1275-line index.ts must still resolve.
 * Excluded from the build (tsconfig.build.json) but checked by tsc --noEmit.
 */

import type {
  // sql.ts
  AfterExecuteInfo,
  AlternateKeyMetadata,
  AuditOptions,
  BaseProviderConfig,
  BatchInsertResult,
  BatchUpdateResult,
  BeforeExecuteInfo,
  BulkDeleteContext,
  BulkUpdateContext,
  CacheInfo,
  CacheOptions,
  CacheSizeInfo,
  CheckConstraintMetadata,
  CircuitEventInfo,
  CircuitState,
  ColumnMetadata,
  ColumnOptions,
  ColumnType,
  ComplexTypePropertyMetadata,
  ConnectionHealthCheckOptions,
  ConnectionHealthInfo,
  ConnectionHealthStatus,
  ConnectionPoolOptions,
  CountCache,
  CrossQueryParams,
  CteDefinition,
  DatabaseColumnModel,
  DatabaseForeignKeyModel,
  DatabaseIndexModel,
  DatabaseModel,
  DatabaseTableModel,
  DbIntrospector,
  DeleteBehavior,
  DiagnosticConfig,
  DiscriminatorEntry,
  DiscriminatorMetadata,
  EntityAttacher,
  EntityCacheLike,
  EntityChangeContext,
  EntityCtor,
  EntityMetadata,
  EntityRef,
  EntityState,
  EntityStoredProcedureMapping,
  ExecutionStrategyOptions,
  FallbackInfo,
  FallbackOperation,
  FallbackPolicy,
  FallbackRequest,
  FilteredIncludeSpec,
  GlobalFilter,
  GroupByClause,
  HedgedWinInfo,
  HierarchyIdTranslator,
  HierarchyMetadata,
  IndexMetadata,
  InheritanceStrategy,
  JoinClause,
  JoinType,
  JsonShape,
  JsonShapeNode,
  LoadingDefaults,
  LoadingStrategy,
  Logger,
  LogLevel,
  MssqlConfig,
  MySqlConfig,
  OrderByClause,
  OrmError,
  OrmMiddleware,
  OwnedEntityMetadata,
  PerformanceOptions,
  PerformanceOptionsExtended,
  PostgresConfig,
  QueryAnalysisInfo,
  QueryEndInfo,
  QueryFallback,
  QueryFilterMetadata,
  QueryOptions,
  QuerySplittingBehavior,
  QueryStartInfo,
  RelationshipMetadata,
  RelationshipOptions,
  Result,
  RetryInfo,
  RetryPolicy,
  ScaffoldConnectionOptions,
  ScaffoldOptions,
  ScaffoldProviderKind,
  SequenceMetadata,
  SetterSpec,
  ShadowPropertyMetadata,
  SkipNavigationMetadata,
  SoftDeleteOptions,
  SoftDeleteOptionsExtended,
  SpatialTranslator,
  SpCallResult,
  SpCallSyntax,
  SpParameterDirection,
  SpParameterMapping,
  SpRowsAffectedMode,
  SqlCache,
  SqlCacheEntry,
  SqlCacheMetrics,
  SqlDialect,
  SqlLogger,
  SqlLoggerFactory,
  SqlParameter,
  SqlQueryResult,
  SqlWithParams,
  SqlWithReturning,
  StorageStrategy,
  StoredProcedureConfig,
  TableFragmentMetadata,
  TemplateSqlCache,
  TemporalClause,
  TemporalMode,
  TrackedEntity,
  TransactionInfo,
  ValidationRule,
  ValueComparerLike,
  ValueConverterLike,
  ValueGeneratedPolicy,
  ValueGenerator,
  ValueGeneratorClass,
  ValueGeneratorContext,
  WarningBehavior,
  WhereClause
} from '..';
import type { OrmErrorOptions } from '..';
// Runtime value imports (functions, enums, classes)
import {
  BatchConfigurationError,
  DatabaseError,
  DecoratorUsageError,
  err,
  ForeignKeyConstraintError,
  InvalidIncludeError,
  isTemplateSqlCache,
  MetadataError,
  ok,
  OperationAbortedError,
  OptimisticConcurrencyError,
  OrmErrorCode,
  TemporalNotSupportedError,
  UniqueConstraintError,
  UnsupportedOperationError,
  ValidationError
} from '..';

// Type-level assertions: each symbol must be a valid type/value.
// All variables use _-prefix so ESLint varsIgnorePattern suppresses unused warnings.

declare const _sqlParam: SqlParameter;
declare const _orderBy: OrderByClause;
declare const _where: WhereClause;
declare const _join: JoinClause;
declare const _groupBy: GroupByClause;
declare const _temporalMode: TemporalMode;
declare const _temporalClause: TemporalClause;
declare const _queryOptions: QueryOptions;
declare const _joinType: JoinType;
declare const _cte: CteDefinition;
declare const _filteredInclude: FilteredIncludeSpec;
declare const _splitBehavior: QuerySplittingBehavior;
declare const _logger: Logger;
declare const _healthStatus: ConnectionHealthStatus;
declare const _circuitState: CircuitState;
declare const _queryStart: QueryStartInfo;
declare const _queryEnd: QueryEndInfo;
declare const _retry: RetryInfo;
declare const _tx: TransactionInfo;
declare const _cacheInfo: CacheInfo;
declare const _connHealth: ConnectionHealthInfo;
declare const _circuitEvent: CircuitEventInfo;
declare const _fallbackInfo: FallbackInfo;
declare const _hedgedWin: HedgedWinInfo;
declare const _analysis: QueryAnalysisInfo;
declare const _crossQuery: CrossQueryParams;
declare const _cacheSize: CacheSizeInfo;
declare const _sqlLogger: SqlLogger;
declare const _sqlLoggerFactory: SqlLoggerFactory;
declare const _sqlQueryResult: SqlQueryResult;
declare const _sqlWithParams: SqlWithParams;
declare const _sqlWithReturning: SqlWithReturning;
declare const _batchInsert: BatchInsertResult;
declare const _batchUpdate: BatchUpdateResult;
declare const _setter: SetterSpec;
declare const _bulkUpdate: BulkUpdateContext;
declare const _bulkDelete: BulkDeleteContext;
declare const _dialect: SqlDialect;
declare const _beforeExec: BeforeExecuteInfo;
declare const _afterExec: AfterExecuteInfo;
declare const _entityChange: EntityChangeContext;
declare const _middleware: OrmMiddleware;
declare const _retryPolicy: RetryPolicy;
declare const _execStrategy: ExecutionStrategyOptions;
declare const _poolOptions: ConnectionPoolOptions;
declare const _healthCheck: ConnectionHealthCheckOptions;
declare const _softDelete: SoftDeleteOptions;
declare const _softDeleteExt: SoftDeleteOptionsExtended;
declare const _baseConfig: BaseProviderConfig;
declare const _pgConfig: PostgresConfig;
declare const _mysqlConfig: MySqlConfig;
declare const _mssqlConfig: MssqlConfig;
declare const _audit: AuditOptions;
declare const _globalFilter: GlobalFilter;
declare const _queryFilter: QueryFilterMetadata;
declare const _result: Result<string>;
declare const _fallbackOp: FallbackOperation;
declare const _fallbackReq: FallbackRequest;
declare const _queryFallback: QueryFallback;
declare const _fallbackPolicy: FallbackPolicy;
declare const _cacheMetrics: SqlCacheMetrics;
declare const _countCache: CountCache;
declare const _cacheEntry: SqlCacheEntry;
declare const _sqlCache: SqlCache;
declare const _templateCache: TemplateSqlCache;
declare const _perfOptions: PerformanceOptions;
declare const _perfOptionsExt: PerformanceOptionsExtended;
declare const _loadingStrategy: LoadingStrategy;
declare const _cacheOptions: CacheOptions;
declare const _entityCache: EntityCacheLike;
declare const _loadingDefaults: LoadingDefaults;
declare const _columnType: ColumnType;
declare const _valueConverter: ValueConverterLike;
declare const _valueComparer: ValueComparerLike;
declare const _sequence: SequenceMetadata;
declare const _valueGenPolicy: ValueGeneratedPolicy;
declare const _valueGenCtx: ValueGeneratorContext;
declare const _valueGen: ValueGenerator;
declare const _valueGenClass: ValueGeneratorClass;
declare const _columnOptions: ColumnOptions;
declare const _relOptions: RelationshipOptions;
declare const _columnMeta: ColumnMetadata;
declare const _deleteBehavior: DeleteBehavior;
declare const _relMeta: RelationshipMetadata;
declare const _checkConstraint: CheckConstraintMetadata;
declare const _indexMeta: IndexMetadata;
declare const _alternateKey: AlternateKeyMetadata;
declare const _validationRule: ValidationRule;
declare const _storageStrategy: StorageStrategy;
declare const _inheritanceStrategy: InheritanceStrategy;
declare const _discriminatorEntry: DiscriminatorEntry;
declare const _discriminatorMeta: DiscriminatorMetadata;
declare const _hierarchyMeta: HierarchyMetadata;
declare const _jsonShapeNode: JsonShapeNode;
declare const _jsonShape: JsonShape;
declare const _ownedEntity: OwnedEntityMetadata;
declare const _complexType: ComplexTypePropertyMetadata;
declare const _skipNav: SkipNavigationMetadata;
declare const _tableFragment: TableFragmentMetadata;
declare const _entityMeta: EntityMetadata;
declare const _shadowProp: ShadowPropertyMetadata;
declare const _attacher: EntityAttacher;
declare const _spDirection: SpParameterDirection;
declare const _spRowsMode: SpRowsAffectedMode;
declare const _spParamMapping: SpParameterMapping;
declare const _spConfig: StoredProcedureConfig;
declare const _entitySpMapping: EntityStoredProcedureMapping;
declare const _spCallResult: SpCallResult;
declare const _spCallSyntax: SpCallSyntax;
declare const _entityState: EntityState;
declare const _trackedEntity: TrackedEntity;
declare const _hierarchyTranslator: HierarchyIdTranslator;
declare const _spatialTranslator: SpatialTranslator;
declare const _logLevel: LogLevel;
declare const _warnBehavior: WarningBehavior;
declare const _diagConfig: DiagnosticConfig;
declare const _dbColumn: DatabaseColumnModel;
declare const _dbFk: DatabaseForeignKeyModel;
declare const _dbIndex: DatabaseIndexModel;
declare const _dbTable: DatabaseTableModel;
declare const _dbModel: DatabaseModel;
declare const _introspector: DbIntrospector;
declare const _scaffoldKind: ScaffoldProviderKind;
declare const _scaffoldOptions: ScaffoldOptions;
declare const _scaffoldConnOptions: ScaffoldConnectionOptions;

// Runtime value assertions — verify functions and classes exist and are callable
const _ok = ok(42);
const _err = err(new Error('test'));
const _isTemplate = isTemplateSqlCache;
const _dbError = new DatabaseError('test');
const _fkError = new ForeignKeyConstraintError('test');
const _occError = new OptimisticConcurrencyError('test');
const _temporalError = new TemporalNotSupportedError('test');
const _uniqueError = new UniqueConstraintError('test');
const _validationError = new ValidationError('test');
const _unsupportedError = new UnsupportedOperationError('test');
const _metadataError = new MetadataError('test');
const _decoratorError = new DecoratorUsageError('test');
const _batchError = new BatchConfigurationError('test');
const _includeError = new InvalidIncludeError('test');
const _abortedError = new OperationAbortedError('test');
const _ormErrorCode = OrmErrorCode.DatabaseError;
declare const _ormErrorOptions: OrmErrorOptions;
// OrmError is abstract: reference the type, never instantiate it directly.
declare const _ormError: OrmError;

// ─── EntityCtor / EntityRef (types/task-4) ──────────────────────────────────
// The aliases are type-only and must flow through the barrel without adding any
// runtime export (guarded by tests/type-exports.test.ts Object.keys assertion).
declare const _entityCtor: EntityCtor;
declare const _entityRef: EntityRef;

class _SampleEntity {}

// Positive: a real class is a valid entity constructor / reference.
const _validCtor: EntityCtor = _SampleEntity;
const _validRefCtor: EntityRef = _SampleEntity;
const _validRefThunk: EntityRef = () => _SampleEntity;
void _validCtor;
void _validRefCtor;
void _validRefThunk;

// Negative: a plain function is not constructable — assigning it must be a compile error.
// @ts-expect-error plain function is not assignable to a construct signature
const _badFnCtor: EntityCtor = function notAConstructor(): void {};
// Negative: an arrow function is not constructable either.
// @ts-expect-error arrow function is not assignable to a construct signature
const _badArrowCtor: EntityCtor = (): void => {};
// Negative: a thunk that does not return a constructor is not an EntityRef.
// @ts-expect-error thunk must return an EntityCtor, not an arbitrary value
const _badRefThunk: EntityRef = () => 42;
void _badFnCtor;
void _badArrowCtor;
void _badRefThunk;

export {};
