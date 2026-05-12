import { MetadataStorage } from '@ts-linq/metadata';
import type { MultiTenantOptions, TenantContext } from './types';

/**
 * Middleware that handles multi-tenant operations
 */
export class MultiTenantMiddleware {
  private options: MultiTenantOptions;
  private currentTenant?: string | number;

  constructor(options: MultiTenantOptions = {}) {
    this.options = {
      enabled: true,
      tenantIdColumn: 'tenantId',
      isolate: true,
      strictMode: true,
      ...options
    };
  }

  /**
   * Set current tenant ID
   */
  setTenant(tenantId: string | number | undefined): void {
    this.currentTenant = tenantId;
  }

  /**
   * Get current tenant ID
   */
  async getTenant(): Promise<string | number | undefined> {
    if (this.currentTenant !== undefined) {
      return this.currentTenant;
    }

    if (this.options.getCurrentTenant) {
      try {
        return await Promise.resolve(this.options.getCurrentTenant());
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Apply tenant ID to entity
   */
  async applyTenant(context: TenantContext): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const meta = MetadataStorage.getEntity(context.entityClass);
    if (!meta) {
      return;
    }

    const tenantColumn = this.options.tenantIdColumn!;

    // Check if entity has tenant column
    const hasTenantColumn = meta.columns.some(
      (c) => c.propertyName === tenantColumn || c.columnName === tenantColumn
    );

    if (!hasTenantColumn) {
      return;
    }

    const tenantId = context.tenantId ?? await this.getTenant();

    if (this.options.strictMode && tenantId === undefined) {
      throw new Error('No tenant context available. Set tenant using setTenant() or getCurrentTenant()');
    }

    if (context.operation === 'insert' || context.operation === 'update') {
      context.entity[tenantColumn] = tenantId;
    }
  }

  /**
   * Get filter condition for tenant isolation
   */
  async getFilterCondition(): Promise<string | null> {
    if (!this.options.enabled || !this.options.isolate) {
      return null;
    }

    const tenantId = await this.getTenant();

    if (tenantId === undefined) {
      if (this.options.strictMode) {
        throw new Error('No tenant context available for query filtering');
      }
      return null;
    }

    const column = this.options.tenantIdColumn!;
    const value = typeof tenantId === 'string' ? `'${tenantId}'` : tenantId;

    return `${column} = ${value}`;
  }

  /**
   * Check if entity belongs to current tenant
   */
  async belongsToTenant(entity: Record<string, unknown>): Promise<boolean> {
    const tenantColumn = this.options.tenantIdColumn!;
    const entityTenantId = entity[tenantColumn];
    const currentTenantId = await this.getTenant();

    return entityTenantId === currentTenantId;
  }

  /**
   * Clear current tenant
   */
  clearTenant(): void {
    this.currentTenant = undefined;
  }
}
