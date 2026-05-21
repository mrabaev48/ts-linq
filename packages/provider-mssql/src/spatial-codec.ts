import type { Geometry, LineString, Point, Polygon } from '@ts-linq/core';
import { isGeometry } from '@ts-linq/core';

export function isGeometryObject(value: unknown): value is Geometry {
  return isGeometry(value);
}

// MSSQL geography/geometry columns:
// - Input: WKT string passed to geography::STGeomFromText('...', SRID)
// - Output: binary (WKB-like format) or string, depending on driver settings
// We use WKT for both directions for maximum compatibility with the mssql driver.

// ─── WKT Encoding (Geometry → Well-Known Text) ────────────────────────────────

export function encodeWkt(geometry: Geometry): string {
  switch (geometry.type) {
    case 'Point':
      return encodePointWkt(geometry as Point);
    case 'LineString':
      return encodeLineStringWkt(geometry as LineString);
    case 'Polygon':
      return encodePolygonWkt(geometry as Polygon);
    case 'MultiPoint':
    case 'MultiLineString':
    case 'MultiPolygon':
    case 'GeometryCollection': {
      const coll = geometry as unknown as { geometries: Geometry[] };
      const inner = coll.geometries.map(encodeWkt).join(', ');
      return `${geometry.type.toUpperCase()} (${inner})`;
    }
    default:
      throw new Error(`WKT encoding not supported for geometry type: ${geometry.type}`);
  }
}

function encodePointWkt(p: Point): string {
  return `POINT (${p.x} ${p.y})`;
}

function encodeLineStringWkt(ls: LineString): string {
  const coords = ls.coordinates.map((p) => `${p.x} ${p.y}`).join(', ');
  return `LINESTRING (${coords})`;
}

function encodePolygonWkt(poly: Polygon): string {
  const rings = [poly.exterior, ...poly.holes];
  const ringWkt = rings
    .map((ring) => `(${ring.coordinates.map((p) => `${p.x} ${p.y}`).join(', ')})`)
    .join(', ');
  return `POLYGON (${ringWkt})`;
}

// ─── WKT Decoding (Well-Known Text → Geometry) ────────────────────────────────

export function decodeWkt(wkt: string, srid = 4326): Geometry {
  const trimmed = wkt.trim();
  if (trimmed.startsWith('POINT')) return parsePoint(trimmed, srid);
  if (trimmed.startsWith('LINESTRING')) return parseLineString(trimmed, srid);
  if (trimmed.startsWith('POLYGON')) return parsePolygon(trimmed, srid);
  throw new Error(`Unsupported WKT type: ${trimmed.substring(0, 30)}`);
}

function parseCoordPair(pair: string, srid: number): Point {
  const parts = pair.trim().split(/\s+/);
  return { type: 'Point', x: parseFloat(parts[0]!), y: parseFloat(parts[1]!), srid };
}

function parsePoint(wkt: string, srid: number): Point {
  const inner = wkt
    .replace(/^POINT\s*\(/, '')
    .replace(/\)$/, '')
    .trim();
  return parseCoordPair(inner, srid);
}

function parseLineString(wkt: string, srid: number): LineString {
  const inner = wkt
    .replace(/^LINESTRING\s*\(/, '')
    .replace(/\)$/, '')
    .trim();
  const coordinates = inner.split(',').map((s) => parseCoordPair(s, srid));
  return { type: 'LineString', coordinates, srid };
}

function parsePolygon(wkt: string, srid: number): Polygon {
  // Extract all ring strings: (x y, x y, ...) groups
  const ringRegex = /\(([^()]+)\)/g;
  const rings: LineString[] = [];
  let match: RegExpExecArray | null;
  while ((match = ringRegex.exec(wkt)) !== null) {
    const coords = match[1]!.split(',').map((s) => parseCoordPair(s, srid));
    rings.push({ type: 'LineString', coordinates: coords, srid });
  }
  const exterior = rings[0] ?? { type: 'LineString', coordinates: [], srid };
  const holes = rings.slice(1);
  return { type: 'Polygon', exterior, holes, srid };
}

// ─── WKB Decoding (for mssql driver binary output) ───────────────────────────

const WKB_POINT = 1;
const WKB_LINESTRING = 2;
const WKB_POLYGON = 3;
const WKB_MULTIPOINT = 4;
const WKB_MULTILINESTRING = 5;
const WKB_MULTIPOLYGON = 6;
const WKB_GEOMETRYCOLLECTION = 7;

export function decodeWkb(input: Buffer, srid = 4326): Geometry {
  const reader = new WkbReader(input, srid);
  return reader.readGeometry();
}

class WkbReader {
  private offset = 0;

  constructor(
    private readonly buf: Buffer,
    private readonly srid: number
  ) {}

  readGeometry(): Geometry {
    const byteOrder = this.buf.readUInt8(this.offset++);
    const le = byteOrder === 1;
    const wkbType = le ? this.buf.readUInt32LE(this.offset) : this.buf.readUInt32BE(this.offset);
    this.offset += 4;

    switch (wkbType) {
      case WKB_POINT:
        return this.readPoint(le);
      case WKB_LINESTRING:
        return this.readLineString(le);
      case WKB_POLYGON:
        return this.readPolygon(le);
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

  private readPoint(le: boolean): Point {
    const x = this.readDouble(le);
    const y = this.readDouble(le);
    return { type: 'Point', x, y, srid: this.srid };
  }

  private readLineString(le: boolean): LineString {
    const n = this.readUInt32(le);
    const coordinates: Point[] = [];
    for (let i = 0; i < n; i++) {
      const x = this.readDouble(le);
      const y = this.readDouble(le);
      coordinates.push({ type: 'Point', x, y, srid: this.srid });
    }
    return { type: 'LineString', coordinates, srid: this.srid };
  }

  private readPolygon(le: boolean): Polygon {
    const numRings = this.readUInt32(le);
    const readRing = (): LineString => {
      const n = this.readUInt32(le);
      const coordinates: Point[] = [];
      for (let i = 0; i < n; i++) {
        const x = this.readDouble(le);
        const y = this.readDouble(le);
        coordinates.push({ type: 'Point', x, y, srid: this.srid });
      }
      return { type: 'LineString', coordinates, srid: this.srid };
    };
    if (numRings === 0) {
      return {
        type: 'Polygon',
        exterior: { type: 'LineString', coordinates: [], srid: this.srid },
        holes: [],
        srid: this.srid
      };
    }
    const exterior = readRing();
    const holes: LineString[] = [];
    for (let i = 1; i < numRings; i++) holes.push(readRing());
    return { type: 'Polygon', exterior, holes, srid: this.srid };
  }
}
