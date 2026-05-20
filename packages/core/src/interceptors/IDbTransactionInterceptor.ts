import type { TransactionEventData } from './types';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IDbTransactionInterceptor {
  transactionStarting?(ev: TransactionEventData): void | Promise<void>;
  transactionStarted?(ev: TransactionEventData): void | Promise<void>;
  transactionCommitting?(ev: TransactionEventData): void | Promise<void>;
  transactionCommitted?(ev: TransactionEventData): void | Promise<void>;
  transactionRollingBack?(ev: TransactionEventData): void | Promise<void>;
  transactionRolledBack?(ev: TransactionEventData): void | Promise<void>;
}
