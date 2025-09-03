import { EntityMetadata } from '../types';
import { DdlStrategy } from './DdlStrategy';

/**
 * Small facade over a DdlStrategy to generate CREATE TABLE and INDEX statements
 * in a consistent, testable way.
 */
export class DdlBuilder {
  private readonly strategy: DdlStrategy;

  constructor(strategy: DdlStrategy) {
    this.strategy = strategy;
  }

  public buildCreateTableSql(metadata: EntityMetadata): string {
    return this.strategy.generateCreateTableSql(metadata);
  }

  public buildCreateIndexesSql(metadata: EntityMetadata): string[] {
    const result: string[] = [];
    for (const idx of metadata.indexes || []) {
      result.push(
        this.strategy.generateCreateIndexSql(metadata.tableName, {
          name: idx.name,
          columns: idx.columns,
          unique: idx.unique
        })
      );
    }
    return result;
  }

  public buildAll(metadata: EntityMetadata): { tableSql: string; indexSqls: string[] } {
    return {
      tableSql: this.buildCreateTableSql(metadata),
      indexSqls: this.buildCreateIndexesSql(metadata)
    };
  }
}


