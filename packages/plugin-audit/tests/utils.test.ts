import { describe, it, expect } from '@jest/globals';
import { 
  withAudit, 
  getAuditInfo, 
  hasBeenModified,
  timeSinceUpdate
} from '../src/utils';

describe('Audit Utils', () => {
  describe('withAudit()', () => {
    it('should create default audit options', () => {
      const options = withAudit();

      expect(options.enabled).toBe(true);
      expect(options.createdAtColumn).toBe('createdAt');
      expect(options.updatedAtColumn).toBe('updatedAt');
      expect(options.createdByColumn).toBe('createdBy');
      expect(options.updatedByColumn).toBe('updatedBy');
    });

    it('should merge custom options with defaults', () => {
      const options = withAudit({
        createdAtColumn: 'created',
        updatedAtColumn: 'modified'
      });

      expect(options.enabled).toBe(true);
      expect(options.createdAtColumn).toBe('created');
      expect(options.updatedAtColumn).toBe('modified');
      expect(options.createdByColumn).toBe('createdBy');
    });

    it('should allow disabling audit', () => {
      const options = withAudit({ enabled: false });
      expect(options.enabled).toBe(false);
    });

    it('should support custom getCurrentUser function', () => {
      const getCurrentUser = () => 'current-user';
      const options = withAudit({ getCurrentUser });

      expect(options.getCurrentUser).toBe(getCurrentUser);
    });
  });

  describe('getAuditInfo()', () => {
    it('should extract audit info with default column names', () => {
      const entity = {
        id: 1,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        createdBy: 'user1',
        updatedBy: 'user2'
      };

      const info = getAuditInfo(entity);

      expect(info.createdAt).toEqual(new Date('2024-01-01'));
      expect(info.updatedAt).toEqual(new Date('2024-01-02'));
      expect(info.createdBy).toBe('user1');
      expect(info.updatedBy).toBe('user2');
    });

    it('should extract audit info with custom column names', () => {
      const entity = {
        id: 1,
        created: new Date('2024-01-01'),
        modified: new Date('2024-01-02'),
        creator: 'user1',
        modifier: 'user2'
      };

      const info = getAuditInfo(entity, {
        createdAtColumn: 'created',
        updatedAtColumn: 'modified',
        createdByColumn: 'creator',
        updatedByColumn: 'modifier'
      });

      expect(info.createdAt).toEqual(new Date('2024-01-01'));
      expect(info.updatedAt).toEqual(new Date('2024-01-02'));
      expect(info.createdBy).toBe('user1');
      expect(info.updatedBy).toBe('user2');
    });

    it('should handle missing audit fields', () => {
      const entity = { id: 1, name: 'Test' };
      const info = getAuditInfo(entity);

      expect(info.createdAt).toBeUndefined();
      expect(info.updatedAt).toBeUndefined();
      expect(info.createdBy).toBeUndefined();
      expect(info.updatedBy).toBeUndefined();
    });

    it('should handle numeric user IDs', () => {
      const entity = {
        id: 1,
        createdBy: 100,
        updatedBy: 200
      };

      const info = getAuditInfo(entity);

      expect(info.createdBy).toBe(100);
      expect(info.updatedBy).toBe(200);
    });
  });

  describe('hasBeenModified()', () => {
    it('should detect modified entity', () => {
      const entity = {
        id: 1,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02')
      };

      expect(hasBeenModified(entity)).toBe(true);
    });

    it('should detect unmodified entity', () => {
      const date = new Date('2024-01-01');
      const entity = {
        id: 1,
        createdAt: date,
        updatedAt: date
      };

      expect(hasBeenModified(entity)).toBe(false);
    });

    it('should return false when timestamps are missing', () => {
      const entity = { id: 1 };
      expect(hasBeenModified(entity)).toBe(false);
    });

    it('should work with custom column names', () => {
      const entity = {
        id: 1,
        created: new Date('2024-01-01'),
        modified: new Date('2024-01-02')
      };

      expect(hasBeenModified(entity, {
        createdAtColumn: 'created',
        updatedAtColumn: 'modified'
      })).toBe(true);
    });
  });

  describe('timeSinceUpdate()', () => {
    it('should calculate time since last update', () => {
      const oneHourAgo = new Date(Date.now() - 3600000);
      const entity = {
        id: 1,
        updatedAt: oneHourAgo
      };

      const timeSince = timeSinceUpdate(entity);

      expect(timeSince).not.toBeNull();
      expect(timeSince!).toBeGreaterThanOrEqual(3600000 - 100); // Allow small margin
      expect(timeSince!).toBeLessThan(3600000 + 1000);
    });

    it('should return null when updatedAt is missing', () => {
      const entity = { id: 1 };
      expect(timeSinceUpdate(entity)).toBeNull();
    });

    it('should work with custom column names', () => {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const entity = {
        id: 1,
        modified: oneMinuteAgo
      };

      const timeSince = timeSinceUpdate(entity, {
        updatedAtColumn: 'modified'
      });

      expect(timeSince).not.toBeNull();
      expect(timeSince!).toBeGreaterThanOrEqual(60000 - 100);
    });

    it('should handle recently updated entity', () => {
      const justNow = new Date();
      const entity = {
        id: 1,
        updatedAt: justNow
      };

      const timeSince = timeSinceUpdate(entity);

      expect(timeSince).not.toBeNull();
      expect(timeSince!).toBeLessThan(1000); // Less than 1 second
    });
  });
});
