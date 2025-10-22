import type { EntityLoader } from '@ts-linq/core';
import { LoadingStrategy } from '@ts-linq/types';

export class IncludePlanner<T> {
  constructor(
    private readonly entityLoader: EntityLoader | undefined,
    private readonly entityClass: new () => T
  ) {}

  public async populateIncludes(entities: T[], includes: string[], limit?: number): Promise<void> {
    if (!this.entityLoader || includes.length === 0 || limit === 1) return;
    await this.entityLoader.populateRelationshipsMany(entities, this.entityClass, {
      strategy: 'eager' as LoadingStrategy,
      includes,
      depth: 1
    });
  }
}
