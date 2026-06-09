/** Transaction-control port used by {@link BatchTransactionRunner}. */
export interface BatchTransactionPort {
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
}

/**
 * Runs a per-entity operation for every item of a batch inside a single
 * transaction, committing on success and rolling back (then rethrowing) on any
 * failure. Extracted from the `insertMany`/`updateMany`/`upsertMany` default
 * implementations so the provider facade keeps only thin delegations.
 *
 * An empty batch is a no-op (no transaction is opened), matching the previous
 * behaviour.
 */
export class BatchTransactionRunner {
  constructor(private readonly tx: BatchTransactionPort) {}

  public async runAll<T>(entities: T[], operation: (entity: T) => Promise<unknown>): Promise<T[]> {
    if (entities.length === 0) return entities;
    await this.tx.beginTransaction();
    try {
      for (const entity of entities) {
        await operation(entity);
      }
      await this.tx.commitTransaction();
      return entities;
    } catch (error) {
      await this.tx.rollbackTransaction();
      throw error;
    }
  }
}
