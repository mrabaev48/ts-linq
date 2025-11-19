import type { AuditOptions } from './types';

/**
 * Helper to create audit options
 */
export function withAudit(options: Partial<AuditOptions> = {}): AuditOptions {
  return {
    enabled: true,
    createdAtColumn: 'createdAt',
    updatedAtColumn: 'updatedAt',
    createdByColumn: 'createdBy',
    updatedByColumn: 'updatedBy',
    ...options
  };
}

/**
 * Get audit trail information from entity
 */
export function getAuditInfo(
  entity: Record<string, unknown>,
  options: Partial<AuditOptions> = {}
): {
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string | number;
  updatedBy?: string | number;
} {
  const createdAtCol = options.createdAtColumn || 'createdAt';
  const updatedAtCol = options.updatedAtColumn || 'updatedAt';
  const createdByCol = options.createdByColumn || 'createdBy';
  const updatedByCol = options.updatedByColumn || 'updatedBy';

  return {
    createdAt: entity[createdAtCol] as Date | undefined,
    updatedAt: entity[updatedAtCol] as Date | undefined,
    createdBy: entity[createdByCol] as string | number | undefined,
    updatedBy: entity[updatedByCol] as string | number | undefined
  };
}

/**
 * Check if entity has been modified (updatedAt > createdAt)
 */
export function hasBeenModified(
  entity: Record<string, unknown>,
  options: Partial<AuditOptions> = {}
): boolean {
  const auditInfo = getAuditInfo(entity, options);

  if (!auditInfo.createdAt || !auditInfo.updatedAt) {
    return false;
  }

  return auditInfo.updatedAt.getTime() > auditInfo.createdAt.getTime();
}

/**
 * Get time since last update in milliseconds
 */
export function timeSinceUpdate(
  entity: Record<string, unknown>,
  options: Partial<AuditOptions> = {}
): number | null {
  const auditInfo = getAuditInfo(entity, options);

  if (!auditInfo.updatedAt) {
    return null;
  }

  return Date.now() - auditInfo.updatedAt.getTime();
}
