import { describe, it, expect, beforeEach } from '@jest/globals';
import { SoftDeleteMiddleware } from '../src/SoftDeleteMiddleware';
import { Entity, PrimaryKey, Column, MetadataStorage } from '@ts-linq/metadata';
import type { SoftDeleteContext } from '../src/types';

@Entity({ name: 'products' })
class Product {
  @PrimaryKey()
  @Column({ name: 'id' })
  id!: number;

  @Column({ name: 'name' })
  name!: string;

  @Column({ name: 'isDeleted', nullable: true })
  isDeleted?: boolean;

  @Column({ name: 'deletedAt', nullable: true })
  deletedAt?: Date;
}

@Entity({ name: 'users' })
class User {
  @PrimaryKey()
  @Column({ name: 'id' })
  id!: number;

  @Column({ name: 'name' })
  name!: string;
}

describe('SoftDeleteMiddleware', () => {
  let middleware: SoftDeleteMiddleware;

  beforeEach(() => {
    middleware = new SoftDeleteMiddleware({
      enabled: true,
      column: 'isDeleted',
      deletedAtColumn: 'deletedAt',
      type: 'boolean'
    });
  });

  describe('Middleware Lifecycle', () => {
    it('should create middleware with default options', () => {
      const mw = new SoftDeleteMiddleware();
      expect(mw).toBeDefined();
    });

    it('should create middleware with custom options', () => {
      const mw = new SoftDeleteMiddleware({
        column: 'deleted',
        deletedAtColumn: 'deleted_at',
        type: 'timestamp'
      });
      expect(mw).toBeDefined();
    });

    it('should disable soft delete when enabled=false', async () => {
      const mw = new SoftDeleteMiddleware({ enabled: false });
      const context: SoftDeleteContext = {
        entity: { id: 1, name: 'Test' },
        entityClass: Product,
        operation: 'delete',

        state: 'deleted',
      };

      const result = await mw.handleSoftDelete(context);
      expect(result).toBe(false);
    });
  });

  describe('Boolean Flag Deletion', () => {
    it('should set isDeleted=true on delete', async () => {
      const entity = { id: 1, name: 'Product 1', isDeleted: false };
      const context: SoftDeleteContext = {
        entity,
        entityClass: Product,
        operation: 'delete',

        state: 'deleted',
      };

      const result = await middleware.handleSoftDelete(context);

      expect(result).toBe(true);
      expect(entity.isDeleted).toBe(true);
    });

    it('should set deletedAt timestamp on delete', async () => {
      const entity = { id: 1, name: 'Product 1', deletedAt: null as any };
      const context: SoftDeleteContext = {
        entity,
        entityClass: Product,
        operation: 'delete',

        state: 'deleted',
      };

      const beforeDelete = new Date();
      const result = await middleware.handleSoftDelete(context);

      expect(result).toBe(true);
      expect(entity.deletedAt).toBeInstanceOf(Date);
      expect(entity.deletedAt!.getTime()).toBeGreaterThanOrEqual(beforeDelete.getTime());
    });

    it('should set both isDeleted and deletedAt when both columns exist', async () => {
      const entity = { id: 1, name: 'Product 1', isDeleted: false, deletedAt: null as any };
      const context: SoftDeleteContext = {
        entity,
        entityClass: Product,
        operation: 'delete',

        state: 'deleted',
      };

      const result = await middleware.handleSoftDelete(context);

      expect(result).toBe(true);
      expect(entity.isDeleted).toBe(true);
      expect(entity.deletedAt).toBeInstanceOf(Date);
    });

    it('should return false for entity without soft-delete columns', async () => {
      const entity = { id: 1, name: 'User 1' };
      const context: SoftDeleteContext = {
        entity,
        entityClass: User,
        operation: 'delete',

        state: 'deleted',
      };

      const result = await middleware.handleSoftDelete(context);
      expect(result).toBe(false);
    });
  });

  describe('Restore Functionality', () => {
    it('should restore deleted entity by setting isDeleted=false', async () => {
      const entity = { id: 1, name: 'Product 1', isDeleted: true };
      const context: SoftDeleteContext = {
        entity,
        entityClass: Product,
        operation: 'restore',

        state: 'modified',
      };

      const result = await middleware.handleSoftDelete(context);

      expect(result).toBe(true);
      expect(entity.isDeleted).toBe(false);
    });

    it('should restore deleted entity by clearing deletedAt', async () => {
      const entity = { id: 1, name: 'Product 1', deletedAt: new Date() };
      const context: SoftDeleteContext = {
        entity,
        entityClass: Product,
        operation: 'restore',

        state: 'modified',
      };

      const result = await middleware.handleSoftDelete(context);

      expect(result).toBe(true);
      expect(entity.deletedAt).toBe(null);
    });

    it('should restore both isDeleted and deletedAt', async () => {
      const entity = { 
        id: 1, 
        name: 'Product 1', 
        isDeleted: true, 
        deletedAt: new Date() 
      };
      const context: SoftDeleteContext = {
        entity,
        entityClass: Product,
        operation: 'restore',

        state: 'modified',
      };

      const result = await middleware.handleSoftDelete(context);

      expect(result).toBe(true);
      expect(entity.isDeleted).toBe(false);
      expect(entity.deletedAt).toBe(null);
    });
  });

  describe('Query Filtering', () => {
    it('should generate filter condition for boolean type', () => {
      const filter = middleware.getFilterCondition();
      expect(filter).toContain('isDeleted');
      expect(filter).toContain('= 0');
      expect(filter).toContain('IS NULL');
    });

    it('should generate filter condition for timestamp type', () => {
      const mw = new SoftDeleteMiddleware({
        type: 'timestamp',
        deletedAtColumn: 'deletedAt'
      });

      const filter = mw.getFilterCondition();
      expect(filter).toContain('deletedAt IS NULL');
    });

    it('should return empty filter when filterDeleted=false', () => {
      const mw = new SoftDeleteMiddleware({
        filterDeleted: false
      });

      const filter = mw.getFilterCondition();
      expect(filter).toBe('');
    });
  });

  describe('Soft Delete Detection', () => {
    it('should detect soft-deleted entity with boolean flag', () => {
      const entity = { id: 1, isDeleted: true };
      const result = middleware.isSoftDeleted(entity);
      expect(result).toBe(true);
    });

    it('should detect non-deleted entity with boolean flag', () => {
      const entity = { id: 1, isDeleted: false };
      const result = middleware.isSoftDeleted(entity);
      expect(result).toBe(false);
    });

    it('should detect soft-deleted entity with timestamp', () => {
      const mw = new SoftDeleteMiddleware({ type: 'timestamp' });
      const entity = { id: 1, deletedAt: new Date() };
      const result = mw.isSoftDeleted(entity);
      expect(result).toBe(true);
    });

    it('should detect non-deleted entity with null timestamp', () => {
      const mw = new SoftDeleteMiddleware({ type: 'timestamp' });
      const entity = { id: 1, deletedAt: null };
      const result = mw.isSoftDeleted(entity);
      expect(result).toBe(false);
    });
  });
});
