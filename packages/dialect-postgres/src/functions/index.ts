import type { EfFunctionTranslator } from '@ts-linq/sql-visitor';

export const postgresEfFunctions: EfFunctionTranslator = {
  like: (col, p) => `${col} LIKE ${p}`,
  iLike: (col, p) => `${col} ILIKE ${p}`,
  random: () => 'RANDOM()',
  dateDiffDay: (col, p) => `(${col}::date - ${p}::date)`,
  dateDiffMonth: (col, p) =>
    `(EXTRACT(YEAR FROM AGE(${col}, ${p})) * 12 + EXTRACT(MONTH FROM AGE(${col}, ${p})))`,
  greatest: (...args) => `GREATEST(${args.join(', ')})`,
  least: (...args) => `LEAST(${args.join(', ')})`,
  stDev: (col) => `STDDEV(${col})`,
  variance: (col) => `VARIANCE(${col})`
};
