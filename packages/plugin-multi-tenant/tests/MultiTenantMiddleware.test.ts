import { beforeEach, describe, expect, it } from '@jest/globals';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';

import { MultiTenantMiddleware } from '../src/MultiTenantMiddleware';
import type { TenantContext } from '../src/types';

@Entity({ name: 'orders' })
class Order {
  @PrimaryKey()
  @Column({ name: 'id' })
  id!: number;

  @Column({ name: 'tenantId' })
  tenantId!: number;

  @Column({ name: 'total' })
  total!: number;
}

@Entity({ name: 'invoices' })
class Invoice {
  @PrimaryKey()
  @Column({ name: 'id' })
  id!: number;

  @Column({ name: 'amount' })
  amount!: number;
}

describe('MultiTenantMiddleware', () => {
  let middleware: MultiTenantMiddleware;

  beforeEach(() => {
    middleware = new MultiTenantMiddleware({
      enabled: true,
      tenantIdColumn: 'tenantId',
      isolate: true,
      strictMode: true
    });
  });

  describe('Middleware Lifecycle', () => {
    it('should create middleware with default options', () => {
      const mw = new MultiTenantMiddleware();
      expect(mw).toBeDefined();
    });

    it('should create middleware with custom options', () => {
      const mw = new MultiTenantMiddleware({
        tenantIdColumn: 'orgId',
        strictMode: false
      });
      expect(mw).toBeDefined();
    });

    it('should disable multi-tenant when enabled=false', async () => {
      const mw = new MultiTenantMiddleware({ enabled: false });
      const entity: Partial<Order> = { id: 1, total: 100 };
      const context: TenantContext = {
        entity,
        entityClass: Order,
        operation: 'insert',

        state: 'added'
      };

      await mw.applyTenant(context);

      // tenantId should not be set
      expect(entity.tenantId).toBeUndefined();
    });
  });

  describe('Tenant Management', () => {
    it('should set and get current tenant', async () => {
      middleware.setTenant(123);
      const tenant = await middleware.getTenant();
      expect(tenant).toBe(123);
    });

    it('should clear current tenant', async () => {
      middleware.setTenant(123);
      middleware.clearTenant();
      const tenant = await middleware.getTenant();
      expect(tenant).toBeUndefined();
    });

    it('should support string tenant IDs', async () => {
      middleware.setTenant('tenant-abc');
      const tenant = await middleware.getTenant();
      expect(tenant).toBe('tenant-abc');
    });

    it('should use getCurrentTenant function if available', async () => {
      const mw = new MultiTenantMiddleware({
        getCurrentTenant: () => 456
      });

      const tenant = await mw.getTenant();
      expect(tenant).toBe(456);
    });

    it('should prioritize setTenant over getCurrentTenant', async () => {
      const mw = new MultiTenantMiddleware({
        getCurrentTenant: () => 456
      });

      mw.setTenant(789);
      const tenant = await mw.getTenant();
      expect(tenant).toBe(789);
    });
  });

  describe('Tenant Isolation', () => {
    it('should apply tenant ID on insert', async () => {
      middleware.setTenant(100);
      const entity: Partial<Order> = { id: 1, total: 250 };
      const context: TenantContext = {
        entity,
        entityClass: Order,
        operation: 'insert',

        state: 'added'
      };

      await middleware.applyTenant(context);

      expect(entity.tenantId).toBe(100);
    });

    it('should apply tenant ID on update', async () => {
      middleware.setTenant(200);
      const entity: Partial<Order> = { id: 1, total: 300, tenantId: 100 };
      const context: TenantContext = {
        entity,
        entityClass: Order,
        operation: 'update',

        state: 'modified'
      };

      await middleware.applyTenant(context);

      expect(entity.tenantId).toBe(200);
    });

    it('should use context tenantId if provided', async () => {
      middleware.setTenant(100);
      const entity: Partial<Order> = { id: 1, total: 250 };
      const context: TenantContext = {
        entity,
        entityClass: Order,
        operation: 'insert',

        state: 'added',
        tenantId: 300
      };

      await middleware.applyTenant(context);

      expect(entity.tenantId).toBe(300);
    });

    it('should not apply tenant to entities without tenant column', async () => {
      middleware.setTenant(100);
      const entity: Partial<Invoice> = { id: 1, amount: 500 };
      const context: TenantContext = {
        entity,
        entityClass: Invoice,
        operation: 'insert',

        state: 'added'
      };

      await middleware.applyTenant(context);

      expect((entity as any).tenantId).toBeUndefined();
    });

    it('should throw error in strict mode when no tenant is set', async () => {
      const entity: Partial<Order> = { id: 1, total: 250 };
      const context: TenantContext = {
        entity,
        entityClass: Order,
        operation: 'insert',

        state: 'added'
      };

      await expect(middleware.applyTenant(context)).rejects.toThrow('No tenant context available');
    });

    it('should not throw error in non-strict mode when no tenant is set', async () => {
      const mw = new MultiTenantMiddleware({ strictMode: false });
      const entity: Partial<Order> = { id: 1, total: 250 };
      const context: TenantContext = {
        entity,
        entityClass: Order,
        operation: 'insert',

        state: 'added'
      };

      await expect(mw.applyTenant(context)).resolves.not.toThrow();
    });
  });

  describe('Query Filtering', () => {
    it('should generate filter condition for numeric tenant ID', async () => {
      middleware.setTenant(100);
      const filter = await middleware.getFilterCondition();

      expect(filter).toBe('tenantId = 100');
    });

    it('should generate filter condition for string tenant ID', async () => {
      middleware.setTenant('tenant-abc');
      const filter = await middleware.getFilterCondition();

      expect(filter).toBe("tenantId = 'tenant-abc'");
    });

    it('should return null when isolate is disabled', async () => {
      const mw = new MultiTenantMiddleware({ isolate: false });
      mw.setTenant(100);
      const filter = await mw.getFilterCondition();

      expect(filter).toBeNull();
    });

    it('should throw error in strict mode when no tenant for filtering', async () => {
      await expect(middleware.getFilterCondition()).rejects.toThrow(
        'No tenant context available for query filtering'
      );
    });

    it('should return null in non-strict mode when no tenant', async () => {
      const mw = new MultiTenantMiddleware({ strictMode: false });
      const filter = await mw.getFilterCondition();

      expect(filter).toBeNull();
    });
  });

  describe('Tenant Ownership', () => {
    it('should detect entity belongs to current tenant', async () => {
      middleware.setTenant(100);
      const entity: Partial<Order> = { id: 1, tenantId: 100, total: 250 };

      const belongs = await middleware.belongsToTenant(entity);
      expect(belongs).toBe(true);
    });

    it('should detect entity does not belong to current tenant', async () => {
      middleware.setTenant(100);
      const entity: Partial<Order> = { id: 1, tenantId: 200, total: 250 };

      const belongs = await middleware.belongsToTenant(entity);
      expect(belongs).toBe(false);
    });

    it('should handle string tenant IDs in ownership check', async () => {
      middleware.setTenant('tenant-a');
      const entity: Partial<Order> = { id: 1, tenantId: 'tenant-a' as any, total: 250 };

      const belongs = await middleware.belongsToTenant(entity);
      expect(belongs).toBe(true);
    });

    it('should return false when current tenant is not set', async () => {
      const entity: Partial<Order> = { id: 1, tenantId: 100, total: 250 };

      const belongs = await middleware.belongsToTenant(entity);
      expect(belongs).toBe(false);
    });
  });

  describe('Custom Tenant Column', () => {
    it('should use custom tenant column name', async () => {
      @Entity()
      class CustomEntity {
        @PrimaryKey()
        @Column()
        id!: number;

        @Column({ name: 'organizationId' })
        organizationId!: number;
      }

      const mw = new MultiTenantMiddleware({
        tenantIdColumn: 'organizationId'
      });

      mw.setTenant(500);
      const entity: Partial<CustomEntity> = { id: 1 };
      const context: TenantContext = {
        entity,
        entityClass: CustomEntity,
        operation: 'insert',

        state: 'added'
      };

      await mw.applyTenant(context);

      expect((entity as any).organizationId).toBe(500);
    });
  });

  describe('Async getCurrentTenant', () => {
    it('should support async getCurrentTenant function', async () => {
      const mw = new MultiTenantMiddleware({
        getCurrentTenant: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 999;
        }
      });

      const tenant = await mw.getTenant();
      expect(tenant).toBe(999);
    });

    it('should handle getCurrentTenant errors gracefully', async () => {
      const mw = new MultiTenantMiddleware({
        strictMode: false,
        getCurrentTenant: () => {
          throw new Error('Tenant not available');
        }
      });

      const tenant = await mw.getTenant();
      expect(tenant).toBeUndefined();
    });
  });
});
