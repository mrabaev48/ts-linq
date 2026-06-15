import { BaseQuoter } from './BaseQuoter';

/**
 * MSSQL quoter: identifiers wrapped in `[` … `]`, embedded `]` doubled to `]]`
 * (only the closing bracket can terminate the quoting, so only it must be escaped).
 */
export class MssqlQuoter extends BaseQuoter {
  protected readonly open = '[';
  protected readonly close = ']';
  protected readonly escapeChar = ']';
  protected readonly escapedChar = ']]';

  protected formatBoolean(value: boolean): string {
    return value ? '1' : '0';
  }
}
