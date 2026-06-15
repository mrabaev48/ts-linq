import type { ColumnMetadata, ShadowPropertyMetadata } from '@ts-linq/types';

import type { ColumnDef } from '../../DiffTypes';
import type { ModelColumnSnapshot } from '../model-snapshot.types';

/** Options controlling how a {@link ColumnMetadata} is projected to a model column. */
export interface ModelColumnOptions {
  /** Whether the resulting column participates in the primary key. Defaults to `false`. */
  isPrimaryKey?: boolean;
  /** Prefix prepended to the column name (owned/complex flattening). Defaults to `''`. */
  namePrefix?: string;
  /** Explicit nullability override. Defaults to `col.nullable ?? true`. */
  nullable?: boolean;
}

/** Options controlling how a {@link ColumnMetadata} is projected to a schema column. */
export interface SchemaColumnOptions {
  /** Whether the resulting column participates in the primary key. Defaults to `false`. */
  isPrimaryKey?: boolean;
}

/**
 * Single source of truth for projecting entity column metadata into the two
 * snapshot column shapes used across the package:
 *
 * - {@link ModelColumnSnapshot} — the deterministic model snapshot (raw type uppercased).
 * - {@link ColumnDef} — the schema snapshot (portable type + value-converter applied).
 *
 * Centralizing the mapping here removes the near-duplicated column projection that
 * was previously copied across both snapshot builders.
 */
export class ColumnMapper {
  /**
   * Project an entity column into a {@link ModelColumnSnapshot}.
   * The model snapshot keeps the raw declared type (uppercased) and always carries
   * the optional default fields (which JSON serialization drops when `undefined`).
   */
  public toModelColumn(
    column: ColumnMetadata,
    options: ModelColumnOptions = {}
  ): ModelColumnSnapshot {
    const prefix = options.namePrefix ?? '';
    return {
      name: `${prefix}${column.columnName}`,
      type: String(column.type ?? '').toUpperCase(),
      nullable: options.nullable ?? column.nullable ?? true,
      isPrimaryKey: options.isPrimaryKey ?? false,
      defaultValue: column.defaultValue,
      defaultExpression: column.defaultExpression
    };
  }

  /**
   * Project an entity column into a schema {@link ColumnDef}.
   * Applies the portable-type mapping and runs the value converter over the default
   * value (so the stored snapshot reflects the provider-side representation).
   */
  public toSchemaColumn(column: ColumnMetadata, options: SchemaColumnOptions = {}): ColumnDef {
    return {
      name: column.columnName,
      type: this.mapPortableType(column.type),
      nullable: column.nullable ?? true,
      defaultValue:
        column.converter && column.defaultValue !== undefined
          ? column.converter.toProvider(column.defaultValue)
          : column.defaultValue,
      defaultExpression: column.defaultExpression,
      isPrimaryKey: options.isPrimaryKey ?? false,
      isComputed: column.isComputed,
      computedExpression: column.computedExpression,
      computedStorage: column.computedStorage,
      comment: column.comment
    };
  }

  /**
   * Project a shadow property into a schema {@link ColumnDef}.
   * Shadow properties have no converter / computed / PK facets, so this is a lighter
   * projection that still shares the single portable-type mapping.
   */
  public toSchemaShadowColumn(shadow: ShadowPropertyMetadata): ColumnDef {
    return {
      name: shadow.columnName,
      type: this.mapPortableType(shadow.type),
      nullable: shadow.nullable ?? true,
      defaultValue: shadow.defaultValue,
      defaultExpression: shadow.defaultExpression,
      comment: shadow.comment
    };
  }

  /**
   * Map a declared portable type to the canonical abstract storage type used by the
   * schema snapshot. Dialect-specific rendering happens later in the DDL emitters.
   */
  public mapPortableType(type: string): string {
    switch (String(type || '').toUpperCase()) {
      case 'INTEGER':
      case 'NUMBER':
        return 'INTEGER';
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return 'REAL';
      case 'BOOLEAN':
        return 'INTEGER';
      case 'DATETIME':
      case 'DATE':
        return 'TEXT';
      case 'BLOB':
        return 'BLOB';
      default:
        return 'TEXT';
    }
  }
}
