import type { EntityCtor, TableFragmentMetadata } from '@ts-linq/types';

import type { EntityMetadataState } from './EntityMetadataState';

/**
 * Facet store for table-/entity-level scalar configuration: table name, schema,
 * temporal versioning, table fragments, keyless/view flags, comment and seed
 * data. These are toggles and names attached to the entity as a whole rather
 * than structural sub-mappings.
 */
export class TableConfigStore {
  public constructor(private readonly state: EntityMetadataState) {}

  /** Register an entity, optionally overriding its table name. */
  public registerEntity(target: EntityCtor, tableName?: string): void {
    this.state.mutate(
      target,
      (finalized) => {
        if (tableName) finalized.tableName = tableName;
      },
      (builder) => {
        if (tableName) builder.setTableName(tableName);
      }
    );
  }

  /** Set the schema for an entity (fluent override). */
  public mergeFluentSchema(target: EntityCtor, schema: string): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.schema = schema;
      },
      (builder) => builder.setSchema(schema)
    );
  }

  /** Mark the entity as a SQL Server system-versioned (temporal) table. */
  public mergeFluentTemporal(
    target: EntityCtor,
    isTemporal: boolean,
    historyTableName?: string
  ): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.isTemporal = isTemporal;
        if (historyTableName !== undefined) finalized.historyTableName = historyTableName;
      },
      (builder) => {
        builder.setTemporal(isTemporal);
        if (historyTableName !== undefined) builder.setHistoryTableName(historyTableName);
      }
    );
  }

  /** Set (replace) table fragment metadata for entity splitting (P1-25). */
  public mergeFluentTableFragments(target: EntityCtor, fragments: TableFragmentMetadata[]): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.tableFragments = [...fragments];
      },
      (builder) => builder.setTableFragments(fragments)
    );
  }

  /** Mark an entity as keyless — no PK, never tracked (P1-26). */
  public setFluentKeyless(target: EntityCtor, value: boolean): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.isKeyless = value;
      },
      (builder) => builder.setIsKeyless(value)
    );
  }

  /** Set the database view name for an entity (P1-26). */
  public setFluentViewName(target: EntityCtor, name: string): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.viewName = name;
      },
      (builder) => builder.setViewName(name)
    );
  }

  /** Set optional CREATE VIEW DDL for migration emission (P1-26). */
  public setFluentViewSql(target: EntityCtor, sql: string): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.viewSql = sql;
      },
      (builder) => builder.setViewSql(sql)
    );
  }

  /** Set table-level comment for an entity (P0-14). */
  public setEntityComment(target: EntityCtor, comment: string): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.comment = comment;
      },
      (builder) => builder.setEntityComment(comment)
    );
  }

  /** Set (replace) seed data rows for an entity (P0-13). */
  public setSeedData(target: EntityCtor, rows: Record<string, unknown>[]): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.seedData = rows;
      },
      (builder) => builder.setSeedData(rows)
    );
  }
}
