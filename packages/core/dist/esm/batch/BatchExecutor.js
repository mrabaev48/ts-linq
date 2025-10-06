export class BatchExecutor {
  constructor(provider) {
    this.provider = provider;
  }
  async inTxn(useTransactions, fn) {
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
//# sourceMappingURL=BatchExecutor.js.map
