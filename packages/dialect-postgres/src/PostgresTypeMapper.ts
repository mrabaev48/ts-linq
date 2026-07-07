import type { TypeMapper } from '@ts-linq/types';

/** PostgreSQL logical→physical type map. Length is not applied (PG types are unlengthed here). */
export class PostgresTypeMapper implements TypeMapper {
  private static readonly MAP: Record<string, string> = {
    TEXT: 'TEXT',
    STRING: 'TEXT',
    INTEGER: 'INTEGER',
    NUMBER: 'INTEGER',
    REAL: 'DOUBLE PRECISION',
    FLOAT: 'DOUBLE PRECISION',
    DOUBLE: 'DOUBLE PRECISION',
    BOOLEAN: 'BOOLEAN',
    DATETIME: 'TIMESTAMPTZ',
    DATE: 'TIMESTAMPTZ',
    BLOB: 'BYTEA',
    UUID: 'UUID',
    JSONB: 'JSONB',
    JSON: 'JSON'
  };

  public mapType(logicalType: string, _length?: number): string {
    return PostgresTypeMapper.MAP[(logicalType || '').toUpperCase()] ?? 'TEXT';
  }
}
