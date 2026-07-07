import type { TypeMapper } from '@ts-linq/types';

/**
 * SQL Server logical→physical type map. When a `length` is supplied it replaces a trailing `(MAX)`
 * or is appended to a length-less type (e.g. `NVARCHAR(MAX)` → `NVARCHAR(255)`, `INT` → `INT(11)`).
 */
export class MssqlTypeMapper implements TypeMapper {
  public mapType(logicalType: string, length?: number): string {
    const base = MssqlTypeMapper.base(logicalType);
    if (length) {
      if (base.endsWith('(MAX)')) return base.slice(0, -5) + `(${length})`;
      if (!base.includes('(')) return base + `(${length})`;
    }
    return base;
  }

  private static base(type: string): string {
    switch ((type || '').toUpperCase()) {
      case 'TEXT':
      case 'STRING':
        return 'NVARCHAR(MAX)';
      case 'INTEGER':
      case 'NUMBER':
        return 'INT';
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return 'FLOAT';
      case 'BOOLEAN':
        return 'BIT';
      case 'DATETIME':
      case 'DATE':
        return 'DATETIME2';
      case 'BLOB':
        return 'VARBINARY(MAX)';
      case 'UUID':
        return 'UNIQUEIDENTIFIER';
      case 'JSON':
      case 'JSONB':
        // SQL Server stores JSON as NVARCHAR(MAX); use a CHECK ISJSON constraint separately.
        return 'NVARCHAR(MAX)';
      default:
        return 'NVARCHAR(MAX)';
    }
  }
}
