import type { DatabaseProvider } from '../DatabaseProvider';
import type { EntityMetadata, SqlParameter } from '../types';

export interface BatchExecutionHooks<T> {
  begin?(provider: DatabaseProvider): Promise<void> | void;
  commit?(provider: DatabaseProvider): Promise<void> | void;
  rollback?(provider: DatabaseProvider): Promise<void> | void;
  onProgress?(processed: number, total: number): void;
}

export class BatchExecutor {
  constructor(private readonly provider: DatabaseProvider) {}

  public async inTxn<T>(useTransactions: boolean, fn: () => Promise<T>): Promise<T> {
    if (useTransactions && !this.provider.inTransactionState) {
      await this.provider.beginTransaction();
    }
    try {
      const res = await fn();
      if (useTransactions && !this.provider.inTransactionState) {
        await this.provider.commitTransaction();
      }
      return res;
    } catch (e) {
      if (useTransactions && this.provider.inTransactionState) {
        await this.provider.rollbackTransaction();
      }
      throw e;
    }
  }
}
