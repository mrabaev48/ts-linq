import type { SoftDeleteOptions } from './types';

/**
 * Helper to create soft delete options
 */
export function withSoftDelete(options: Partial<SoftDeleteOptions> = {}): SoftDeleteOptions {
  return {
    enabled: true,
    column: 'isDeleted',
    deletedAtColumn: 'deletedAt',
    type: 'boolean',
    filterDeleted: true,
    ...options
  };
}

/**
 * Mark entity as restored (opposite of soft delete)
 */
export function restore(entity: Record<string, unknown>, options: SoftDeleteOptions = {}): void {
  const flagColumn = options.column || 'isDeleted';
  const timestampColumn = options.deletedAtColumn || 'deletedAt';

  entity[flagColumn] = false;
  entity[timestampColumn] = null;
}

/**
 * Check if entity is soft deleted
 */
export function isSoftDeleted(
  entity: Record<string, unknown>,
  options: SoftDeleteOptions = {}
): boolean {
  const flagColumn = options.column || 'isDeleted';
  const timestampColumn = options.deletedAtColumn || 'deletedAt';
  const type = options.type || 'boolean';

  if (type === 'boolean') {
    return entity[flagColumn] === true;
  } else {
    return entity[timestampColumn] != null;
  }
}

/**
 * Mark entity for hard delete (bypass soft delete)
 */
export function markForHardDelete(entity: Record<string, unknown>): void {
  (entity as any).__hardDelete = true;
}

/**
 * Check if entity is marked for hard delete
 */
export function isMarkedForHardDelete(entity: Record<string, unknown>): boolean {
  return (entity as any).__hardDelete === true;
}
