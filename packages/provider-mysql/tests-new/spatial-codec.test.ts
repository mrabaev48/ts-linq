import { createLineString, createPoint, createPolygon } from '@ts-linq/core';

import { decodeWkb, encodeWkb } from '../src/spatial-codec';

describe('MySQL spatial-codec (ISO WKB)', () => {
  describe('Point round-trip', () => {
    it('encodes and decodes a Point', () => {
      const original = createPoint(13.404954, 52.520008);
      const buf = encodeWkb(original);
      // Simulate MySQL driver response: prepend 4-byte SRID
      const sridBuf = Buffer.allocUnsafe(4);
      sridBuf.writeUInt32LE(4326, 0);
      const withSrid = Buffer.concat([sridBuf, buf]);
      const decoded = decodeWkb(withSrid);
      expect(decoded.type).toBe('Point');
      expect((decoded as typeof original).x).toBeCloseTo(13.404954, 6);
      expect((decoded as typeof original).y).toBeCloseTo(52.520008, 6);
    });

    it('decodes ISO WKB without SRID prefix', () => {
      const original = createPoint(1.0, 2.0);
      const buf = encodeWkb(original);
      const decoded = decodeWkb(buf);
      expect(decoded.type).toBe('Point');
      expect((decoded as typeof original).x).toBeCloseTo(1.0, 6);
    });
  });

  describe('LineString round-trip', () => {
    it('encodes and decodes a LineString', () => {
      const original = createLineString([createPoint(0, 0), createPoint(1, 1), createPoint(2, 0)]);
      const buf = encodeWkb(original);
      const decoded = decodeWkb(buf);
      expect(decoded.type).toBe('LineString');
      const ls = decoded as typeof original;
      expect(ls.coordinates).toHaveLength(3);
      expect(ls.coordinates[0]!.x).toBeCloseTo(0, 6);
    });
  });

  describe('Polygon round-trip', () => {
    it('encodes and decodes a Polygon', () => {
      const exterior = createLineString([
        createPoint(0, 0),
        createPoint(1, 0),
        createPoint(1, 1),
        createPoint(0, 1),
        createPoint(0, 0)
      ]);
      const original = createPolygon(exterior);
      const buf = encodeWkb(original);
      const decoded = decodeWkb(buf);
      expect(decoded.type).toBe('Polygon');
      const poly = decoded as typeof original;
      expect(poly.exterior.coordinates).toHaveLength(5);
    });
  });
});
