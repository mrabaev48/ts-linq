import { MetadataStorage } from '../metadata/MetadataStorage';
/**
 * Enhanced batch operations with optimizations for large datasets.
 * Provides bulk insert/update/delete operations that are much more efficient
 * than iterating through entities one by one.
 */
export class BatchOperations {
    constructor(provider) {
        this.defaultBatchSize = 1000;
        this.provider = provider;
    }
    /**
     * Bulk insert entities using optimized SQL bulk insert statements.
     * Much more efficient than insertMany for large datasets.
     */
    async bulkInsert(entities, entityClass, options = {}) {
        const startTime = Date.now();
        const metadata = this.getEntityMetadata(entityClass);
        const { batchSize = this.defaultBatchSize, useTransactions = true, continueOnError = false, onProgress, returnDetailedResults = false } = options;
        if (entities.length === 0) {
            return this.createEmptyResult(returnDetailedResults, startTime);
        }
        const successful = [];
        const failed = [];
        const chunks = this.chunkArray(entities, batchSize);
        let processed = 0;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                if (useTransactions && !this.provider.inTransactionState) {
                    await this.provider.beginTransaction();
                }
                const insertedChunk = await this.executeBulkInsert(chunk, metadata);
                successful.push(...insertedChunk);
                if (useTransactions && !this.provider.inTransactionState) {
                    await this.provider.commitTransaction();
                }
                processed += chunk.length;
                onProgress?.(processed, entities.length);
            }
            catch (error) {
                if (useTransactions && this.provider.inTransactionState) {
                    await this.provider.rollbackTransaction();
                }
                if (continueOnError) {
                    // Add all entities in this chunk as failed
                    for (const entity of chunk) {
                        failed.push({ entity, error: error });
                    }
                    processed += chunk.length;
                    onProgress?.(processed, entities.length);
                }
                else {
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
            };
        }
        else {
            return {
                entities: successful,
                failedCount: failed.length,
                durationMs
            };
        }
    }
    /**
     * Bulk update entities using optimized batch update strategies.
     */
    async bulkUpdate(entities, entityClass, options = {}) {
        const startTime = Date.now();
        const metadata = this.getEntityMetadata(entityClass);
        const { batchSize = this.defaultBatchSize, useTransactions = true, continueOnError = false, onProgress, returnDetailedResults = false } = options;
        if (entities.length === 0) {
            return this.createEmptyResult(returnDetailedResults, startTime);
        }
        const successful = [];
        const failed = [];
        const chunks = this.chunkArray(entities, batchSize);
        let processed = 0;
        for (const chunk of chunks) {
            try {
                if (useTransactions && !this.provider.inTransactionState) {
                    await this.provider.beginTransaction();
                }
                const updatedChunk = await this.executeBulkUpdate(chunk, metadata);
                successful.push(...updatedChunk);
                if (useTransactions && !this.provider.inTransactionState) {
                    await this.provider.commitTransaction();
                }
                processed += chunk.length;
                onProgress?.(processed, entities.length);
            }
            catch (error) {
                if (useTransactions && this.provider.inTransactionState) {
                    await this.provider.rollbackTransaction();
                }
                if (continueOnError) {
                    for (const entity of chunk) {
                        failed.push({ entity, error: error });
                    }
                    processed += chunk.length;
                    onProgress?.(processed, entities.length);
                }
                else {
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
            };
        }
        else {
            return {
                entities: successful,
                failedCount: failed.length,
                durationMs
            };
        }
    }
    /**
     * Bulk delete entities using optimized bulk delete operations.
     */
    async bulkDelete(entities, entityClass, options = {}) {
        const startTime = Date.now();
        const metadata = this.getEntityMetadata(entityClass);
        const { batchSize = this.defaultBatchSize, useTransactions = true, continueOnError = false, onProgress } = options;
        if (entities.length === 0) {
            return { deletedCount: 0, failedCount: 0, durationMs: 0 };
        }
        let deletedCount = 0;
        let failedCount = 0;
        const chunks = this.chunkArray(entities, batchSize);
        let processed = 0;
        for (const chunk of chunks) {
            try {
                if (useTransactions && !this.provider.inTransactionState) {
                    await this.provider.beginTransaction();
                }
                const deleted = await this.executeBulkDelete(chunk, metadata);
                deletedCount += deleted;
                if (useTransactions && !this.provider.inTransactionState) {
                    await this.provider.commitTransaction();
                }
                processed += chunk.length;
                onProgress?.(processed, entities.length);
            }
            catch (error) {
                if (useTransactions && this.provider.inTransactionState) {
                    await this.provider.rollbackTransaction();
                }
                if (continueOnError) {
                    failedCount += chunk.length;
                    processed += chunk.length;
                    onProgress?.(processed, entities.length);
                }
                else {
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
    async bulkUpsert(entities, entityClass, options = {}) {
        const startTime = Date.now();
        const metadata = this.getEntityMetadata(entityClass);
        const { batchSize = this.defaultBatchSize, useTransactions = true, continueOnError = false, onProgress, returnDetailedResults = false } = options;
        if (entities.length === 0) {
            return this.createEmptyResult(returnDetailedResults, startTime);
        }
        const successful = [];
        const failed = [];
        const chunks = this.chunkArray(entities, batchSize);
        let processed = 0;
        for (const chunk of chunks) {
            try {
                if (useTransactions && !this.provider.inTransactionState) {
                    await this.provider.beginTransaction();
                }
                const upsertedChunk = await this.executeBulkUpsert(chunk, metadata);
                successful.push(...upsertedChunk);
                if (useTransactions && !this.provider.inTransactionState) {
                    await this.provider.commitTransaction();
                }
                processed += chunk.length;
                onProgress?.(processed, entities.length);
            }
            catch (error) {
                if (useTransactions && this.provider.inTransactionState) {
                    await this.provider.rollbackTransaction();
                }
                if (continueOnError) {
                    for (const entity of chunk) {
                        failed.push({ entity, error: error });
                    }
                    processed += chunk.length;
                    onProgress?.(processed, entities.length);
                }
                else {
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
            };
        }
        else {
            return {
                entities: successful,
                failedCount: failed.length,
                durationMs
            };
        }
    }
    /**
     * Execute optimized bulk insert using VALUES clause or provider-specific bulk insert.
     */
    async executeBulkInsert(entities, metadata) {
        const dialect = this.provider.getDialect();
        // Try to use provider-specific bulk insert if available
        if (this.provider.insertMany && entities.length > 1) {
            // Use database-specific bulk operations if supported
            return await this.provider.insertMany(entities, metadata.target);
        }
        // Build bulk INSERT with VALUES clause
        const columns = metadata.columns.filter((col) => !col.isGenerated &&
            entities.some((entity) => entity[col.propertyName] !== undefined));
        if (columns.length === 0) {
            throw new Error('No insertable columns found');
        }
        const columnNames = columns.map((col) => col.columnName || col.propertyName);
        const placeholders = [];
        const allParams = [];
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            const entityPlaceholders = [];
            for (const column of columns) {
                const value = entity[column.propertyName];
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
    async executeBulkUpdate(entities, metadata) {
        // Try provider-specific bulk update
        if (this.provider.updateMany && entities.length > 1) {
            return await this.provider.updateMany(entities, metadata.target);
        }
        // Build batch update statements
        const primaryKeyColumn = metadata.columns.find((col) => metadata.primaryKeys.includes(col.propertyName));
        if (!primaryKeyColumn) {
            throw new Error(`No primary key found for entity ${metadata.target.name}`);
        }
        const updateColumns = metadata.columns.filter((col) => !metadata.primaryKeys.includes(col.propertyName) && !col.isGenerated);
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
    async executeBulkDelete(entities, metadata) {
        const primaryKeyColumn = metadata.columns.find((col) => metadata.primaryKeys.includes(col.propertyName));
        if (!primaryKeyColumn) {
            throw new Error(`No primary key found for entity ${metadata.target.name}`);
        }
        const primaryKeyValues = entities
            .map((entity) => entity[primaryKeyColumn.propertyName])
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
    async executeBulkUpsert(entities, metadata) {
        // Use provider's upsertMany if available
        if (this.provider.upsertMany && entities.length > 1) {
            return await this.provider.upsertMany(entities, metadata.target);
        }
        // Fallback to individual upserts
        const results = [];
        for (const entity of entities) {
            const result = await this.provider.upsert(entity, metadata.target);
            results.push(result);
        }
        return results;
    }
    /**
     * Split array into chunks of specified size for batch processing.
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    /**
     * Get entity metadata with validation.
     */
    getEntityMetadata(entityClass) {
        const metadata = MetadataStorage.getEntity(entityClass);
        if (!metadata) {
            throw new Error(`No metadata found for entity ${entityClass.name}`);
        }
        return metadata;
    }
    /**
     * Create empty result based on return type.
     */
    createEmptyResult(returnDetailedResults, startTime) {
        const durationMs = Date.now() - startTime;
        if (returnDetailedResults) {
            return {
                successful: [],
                failed: [],
                totalProcessed: 0,
                durationMs,
                batchCount: 0
            };
        }
        else {
            return {
                entities: [],
                failedCount: 0,
                durationMs
            };
        }
    }
    /**
     * Set default batch size for operations.
     */
    setDefaultBatchSize(size) {
        if (size <= 0) {
            throw new Error('Batch size must be greater than 0');
        }
        this.defaultBatchSize = size;
    }
    /**
     * Get current default batch size.
     */
    getDefaultBatchSize() {
        return this.defaultBatchSize;
    }
}
//# sourceMappingURL=BatchOperations.js.map