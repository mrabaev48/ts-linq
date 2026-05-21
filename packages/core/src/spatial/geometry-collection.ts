import type { Geometry } from './geometry';

export interface GeometryCollection extends Geometry {
  readonly type: 'GeometryCollection';
  readonly geometries: Geometry[];
  readonly srid: number;
}

export function createGeometryCollection(geometries: Geometry[], srid = 4326): GeometryCollection {
  return { type: 'GeometryCollection', geometries, srid };
}

export function isGeometryCollection(g: Geometry): g is GeometryCollection {
  return g.type === 'GeometryCollection';
}
