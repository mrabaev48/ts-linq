import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityCtor, EntityMetadata } from '@ts-linq/types';

import type { DatabaseProvider } from '../DatabaseProvider';
import { BatchDeleteOperation } from './BatchDeleteOperation';
import { BatchExecutor } from './BatchExecutor';
import { BatchInsertOperation } from './BatchInsertOperation';
import { BatchPlan } from './BatchPlan';
import { BatchUpdateOperation } from './BatchUpdateOperation';
import { BatchUpsertOperation } from './BatchUpsertOperation';

export interface BatchOptions {
  batchSize?: number;
  useTransactions?: boolean;
  continueOnError?: boolean;
  onProgress?: (processed: number, total: number) => void;
  timeoutMs?: number;
  returnDetailedResults?: boolean;
}

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ entity: T; error: Error }>;
  totalProcessed: number;
  durationMs: number;
  batchCount: number;
}

export interface SimpleBatchResult<T> {
  entities: T[];
  failedCount: number;
  durationMs: number;
}

export class BatchOperations {
  private readonly plan: BatchPlan;
  private readonly executor: BatchExecutor;
  private readonly insert: BatchInsertOperation;
  private readonly update: BatchUpdateOperation;
  private readonly delete: BatchDeleteOperation;
  private readonly upsert: BatchUpsertOperation;
  private defaultBatchSize = 1000;

  constructor(private readonly provider: DatabaseProvider) {
    this.plan = new BatchPlan();
    this.executor = new BatchExecutor(provider);
    this.insert = new BatchInsertOperation(provider);
    this.update = new BatchUpdateOperation(provider);
    this.delete = new BatchDeleteOperation(provider);
    this.upsert = new BatchUpsertOperation(provider);
  }

  async bulkInsert<T extends object>(
    entities: T[],
    entityClass: new () => T,
    options: BatchOptions = {}
  ): Promise<
    BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>
  > {
    return this.runBatch(entities, entityClass, options, async (chunk, meta) =>
      this.insert.execute(chunk, meta)
    ) as Promise<
      BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>
    >;
  }

  async bulkUpdate<T extends object>(
    entities: T[],
    entityClass: new () => T,
    options: BatchOptions = {}
  ): Promise<
    BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>
  > {
    return this.runBatch(entities, entityClass, options, async (chunk, meta) =>
      this.update.execute(chunk, meta)
    ) as Promise<
      BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>
    >;
  }

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
    if (entities.length === 0) return { deletedCount: 0, failedCount: 0, durationMs: 0 };

    let deletedCount = 0;
    let failedCount = 0;
    const chunks = this.plan.planChunks(entities, batchSize);
    let processed = 0;

    for (const chunk of chunks) {
      try {
        await this.executor.inTxn(useTransactions, async () => {
          deletedCount += await this.delete.execute(chunk, metadata);
        });
        processed += chunk.length;
        onProgress?.(processed, entities.length);
      } catch (error) {
        if (continueOnError) {
          failedCount += chunk.length;
          processed += chunk.length;
          onProgress?.(processed, entities.length);
        } else throw error;
      }
    }

    return { deletedCount, failedCount, durationMs: Date.now() - startTime };
  }

  async bulkUpsert<T extends object>(
    entities: T[],
    entityClass: new () => T,
    options: BatchOptions = {}
  ): Promise<
    BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>
  > {
    return this.runBatch(entities, entityClass, options, async (chunk, meta) =>
      this.upsert.execute(chunk, meta)
    ) as Promise<
      BatchOptions['returnDetailedResults'] extends true ? BatchResult<T> : SimpleBatchResult<T>
    >;
  }

  setDefaultBatchSize(size: number): void {
    if (size <= 0) throw new Error('Batch size must be greater than 0');
    this.defaultBatchSize = size;
  }

  getDefaultBatchSize(): number {
    return this.defaultBatchSize;
  }

  private async runBatch<T extends object>(
    entities: T[],
    entityClass: new () => T,
    options: BatchOptions,
    executeFn: (chunk: T[], metadata: EntityMetadata) => Promise<T[]>
  ): Promise<BatchResult<T> | SimpleBatchResult<T>> {
    const startTime = Date.now();
    const metadata = this.getEntityMetadata(entityClass);
    const {
      batchSize = this.defaultBatchSize,
      useTransactions = true,
      continueOnError = false,
      onProgress,
      returnDetailedResults = false
    } = options;

    if (entities.length === 0) return this.emptyResult<T>(returnDetailedResults, startTime);

    const successful: T[] = [];
    const failed: Array<{ entity: T; error: Error }> = [];
    const chunks = this.plan.planChunks(entities, batchSize);
    let processed = 0;

    for (const chunk of chunks) {
      try {
        await this.executor.inTxn(useTransactions, async () => {
          successful.push(...(await executeFn(chunk, metadata)));
        });
        processed += chunk.length;
        onProgress?.(processed, entities.length);
      } catch (error) {
        if (continueOnError) {
          for (const entity of chunk) failed.push({ entity, error: error as Error });
          processed += chunk.length;
          onProgress?.(processed, entities.length);
        } else throw error;
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
      };
    }
    return { entities: successful, failedCount: failed.length, durationMs };
  }

  private getEntityMetadata(entityClass: EntityCtor): EntityMetadata {
    const metadata = MetadataStorage.getEntity(entityClass);
    if (!metadata) throw new Error(`No metadata found for entity ${entityClass.name}`);
    return metadata;
  }

  private emptyResult<T>(
    returnDetailedResults: boolean,
    startTime: number
  ): BatchResult<T> | SimpleBatchResult<T> {
    const durationMs = Date.now() - startTime;
    if (returnDetailedResults) {
      return { successful: [], failed: [], totalProcessed: 0, durationMs, batchCount: 0 };
    }
    return { entities: [], failedCount: 0, durationMs };
  }
}
