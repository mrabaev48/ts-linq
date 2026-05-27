import type { DatabaseProvider } from '@ts-linq/core';
import type { MetadataRegistry } from '@ts-linq/metadata';

import type { NormalizedChange } from '../types';
import { chunkGroup, groupChanges } from './batch-grouper';

/**
 * Executes SaveChanges entries in dialect-specific batch SQL statements.
 *
 * Flow:
 *  1. Group changes by (entityClass, operation)
 *  2. Chunk each group to honour maxBatchSize + dialect.parameterLimit
 *  3. Emit multi-row INSERT / bulk UPDATE / DELETE IN (…) per chunk
 *  4. Copy generated PK values back into entity objects (INSERT path)
 *  5. Return total affected rows
 */
export class BatchExecutor {
  constructor(
    private readonly provider: DatabaseProvider,
    private readonly maxBatchSize: number,
    private readonly registry: MetadataRegistry
  ) {}

  async execute(changes: NormalizedChange[]): Promise<number> {
    const dialect = this.provider.getDialect();
    const paramLimit = dialect.parameterLimit ?? 65535;

    const groups = groupChanges(changes, this.registry);
    let totalAffected = 0;

    for (const group of groups) {
      const chunks = chunkGroup(group, this.maxBatchSize, paramLimit);

      for (const chunk of chunks) {
        switch (chunk.operation) {
          case 'insert': {
            if (dialect.buildBatchInsert) {
              const result = dialect.buildBatchInsert(chunk.entities, chunk.metadata);
              if (result.returnsRows === false) {
                // MySQL path: INSERT does not return rows; retrieve generated PKs separately
                await this.provider.executeNonQuery(result.sql, result.parameters);
                if (result.fetchFirstInsertIdSql) {
                  const idRows = await this.provider.executeQuery<Record<string, unknown>>(
                    result.fetchFirstInsertIdSql,
                    []
                  );
                  const firstId = idRows[0]?.['first_id'] as number | undefined;
                  if (firstId != null) {
                    assignSequentialIds(chunk.entities, firstId, chunk.metadata);
                  }
                }
              } else {
                // PG / MSSQL path: INSERT returns rows inline via RETURNING / OUTPUT
                const rows = await this.provider.executeQuery<Record<string, unknown>>(
                  result.sql,
                  result.parameters
                );
                copyGeneratedValues(chunk.entities, rows, chunk.metadata);
              }
              totalAffected += chunk.entities.length;
            } else {
              // Dialect doesn't support batch insert — fall back to per-row
              for (const entity of chunk.entities) {
                await this.provider.insert(entity, chunk.entityClass);
                totalAffected++;
              }
            }
            break;
          }

          case 'update': {
            if (dialect.buildBatchUpdate) {
              const result = dialect.buildBatchUpdate(chunk.entities, chunk.metadata);
              if (result.statements) {
                // MySQL: multiple per-row statements
                for (const stmt of result.statements) {
                  const affected = await this.provider.executeNonQuery(stmt.sql, stmt.parameters);
                  totalAffected += affected;
                }
              } else if (result.sql && result.parameters) {
                const affected = await this.provider.executeNonQuery(result.sql, result.parameters);
                totalAffected += affected;
              }
            } else {
              for (const entity of chunk.entities) {
                await this.provider.update(entity, chunk.entityClass);
                totalAffected++;
              }
            }
            break;
          }

          case 'delete': {
            if (dialect.buildBatchDelete) {
              const result = dialect.buildBatchDelete(chunk.entities, chunk.metadata);
              const affected = await this.provider.executeNonQuery(result.sql, result.parameters);
              totalAffected += affected;
            } else {
              for (const entity of chunk.entities) {
                await this.provider.delete(entity, chunk.entityClass);
                totalAffected++;
              }
            }
            break;
          }
        }
      }
    }

    return totalAffected;
  }
}

/**
 * Assign sequential IDs to entities after a MySQL batch INSERT.
 * MySQL AUTO_INCREMENT guarantees that multi-row INSERT produces consecutive IDs
 * starting from LAST_INSERT_ID().
 */
function assignSequentialIds(
  entities: Record<string, unknown>[],
  firstId: number,
  metadata: {
    columns: Array<{ propertyName: string; isGenerated?: boolean }>;
    primaryKeys?: string[];
  }
): void {
  const pks = metadata.primaryKeys ?? [];
  const genCols = metadata.columns.filter((c) => c.isGenerated && pks.includes(c.propertyName));
  for (let i = 0; i < entities.length; i++) {
    for (const col of genCols) {
      entities[i][col.propertyName] = firstId + i;
    }
  }
}

/**
 * Copy values returned by INSERT RETURNING / OUTPUT back into the original entity objects.
 * This updates generated PKs, computed columns, and server-side defaults in-place.
 */
function copyGeneratedValues(
  entities: Record<string, unknown>[],
  rows: Record<string, unknown>[],
  metadata: { columns: Array<{ propertyName: string; columnName: string }> }
): void {
  for (let i = 0; i < Math.min(entities.length, rows.length); i++) {
    const row = rows[i];
    const entity = entities[i];
    // Map column names → property names
    for (const col of metadata.columns) {
      const dbValue = row[col.columnName] ?? row[col.propertyName];
      if (dbValue !== undefined) {
        entity[col.propertyName] = dbValue;
      }
    }
  }
}
