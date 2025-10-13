import type { DatabaseProvider } from '@ts-linq/core/dist/DatabaseProvider';
export interface BatchExecutionHooks<T> {
    begin?(provider: DatabaseProvider): Promise<void> | void;
    commit?(provider: DatabaseProvider): Promise<void> | void;
    rollback?(provider: DatabaseProvider): Promise<void> | void;
    onProgress?(processed: number, total: number): void;
}
export declare class BatchExecutor {
    private readonly provider;
    constructor(provider: DatabaseProvider);
    inTxn<T>(useTransactions: boolean, fn: () => Promise<T>): Promise<T>;
}
//# sourceMappingURL=BatchExecutor.d.ts.map