import { EntityMetadata, ColumnMetadata } from '../../types';
import { SqlHelper } from '../../utils/SqlHelper';

export class PostgresDdlStrategy {
  public generateCreateTableSql(entityMetadata: EntityMetadata): string {
    const cols = entityMetadata.columns.map((c) => {
      const t = this.mapTypeToPg(c.type);
      const nn = c.nullable ? '' : ' NOT NULL';
      return `"${c.columnName}" ${t}${nn}`;
    });
    if (entityMetadata.primaryKeys.length > 0) {
      const pk = entityMetadata.primaryKeys
        .map(
          (pk) => `"${entityMetadata.columns.find((c) => c.propertyName === pk)?.columnName || pk}"`
        )
        .join(', ');
      cols.push(`PRIMARY KEY (${pk})`);
    }
    return `CREATE TABLE IF NOT EXISTS "${entityMetadata.tableName}" (${cols.join(', ')})`;
  }

  public generateCreateIndexSql(
    table: string,
    index: { name: string; columns: string[]; unique: boolean }
  ): string {
    const uniqueKeyword = index.unique ? 'UNIQUE ' : '';
    const colsList = index.columns.map((c) => `"${c}"`).join(', ');
    return `CREATE ${uniqueKeyword}INDEX IF NOT EXISTS "${index.name}" ON "${table}" (${colsList})`;
  }

  public mapTypeToPg(type: string): string {
    switch ((type || '').toUpperCase()) {
      case 'TEXT':
      case 'STRING':
        return 'TEXT';
      case 'INTEGER':
      case 'NUMBER':
        return 'INTEGER';
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return 'DOUBLE PRECISION';
      case 'BOOLEAN':
        return 'BOOLEAN';
      case 'DATETIME':
      case 'DATE':
        return 'TIMESTAMPTZ';
      case 'BLOB':
        return 'BYTEA';
      case 'UUID':
        return 'UUID';
      case 'JSONB':
        return 'JSONB';
      case 'JSON':
        return 'JSON';
      default:
        return 'TEXT';
    }
  }
}
