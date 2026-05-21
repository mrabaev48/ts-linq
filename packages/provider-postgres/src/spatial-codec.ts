import type { Geometry, LineString, Point, Polygon } from '@ts-linq/core';
import { isGeometry } from '@ts-linq/core';

export function isGeometryObject(value: unknown): value is Geometry {
  return isGeometry(value);
}

// WKB type constants (ISO WKB)
const WKB_POINT = 1;
const WKB_LINESTRING = 2;
const WKB_POLYGON = 3;
const WKB_MULTIPOINT = 4;
const WKB_MULTILINESTRING = 5;
const WKB_MULTIPOLYGON = 6;
const WKB_GEOMETRYCOLLECTION = 7;

// EWKB flag: SRID is present
const EWKB_SRID_FLAG = 0x20000000;

const LITTLE_ENDIAN = 1;

// ─── Encoding (Geometry → EWKB Buffer) ────────────────────────────────────────

export function encodeWkb(geometry: Geometry): Buffer {
  switch (geometry.type) {
    case 'Point':
      return encodePoint(geometry as Point);
    case 'LineString':
      return encodeLineString(geometry as LineString);
    case 'Polygon':
      return encodePolygon(geometry as Polygon);
    default:
      return encodeGeneric(geometry);
  }
}

function encodePoint(p: Point): Buffer {
  const hasSrid = p.srid !== undefined && p.srid !== 0;
  const size = 1 + 4 + (hasSrid ? 4 : 0) + 8 + 8;
  const buf = Buffer.allocUnsafe(size);
  let offset = 0;
  buf.writeUInt8(LITTLE_ENDIAN, offset++);
  const typeCode = hasSrid ? WKB_POINT | EWKB_SRID_FLAG : WKB_POINT;
  buf.writeUInt32LE(typeCode, offset);
  offset += 4;
  if (hasSrid) {
    buf.writeUInt32LE(p.srid!, offset);
    offset += 4;
  }
  buf.writeDoubleLE(p.x, offset);
  offset += 8;
  buf.writeDoubleLE(p.y, offset);
  return buf;
}

function encodeLineString(ls: LineString): Buffer {
  const hasSrid = ls.srid !== undefined && ls.srid !== 0;
  const numPoints = ls.coordinates.length;
  const size = 1 + 4 + (hasSrid ? 4 : 0) + 4 + numPoints * 16;
  const buf = Buffer.allocUnsafe(size);
  let offset = 0;
  buf.writeUInt8(LITTLE_ENDIAN, offset++);
  const typeCode = hasSrid ? WKB_LINESTRING | EWKB_SRID_FLAG : WKB_LINESTRING;
  buf.writeUInt32LE(typeCode, offset);
  offset += 4;
  if (hasSrid) {
    buf.writeUInt32LE(ls.srid!, offset);
    offset += 4;
  }
  buf.writeUInt32LE(numPoints, offset);
  offset += 4;
  for (const pt of ls.coordinates) {
    buf.writeDoubleLE(pt.x, offset);
    offset += 8;
    buf.writeDoubleLE(pt.y, offset);
    offset += 8;
  }
  return buf;
}

function encodeLinearRing(ring: LineString): Buffer {
  const numPoints = ring.coordinates.length;
  const buf = Buffer.allocUnsafe(4 + numPoints * 16);
  buf.writeUInt32LE(numPoints, 0);
  let offset = 4;
  for (const pt of ring.coordinates) {
    buf.writeDoubleLE(pt.x, offset);
    offset += 8;
    buf.writeDoubleLE(pt.y, offset);
    offset += 8;
  }
  return buf;
}

function encodePolygon(poly: Polygon): Buffer {
  const hasSrid = poly.srid !== undefined && poly.srid !== 0;
  const numRings = 1 + poly.holes.length;
  const rings = [poly.exterior, ...poly.holes].map(encodeLinearRing);
  const ringBytes = rings.reduce((s, r) => s + r.length, 0);
  const size = 1 + 4 + (hasSrid ? 4 : 0) + 4 + ringBytes;
  const buf = Buffer.allocUnsafe(size);
  let offset = 0;
  buf.writeUInt8(LITTLE_ENDIAN, offset++);
  const typeCode = hasSrid ? WKB_POLYGON | EWKB_SRID_FLAG : WKB_POLYGON;
  buf.writeUInt32LE(typeCode, offset);
  offset += 4;
  if (hasSrid) {
    buf.writeUInt32LE(poly.srid!, offset);
    offset += 4;
  }
  buf.writeUInt32LE(numRings, offset);
  offset += 4;
  for (const ring of rings) {
    ring.copy(buf, offset);
    offset += ring.length;
  }
  return buf;
}

function encodeGeneric(geometry: Geometry): Buffer {
  throw new Error(`WKB encoding not supported for geometry type: ${geometry.type}`);
}

// ─── Decoding (EWKB Buffer | hex string → Geometry) ───────────────────────────

export function decodeWkb(input: Buffer | string): Geometry {
  let buf: Buffer;
  if (typeof input === 'string') {
    // pg driver returns hex-encoded EWKB (may have leading \x)
    const hex = input.startsWith('\\x') ? input.slice(2) : input;
    buf = Buffer.from(hex, 'hex');
  } else {
    buf = input;
  }
  const reader = new WkbReader(buf);
  return reader.readGeometry();
}

class WkbReader {
  private offset = 0;

  constructor(private readonly buf: Buffer) {}

  readGeometry(): Geometry {
    const byteOrder = this.buf.readUInt8(this.offset++);
    const le = byteOrder === LITTLE_ENDIAN;
    const rawType = le ? this.buf.readUInt32LE(this.offset) : this.buf.readUInt32BE(this.offset);
    this.offset += 4;
    const wkbType = rawType & 0x0fffffff;
    const hasSrid = (rawType & EWKB_SRID_FLAG) !== 0;
    let srid: number | undefined;
    if (hasSrid) {
      srid = le ? this.buf.readUInt32LE(this.offset) : this.buf.readUInt32BE(this.offset);
      this.offset += 4;
    }

    switch (wkbType) {
      case WKB_POINT:
        return this.readPoint(le, srid);
      case WKB_LINESTRING:
        return this.readLineString(le, srid);
      case WKB_POLYGON:
        return this.readPolygon(le, srid);
      case WKB_MULTIPOINT:
        return this.readMultiGeometry(le, srid, 'MultiPoint');
      case WKB_MULTILINESTRING:
        return this.readMultiGeometry(le, srid, 'MultiLineString');
      case WKB_MULTIPOLYGON:
        return this.readMultiGeometry(le, srid, 'MultiPolygon');
      case WKB_GEOMETRYCOLLECTION:
        return this.readMultiGeometry(le, srid, 'GeometryCollection');
      default:
        throw new Error(`Unsupported WKB type: ${wkbType}`);
    }
  }

  private readDouble(le: boolean): number {
    const v = le ? this.buf.readDoubleLE(this.offset) : this.buf.readDoubleBE(this.offset);
    this.offset += 8;
    return v;
  }

  private readUInt32(le: boolean): number {
    const v = le ? this.buf.readUInt32LE(this.offset) : this.buf.readUInt32BE(this.offset);
    this.offset += 4;
    return v;
  }

  private readPoint(le: boolean, srid?: number): Point {
    const x = this.readDouble(le);
    const y = this.readDouble(le);
    return { type: 'Point', x, y, srid: srid ?? 4326 };
  }

  private readPointCoordPair(le: boolean, srid?: number): Point {
    const x = this.readDouble(le);
    const y = this.readDouble(le);
    return { type: 'Point', x, y, srid: srid ?? 4326 };
  }

  private readLineString(le: boolean, srid?: number): LineString {
    const numPoints = this.readUInt32(le);
    const coordinates: Point[] = [];
    for (let i = 0; i < numPoints; i++) {
      coordinates.push(this.readPointCoordPair(le, srid));
    }
    return { type: 'LineString', coordinates, srid: srid ?? 4326 };
  }

  private readLinearRing(le: boolean, srid?: number): LineString {
    return this.readLineString(le, srid);
  }

  private readPolygon(le: boolean, srid?: number): Polygon {
    const numRings = this.readUInt32(le);
    if (numRings === 0) {
      return {
        type: 'Polygon',
        exterior: { type: 'LineString', coordinates: [], srid: srid ?? 4326 },
        holes: [],
        srid: srid ?? 4326
      };
    }
    const exterior = this.readLinearRing(le, srid);
    const holes: LineString[] = [];
    for (let i = 1; i < numRings; i++) {
      holes.push(this.readLinearRing(le, srid));
    }
    return { type: 'Polygon', exterior, holes, srid: srid ?? 4326 };
  }

  private readMultiGeometry(le: boolean, srid: number | undefined, type: string): Geometry {
    const numGeoms = this.readUInt32(le);
    const geometries: Geometry[] = [];
    for (let i = 0; i < numGeoms; i++) {
      geometries.push(this.readGeometry());
    }
    return {
      type: type as Geometry['type'],
      geometries,
      srid: srid ?? 4326
    } as unknown as Geometry;
  }
}

// ─── Hex helper for pg driver (PostGIS returns \x prefixed hex) ───────────────

export function geometryToEwkbHex(geometry: Geometry): string {
  return encodeWkb(geometry).toString('hex');
}
