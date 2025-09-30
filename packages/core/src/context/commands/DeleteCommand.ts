import type { DatabaseProvider } from '../../DatabaseProvider';

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
    if (await this.handleSoftDelete(change)) return true;
    await this.provider.delete(change.entity, change.entityClass);
    this.onAfterDelete(change);
    return true;
  }
}
