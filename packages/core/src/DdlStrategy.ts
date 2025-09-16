import type { EntityMetadata } from '../types';

export interface DdlStrategy {
  generateCreateTableSql(metadata: EntityMetadata): string;
  generateCreateIndexSql(
    tableName: string,
    index: { name: string; columns: string[]; unique: boolean }
  ): string;
}
