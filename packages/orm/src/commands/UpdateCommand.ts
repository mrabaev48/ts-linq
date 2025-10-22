import type { DatabaseProvider } from '@ts-linq/core';

export type TrackedChange = {
  entity: Record<string, unknown>;
  entityClass: Function;
  state: string;
};

export class UpdateCommand {
  constructor(
    private readonly provider: DatabaseProvider,
    private readonly onAfterUpdate: (change: TrackedChange) => void
  ) {}

  public async execute(change: TrackedChange): Promise<void> {
    if (!change.entity || typeof change.entity !== 'object') return;
    await this.provider.update(change.entity, change.entityClass);
    this.onAfterUpdate(change);
  }
}
