import type {
  BulkDeleteContext,
  BulkUpdateContext,
  ColumnMetadata,
  DialectCapabilities,
  EntityMetadata,
  QueryOptions,
  SqlDialect,
  SqlParameter,
  SqlQueryResult,
  SqlWithParams,
  SqlWithReturning,
  SupportsBulk,
  SupportsCrud
} from '@ts-linq/types';

import {
  type InsertableColumnOptions,
  selectInsertableColumns,
  selectUpdatableColumns
} from '../columns/select-columns';
import { emitGroup } from '../emitters/emitGroup';
import { emitJoin } from '../emitters/emitJoin';
import { emitOrder } from '../emitters/emitOrder';
import { emitWhere } from '../emitters/emitWhere';
import { applyConverter, coerceSqlParameter } from '../params/coerce';
import type { DialectSyntax } from './DialectSyntax';

/**
 * INSERT decoration contributed by a concrete dialect: the `OUTPUT`/`RETURNING` fragments and the
 * name of the primary key returned inline (if any). All fields are optional; a dialect with no
 * inline write-back returns `{}`.
 */
export interface InsertDecoration {
  /** Fragment inserted between the column list and `VALUES` (SQL Server `OUTPUT INSERTED.…`). */
  readonly output?: string;
  /** Fragment appended after the `VALUES (…)` list (PostgreSQL `RETURNING *`). */
  readonly returning?: string;
  /** Property name of the PK returned inline, surfaced on {@link SqlWithReturning}. */
  readonly returningPk?: string;
}

/**
 * Shared base for the SQL dialects (Template Method). Owns the invariant clause-ordering and
 * parameter-collection algorithms for SELECT/INSERT/UPDATE/DELETE and bulk DML; the only
 * dialect-variable tokens are injected through a {@link DialectSyntax} strategy (identifier
 * quoting, parameter-marker renumbering, LIMIT/OFFSET, SELECT head), and the genuinely divergent
 * behavior is exposed as a handful of protected hooks (temporal support, CTE prefix, INSERT
 * decoration).
 *
 * The base depends inward on the abstraction only (`DialectSyntax` + hooks) and never imports a
 * concrete dialect — the shared emitters and coercion/column utilities are the single source of
 * truth, replacing the ~85% duplication previously copy-pasted across the three dialect classes.
 */
export abstract class AbstractSqlDialect implements SqlDialect, SupportsCrud, SupportsBulk {
  /** The dialect-variable token strategy. Supplied by each concrete dialect. */
  protected abstract readonly syntax: DialectSyntax;

  /**
   * Explicit capability matrix. Required (not merely inherited from `SqlDialect`'s optional
   * field) so every dialect built on this shared base is statically forced to declare its true
   * matrix — a future dialect extending `AbstractSqlDialect` cannot silently omit it and fall
   * through to the `require*` method-presence fallback in `@ts-linq/types/runtime.ts` meant for
   * pre-existing, non-`AbstractSqlDialect` `SqlDialect` implementers (test doubles etc.).
   */
  public abstract readonly capabilities: DialectCapabilities;

  /**
   * INSERT column policy. Identical across every current dialect (computed columns and unset
   * generated PKs are omitted); overridable if a future dialect needs a different rule.
   */
  protected readonly insertPolicy: InsertableColumnOptions = {
    excludeComputed: true,
    excludeGeneratedPk: true
  };

  public quoteIdentifier(identifier: string): string {
    return this.syntax.quote(identifier);
  }

  /** Quote a string literal for interpolation into a SQL string-literal position. */
  public quoteStringLiteral(value: string): string {
    return this.syntax.quoteStringLiteral(value);
  }

  public buildSelect<T>(entityClass: new () => T, options: QueryOptions): SqlQueryResult {
    this.assertTemporalSupported(options);
    const parameters: SqlParameter[] = [];
    let query = this.syntax.renderSelectHead(options);
    query = this.applyCtePrefix(query, options);
    // SELECT-clause params must precede FROM params so the marker indices are assigned correctly
    // (`SELECT ?` appears before `FROM … ?` in the SQL string).
    this.collectSelectParams(parameters, options);
    if (options.rawSqlSource) {
      parameters.push(...options.rawSqlSource.params);
      query += ` FROM (${options.rawSqlSource.sql}) AS t0`;
    } else {
      const metadata = this.getEntityMetadata(entityClass);
      if (!metadata) throw new Error(`Entity metadata not found for ${entityClass.name}`);
      query += ` FROM ${this.syntax.quote(options.from ?? metadata.viewName ?? metadata.tableName)}`;
      query += this.renderTemporal(options, parameters);
    }
    query += emitJoin(options, (id) => this.syntax.quote(id));
    query += emitWhere(parameters, options);
    query += emitGroup(parameters, options);
    query += emitOrder(options);
    const hasOrderBy = Boolean(options.orderBy && options.orderBy.length > 0);
    query += this.syntax.renderLimitOffset(options, hasOrderBy);
    query = this.syntax.renumberPlaceholders(query);
    return { query, parameters };
  }

  public buildInsert(entity: Record<string, unknown>, metadata: EntityMetadata): SqlWithReturning {
    const cols = selectInsertableColumns(metadata, entity, this.insertPolicy);
    const names = cols.map((c) => this.syntax.quote(c.columnName));
    const placeholders = cols.map(() => '?');
    const parameters: SqlParameter[] = cols.map((c) =>
      coerceSqlParameter(applyConverter(entity[c.propertyName], c), c.propertyName)
    );
    const sep = this.syntax.insertColumnSeparator;
    const decoration = this.getInsertDecoration(metadata);
    const output = decoration.output ?? '';
    const returning = decoration.returning ?? '';
    const rawSql =
      `INSERT INTO ${this.syntax.quote(metadata.tableName)} (${names.join(sep)})${output}` +
      ` VALUES (${placeholders.join(sep)})${returning}`;
    const sql = this.syntax.renumberPlaceholders(rawSql);
    return { sql, parameters, returningPk: decoration.returningPk };
  }

  public buildUpdate(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    versionCol?: ColumnMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams {
    const primaryKeys = metadata.primaryKeys;
    if (!primaryKeys || primaryKeys.length === 0) {
      throw new Error(`No primary key defined for ${metadata.tableName}`);
    }
    const setCols = selectUpdatableColumns(metadata);
    if (setCols.length === 0) throw new Error(`No updatable columns for ${metadata.tableName}`);

    const setClauses = setCols.map((c) => `${this.syntax.quote(c.columnName)} = ?`);
    const setParams: SqlParameter[] = setCols.map((c) =>
      coerceSqlParameter(applyConverter(entity[c.propertyName], c), c.propertyName)
    );
    if (versionCol) {
      const versionId = this.syntax.quote(versionCol.columnName);
      setClauses.push(`${versionId} = ${versionId} + 1`);
    }

    const whereClauses: string[] = [];
    const whereParams: SqlParameter[] = [];
    for (const pk of primaryKeys) {
      const col = metadata.columns.find((c) => c.propertyName === pk);
      whereClauses.push(`${this.syntax.quote(col?.columnName ?? pk)} = ?`);
      whereParams.push(coerceSqlParameter(col ? applyConverter(entity[pk], col) : entity[pk], pk));
    }
    if (versionCol) {
      whereClauses.push(`${this.syntax.quote(versionCol.columnName)} = ?`);
      whereParams.push(
        coerceSqlParameter(
          applyConverter(entity[versionCol.propertyName], versionCol),
          versionCol.propertyName
        )
      );
    }
    for (const col of (concurrencyTokens ?? []).filter((c) => !c.isVersion)) {
      const origVal = originalValues?.[col.propertyName] ?? entity[col.propertyName];
      whereClauses.push(`${this.syntax.quote(col.columnName)} = ?`);
      whereParams.push(coerceSqlParameter(applyConverter(origVal, col), col.propertyName));
    }

    const rawSql =
      `UPDATE ${this.syntax.quote(metadata.tableName)} SET ${setClauses.join(', ')}` +
      ` WHERE ${whereClauses.join(' AND ')}`;
    const sql = this.syntax.renumberPlaceholders(rawSql);
    return { sql, parameters: [...setParams, ...whereParams] };
  }

  public buildDelete(
    entity: Record<string, unknown>,
    metadata: EntityMetadata,
    concurrencyTokens?: ColumnMetadata[],
    originalValues?: Record<string, unknown>
  ): SqlWithParams {
    const primaryKeys = metadata.primaryKeys;
    if (!primaryKeys || primaryKeys.length === 0) {
      throw new Error(`No primary key defined for ${metadata.tableName}`);
    }
    const whereClauses: string[] = [];
    const parameters: SqlParameter[] = [];
    for (const pk of primaryKeys) {
      const col = metadata.columns.find((c) => c.propertyName === pk);
      whereClauses.push(`${this.syntax.quote(col?.columnName ?? pk)} = ?`);
      parameters.push(coerceSqlParameter(entity[pk], pk));
    }
    for (const col of concurrencyTokens ?? []) {
      const origVal = originalValues?.[col.propertyName] ?? entity[col.propertyName];
      whereClauses.push(`${this.syntax.quote(col.columnName)} = ?`);
      parameters.push(coerceSqlParameter(applyConverter(origVal, col), col.propertyName));
    }
    const rawSql = `DELETE FROM ${this.syntax.quote(metadata.tableName)} WHERE ${whereClauses.join(' AND ')}`;
    const sql = this.syntax.renumberPlaceholders(rawSql);
    return { sql, parameters };
  }

  public buildBulkUpdate(ctx: BulkUpdateContext): SqlWithParams {
    const params: SqlParameter[] = [];
    const setClauses: string[] = [];
    for (const setter of ctx.setters) {
      const col = this.syntax.quote(setter.columnName);
      if (setter.value.kind === 'literal') {
        setClauses.push(`${col} = ?`);
        params.push(...setter.value.params);
      } else {
        setClauses.push(`${col} = ${this.syntax.quote(setter.value.refColumnName)}`);
      }
    }
    let rawSql = `UPDATE ${this.syntax.quote(ctx.tableName)} SET ${setClauses.join(', ')}`;
    if (ctx.where.length > 0) {
      const conditions = ctx.where.map((w) => w.condition).join(' AND ');
      for (const w of ctx.where) params.push(...w.parameters);
      rawSql += ` WHERE ${conditions}`;
    }
    const sql = this.syntax.renumberPlaceholders(rawSql);
    return { sql, parameters: params };
  }

  public buildBulkDelete(ctx: BulkDeleteContext): SqlWithParams {
    const params: SqlParameter[] = [];
    let rawSql = `DELETE FROM ${this.syntax.quote(ctx.tableName)}`;
    if (ctx.where.length > 0) {
      const conditions = ctx.where.map((w) => w.condition).join(' AND ');
      for (const w of ctx.where) params.push(...w.parameters);
      rawSql += ` WHERE ${conditions}`;
    }
    const sql = this.syntax.renumberPlaceholders(rawSql);
    return { sql, parameters: params };
  }

  private collectSelectParams(parameters: SqlParameter[], options: QueryOptions): void {
    if (options.selectParams && options.selectParams.length) {
      parameters.push(...options.selectParams);
    }
  }

  // --- Protected hooks: the only genuinely divergent behavior across dialects. ---

  /**
   * Resolve the entity metadata that `buildSelect` uses to derive the FROM target. Left to the
   * concrete dialect so the base does not depend on the metadata registry (injection is the job of
   * a later task); returns `undefined` when the entity is unknown.
   */
  protected abstract getEntityMetadata<T>(entityClass: new () => T): EntityMetadata | undefined;

  /**
   * Reject an unsupported temporal (`FOR SYSTEM_TIME`) query. Default: supported (no-op). Dialects
   * without temporal support override this to throw. Called first so the rejection fires even for a
   * raw-SQL source.
   */
  protected assertTemporalSupported(_options: QueryOptions): void {}

  /**
   * Render a temporal clause after the FROM target (leading space included). Default: none; SQL
   * Server overrides. Only invoked on the metadata (non-raw-SQL) branch.
   */
  protected renderTemporal(_options: QueryOptions, _parameters: SqlParameter[]): string {
    return '';
  }

  /**
   * Prepend a CTE (`WITH … AS (…) `) to the assembled query. Default: none; PostgreSQL overrides.
   */
  protected applyCtePrefix(query: string, _options: QueryOptions): string {
    return query;
  }

  /**
   * Contribute the dialect's INSERT write-back decoration (`OUTPUT`/`RETURNING` + inline PK).
   * Default: none; PostgreSQL and SQL Server override.
   */
  protected getInsertDecoration(_metadata: EntityMetadata): InsertDecoration {
    return {};
  }
}
