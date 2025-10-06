import type { DatabaseProvider } from '../../DatabaseProvider';
export type TrackedChange = {
  entity: Record<string, unknown>;
  entityClass: Function;
  state: string;
};
export declare class UpdateCommand {
  private readonly provider;
  private readonly onAfterUpdate;
  constructor(provider: DatabaseProvider, onAfterUpdate: (change: TrackedChange) => void);
  execute(change: TrackedChange): Promise<void>;
}
//# sourceMappingURL=UpdateCommand.d.ts.map
