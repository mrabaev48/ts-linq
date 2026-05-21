import type { Geometry } from './geometry';

export interface Point extends Geometry {
  readonly type: 'Point';
  readonly x: number;
  readonly y: number;
  readonly z?: number;
  readonly m?: number;
  readonly srid: number;
}

export function createPoint(x: number, y: number, srid = 4326): Point {
  return { type: 'Point', x, y, srid };
}

export function isPoint(g: Geometry): g is Point {
  return g.type === 'Point';
}
