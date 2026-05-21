import { createLineString, createPoint, createPolygon } from '@ts-linq/core';

import { decodeWkb, encodeWkb, geometryToEwkbHex } from '../src/spatial-codec';

describe('PostgreSQL spatial-codec (EWKB)', () => {
  describe('Point round-trip', () => {
    it('encodes and decodes a simple Point with SRID 4326', () => {
      const original = createPoint(13.404954, 52.520008); // Berlin
      const buf = encodeWkb(original);
      const decoded = decodeWkb(buf);
      expect(decoded.type).toBe('Point');
      expect((decoded as typeof original).x).toBeCloseTo(13.404954, 6);
      expect((decoded as typeof original).y).toBeCloseTo(52.520008, 6);
      expect((decoded as typeof original).srid).toBe(4326);
    });

    it('encodes and decodes a Point with custom SRID', () => {
      const original = createPoint(100.0, 0.0, 32632);
      const buf = encodeWkb(original);
      const decoded = decodeWkb(buf);
      expect((decoded as typeof original).srid).toBe(32632);
      expect((decoded as typeof original).x).toBeCloseTo(100.0, 6);
    });

    it('decodes from hex string (pg driver format)', () => {
      const original = createPoint(1.0, 2.0);
      const hex = geometryToEwkbHex(original);
      const decoded = decodeWkb(hex);
      expect(decoded.type).toBe('Point');
      expect((decoded as typeof original).x).toBeCloseTo(1.0, 6);
      expect((decoded as typeof original).y).toBeCloseTo(2.0, 6);
    });

    it('decodes from \\x prefixed hex string', () => {
      const original = createPoint(5.0, 10.0);
      const hex = '\\x' + geometryToEwkbHex(original);
      const decoded = decodeWkb(hex);
      expect((decoded as typeof original).x).toBeCloseTo(5.0, 6);
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
      expect(ls.coordinates[1]!.x).toBeCloseTo(1, 6);
      expect(ls.coordinates[2]!.x).toBeCloseTo(2, 6);
    });

    it('handles empty LineString', () => {
      const original = createLineString([]);
      const buf = encodeWkb(original);
      const decoded = decodeWkb(buf) as typeof original;
      expect(decoded.type).toBe('LineString');
      expect(decoded.coordinates).toHaveLength(0);
    });
  });

  describe('Polygon round-trip', () => {
    it('encodes and decodes a Polygon with no holes', () => {
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
      expect(poly.holes).toHaveLength(0);
    });

    it('encodes and decodes a Polygon with a hole', () => {
      const exterior = createLineString([
        createPoint(0, 0),
        createPoint(10, 0),
        createPoint(10, 10),
        createPoint(0, 10),
        createPoint(0, 0)
      ]);
      const hole = createLineString([
        createPoint(2, 2),
        createPoint(4, 2),
        createPoint(4, 4),
        createPoint(2, 4),
        createPoint(2, 2)
      ]);
      const original = createPolygon(exterior, [hole]);
      const buf = encodeWkb(original);
      const decoded = decodeWkb(buf) as typeof original;
      expect(decoded.holes).toHaveLength(1);
      expect(decoded.holes[0]!.coordinates).toHaveLength(5);
    });
  });

  describe('geometryToEwkbHex', () => {
    it('returns a hex string', () => {
      const hex = geometryToEwkbHex(createPoint(0, 0));
      expect(typeof hex).toBe('string');
      expect(hex.length).toBeGreaterThan(0);
      // valid hex: only 0-9 a-f characters
      expect(/^[0-9a-f]+$/i.test(hex)).toBe(true);
    });
  });
});
