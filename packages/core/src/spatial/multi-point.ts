import type { Geometry } from './geometry';
import type { Point } from './point';

export interface MultiPoint extends Geometry {
  readonly type: 'MultiPoint';
  readonly geometries: Point[];
  readonly srid: number;
}

export function createMultiPoint(geometries: Point[], srid = 4326): MultiPoint {
  return { type: 'MultiPoint', geometries, srid };
}

export function isMultiPoint(g: Geometry): g is MultiPoint {
  return g.type === 'MultiPoint';
}
