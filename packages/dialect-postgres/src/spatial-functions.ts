import type { SpatialTranslator } from '@ts-linq/types';

export const postgisSpatialFunctions: SpatialTranslator = {
  distance: (col, p) => `ST_Distance(${col}::geography, ${p}::geography)`,
  intersects: (col, p) => `ST_Intersects(${col}, ${p})`,
  within: (col, p) => `ST_Within(${col}, ${p})`,
  buffer: (col, p) => `ST_Buffer(${col}::geography, ${p})`,
  area: (col) => `ST_Area(${col})`,
  length: (col) => `ST_Length(${col})`,
  contains: (col, p) => `ST_Contains(${col}, ${p})`
};
