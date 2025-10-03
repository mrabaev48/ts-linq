import type { DatabaseProvider } from '../../DatabaseProvider';
export type TrackedChange = {
    entity: Record<string, unknown>;
    entityClass: Function;
    state: string;
};
export declare class InsertCommand {
    private readonly provider;
    private readonly onAfterInsert;
    constructor(provider: DatabaseProvider, onAfterInsert: (change: TrackedChange) => void);
    execute(change: TrackedChange): Promise<void>;
}
//# sourceMappingURL=InsertCommand.d.ts.map