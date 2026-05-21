import type { Geometry } from './geometry';
import type { Polygon } from './polygon';

export interface MultiPolygon extends Geometry {
  readonly type: 'MultiPolygon';
  readonly geometries: Polygon[];
  readonly srid: number;
}

export function createMultiPolygon(geometries: Polygon[], srid = 4326): MultiPolygon {
  return { type: 'MultiPolygon', geometries, srid };
}

export function isMultiPolygon(g: Geometry): g is MultiPolygon {
  return g.type === 'MultiPolygon';
}
