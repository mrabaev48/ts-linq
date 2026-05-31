import type { EfFunctionTranslator } from '@ts-linq/sql-visitor';

export const mysqlEfFunctions: EfFunctionTranslator = {
  like: (col, p) => `${col} LIKE ${p}`,
  random: () => 'RAND()',
  dateDiffDay: (col, p) => `DATEDIFF(${col}, ${p})`,
  dateDiffMonth: (col, p) => `TIMESTAMPDIFF(MONTH, ${p}, ${col})`,
  greatest: (...args) => `GREATEST(${args.join(', ')})`,
  least: (...args) => `LEAST(${args.join(', ')})`,
  stDev: (col) => `STDDEV(${col})`,
  variance: (col) => `VARIANCE(${col})`
};
