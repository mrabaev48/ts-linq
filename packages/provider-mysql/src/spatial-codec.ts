import type { Geometry, LineString, Point, Polygon } from '@ts-linq/core';
import { isGeometry } from '@ts-linq/core';

export function isGeometryObject(value: unknown): value is Geometry {
  return isGeometry(value);
}

// ISO WKB type constants
const WKB_POINT = 1;
const WKB_LINESTRING = 2;
const WKB_POLYGON = 3;
const WKB_MULTIPOINT = 4;
const WKB_MULTILINESTRING = 5;
const WKB_MULTIPOLYGON = 6;
const WKB_GEOMETRYCOLLECTION = 7;

const LITTLE_ENDIAN = 1;

// MySQL prefixes WKB output with a 4-byte SRID (little-endian) when reading,
// and expects WKB without the SRID prefix for most input operations.

// ─── Encoding (Geometry → ISO WKB Buffer, no SRID prefix) ────────────────────

export function encodeWkb(geometry: Geometry): Buffer {
  switch (geometry.type) {
    case 'Point':
      return encodePoint(geometry as Point);
    case 'LineString':
      return encodeLineString(geometry as LineString);
    case 'Polygon':
      return encodePolygon(geometry as Polygon);
    default:
      throw new Error(`WKB encoding not supported for geometry type: ${geometry.type}`);
  }
}

function encodePoint(p: Point): Buffer {
  const buf = Buffer.allocUnsafe(1 + 4 + 8 + 8);
  let offset = 0;
  buf.writeUInt8(LITTLE_ENDIAN, offset++);
  buf.writeUInt32LE(WKB_POINT, offset);
  offset += 4;
  buf.writeDoubleLE(p.x, offset);
  offset += 8;
  buf.writeDoubleLE(p.y, offset);
  return buf;
}

function encodeLineString(ls: LineString): Buffer {
  const numPoints = ls.coordinates.length;
  const buf = Buffer.allocUnsafe(1 + 4 + 4 + numPoints * 16);
  let offset = 0;
  buf.writeUInt8(LITTLE_ENDIAN, offset++);
  buf.writeUInt32LE(WKB_LINESTRING, offset);
  offset += 4;
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

function encodePolygon(poly: Polygon): Buffer {
  const numRings = 1 + poly.holes.length;
  const rings = [poly.exterior, ...poly.holes];
  const ringBuffers = rings.map((ring) => {
    const n = ring.coordinates.length;
    const rb = Buffer.allocUnsafe(4 + n * 16);
    rb.writeUInt32LE(n, 0);
    let off = 4;
    for (const pt of ring.coordinates) {
      rb.writeDoubleLE(pt.x, off);
      off += 8;
      rb.writeDoubleLE(pt.y, off);
      off += 8;
    }
    return rb;
  });
  const ringBytes = ringBuffers.reduce((s, r) => s + r.length, 0);
  const buf = Buffer.allocUnsafe(1 + 4 + 4 + ringBytes);
  let offset = 0;
  buf.writeUInt8(LITTLE_ENDIAN, offset++);
  buf.writeUInt32LE(WKB_POLYGON, offset);
  offset += 4;
  buf.writeUInt32LE(numRings, offset);
  offset += 4;
  for (const rb of ringBuffers) {
    rb.copy(buf, offset);
    offset += rb.length;
  }
  return buf;
}

// ─── Decoding (MySQL WKB Buffer → Geometry) ────────────────────────────────────
// MySQL returns a Buffer with 4-byte SRID prefix followed by ISO WKB.

export function decodeWkb(input: Buffer): Geometry {
  // Strip 4-byte SRID prefix if present (MySQL format)
  let srid: number | undefined;
  let buf = input;
  if (buf.length >= 5) {
    // Check if first byte could be SRID prefix (MySQL) or byte-order mark (ISO WKB)
    const firstByte = buf.readUInt8(0);
    if (firstByte !== 0 && firstByte !== 1) {
      // Looks like a 4-byte SRID prefix
      srid = buf.readUInt32LE(0);
      buf = buf.subarray(4);
    }
  }
  const reader = new WkbReader(buf, srid);
  return reader.readGeometry();
}

class WkbReader {
  private offset = 0;

  constructor(
    private readonly buf: Buffer,
    private readonly defaultSrid?: number
  ) {}

  readGeometry(): Geometry {
    const byteOrder = this.buf.readUInt8(this.offset++);
    const le = byteOrder === LITTLE_ENDIAN;
    const wkbType = le ? this.buf.readUInt32LE(this.offset) : this.buf.readUInt32BE(this.offset);
    this.offset += 4;

    const srid = this.defaultSrid ?? 4326;

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

  private readPoint(le: boolean, srid: number): Point {
    const x = this.readDouble(le);
    const y = this.readDouble(le);
    return { type: 'Point', x, y, srid };
  }

  private readLineString(le: boolean, srid: number): LineString {
    const n = this.readUInt32(le);
    const coordinates: Point[] = [];
    for (let i = 0; i < n; i++) {
      const x = this.readDouble(le);
      const y = this.readDouble(le);
      coordinates.push({ type: 'Point', x, y, srid });
    }
    return { type: 'LineString', coordinates, srid };
  }

  private readPolygon(le: boolean, srid: number): Polygon {
    const numRings = this.readUInt32(le);
    if (numRings === 0) {
      return {
        type: 'Polygon',
        exterior: { type: 'LineString', coordinates: [], srid },
        holes: [],
        srid
      };
    }
    const exterior = this.readRing(le, srid);
    const holes: LineString[] = [];
    for (let i = 1; i < numRings; i++) {
      holes.push(this.readRing(le, srid));
    }
    return { type: 'Polygon', exterior, holes, srid };
  }

  private readRing(le: boolean, srid: number): LineString {
    const n = this.readUInt32(le);
    const coordinates: Point[] = [];
    for (let i = 0; i < n; i++) {
      const x = this.readDouble(le);
      const y = this.readDouble(le);
      coordinates.push({ type: 'Point', x, y, srid });
    }
    return { type: 'LineString', coordinates, srid };
  }

  private readMultiGeometry(le: boolean, srid: number, type: string): Geometry {
    const n = this.readUInt32(le);
    const geometries: Geometry[] = [];
    for (let i = 0; i < n; i++) {
      geometries.push(this.readGeometry());
    }
    return { type: type as Geometry['type'], geometries, srid } as unknown as Geometry;
  }
}
