import { MetadataStorage } from '@ts-linq/metadata';
import type { OrmMiddleware, EntityChangeContext } from '@ts-linq/types';
import type { MultiTenantOptions, TenantContext } from './types';

/**
 * Middleware that handles multi-tenant operations
 * Implements OrmMiddleware interface for DbContext integration
 */
export class MultiTenantMiddleware implements OrmMiddleware {
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
   * OrmMiddleware lifecycle hook - called before save
   * Automatically applies tenant ID to entities
   */
  async beforeSave(context: EntityChangeContext): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    if (context.state !== 'added' && context.state !== 'modified') {
      return;
    }

    const meta = MetadataStorage.getEntity(context.entityClass);
    if (!meta) {
      return;
    }

    const tenantColumn = this.options.tenantIdColumn!;

    const hasTenantColumn = meta.columns.some(
      (c: any) => c.propertyName === tenantColumn || c.columnName === tenantColumn
    );

    if (!hasTenantColumn) {
      return;
    }

    const tenantId = await this.getTenant();
    const entity = context.entity as Record<string, unknown>;

    if (this.options.strictMode && tenantId === undefined) {
      throw new Error('No tenant context available. Set tenant using setTenant() or getCurrentTenant()');
    }

    entity[tenantColumn] = tenantId as any;
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
   * Apply tenant ID to entity (legacy method for backward compatibility)
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

    const hasTenantColumn = meta.columns.some(
      (c: any) => c.propertyName === tenantColumn || c.columnName === tenantColumn
    );

    if (!hasTenantColumn) {
      return;
    }

    const tenantId = context.tenantId ?? await this.getTenant();

    if (this.options.strictMode && tenantId === undefined) {
      throw new Error('No tenant context available. Set tenant using setTenant() or getCurrentTenant()');
    }

    if (context.operation === 'insert' || context.operation === 'update') {
      context.entity[tenantColumn] = tenantId as any;
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
