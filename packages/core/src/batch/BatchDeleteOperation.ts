import type { EntityMetadata, SqlParameter } from '@ts-linq/types';

import type { DatabaseProvider } from '../DatabaseProvider';
import { noPrimaryKey, noPrimaryKeys } from './batchErrors';

export class BatchDeleteOperation {
  constructor(private readonly provider: DatabaseProvider) {}

  async execute<T extends object>(entities: T[], metadata: EntityMetadata): Promise<number> {
    if (!metadata.primaryKeys) {
      throw noPrimaryKeys(metadata.target?.name ?? 'Unknown');
    }

    const primaryKeyColumn = metadata.columns.find((col) =>
      metadata.primaryKeys!.includes(col.propertyName)
    );

    if (!primaryKeyColumn) {
      throw noPrimaryKey(metadata.target?.name ?? 'Unknown');
    }

    const primaryKeyValues = entities
      .map(
        (entity) =>
          (entity as Record<string, unknown>)[primaryKeyColumn.propertyName] as SqlParameter
      )
      .filter((value) => value !== undefined && value !== null);

    if (primaryKeyValues.length === 0) return 0;

    const placeholders = primaryKeyValues.map(() => '?').join(', ');
    const columnName = primaryKeyColumn.columnName || primaryKeyColumn.propertyName;
    const sql = `DELETE FROM ${metadata.tableName} WHERE ${columnName} IN (${placeholders})`;

    return await this.provider.executeNonQuery(sql, primaryKeyValues);
  }
}
