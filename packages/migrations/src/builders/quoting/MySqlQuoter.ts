import { BaseQuoter } from './BaseQuoter';

/** MySQL quoter: identifiers wrapped in `` ` ``, embedded `` ` `` doubled to ``` `` ```. */
export class MySqlQuoter extends BaseQuoter {
  protected readonly open = '`';
  protected readonly close = '`';
  protected readonly escapeChar = '`';
  protected readonly escapedChar = '``';

  protected formatBoolean(value: boolean): string {
    return value ? '1' : '0';
  }
}
