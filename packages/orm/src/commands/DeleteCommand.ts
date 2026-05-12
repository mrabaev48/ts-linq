import type { DatabaseProvider } from '@ts-linq/core';

export type TrackedChange = {
  entity: Record<string, unknown>;
  entityClass: Function;
  state: string;
};

export interface SoftDeleteHandler {
  (change: TrackedChange): Promise<boolean>;
}

export class DeleteCommand {
  constructor(
    private readonly provider: DatabaseProvider,
    private readonly handleSoftDelete: SoftDeleteHandler,
    private readonly onAfterDelete: (change: TrackedChange) => void
  ) {}

  public async execute(change: TrackedChange): Promise<boolean> {
    if (!change.entity || typeof change.entity !== 'object') return false;
    
    const softDeleted = await this.handleSoftDelete(change);
    if (softDeleted) {
      this.onAfterDelete(change);
      return true;
    }
    
    await this.provider.delete(change.entity, change.entityClass);
    this.onAfterDelete(change);
    return true;
  }
}
