import type { EntityMetadata } from '@ts-linq/types';

import type { DatabaseProvider } from '../DatabaseProvider';
import { noPrimaryKey, noPrimaryKeys, noTargetEntity } from './batchErrors';

export class BatchUpdateOperation {
  constructor(private readonly provider: DatabaseProvider) {}

  async execute<T extends object>(entities: T[], metadata: EntityMetadata): Promise<T[]> {
    if (this.provider.updateMany && entities.length > 1 && metadata.target) {
      return await this.provider.updateMany(entities, metadata.target);
    }

    if (!metadata.primaryKeys) {
      throw noPrimaryKeys(metadata.target?.name ?? 'Unknown');
    }

    const primaryKeyColumn = metadata.columns.find((col) =>
      metadata.primaryKeys!.includes(col.propertyName)
    );

    if (!primaryKeyColumn) {
      throw noPrimaryKey(metadata.target?.name ?? 'Unknown');
    }

    const updateColumns = metadata.columns.filter(
      (col) => !metadata.primaryKeys!.includes(col.propertyName) && !col.isGenerated
    );

    if (updateColumns.length === 0) return entities;

    if (!metadata.target) {
      throw noTargetEntity();
    }

    for (const entity of entities) {
      await this.provider.update(entity, metadata.target);
    }

    return entities;
  }
}
