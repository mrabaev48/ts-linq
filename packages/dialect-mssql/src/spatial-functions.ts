import type { SpatialTranslator } from '@ts-linq/types';

export const mssqlSpatialFunctions: SpatialTranslator = {
  distance: (col, p) => `${col}.STDistance(${p})`,
  intersects: (col, p) => `${col}.STIntersects(${p})`,
  within: (col, p) => `${col}.STWithin(${p})`,
  buffer: (col, p) => `${col}.STBuffer(${p})`,
  area: (col) => `${col}.STArea()`,
  length: (col) => `${col}.STLength()`,
  contains: (col, p) => `${col}.STContains(${p})`
};
