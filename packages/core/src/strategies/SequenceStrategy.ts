import type { SqlParameter } from '@ts-linq/types';
import { UnsupportedOperationError } from '@ts-linq/types';

/**
 * Narrow execution port a {@link SequenceStrategy} uses to talk back to the
 * host provider. `DatabaseProvider` satisfies it structurally via its public
 * `executeQuery`/`executeNonQuery`/`providerLabel` surface.
 */
export interface SequenceExecutionPort {
  executeQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]>;
  executeNonQuery(sql: string, params?: readonly SqlParameter[]): Promise<number>;
  readonly providerLabel: string;
}

/**
 * Strategy reserving the next Hi-Lo block from a database sequence.
 *
 * Behaviour is dialect-specific (native `NEXTVAL` / `NEXT VALUE FOR`, or a
 * MySQL counter-table emulation), so the strategy is behavioural rather than a
 * pure SQL emitter. The returned value is the high-water mark of the reserved
 * block (covering `[value - blockSize + 1, value]`).
 */
export interface SequenceStrategy {
  nextValue(
    port: SequenceExecutionPort,
    sequenceName: string,
    schema: string | undefined,
    blockSize: number
  ): Promise<number>;
}

/**
 * Default strategy for providers without sequence support: throws
 * {@link UnsupportedOperationError}. Preserves the previous base-class
 * behaviour (and its `operation: 'nextSequenceValue'` error detail).
 */
export class UnsupportedSequenceStrategy implements SequenceStrategy {
  public async nextValue(port: SequenceExecutionPort): Promise<number> {
    throw new UnsupportedOperationError(
      `Provider "${port.providerLabel}" does not support database sequences. ` +
        'Provide a SequenceStrategy via ProviderConfig.',
      { details: { provider: port.providerLabel, operation: 'nextSequenceValue' } }
    );
  }
}
