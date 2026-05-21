import type { SpatialTranslator } from '@ts-linq/types';

export const mysqlSpatialFunctions: SpatialTranslator = {
  distance: (col, p) => `ST_Distance_Sphere(${col}, ${p})`,
  intersects: (col, p) => `ST_Intersects(${col}, ${p})`,
  within: (col, p) => `ST_Within(${col}, ${p})`,
  buffer: (col, p) => `ST_Buffer(${col}, ${p})`,
  area: (col) => `ST_Area(${col})`,
  length: (col) => `ST_Length(${col})`,
  contains: (col, p) => `ST_Contains(${col}, ${p})`
};
