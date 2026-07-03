import type { MetadataRegistry } from '@ts-linq/metadata';
import { StoredProcedureBuilder } from '@ts-linq/metadata';
import type { EntityStoredProcedureMapping } from '@ts-linq/types';

import type { EntityConfigAspect } from './EntityConfigAspect';

/**
 * Insert/update/delete stored-procedure mapping (`insert/update/deleteUsingStoredProcedure`).
 */
export class StoredProcedureAspect<T extends object> implements EntityConfigAspect<T> {
  private readonly _spMapping: EntityStoredProcedureMapping = {};

  insertUsingStoredProcedure(
    name: string,
    configure?: (b: StoredProcedureBuilder<T>) => StoredProcedureBuilder<T>
  ): void {
    this._spMapping.insert = this._build(name, configure);
  }

  updateUsingStoredProcedure(
    name: string,
    configure?: (b: StoredProcedureBuilder<T>) => StoredProcedureBuilder<T>
  ): void {
    this._spMapping.update = this._build(name, configure);
  }

  deleteUsingStoredProcedure(
    name: string,
    configure?: (b: StoredProcedureBuilder<T>) => StoredProcedureBuilder<T>
  ): void {
    this._spMapping.delete = this._build(name, configure);
  }

  applyTo(registry: MetadataRegistry, ctor: new () => T): void {
    if (
      this._spMapping.insert !== undefined ||
      this._spMapping.update !== undefined ||
      this._spMapping.delete !== undefined
    ) {
      registry.setStoredProcedureMapping(ctor, this._spMapping);
    }
  }

  private _build(
    name: string,
    configure?: (b: StoredProcedureBuilder<T>) => StoredProcedureBuilder<T>
  ): EntityStoredProcedureMapping['insert'] {
    const builder = new StoredProcedureBuilder<T>();
    const configured = configure ? configure(builder) : builder;
    return configured._build(name);
  }
}
