import type { Geometry } from './geometry';
import type { LineString } from './line-string';

export interface MultiLineString extends Geometry {
  readonly type: 'MultiLineString';
  readonly geometries: LineString[];
  readonly srid: number;
}

export function createMultiLineString(geometries: LineString[], srid = 4326): MultiLineString {
  return { type: 'MultiLineString', geometries, srid };
}

export function isMultiLineString(g: Geometry): g is MultiLineString {
  return g.type === 'MultiLineString';
}
