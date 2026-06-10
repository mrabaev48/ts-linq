import type { DatabaseProvider } from '../../DatabaseProvider';
import { ctorName } from '../../utils/ctorName';
import { logInternalError } from '../../utils/InternalLogger';

/** Default IN()-list chunk size when a caller does not configure one. */
export const DEFAULT_IN_CHUNK_SIZE = 1000;

/**
 * Single source of the chunked `WHERE col IN (...)` fan-out shared by every
 * loader. Large IN lists are split into chunks to stay within driver parameter
 * limits; when chunking actually happens the cross-query telemetry hook is
 * notified once (failures there are swallowed through the internal-error
 * channel, never propagated).
 *
 * Previously this loop was copy-pasted in three places inside `EntityLoader`
 * and absent entirely from `RelationshipLoader`.
 */
export class InClauseChunker {
  /**
   * Fetch all rows of `ctor` whose `column` is in `values`, chunking the IN
   * list at `chunkSize`. A single query is issued when the list fits in one
   * chunk (no telemetry, matching the historical fast path).
   */
  public async query(
    provider: DatabaseProvider,
    ctor: new () => object,
    column: string,
    values: unknown[],
    chunkSize: number
  ): Promise<unknown[]> {
    if (values.length <= chunkSize) {
      return provider.findWhereIn(ctor, column, values);
    }

    const acc: unknown[] = [];
    let chunks = 0;
    for (let i = 0; i < values.length; i += chunkSize) {
      const part = await provider.findWhereIn(ctor, column, values.slice(i, i + chunkSize));
      acc.push(...part);
      chunks++;
    }

    try {
      provider.loggerRef?.crossQuery?.({
        op: 'IN-chunk',
        chunks,
        size: values.length,
        entity: ctorName(ctor),
        column,
        provider: provider.providerLabel
      });
    } catch (e) {
      logInternalError('InClauseChunker.crossQuery', e);
    }

    return acc;
  }
}
