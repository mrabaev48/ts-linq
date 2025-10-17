import type { DatabaseProvider } from '../../DatabaseProvider';

export type TrackedChange = {
  entity: Record<string, unknown>;
  entityClass: Function;
  state: string;
};

export class InsertCommand {
  constructor(
    private readonly provider: DatabaseProvider,
    private readonly onAfterInsert: (change: TrackedChange) => void
  ) {}

  public async execute(change: TrackedChange): Promise<void> {
    if (!change.entity || typeof change.entity !== 'object') return;
    await this.provider.insert(change.entity, change.entityClass);
    this.onAfterInsert(change);
  }
}
