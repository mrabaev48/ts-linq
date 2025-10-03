import type { DatabaseProvider } from '../DatabaseProvider';
import type { EntityMetadata, SqlParameter } from '../types';
import { MetadataStorage } from '../metadata/MetadataStorage';
import { BatchPlan } from './BatchPlan';
import { BatchExecutor } from './BatchExecutor';

/**
 * Configuration options for batch operations
 */
export interface BatchOptions {
  /** Maximum number of entities to process in a single batch (default: 1000) */
  batchSize?: number;
  /** Whether to use transactions for each batch (default: true) */
  useTransactions?: boolean;
  /** Whether to continue processing if some entities fail (default: false) */
  continueOnError?: boolean;
  /** Progress callback for long-running operations */
  onProgress?: (processed: number, total: number) => void;
  /** Custom timeout per batch in milliseconds */
  timeoutMs?: number;
  /** Whether to return detailed results with errors (default: false) */
  returnDetailedResults?: boolean;
}

/**
 * Detailed result for batch operations when returnDetailedResults is enabled
 */
export interface BatchResult<T> {
  /** Successfully processed entities */
  successful: T[];
  /** Failed entities with their errors */
  failed: Array<{ entity: T; error: Error }>;
  /** Total number of entities processed */
  totalProcessed: number;
  /** Total time taken in milliseconds */
  durationMs: number;
  /** Number of batches executed */
  batchCount: number;
}

/**
 * Simple batch result for basic operations
 */
export interface SimpleBatchResult<T> {
  /** All processed entities (successful ones) */
  entities: T[];
  /** Number of entities that failed */
  failedCount: number;
  /** Total processing time */
  durationMs: number;
}

/**
 * Enhanced batch operations with optimizations for large datasets.
 * Provides bulk insert/update/delete operations that are much more efficient
 * than iterating through entities one by one.
 */
export class BatchOperations {
  private provider: DatabaseProvider;
  private defaultBatchSize = 1000;
  private readonly plan: BatchPlan;
  private readonly executor: BatchExecutor;

  constructor(provider: DatabaseProvider) {
    this.provider = provider;
    this.plan = new BatchPlan();
    this.executor = new BatchExecutor(provider);
  }

  /**
   * Bulk insert entities using optimized SQL bulk insert statements.
   * Much more efficient than insertMany for large datasets.
   */
  async bulkInsert<T extends object>(
    entities: T[],
    entityClass: new () => T,
    options: BatchOptions = {}
  ): Promise<
    BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>
  > {
    const startTime = Date.now();
    const metadata = this.getEntityMetadata(entityClass);
    const {
      batchSize = this.defaultBatchSize,
      useTransactions = true,
      continueOnError = false,
      onProgress,
      returnDetailedResults = false
    } = options;

    if (entities.length === 0) {
      return this.createEmptyResult<T>(
        returnDetailedResults,
        startTime
      ) as unknown as BatchOptions['returnDetailedResults'] extends true
        ? BatchResult<T>
        : SimpleBatchResult<T>;
    }

    const successful: T[] = [];
    const failed: Array<{ entity: T; error: Error }> = [];
    const chunks = this.plan.planChunks(entities, batchSize);
    let processed = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      try {
        await this.executor.inTxn(useTransactions, async () => {
          const insertedChunk = await this.executeBulkInsert(chunk, metadata);
          successful.push(...insertedChunk);
        });
        processed += chunk.length;
        onProgress?.(processed, entities.length);
      } catch (error) {
        if (continueOnError) {
          for (const entity of chunk) {
            failed.push({ entity, error: error as Error });
          }
          processed += chunk.length;
          onProgress?.(processed, entities.length);
        } else {
          throw error;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    if (returnDetailedResults) {
      return {
        successful,
        failed,
        totalProcessed: processed,
        durationMs,
        batchCount: chunks.length
      } as unknown as BatchOptions['returnDetailedResults'] extends true
        ? BatchResult<T>
        : SimpleBatchResult<T>;
    } else {
      return {
        entities: successful,
        failedCount: failed.length,
        durationMs
      } as unknown as BatchOptions['returnDetailedResults'] extends true
        ? BatchResult<T>
        : SimpleBatchResult<T>;
    }
  }

  /**
   * Bulk update entities using optimized batch update strategies.
   */
  async bulkUpdate<T extends object>(
    entities: T[],
    entityClass: new () => T,
    options: BatchOptions = {}
  ): Promise<
    BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>
  > {
    const startTime = Date.now();
    const metadata = this.getEntityMetadata(entityClass);
    const {
      batchSize = this.defaultBatchSize,
      useTransactions = true,
      continueOnError = false,
      onProgress,
      returnDetailedResults = false
    } = options;

    if (entities.length === 0) {
      return this.createEmptyResult<T>(
        returnDetailedResults,
        startTime
      ) as unknown as BatchOptions['returnDetailedResults'] extends true
        ? BatchResult<T>
        : SimpleBatchResult<T>;
    }

    const successful: T[] = [];
    const failed: Array<{ entity: T; error: Error }> = [];
    const chunks = this.plan.planChunks(entities, batchSize);
    let processed = 0;

    for (const chunk of chunks) {
      try {
        await this.executor.inTxn(useTransactions, async () => {
          const updatedChunk = await this.executeBulkUpdate(chunk, metadata);
          successful.push(...updatedChunk);
        });
        processed += chunk.length;
        onProgress?.(processed, entities.length);
      } catch (error) {
        if (continueOnError) {
          for (const entity of chunk) {
            failed.push({ entity, error: error as Error });
          }
          processed += chunk.length;
          onProgress?.(processed, entities.length);
        } else {
          throw error;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    if (returnDetailedResults) {
      return {
        successful,
        failed,
        totalProcessed: processed,
        durationMs,
        batchCount: chunks.length
      } as unknown as BatchOptions['returnDetailedResults'] extends true
        ? BatchResult<T>
        : SimpleBatchResult<T>;
    } else {
      return {
        entities: successful,
        failedCount: failed.length,
        durationMs
      } as unknown as BatchOptions['returnDetailedResults'] extends true
        ? BatchResult<T>
        : SimpleBatchResult<T>;
    }
  }

  /**
   * Bulk delete entities using optimized bulk delete operations.
   */
  async bulkDelete<T extends object>(
    entities: T[],
    entityClass: new () => T,
    options: BatchOptions = {}
  ): Promise<{ deletedCount: number; failedCount: number; durationMs: number }> {
    const startTime = Date.now();
    const metadata = this.getEntityMetadata(entityClass);
    const {
      batchSize = this.defaultBatchSize,
      useTransactions = true,
      continueOnError = false,
      onProgress
    } = options;

    if (entities.length === 0) {
      return { deletedCount: 0, failedCount: 0, durationMs: 0 };
    }

    let deletedCount = 0;
    let failedCount = 0;
    const chunks = this.plan.planChunks(entities, batchSize);
    let processed = 0;

    for (const chunk of chunks) {
      try {
        await this.executor.inTxn(useTransactions, async () => {
          const deleted = await this.executeBulkDelete(chunk, metadata);
          deletedCount += deleted;
        });
        processed += chunk.length;
        onProgress?.(processed, entities.length);
      } catch (error) {
        if (continueOnError) {
          failedCount += chunk.length;
          processed += chunk.length;
          onProgress?.(processed, entities.length);
        } else {
          throw error;
        }
      }
    }

    return {
      deletedCount,
      failedCount,
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Bulk upsert (insert or update) entities with optimized conflict resolution.
   */
  async bulkUpsert<T extends object>(
    entities: T[],
    entityClass: new () => T,
    options: BatchOptions = {}
  ): Promise<
    BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>
  > {
    const startTime = Date.now();
    const metadata = this.getEntityMetadata(entityClass);
    const {
      batchSize = this.defaultBatchSize,
      useTransactions = true,
      continueOnError = false,
      onProgress,
      returnDetailedResults = false
    } = options;

    if (entities.length === 0) {
      return this.createEmptyResult<T>(
        returnDetailedResults,
        startTime
      ) as unknown as BatchOptions['returnDetailedResults'] extends true
        ? BatchResult<T>
        : SimpleBatchResult<T>;
    }

    const successful: T[] = [];
    const failed: Array<{ entity: T; error: Error }> = [];
    const chunks = this.plan.planChunks(entities, batchSize);
    let processed = 0;

    for (const chunk of chunks) {
      try {
        await this.executor.inTxn(useTransactions, async () => {
          const upsertedChunk = await this.executeBulkUpsert(chunk, metadata);
          successful.push(...upsertedChunk);
        });
        processed += chunk.length;
        onProgress?.(processed, entities.length);
      } catch (error) {
        if (continueOnError) {
          for (const entity of chunk) {
            failed.push({ entity, error: error as Error });
          }
          processed += chunk.length;
          onProgress?.(processed, entities.length);
        } else {
          throw error;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    if (returnDetailedResults) {
      return {
        successful,
        failed,
        totalProcessed: processed,
        durationMs,
        batchCount: chunks.length
      } as unknown as BatchOptions['returnDetailedResults'] extends true
        ? BatchResult<T>
        : SimpleBatchResult<T>;
    } else {
      return {
        entities: successful,
        failedCount: failed.length,
        durationMs
      } as unknown as BatchOptions['returnDetailedResults'] extends true
        ? BatchResult<T>
        : SimpleBatchResult<T>;
    }
  }

  /**
   * Execute optimized bulk insert using VALUES clause or provider-specific bulk insert.
   */
  private async executeBulkInsert<T extends object>(
    entities: T[],
    metadata: EntityMetadata
  ): Promise<T[]> {
    // Try to use provider-specific bulk insert if available
    if (this.provider.insertMany && entities.length > 1) {
      // Use database-specific bulk operations if supported
      return await this.provider.insertMany(entities, metadata.target);
    }

    // Build bulk INSERT with VALUES clause
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

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const entityPlaceholders: string[] = [];

      for (const column of columns) {
        const value = (entity as Record<string, unknown>)[column.propertyName] as SqlParameter;
        entityPlaceholders.push('?');
        allParams.push(value);
      }

      placeholders.push(`(${entityPlaceholders.join(', ')})`);
    }

    const sql = `
      INSERT INTO ${metadata.tableName} (${columnNames.join(', ')})
      VALUES ${placeholders.join(', ')}
    `;

    await this.provider.executeNonQuery(sql, allParams);
    return entities;
  }

  /**
   * Execute optimized bulk update using CASE statements or batch operations.
   */
  private async executeBulkUpdate<T extends object>(
    entities: T[],
    metadata: EntityMetadata
  ): Promise<T[]> {
    // Try provider-specific bulk update
    if (this.provider.updateMany && entities.length > 1) {
      return await this.provider.updateMany(entities, metadata.target);
    }

    // Build batch update statements
    const primaryKeyColumn = metadata.columns.find((col) =>
      metadata.primaryKeys.includes(col.propertyName)
    );

    if (!primaryKeyColumn) {
      throw new Error(`No primary key found for entity ${metadata.target.name}`);
    }

    const updateColumns = metadata.columns.filter(
      (col) => !metadata.primaryKeys.includes(col.propertyName) && !col.isGenerated
    );

    if (updateColumns.length === 0) {
      return entities; // Nothing to update
    }

    // Use individual updates within the transaction for better compatibility
    for (const entity of entities) {
      await this.provider.update(entity, metadata.target);
    }

    return entities;
  }

  /**
   * Execute optimized bulk delete using IN clause.
   */
  private async executeBulkDelete<T extends object>(
    entities: T[],
    metadata: EntityMetadata
  ): Promise<number> {
    const primaryKeyColumn = metadata.columns.find((col) =>
      metadata.primaryKeys.includes(col.propertyName)
    );

    if (!primaryKeyColumn) {
      throw new Error(`No primary key found for entity ${metadata.target.name}`);
    }

    const primaryKeyValues = entities
      .map(
        (entity) =>
          (entity as Record<string, unknown>)[primaryKeyColumn.propertyName] as SqlParameter
      )
      .filter((value) => value !== undefined && value !== null);

    if (primaryKeyValues.length === 0) {
      return 0;
    }

    const placeholders = primaryKeyValues.map(() => '?').join(', ');
    const sql = `
      DELETE FROM ${metadata.tableName}
      WHERE ${primaryKeyColumn.columnName || primaryKeyColumn.propertyName} IN (${placeholders})
    `;

    return await this.provider.executeNonQuery(sql, primaryKeyValues);
  }

  /**
   * Execute bulk upsert using INSERT ... ON CONFLICT or provider-specific methods.
   */
  private async executeBulkUpsert<T extends object>(
    entities: T[],
    metadata: EntityMetadata
  ): Promise<T[]> {
    // Use provider's upsertMany if available
    if (this.provider.upsertMany && entities.length > 1) {
      return await this.provider.upsertMany(entities, metadata.target);
    }

    // Fallback to individual upserts
    const results: T[] = [];
    for (const entity of entities) {
      const result = await this.provider.upsert(entity, metadata.target);
      results.push(result);
    }

    return results;
  }

  /**
   * Split array into chunks of specified size for batch processing.
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get entity metadata with validation.
   */
  private getEntityMetadata(entityClass: Function): EntityMetadata {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) {
      throw new Error(`No metadata found for entity ${entityClass.name}`);
    }
    return metadata;
  }

  /**
   * Create empty result based on return type.
   */
  private createEmptyResult<T>(
    returnDetailedResults: boolean,
    startTime: number
  ): BatchResult<T> | SimpleBatchResult<T> {
    const durationMs = Date.now() - startTime;

    if (returnDetailedResults) {
      return {
        successful: [],
        failed: [],
        totalProcessed: 0,
        durationMs,
        batchCount: 0
      } as BatchResult<T>;
    } else {
      return {
        entities: [],
        failedCount: 0,
        durationMs
      } as SimpleBatchResult<T>;
    }
  }

  /**
   * Set default batch size for operations.
   */
  setDefaultBatchSize(size: number): void {
    if (size <= 0) {
      throw new Error('Batch size must be greater than 0');
    }
    this.defaultBatchSize = size;
  }

  /**
   * Get current default batch size.
   */
  getDefaultBatchSize(): number {
    return this.defaultBatchSize;
  }
}
