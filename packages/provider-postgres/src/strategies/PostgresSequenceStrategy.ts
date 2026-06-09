import type { SequenceExecutionPort, SequenceStrategy } from '@ts-linq/core';
import { DatabaseError } from '@ts-linq/types';

/**
 * PostgreSQL Hi-Lo sequence strategy.
 *
 * Reserves the next block by advancing a native sequence with `nextval`. The
 * sequence must be declared with `INCREMENT BY = blockSize`; the returned value
 * is the high-water mark of the reserved block.
 */
export class PostgresSequenceStrategy implements SequenceStrategy {
  public async nextValue(
    port: SequenceExecutionPort,
    sequenceName: string,
    schema: string | undefined,
    _blockSize: number
  ): Promise<number> {
    const qualifiedName = schema ? `"${schema}"."${sequenceName}"` : `"${sequenceName}"`;
    const rows = await port.executeQuery<{ nextval: string }>(`SELECT nextval(${qualifiedName})`);
    const raw = rows[0]?.nextval;
    if (raw === undefined) {
      throw new DatabaseError(`Failed to fetch next value for sequence "${qualifiedName}"`);
    }
    return Number(raw);
  }
}
