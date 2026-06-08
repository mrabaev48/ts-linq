import type { ColumnMetadata, EntityCtor, ShadowPropertyMetadata } from '@ts-linq/types';
import { ValidationError } from '@ts-linq/types';

import type { EntityMetadataState } from './EntityMetadataState';

/**
 * Facet store for property-level mapping: columns, primary keys and shadow
 * properties. Owns the column conflict/computed validation and routes every
 * mutation through {@link EntityMetadataState.mutate}.
 */
export class ColumnMetadataStore {
  public constructor(private readonly state: EntityMetadataState) {}

  /** Decorator-driven column registration (append-only; ignores duplicates). */
  public addColumn(target: EntityCtor, column: ColumnMetadata): void {
    this.validateColumn(column);
    this.state.mutate(
      target,
      (finalized) => {
        if (!finalized.columns.some((c) => c.propertyName === column.propertyName)) {
          finalized.columns = [...finalized.columns, column];
        }
      },
      (builder) => builder.addColumn(column)
    );
  }

  /** Fluent column override (fluent wins on conflict via shallow merge). */
  public mergeFluentColumn(target: EntityCtor, column: ColumnMetadata): void {
    this.state.mutate(
      target,
      (finalized) => {
        const idx = finalized.columns.findIndex((c) => c.propertyName === column.propertyName);
        if (idx >= 0) {
          finalized.columns[idx] = { ...finalized.columns[idx], ...column };
        } else {
          finalized.columns = [...finalized.columns, column];
        }
      },
      (builder) => builder.mergeColumn(column)
    );
  }

  /** Decorator-driven primary key registration (append-only; ignores duplicates). */
  public addPrimaryKey(target: EntityCtor, propertyName: string): void {
    this.state.mutate(
      target,
      (finalized) => {
        if (!finalized.primaryKeys?.includes(propertyName)) {
          finalized.primaryKeys = [...(finalized.primaryKeys || []), propertyName];
        }
      },
      (builder) => builder.addPrimaryKey(propertyName)
    );
  }

  /** Fluent primary key override (replaces the whole key set). */
  public setFluentPrimaryKeys(target: EntityCtor, keys: string[]): void {
    this.state.mutate(
      target,
      (finalized) => {
        finalized.primaryKeys = [...keys];
      },
      (builder) => builder.setPrimaryKeys(keys)
    );
  }

  /** Add or replace a shadow property (P1-16). */
  public addShadowProperty(target: EntityCtor, prop: ShadowPropertyMetadata): void {
    this.state.mutate(
      target,
      (finalized) => {
        if (!finalized.shadowProperties) {
          finalized.shadowProperties = new Map();
        }
        finalized.shadowProperties.set(prop.propertyName, prop);
      },
      (builder) => builder.addShadowProperty(prop)
    );
  }

  /**
   * Reject mutually-exclusive column flags before storing.
   *
   * Mirrors the original `addColumnMetadata` guard: a computed column may not
   * carry a default, be generated, or act as a version column, and it is forced
   * read-only. The wording of each error is preserved for behavioural parity.
   */
  private validateColumn(column: ColumnMetadata): void {
    if (column.defaultExpression !== undefined && column.defaultValue !== undefined) {
      throw new ValidationError(
        `Column ${column.columnName} cannot have both defaultExpression and defaultValue`
      );
    }
    if (column.isComputed) {
      if (column.defaultValue !== undefined || column.defaultExpression !== undefined) {
        throw new ValidationError(
          `Computed column ${column.columnName} cannot have defaultValue/defaultExpression`
        );
      }
      if (column.isGenerated) {
        throw new ValidationError(
          `Computed column ${column.columnName} cannot be marked as isGenerated`
        );
      }
      if (column.isVersion) {
        throw new ValidationError(
          `Computed column ${column.columnName} cannot be a version column`
        );
      }
      (column as { isReadOnly?: boolean }).isReadOnly = true;
    }
  }
}
