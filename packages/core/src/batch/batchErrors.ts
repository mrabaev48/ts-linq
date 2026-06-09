import { BatchConfigurationError, MetadataError } from '@ts-linq/types';

// Factories for the typed errors raised by the batch operations. They preserve
// the exact historical messages while attaching a stable `code` (carried by the
// error class) and a safe-to-log `details` payload, and DRY the repeated
// precondition guards across the BatchInsert/Update/Delete/Upsert operations.

/** No entity metadata is registered for the requested entity class. */
export function metadataNotFound(entity: string): MetadataError {
  return new MetadataError(`No metadata found for entity ${entity}`, { details: { entity } });
}

/** The entity metadata declares no primary-key properties. */
export function noPrimaryKeys(entity: string): MetadataError {
  return new MetadataError(`No primary keys defined for entity ${entity}`, { details: { entity } });
}

/** No column matches the declared primary-key property. */
export function noPrimaryKey(entity: string): MetadataError {
  return new MetadataError(`No primary key found for entity ${entity}`, { details: { entity } });
}

/** No insertable (non-generated, present) columns were found for the batch. */
export function noInsertableColumns(): MetadataError {
  return new MetadataError('No insertable columns found');
}

/** The entity metadata has no resolved target constructor. */
export function noTargetEntity(): MetadataError {
  return new MetadataError('No target entity defined in metadata');
}

/** The configured batch size is not a positive integer. */
export function invalidBatchSize(size: number): BatchConfigurationError {
  return new BatchConfigurationError('Batch size must be greater than 0', { details: { size } });
}
