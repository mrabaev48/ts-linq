import { describe, it, expect } from '@jest/globals';
import { 
  withSoftDelete, 
  restore, 
  isSoftDeleted,
  markForHardDelete,
  isMarkedForHardDelete
} from '../src/utils';

describe('SoftDelete Utils', () => {
  describe('withSoftDelete()', () => {
    it('should create default soft delete options', () => {
      const options = withSoftDelete();

      expect(options.enabled).toBe(true);
      expect(options.column).toBe('isDeleted');
      expect(options.deletedAtColumn).toBe('deletedAt');
      expect(options.type).toBe('boolean');
      expect(options.filterDeleted).toBe(true);
    });

    it('should merge custom options with defaults', () => {
      const options = withSoftDelete({
        column: 'deleted',
        type: 'timestamp'
      });

      expect(options.enabled).toBe(true);
      expect(options.column).toBe('deleted');
      expect(options.deletedAtColumn).toBe('deletedAt');
      expect(options.type).toBe('timestamp');
    });

    it('should allow disabling soft delete', () => {
      const options = withSoftDelete({ enabled: false });
      expect(options.enabled).toBe(false);
    });
  });

  describe('restore()', () => {
    it('should restore entity with default column names', () => {
      const entity = { 
        id: 1, 
        isDeleted: true, 
        deletedAt: new Date() 
      };

      restore(entity);

      expect(entity.isDeleted).toBe(false);
      expect(entity.deletedAt).toBe(null);
    });

    it('should restore entity with custom column names', () => {
      const entity = { 
        id: 1, 
        deleted: true, 
        deleted_at: new Date() 
      };

      restore(entity, {
        column: 'deleted',
        deletedAtColumn: 'deleted_at'
      });

      expect(entity.deleted).toBe(false);
      expect(entity.deleted_at).toBe(null);
    });

    it('should handle entities without timestamp column', () => {
      const entity = { id: 1, isDeleted: true };
      
      restore(entity);
      
      expect(entity.isDeleted).toBe(false);
    });
  });

  describe('isSoftDeleted()', () => {
    it('should detect deleted entity with boolean flag', () => {
      const entity = { id: 1, isDeleted: true };
      expect(isSoftDeleted(entity)).toBe(true);
    });

    it('should detect non-deleted entity with boolean flag', () => {
      const entity = { id: 1, isDeleted: false };
      expect(isSoftDeleted(entity)).toBe(false);
    });

    it('should detect deleted entity with timestamp', () => {
      const entity = { id: 1, deletedAt: new Date() };
      expect(isSoftDeleted(entity, { type: 'timestamp' })).toBe(true);
    });

    it('should detect non-deleted entity with null timestamp', () => {
      const entity = { id: 1, deletedAt: null };
      expect(isSoftDeleted(entity, { type: 'timestamp' })).toBe(false);
    });

    it('should use custom column names', () => {
      const entity = { id: 1, deleted: true };
      expect(isSoftDeleted(entity, { column: 'deleted' })).toBe(true);
    });
  });

  describe('Hard Delete', () => {
    it('should mark entity for hard delete', () => {
      const entity = { id: 1, name: 'Test' };
      
      markForHardDelete(entity);
      
      expect(isMarkedForHardDelete(entity)).toBe(true);
    });

    it('should detect entity not marked for hard delete', () => {
      const entity = { id: 1, name: 'Test' };
      expect(isMarkedForHardDelete(entity)).toBe(false);
    });

    it('should allow marking multiple entities', () => {
      const entity1 = { id: 1, name: 'Test 1' };
      const entity2 = { id: 2, name: 'Test 2' };

      markForHardDelete(entity1);
      markForHardDelete(entity2);

      expect(isMarkedForHardDelete(entity1)).toBe(true);
      expect(isMarkedForHardDelete(entity2)).toBe(true);
    });
  });
});
