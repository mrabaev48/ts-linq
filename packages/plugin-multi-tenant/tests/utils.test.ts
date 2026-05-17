import { describe, expect, it } from '@jest/globals';

import {
  createTenantScope,
  getTenantId,
  hasTenantColumn,
  setTenantId,
  withTenant
} from '../src/utils';

describe('MultiTenant Utils', () => {
  describe('withTenant()', () => {
    it('should create default multi-tenant options', () => {
      const options = withTenant();

      expect(options.enabled).toBe(true);
      expect(options.tenantIdColumn).toBe('tenantId');
      expect(options.isolate).toBe(true);
      expect(options.strictMode).toBe(true);
    });

    it('should merge custom options with defaults', () => {
      const options = withTenant({
        tenantIdColumn: 'orgId',
        strictMode: false
      });

      expect(options.enabled).toBe(true);
      expect(options.tenantIdColumn).toBe('orgId');
      expect(options.isolate).toBe(true);
      expect(options.strictMode).toBe(false);
    });

    it('should allow disabling multi-tenant', () => {
      const options = withTenant({ enabled: false });
      expect(options.enabled).toBe(false);
    });

    it('should support custom getCurrentTenant function', () => {
      const getCurrentTenant = () => 123;
      const options = withTenant({ getCurrentTenant });

      expect(options.getCurrentTenant).toBe(getCurrentTenant);
    });
  });

  describe('getTenantId()', () => {
    it('should extract tenant ID with default column name', () => {
      const entity = { id: 1, tenantId: 100, name: 'Test' };
      const tenantId = getTenantId(entity);

      expect(tenantId).toBe(100);
    });

    it('should extract tenant ID with custom column name', () => {
      const entity = { id: 1, organizationId: 200, name: 'Test' };
      const tenantId = getTenantId(entity, {
        tenantIdColumn: 'organizationId'
      });

      expect(tenantId).toBe(200);
    });

    it('should handle string tenant IDs', () => {
      const entity = { id: 1, tenantId: 'tenant-abc' };
      const tenantId = getTenantId(entity);

      expect(tenantId).toBe('tenant-abc');
    });

    it('should return undefined for entities without tenant ID', () => {
      const entity = { id: 1, name: 'Test' };
      const tenantId = getTenantId(entity);

      expect(tenantId).toBeUndefined();
    });
  });

  describe('hasTenantColumn()', () => {
    it('should detect entity with tenant column', () => {
      const entity = { id: 1, tenantId: 100 };
      expect(hasTenantColumn(entity)).toBe(true);
    });

    it('should detect entity without tenant column', () => {
      const entity = { id: 1, name: 'Test' };
      expect(hasTenantColumn(entity)).toBe(false);
    });

    it('should work with custom column names', () => {
      const entity = { id: 1, organizationId: 100 };
      expect(
        hasTenantColumn(entity, {
          tenantIdColumn: 'organizationId'
        })
      ).toBe(true);
    });

    it('should handle null tenant ID', () => {
      const entity = { id: 1, tenantId: null };
      expect(hasTenantColumn(entity)).toBe(true);
    });
  });

  describe('setTenantId()', () => {
    it('should set tenant ID with default column name', () => {
      const entity = { id: 1, name: 'Test' };
      setTenantId(entity, 100);

      expect((entity as any).tenantId).toBe(100);
    });

    it('should set tenant ID with custom column name', () => {
      const entity = { id: 1, name: 'Test' };
      setTenantId(entity, 200, {
        tenantIdColumn: 'organizationId'
      });

      expect((entity as any).organizationId).toBe(200);
    });

    it('should set string tenant ID', () => {
      const entity = { id: 1, name: 'Test' };
      setTenantId(entity, 'tenant-xyz');

      expect((entity as any).tenantId).toBe('tenant-xyz');
    });

    it('should overwrite existing tenant ID', () => {
      const entity = { id: 1, tenantId: 100 };
      setTenantId(entity, 200);

      expect(entity.tenantId).toBe(200);
    });
  });

  describe('createTenantScope()', () => {
    it('should create tenant scope wrapper', async () => {
      let capturedValue: string | null = null;

      const scopedFn = createTenantScope('tenant-123', () => {
        capturedValue = 'executed';
        return 'result';
      });

      const result = await scopedFn();

      expect(result).toBe('result');
      expect(capturedValue).toBe('executed');
    });

    it('should handle async functions', async () => {
      const scopedFn = createTenantScope('tenant-abc', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'async-result';
      });

      const result = await scopedFn();
      expect(result).toBe('async-result');
    });

    it('should handle errors in scoped function', async () => {
      const scopedFn = createTenantScope('tenant-123', () => {
        throw new Error('Test error');
      });

      await expect(scopedFn()).rejects.toThrow('Test error');
    });
  });
});
