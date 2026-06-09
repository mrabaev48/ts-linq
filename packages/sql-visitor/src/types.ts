import type { SqlParameter } from '@ts-linq/types';

/**
 * A rendered boolean SQL condition plus its bound parameters.
 *
 * This is *generation output* — it describes an already-rendered SQL string, which is a
 * concern of the SQL-generation layer (this package + the dialects), never of the pure
 * `@ts-linq/ast` node layer.
 */
export interface ConditionFragment {
  condition: string;
  parameters: SqlParameter[];
}

/**
 * A rendered SQL expression fragment plus its bound parameters.
 *
 * Like {@link ConditionFragment}, this is generation output and lives on the rendering side.
 */
export interface SqlFragment {
  fragment: string;
  params: SqlParameter[];
}
