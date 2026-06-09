import type { SequenceExecutionPort, SequenceStrategy } from '@ts-linq/core';
import { buildMysqlNextBlockSql } from '@ts-linq/dialect-mysql';
import type { SqlParameter } from '@ts-linq/types';
import { DatabaseError } from '@ts-linq/types';

/**
 * MySQL Hi-Lo sequence strategy using the emulation counter table.
 *
 * MySQL has no native sequences, so a counter row is advanced by `blockSize`
 * (UPDATE) and then read back (SELECT). Both statements run through the same
 * provider so the read observes the advanced value.
 */
export class MySqlSequenceStrategy implements SequenceStrategy {
  public async nextValue(
    port: SequenceExecutionPort,
    sequenceName: string,
    _schema: string | undefined,
    blockSize: number
  ): Promise<number> {
    const { updateSql, selectSql, params } = buildMysqlNextBlockSql(sequenceName, blockSize);
    await port.executeNonQuery(updateSql, params as SqlParameter[]);
    const rows = await port.executeQuery<{ val: unknown }>(selectSql, [
      sequenceName
    ] as SqlParameter[]);
    const raw = rows[0]?.val;
    if (raw === undefined) {
      throw new DatabaseError(
        `MySQL sequence emulation: no row found for sequence "${sequenceName}". ` +
          'Ensure the sequence was registered via ModelBuilder.hasSequence().'
      );
    }
    return Number(raw);
  }
}
