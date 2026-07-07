import { type DialectSyntax, numberPlaceholders } from '@ts-linq/dialect-kit';

import { quoteIdentifier, quoteStringLiteral } from './quoting';

/**
 * SQL Server token strategy injected into the shared base dialect: `[id]` quoting, `@p1..@pn`
 * markers, `TOP (n)` in the SELECT head and `OFFSET … ROWS FETCH NEXT … ROWS ONLY` for paging (a
 * synthetic `ORDER BY (SELECT NULL)` is injected when the query has no ordering, as `OFFSET`
 * requires one).
 */
export const mssqlSyntax: DialectSyntax = {
  quote: quoteIdentifier,
  quoteStringLiteral,
  renumberPlaceholders: (sql) => numberPlaceholders(sql, '@p'),
  renderSelectHead: (options) => {
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    let head = 'SELECT ';
    if (options.distinct) head += 'DISTINCT ';
    if (hasLimit && !hasOffset) head += `TOP (${options.limit}) `;
    head += options.select && options.select.length ? options.select.join(', ') : '*';
    return head;
  },
  renderLimitOffset: (options, hasOrderBy) => {
    const hasLimit = options.limit !== undefined && options.limit !== null;
    const hasOffset = options.offset !== undefined && options.offset !== null;
    if (!hasOffset) return '';
    let sql = '';
    if (!hasOrderBy) sql += ' ORDER BY (SELECT NULL)';
    const fetchNext = hasLimit ? ` FETCH NEXT ${options.limit} ROWS ONLY` : '';
    sql += ` OFFSET ${options.offset} ROWS${fetchNext}`;
    return sql;
  },
  insertColumnSeparator: ', '
};
