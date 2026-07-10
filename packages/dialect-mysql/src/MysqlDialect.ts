import { AbstractSqlDialect } from '@ts-linq/dialect-kit';
import { MetadataStorage } from '@ts-linq/metadata';
import type { DialectVisitorSupport, DialectVisitorTranslators } from '@ts-linq/sql-visitor';
import type {
  BatchInsertResult,
  BatchUpdateResult,
  DialectCapabilities,
  EntityMetadata,
  QueryOptions,
  SqlDialect,
  SqlWithParams,
  SupportsBatch,
  SupportsStoredProcedures
} from '@ts-linq/types';
import { TemporalNotSupportedError } from '@ts-linq/types';

import {
  buildMysqlBatchDelete,
  buildMysqlBatchInsert,
  buildMysqlBatchUpdate,
  MYSQL_PARAM_LIMIT
} from './batch-syntax';
import { mysqlEfFunctions } from './functions/index';
import { MySqlJsonPathTranslator } from './json/JsonPathTranslator';
import { createMysqlSpCallSyntax } from './sp-syntax';
import { mysqlSpatialFunctions } from './spatial-functions';
import { mysqlSyntax } from './syntax';

/**
 * MySQL implementation of `SqlDialect`. The invariant SELECT/CRUD/bulk assembly lives in
 * {@link AbstractSqlDialect}; this class wires the MySQL {@link DialectSyntax}. MySQL has no
 * `RETURNING`/`OUTPUT` and no temporal support, so it only overrides the temporal-rejection hook.
 */
export class MysqlDialect
  extends AbstractSqlDialect
  implements SqlDialect, DialectVisitorSupport, SupportsBatch, SupportsStoredProcedures
{
  private readonly jsonPathTranslator = new MySqlJsonPathTranslator();

  readonly parameterLimit = MYSQL_PARAM_LIMIT;

  /** Explicit capability matrix — MySQL implements every optional group except temporal. */
  public readonly capabilities: DialectCapabilities = {
    crud: true,
    batch: true,
    bulk: true,
    storedProcedures: true,
    temporal: false
  };

  protected readonly syntax = mysqlSyntax;

  /**
   * Dialect-specific translators consumed by the `query` layer's SQL visitor factory so that
   * spatial / JSON-path / EF.functions predicates render to MySQL SQL. MySQL has no native
   * hierarchyid support, so `hierarchyTranslator` is intentionally omitted.
   */
  public getVisitorTranslators(): DialectVisitorTranslators {
    return {
      spatialTranslator: mysqlSpatialFunctions,
      efFunctionTranslator: mysqlEfFunctions,
      jsonPathTranslator: this.jsonPathTranslator
    };
  }

  public getSpCallSyntax() {
    return createMysqlSpCallSyntax();
  }

  public buildBatchInsert(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchInsertResult {
    return buildMysqlBatchInsert(entities, metadata);
  }

  public buildBatchUpdate(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchUpdateResult {
    return buildMysqlBatchUpdate(entities, metadata);
  }

  public buildBatchDelete(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): SqlWithParams {
    return buildMysqlBatchDelete(entities, metadata);
  }

  protected getEntityMetadata<T>(entityClass: new () => T): EntityMetadata | undefined {
    return MetadataStorage.getEntity(entityClass);
  }

  protected assertTemporalSupported(options: QueryOptions): void {
    if (options.temporal) {
      throw new TemporalNotSupportedError(
        'Temporal queries (FOR SYSTEM_TIME) are not supported by the MySQL dialect. ' +
          'Use the @ts-linq/plugin-audit package for row-history tracking on MySQL.'
      );
    }
  }
}
