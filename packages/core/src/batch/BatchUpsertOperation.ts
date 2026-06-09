import type { EntityMetadata } from '@ts-linq/types';

import type { DatabaseProvider } from '../DatabaseProvider';
import { noTargetEntity } from './batchErrors';

export class BatchUpsertOperation {
  constructor(private readonly provider: DatabaseProvider) {}

  async execute<T extends object>(entities: T[], metadata: EntityMetadata): Promise<T[]> {
    if (!metadata.target) {
      throw noTargetEntity();
    }

    if (this.provider.upsertMany && entities.length > 1) {
      return await this.provider.upsertMany(entities, metadata.target);
    }

    const results: T[] = [];
    for (const entity of entities) {
      const result = await this.provider.upsert(entity, metadata.target);
      results.push(result);
    }
    return results;
  }
}
