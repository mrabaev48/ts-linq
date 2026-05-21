import { createLineString, createPoint, createPolygon } from '@ts-linq/core';

import { decodeWkt, encodeWkt } from '../src/spatial-codec';

describe('MSSQL spatial-codec (WKT)', () => {
  describe('Point WKT', () => {
    it('encodes a Point to WKT', () => {
      const p = createPoint(13.404954, 52.520008);
      const wkt = encodeWkt(p);
      expect(wkt).toBe('POINT (13.404954 52.520008)');
    });

    it('decodes a Point WKT', () => {
      const decoded = decodeWkt('POINT (13.404954 52.520008)');
      expect(decoded.type).toBe('Point');
      expect((decoded as ReturnType<typeof createPoint>).x).toBeCloseTo(13.404954, 4);
      expect((decoded as ReturnType<typeof createPoint>).y).toBeCloseTo(52.520008, 4);
    });

    it('round-trips a Point', () => {
      const original = createPoint(100.0, -45.5);
      const wkt = encodeWkt(original);
      const decoded = decodeWkt(wkt);
      expect((decoded as typeof original).x).toBeCloseTo(100.0, 4);
      expect((decoded as typeof original).y).toBeCloseTo(-45.5, 4);
    });
  });

  describe('LineString WKT', () => {
    it('encodes a LineString to WKT', () => {
      const ls = createLineString([createPoint(0, 0), createPoint(1, 1)]);
      const wkt = encodeWkt(ls);
      expect(wkt).toBe('LINESTRING (0 0, 1 1)');
    });

    it('round-trips a LineString', () => {
      const original = createLineString([createPoint(0, 0), createPoint(1, 1), createPoint(2, 0)]);
      const wkt = encodeWkt(original);
      const decoded = decodeWkt(wkt) as typeof original;
      expect(decoded.type).toBe('LineString');
      expect(decoded.coordinates).toHaveLength(3);
      expect(decoded.coordinates[0]!.x).toBeCloseTo(0, 4);
      expect(decoded.coordinates[1]!.x).toBeCloseTo(1, 4);
    });
  });

  describe('Polygon WKT', () => {
    it('encodes a Polygon to WKT', () => {
      const exterior = createLineString([
        createPoint(0, 0),
        createPoint(1, 0),
        createPoint(1, 1),
        createPoint(0, 0)
      ]);
      const poly = createPolygon(exterior);
      const wkt = encodeWkt(poly);
      expect(wkt).toContain('POLYGON');
      expect(wkt).toContain('0 0');
    });

    it('round-trips a Polygon with no holes', () => {
      const exterior = createLineString([
        createPoint(0, 0),
        createPoint(1, 0),
        createPoint(1, 1),
        createPoint(0, 1),
        createPoint(0, 0)
      ]);
      const original = createPolygon(exterior);
      const wkt = encodeWkt(original);
      const decoded = decodeWkt(wkt) as typeof original;
      expect(decoded.type).toBe('Polygon');
      expect(decoded.exterior.coordinates).toHaveLength(5);
      expect(decoded.holes).toHaveLength(0);
    });
  });
});
