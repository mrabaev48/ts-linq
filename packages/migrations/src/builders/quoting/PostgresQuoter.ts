import { BaseQuoter } from './BaseQuoter';

/** PostgreSQL quoter: identifiers wrapped in `"`, embedded `"` doubled to `""`. */
export class PostgresQuoter extends BaseQuoter {
  protected readonly open = '"';
  protected readonly close = '"';
  protected readonly escapeChar = '"';
  protected readonly escapedChar = '""';

  protected formatBoolean(value: boolean): string {
    return value ? 'TRUE' : 'FALSE';
  }
}
