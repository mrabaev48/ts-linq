import type { SequenceExecutionPort, SequenceStrategy } from '@ts-linq/core';
import { DatabaseError } from '@ts-linq/types';

/**
 * SQL Server Hi-Lo sequence strategy using a native sequence object.
 *
 * The sequence must be declared with `INCREMENT BY = blockSize`; the returned
 * value is the high-water mark of the reserved block.
 */
export class MssqlSequenceStrategy implements SequenceStrategy {
  public async nextValue(
    port: SequenceExecutionPort,
    sequenceName: string,
    schema: string | undefined,
    _blockSize: number
  ): Promise<number> {
    const qualifiedName = schema ? `[${schema}].[${sequenceName}]` : `[${sequenceName}]`;
    const rows = await port.executeQuery<{ val: unknown }>(
      `SELECT NEXT VALUE FOR ${qualifiedName} AS val`
    );
    const raw = rows[0]?.val;
    if (raw === undefined) {
      throw new DatabaseError(`Failed to fetch next value for sequence "${qualifiedName}"`);
    }
    return Number(raw);
  }
}
