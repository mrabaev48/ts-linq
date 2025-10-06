'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.BatchExecutor = void 0;
class BatchExecutor {
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
exports.BatchExecutor = BatchExecutor;
//# sourceMappingURL=BatchExecutor.js.map
