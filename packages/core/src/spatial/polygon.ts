import type { Geometry } from './geometry';
import type { LineString } from './line-string';

export interface Polygon extends Geometry {
  readonly type: 'Polygon';
  readonly exterior: LineString;
  readonly holes: LineString[];
  readonly srid: number;
}

export function createPolygon(
  exterior: LineString,
  holes: LineString[] = [],
  srid = 4326
): Polygon {
  return { type: 'Polygon', exterior, holes, srid };
}

export function isPolygon(g: Geometry): g is Polygon {
  return g.type === 'Polygon';
}
