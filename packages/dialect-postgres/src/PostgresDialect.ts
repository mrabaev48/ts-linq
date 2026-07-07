import { AbstractSqlDialect, type InsertDecoration } from '@ts-linq/dialect-kit';
import { MetadataStorage } from '@ts-linq/metadata';
import type { DialectVisitorSupport, DialectVisitorTranslators } from '@ts-linq/sql-visitor';
import type {
  BatchInsertResult,
  BatchUpdateResult,
  EntityMetadata,
  QueryOptions,
  SqlDialect,
  SqlWithParams
} from '@ts-linq/types';
import { TemporalNotSupportedError } from '@ts-linq/types';

import {
  buildPgBatchDelete,
  buildPgBatchInsert,
  buildPgBatchUpdate,
  PG_PARAM_LIMIT
} from './batch-syntax';
import { postgresEfFunctions } from './functions/index';
import { PostgresJsonPathTranslator } from './json/JsonPathTranslator';
import { postgresLtreeFunctions } from './ltree-functions';
import { createPostgresSpCallSyntax } from './sp-syntax';
import { postgisSpatialFunctions } from './spatial-functions';
import { postgresSyntax } from './syntax';

/**
 * PostgreSQL implementation of `SqlDialect`. The invariant SELECT/CRUD/bulk assembly lives in
 * {@link AbstractSqlDialect}; this class wires the PostgreSQL {@link DialectSyntax} plus the two
 * divergent hooks (temporal rejection, CTE prefix, `RETURNING *`).
 */
export class PostgresDialect
  extends AbstractSqlDialect
  implements SqlDialect, DialectVisitorSupport
{
  private readonly jsonPathTranslator = new PostgresJsonPathTranslator();

  readonly parameterLimit = PG_PARAM_LIMIT;

  protected readonly syntax = postgresSyntax;

  /**
   * Dialect-specific translators consumed by the `query` layer's SQL visitor factory so that
   * spatial / hierarchy (ltree) / JSON-path / EF.functions predicates render to PostgreSQL SQL.
   */
  public getVisitorTranslators(): DialectVisitorTranslators {
    return {
      spatialTranslator: postgisSpatialFunctions,
      hierarchyTranslator: postgresLtreeFunctions,
      efFunctionTranslator: postgresEfFunctions,
      jsonPathTranslator: this.jsonPathTranslator
    };
  }

  public getSpCallSyntax() {
    return createPostgresSpCallSyntax();
  }

  public buildBatchInsert(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchInsertResult {
    return buildPgBatchInsert(entities, metadata);
  }

  public buildBatchUpdate(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): BatchUpdateResult {
    return buildPgBatchUpdate(entities, metadata);
  }

  public buildBatchDelete(
    entities: Record<string, unknown>[],
    metadata: EntityMetadata
  ): SqlWithParams {
    return buildPgBatchDelete(entities, metadata);
  }

  protected getEntityMetadata<T>(entityClass: new () => T): EntityMetadata | undefined {
    return MetadataStorage.getEntity(entityClass);
  }

  protected assertTemporalSupported(options: QueryOptions): void {
    if (options.temporal) {
      throw new TemporalNotSupportedError(
        'Temporal queries (FOR SYSTEM_TIME) are not supported by the PostgreSQL dialect. ' +
          'Use the @ts-linq/plugin-audit package for row-history tracking on PostgreSQL.'
      );
    }
  }

  protected applyCtePrefix(query: string, options: QueryOptions): string {
    if (!options.cte) return query;
    return `WITH ${options.cte.name} AS (${options.cte.sql}) ` + query;
  }

  protected getInsertDecoration(): InsertDecoration {
    return { returning: ' RETURNING *' };
  }
}
