import { AbstractSqlDialect, type InsertDecoration } from '@ts-linq/dialect-kit';
import { MetadataStorage } from '@ts-linq/metadata';
import type { DialectVisitorSupport, DialectVisitorTranslators } from '@ts-linq/sql-visitor';
import type {
  BatchInsertResult,
  BatchUpdateResult,
  EntityMetadata,
  QueryOptions,
  SqlDialect,
  SqlParameter,
  SqlWithParams
} from '@ts-linq/types';

import {
  buildMssqlBatchDelete,
  buildMssqlBatchInsert,
  buildMssqlBatchUpdate,
  MSSQL_PARAM_LIMIT
} from './batch-syntax';
import { buildTemporalClause } from './emit-temporal';
import { mssqlEfFunctions } from './functions/index';
import { mssqlHierarchyFunctions } from './hierarchy-functions';
import { MssqlJsonPathTranslator } from './json/JsonPathTranslator';
import { quoteIdentifier } from './quoting';
import { createMssqlSpCallSyntax } from './sp-syntax';
import { mssqlSpatialFunctions } from './spatial-functions';
import { mssqlSyntax } from './syntax';

/**
 * SQL Server (T-SQL) implementation of `SqlDialect`. The invariant SELECT/CRUD/bulk assembly lives
 * in {@link AbstractSqlDialect}; this class wires the T-SQL {@link DialectSyntax} plus the two
 * divergent hooks (temporal `FOR SYSTEM_TIME` rendering and `OUTPUT INSERTED` write-back).
 */
export class MssqlDialect extends AbstractSqlDialect implements SqlDialect, DialectVisitorSupport {
  private readonly jsonPathTranslator = new MssqlJsonPathTranslator();

  readonly parameterLimit = MSSQL_PARAM_LIMIT;

  protected readonly syntax = mssqlSyntax;

  /**
   * Dialect-specific translators consumed by the `query` layer's SQL visitor factory so that
   * spatial / hierarchyid / JSON-path / EF.functions predicates render to T-SQL.
   */
  public getVisitorTranslators(): DialectVisitorTranslators {
    return {
      spatialTranslator: mssqlSpatialFunctions,
      hierarchyTranslator: mssqlHierarchyFunctions,
      efFunctionTranslator: mssqlEfFunctions,
      jsonPathTranslator: this.jsonPathTranslator
    };
  }

  public getSpCallSyntax() {
    return createMssqlSpCallSyntax();
  }

  public buildBatchInsert(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchInsertResult {
    return buildMssqlBatchInsert(entities, metadata);
  }

  public buildBatchUpdate(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchUpdateResult {
    return buildMssqlBatchUpdate(entities, metadata);
  }

  public buildBatchDelete(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): SqlWithParams {
    return buildMssqlBatchDelete(entities, metadata);
  }

  protected getEntityMetadata<T>(entityClass: new () => T): EntityMetadata | undefined {
    return MetadataStorage.getEntity(entityClass);
  }

  protected renderTemporal(options: QueryOptions, parameters: SqlParameter[]): string {
    return options.temporal ? buildTemporalClause(options.temporal, parameters) : '';
  }

  protected getInsertDecoration(metadata: EntityMetadata): InsertDecoration {
    const firstPk = metadata.primaryKeys?.[0];
    const pkColMeta = firstPk
      ? metadata.columns.find((c) => c.propertyName === firstPk)
      : undefined;
    if (firstPk && pkColMeta?.isGenerated) {
      return {
        output: ` OUTPUT INSERTED.${quoteIdentifier(pkColMeta.columnName)} AS id`,
        returningPk: firstPk
      };
    }
    return {};
  }
}
