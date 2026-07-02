import type { MetadataRegistry } from '@ts-linq/metadata';

import type { AspectApplyContext, EntityConfigAspect } from './EntityConfigAspect';

/**
 * Table name / schema and primary keys.
 *
 * Runs first in the apply order: `registry.addEntity()` creates the registry record that all
 * other aspects merge into. Publishes the configured primary keys to the apply context so
 * `SkipNavigationAspect` can derive the many-to-many left foreign key.
 */
export class KeyAndTableAspect<T extends object> implements EntityConfigAspect<T> {
  private _tableName?: string;
  private _schema?: string;
  private _primaryKeys?: string[];

  toTable(name: string, schema?: string): void {
    this._tableName = name;
    if (schema !== undefined) this._schema = schema;
  }

  hasKey(keys: string[]): void {
    this._primaryKeys = keys;
  }

  applyTo(registry: MetadataRegistry, ctor: new () => T, ctx: AspectApplyContext): void {
    registry.addEntity(ctor, this._tableName);

    if (this._schema !== undefined) {
      registry.mergeFluentSchema(ctor, this._schema);
    }

    if (this._primaryKeys !== undefined) {
      registry.setFluentPrimaryKeys(ctor, this._primaryKeys);
    }

    // Publish PKs so SkipNavigationAspect can derive the m2m left FK (see AspectApplyContext).
    ctx.primaryKeys = this._primaryKeys;
  }
}
