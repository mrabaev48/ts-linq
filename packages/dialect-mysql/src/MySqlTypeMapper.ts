import type { TypeMapper } from '@ts-linq/types';

/** MySQL logical→physical type map. A supplied `length` is appended as `(length)`. */
export class MySqlTypeMapper implements TypeMapper {
  public mapType(logicalType: string, length?: number): string {
    const base = MySqlTypeMapper.base(logicalType);
    return length ? `${base}(${length})` : base;
  }

  private static base(type: string): string {
    switch ((type || '').toUpperCase()) {
      case 'TEXT':
      case 'STRING':
        return 'TEXT';
      case 'INTEGER':
      case 'NUMBER':
        return 'INT';
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return 'DOUBLE';
      case 'BOOLEAN':
        return 'TINYINT(1)';
      case 'DATETIME':
      case 'DATE':
        return 'DATETIME';
      case 'BLOB':
        return 'BLOB';
      case 'JSON':
      case 'JSONB':
        return 'JSON';
      default:
        return 'TEXT';
    }
  }
}
