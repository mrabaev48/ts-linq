import type { DialectSyntax } from '@ts-linq/dialect-kit';

import { quoteIdentifier, quoteStringLiteral } from './quoting';

/**
 * MySQL token strategy injected into the shared base dialect: backtick quoting, positional `?`
 * markers left as-is (mysql2 binds them directly), and `LIMIT`/`OFFSET` (offset-only queries use
 * the documented MySQL sentinel row count).
 */
export const mysqlSyntax: DialectSyntax = {
  quote: quoteIdentifier,
  quoteStringLiteral,
  renumberPlaceholders: (sql) => sql,
  renderSelectHead: (options) => {
    let head = 'SELECT ';
    if (options.distinct) head += 'DISTINCT ';
    head += options.select && options.select.length ? options.select.join(', ') : '*';
    return head;
  },
  renderLimitOffset: (options) => {
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (hasLimit) {
      return ` LIMIT ${options.limit}` + (hasOffset ? ` OFFSET ${options.offset}` : '');
    }
    if (hasOffset) return ` LIMIT 18446744073709551615 OFFSET ${options.offset}`;
    return '';
  },
  insertColumnSeparator: ', '
};
