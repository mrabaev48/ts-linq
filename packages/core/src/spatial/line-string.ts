import type { Geometry } from './geometry';
import type { Point } from './point';

export interface LineString extends Geometry {
  readonly type: 'LineString';
  readonly coordinates: Point[];
  readonly srid: number;
}

export function createLineString(coordinates: Point[], srid = 4326): LineString {
  return { type: 'LineString', coordinates, srid };
}

export function isLineString(g: Geometry): g is LineString {
  return g.type === 'LineString';
}
