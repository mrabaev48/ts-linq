import {
  createGeometryCollection,
  createLineString,
  createMultiLineString,
  createMultiPoint,
  createMultiPolygon,
  createPoint,
  createPolygon,
  isGeometry,
  isGeometryCollection,
  isLineString,
  isMultiLineString,
  isMultiPoint,
  isMultiPolygon,
  isPoint,
  isPolygon
} from '../index';

describe('Geometry factory functions', () => {
  describe('createPoint', () => {
    it('creates a point with default SRID 4326', () => {
      const p = createPoint(10.5, 20.3);
      expect(p.type).toBe('Point');
      expect(p.x).toBe(10.5);
      expect(p.y).toBe(20.3);
      expect(p.srid).toBe(4326);
    });

    it('creates a point with custom SRID', () => {
      const p = createPoint(1, 2, 32632);
      expect(p.srid).toBe(32632);
    });

    it('isPoint returns true for Point', () => {
      expect(isPoint(createPoint(0, 0))).toBe(true);
    });

    it('isPoint returns false for other geometry', () => {
      const ls = createLineString([createPoint(0, 0), createPoint(1, 1)]);
      expect(isPoint(ls)).toBe(false);
    });
  });

  describe('createLineString', () => {
    it('creates a LineString with two points', () => {
      const ls = createLineString([createPoint(0, 0), createPoint(1, 1)]);
      expect(ls.type).toBe('LineString');
      expect(ls.coordinates).toHaveLength(2);
      expect(ls.srid).toBe(4326);
    });

    it('isLineString identifies correctly', () => {
      expect(isLineString(createLineString([]))).toBe(true);
      expect(isLineString(createPoint(0, 0))).toBe(false);
    });
  });

  describe('createPolygon', () => {
    it('creates a Polygon with exterior ring and no holes', () => {
      const ring = createLineString([
        createPoint(0, 0),
        createPoint(1, 0),
        createPoint(1, 1),
        createPoint(0, 0)
      ]);
      const poly = createPolygon(ring);
      expect(poly.type).toBe('Polygon');
      expect(poly.exterior).toBe(ring);
      expect(poly.holes).toHaveLength(0);
      expect(poly.srid).toBe(4326);
    });

    it('creates a Polygon with holes', () => {
      const exterior = createLineString([
        createPoint(0, 0),
        createPoint(10, 0),
        createPoint(10, 10),
        createPoint(0, 0)
      ]);
      const hole = createLineString([
        createPoint(2, 2),
        createPoint(4, 2),
        createPoint(4, 4),
        createPoint(2, 2)
      ]);
      const poly = createPolygon(exterior, [hole]);
      expect(poly.holes).toHaveLength(1);
    });

    it('isPolygon identifies correctly', () => {
      const ring = createLineString([]);
      expect(isPolygon(createPolygon(ring))).toBe(true);
      expect(isPolygon(createPoint(0, 0))).toBe(false);
    });
  });

  describe('MultiPoint', () => {
    it('creates MultiPoint', () => {
      const mp = createMultiPoint([createPoint(0, 0), createPoint(1, 1)]);
      expect(mp.type).toBe('MultiPoint');
      expect(mp.geometries).toHaveLength(2);
    });

    it('isMultiPoint identifies correctly', () => {
      expect(isMultiPoint(createMultiPoint([]))).toBe(true);
      expect(isMultiPoint(createPoint(0, 0))).toBe(false);
    });
  });

  describe('MultiLineString', () => {
    it('creates MultiLineString', () => {
      const mls = createMultiLineString([createLineString([]), createLineString([])]);
      expect(mls.type).toBe('MultiLineString');
      expect(mls.geometries).toHaveLength(2);
    });

    it('isMultiLineString identifies correctly', () => {
      expect(isMultiLineString(createMultiLineString([]))).toBe(true);
      expect(isMultiLineString(createPoint(0, 0))).toBe(false);
    });
  });

  describe('MultiPolygon', () => {
    it('creates MultiPolygon', () => {
      const ring = createLineString([]);
      const mp = createMultiPolygon([createPolygon(ring), createPolygon(ring)]);
      expect(mp.type).toBe('MultiPolygon');
      expect(mp.geometries).toHaveLength(2);
    });

    it('isMultiPolygon identifies correctly', () => {
      const ring = createLineString([]);
      expect(isMultiPolygon(createMultiPolygon([]))).toBe(true);
      expect(isMultiPolygon(createPolygon(ring))).toBe(false);
    });
  });

  describe('GeometryCollection', () => {
    it('creates GeometryCollection', () => {
      const gc = createGeometryCollection([createPoint(0, 0), createLineString([])]);
      expect(gc.type).toBe('GeometryCollection');
      expect(gc.geometries).toHaveLength(2);
    });

    it('isGeometryCollection identifies correctly', () => {
      expect(isGeometryCollection(createGeometryCollection([]))).toBe(true);
      expect(isGeometryCollection(createPoint(0, 0))).toBe(false);
    });
  });

  describe('isGeometry', () => {
    it('returns true for any geometry', () => {
      expect(isGeometry(createPoint(0, 0))).toBe(true);
      expect(isGeometry(createLineString([]))).toBe(true);
    });

    it('returns false for non-geometry values', () => {
      expect(isGeometry(null)).toBe(false);
      expect(isGeometry(42)).toBe(false);
      expect(isGeometry('Point')).toBe(false);
      expect(isGeometry({})).toBe(false);
    });
  });
});
