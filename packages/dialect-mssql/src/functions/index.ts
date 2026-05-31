import type { EfFunctionTranslator } from '@ts-linq/sql-visitor';

export const mssqlEfFunctions: EfFunctionTranslator = {
  like: (col, p) => `${col} LIKE ${p}`,
  random: () => 'ABS(CHECKSUM(NEWID()))',
  dateDiffDay: (col, p) => `DATEDIFF(DAY, ${p}, ${col})`,
  dateDiffMonth: (col, p) => `DATEDIFF(MONTH, ${p}, ${col})`,
  greatest: (...args) =>
    `(SELECT MAX(v) FROM (VALUES ${args.map((a) => `(${a})`).join(', ')}) AS _t(v))`,
  least: (...args) =>
    `(SELECT MIN(v) FROM (VALUES ${args.map((a) => `(${a})`).join(', ')}) AS _t(v))`,
  stDev: (col) => `STDEV(${col})`,
  variance: (col) => `VAR(${col})`
};
