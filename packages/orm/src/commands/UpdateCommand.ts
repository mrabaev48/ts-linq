import type { DatabaseProvider } from '@ts-linq/core';
import type { EntityCtorRef } from '@ts-linq/types';

export type TrackedChange = {
  entity: Record<string, unknown>;
  entityClass: EntityCtorRef;
  state: string;
  originalValues?: object;
};

export class UpdateCommand {
  constructor(
    private readonly provider: DatabaseProvider,
    private readonly onAfterUpdate: (change: TrackedChange) => void
  ) {}

  public async execute(change: TrackedChange): Promise<void> {
    if (!change.entity || typeof change.entity !== 'object') return;
    await this.provider.update(change.entity, change.entityClass, change.originalValues);
    this.onAfterUpdate(change);
  }
}
