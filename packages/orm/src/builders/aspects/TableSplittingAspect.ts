import type { MetadataRegistry } from '@ts-linq/metadata';
import type { TableFragmentMetadata } from '@ts-linq/types';

import { TableSplitConfigBuilder } from '../TableSplitConfigBuilder';
import type { EntityConfigAspect } from './EntityConfigAspect';

/**
 * Entity splitting: mapping additional properties to separate physical tables (`splitToTable`).
 */
export class TableSplittingAspect<T extends object> implements EntityConfigAspect<T> {
  private readonly _tableFragments: TableFragmentMetadata[] = [];

  splitToTable(
    tableName: string,
    configure: (b: TableSplitConfigBuilder<T>) => void,
    schema?: string
  ): void {
    const configBuilder = new TableSplitConfigBuilder<T>();
    configure(configBuilder);
    this._tableFragments.push({
      tableName,
      ...(schema !== undefined ? { schema } : {}),
      properties: configBuilder._build()
    });
  }

  applyTo(registry: MetadataRegistry, ctor: new () => T): void {
    if (this._tableFragments.length > 0) {
      registry.mergeFluentTableFragments(ctor, this._tableFragments);
    }
  }
}
