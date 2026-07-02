import type { MetadataRegistry, PropertyAccessMode } from '@ts-linq/metadata';
import { createPropertyAccessor, type PropertyAccessor } from '@ts-linq/metadata';
import type { ColumnMetadata, ShadowPropertyMetadata } from '@ts-linq/types';

import type { EntityConfigAspect } from './EntityConfigAspect';

/**
 * Mapped columns (with entity-level property access mode) and shadow properties.
 *
 * The `columns` / `shadowColumns` maps are exposed so `EntityTypeBuilder.property()` can hand
 * them to the `PropertyBuilder` it returns; the maps are the aspect's accumulators.
 */
export class ColumnAspect<T extends object> implements EntityConfigAspect<T> {
  readonly columns: Map<string, ColumnMetadata> = new Map();
  readonly shadowColumns: Map<string, ColumnMetadata> = new Map();
  private _entityAccessMode?: PropertyAccessMode;

  usePropertyAccessMode(mode: PropertyAccessMode): void {
    this._entityAccessMode = mode;
  }

  applyTo(registry: MetadataRegistry, ctor: new () => T): void {
    for (const column of this.columns.values()) {
      // Apply entity-level access mode when the property does not have its own mode.
      if (this._entityAccessMode !== undefined && !column.accessMode) {
        column.accessMode = this._entityAccessMode;
        column.accessor = createPropertyAccessor(
          column.propertyName,
          column.fieldName,
          this._entityAccessMode
        ) as PropertyAccessor;
      }
      registry.mergeFluentColumn(ctor, column);
    }

    for (const col of this.shadowColumns.values()) {
      const shadowProp: ShadowPropertyMetadata = {
        propertyName: col.propertyName,
        columnName: col.columnName,
        type: col.type,
        nullable: col.nullable,
        defaultValue: col.defaultValue,
        defaultExpression: col.defaultExpression,
        comment: col.comment,
        length: col.length,
        precision: col.precision,
        scale: col.scale
      };
      registry.addShadowProperty(ctor, shadowProp);
    }
  }
}
