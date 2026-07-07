import { type DialectSyntax, numberPlaceholders } from '@ts-linq/dialect-kit';

import { quoteIdentifier, quoteStringLiteral } from './quoting';

/**
 * PostgreSQL token strategy injected into the shared base dialect: `"id"` quoting, `$1..$n` markers,
 * `LIMIT`/`OFFSET`, and comma-only (no space) INSERT column/placeholder lists.
 */
export const postgresSyntax: DialectSyntax = {
  quote: quoteIdentifier,
  quoteStringLiteral,
  renumberPlaceholders: (sql) => numberPlaceholders(sql, '$'),
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
    if (hasOffset) return ` OFFSET ${options.offset}`;
    return '';
  },
  insertColumnSeparator: ','
};
