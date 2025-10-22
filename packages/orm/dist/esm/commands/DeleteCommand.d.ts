import type { DatabaseProvider } from '@ts-linq/core';
export type TrackedChange = {
    entity: Record<string, unknown>;
    entityClass: Function;
    state: string;
};
export interface SoftDeleteHandler {
    (change: TrackedChange): Promise<boolean>;
}
export declare class DeleteCommand {
    private readonly provider;
    private readonly handleSoftDelete;
    private readonly onAfterDelete;
    constructor(provider: DatabaseProvider, handleSoftDelete: SoftDeleteHandler, onAfterDelete: (change: TrackedChange) => void);
    execute(change: TrackedChange): Promise<boolean>;
}
//# sourceMappingURL=DeleteCommand.d.ts.map