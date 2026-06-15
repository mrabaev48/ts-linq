import type { DatabaseProvider } from '@ts-linq/core';

/** The minimal transaction surface {@link TransactionScope} depends on. */
export type TransactionCapableProvider = Pick<
  DatabaseProvider,
  'beginTransaction' | 'commitTransaction' | 'rollbackTransaction'
>;

/**
 * Scoped transactional resource: centralizes the begin → run → commit / rollback lifecycle so
 * callers never hand-roll a `try/catch` around `beginTransaction`/`rollbackTransaction`.
 *
 * Guarantees that the **original** failure always wins: if the body throws, the transaction is
 * rolled back and the original error is rethrown unchanged. If `rollbackTransaction()` *also*
 * throws, that secondary failure is attached as a *suppressed* error on the original (see
 * {@link attachSuppressed}) rather than masking it — mirroring the semantics of the TC39
 * `SuppressedError`, which is not available in our `lib` target.
 */
export class TransactionScope {
  constructor(private readonly provider: TransactionCapableProvider) {}

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.provider.beginTransaction();

    let result: T;
    try {
      result = await fn();
    } catch (error) {
      try {
        await this.provider.rollbackTransaction();
      } catch (rollbackError) {
        // The rollback failure must not mask the original cause: surface it as suppressed.
        attachSuppressed(error, rollbackError);
      }
      throw error;
    }

    await this.provider.commitTransaction();
    return result;
  }
}

/**
 * Records a secondary failure that occurred while handling `primary`, without replacing it.
 *
 * The secondary error is appended to a `suppressed` array on the primary `Error` (created lazily),
 * matching the observable shape of a TC39 `SuppressedError`.
 */
function attachSuppressed(primary: unknown, suppressed: unknown): void {
  if (!(primary instanceof Error)) {
    return;
  }
  const holder = primary as Error & { suppressed?: unknown[] };
  (holder.suppressed ??= []).push(suppressed);
}
