import type { EntityMetadata, SqlParameter } from '@ts-linq/types';

import type { DatabaseProvider } from '../DatabaseProvider';

export class BatchInsertOperation {
  constructor(private readonly provider: DatabaseProvider) {}

  async execute<T extends object>(entities: T[], metadata: EntityMetadata): Promise<T[]> {
    if (entities.length === 0) return [];

    if (this.provider.insertMany && entities.length > 1 && metadata.target) {
      return await this.provider.insertMany(entities, metadata.target);
    }

    const columns = metadata.columns.filter(
      (col) =>
        !col.isGenerated &&
        entities.some(
          (entity) => (entity as Record<string, unknown>)[col.propertyName] !== undefined
        )
    );

    if (columns.length === 0) {
      throw new Error('No insertable columns found');
    }

    const columnNames = columns.map((col) => col.columnName || col.propertyName);
    const placeholders: string[] = [];
    const allParams: SqlParameter[] = [];

    for (const entity of entities) {
      const rowPlaceholders: string[] = [];
      for (const column of columns) {
        const value = (entity as Record<string, unknown>)[column.propertyName] as SqlParameter;
        rowPlaceholders.push('?');
        allParams.push(value);
      }
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    }

    const sql = `INSERT INTO ${metadata.tableName} (${columnNames.join(', ')}) VALUES ${placeholders.join(', ')}`;
    await this.provider.executeNonQuery(sql, allParams);
    return entities;
  }
}
