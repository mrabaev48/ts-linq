import { describe, it, expect, beforeEach } from '@jest/globals';
import { AuditMiddleware } from '../src/AuditMiddleware';
import { Entity, PrimaryKey, Column } from '@ts-linq/metadata';
import type { AuditContext } from '../src/types';

@Entity({ name: 'documents' })
class Document {
  @PrimaryKey()
  @Column({ name: 'id' })
  id!: number;

  @Column({ name: 'title' })
  title!: string;

  @Column({ name: 'createdAt', nullable: true })
  createdAt?: Date;

  @Column({ name: 'updatedAt', nullable: true })
  updatedAt?: Date;

  @Column({ name: 'createdBy', nullable: true })
  createdBy?: string;

  @Column({ name: 'updatedBy', nullable: true })
  updatedBy?: string;
}

@Entity({ name: 'posts' })
class Post {
  @PrimaryKey()
  @Column({ name: 'id' })
  id!: number;

  @Column({ name: 'content' })
  content!: string;
}

describe('AuditMiddleware', () => {
  let middleware: AuditMiddleware;
  let currentUser: string;

  beforeEach(() => {
    currentUser = 'test-user';
    middleware = new AuditMiddleware({
      enabled: true,
      getCurrentUser: () => currentUser
    });
  });

  describe('Middleware Lifecycle', () => {
    it('should create middleware with default options', () => {
      const mw = new AuditMiddleware();
      expect(mw).toBeDefined();
    });

    it('should create middleware with custom options', () => {
      const mw = new AuditMiddleware({
        createdAtColumn: 'created',
        updatedAtColumn: 'modified',
        createdByColumn: 'creator',
        updatedByColumn: 'modifier'
      });
      expect(mw).toBeDefined();
    });

    it('should disable audit when enabled=false', async () => {
      const mw = new AuditMiddleware({ enabled: false });
      const entity: any = { id: 1, title: 'Test' };
      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'added',
        timestamp: new Date()
      };

      await mw.applyAudit(context);

      expect(entity.createdAt).toBeUndefined();
    });
  });

  describe('Created Audit Fields', () => {
    it('should set createdAt on insert', async () => {
      const entity: any = { id: 1, title: 'New Document' };
      const beforeCreate = new Date();
      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'added',
        timestamp: new Date()
      };

      await middleware.applyAudit(context);

      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.createdAt!.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    });

    it('should set createdBy on insert', async () => {
      const entity: any = { id: 1, title: 'New Document' };
      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'added',
        timestamp: new Date(),
        currentUser: 'john-doe'
      };

      await middleware.applyAudit(context);

      expect(entity.createdBy).toBe('john-doe');
    });

    it('should use getCurrentUser function if currentUser not in context', async () => {
      const entity: any = { id: 1, title: 'New Document' };
      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'added',
        timestamp: new Date()
      };

      await middleware.applyAudit(context);

      expect(entity.createdBy).toBe('test-user');
    });

    it('should handle entity without audit columns', async () => {
      const entity: any = { id: 1, content: 'Post content' };
      const context: AuditContext = {
        entity,
        entityClass: Post,
        state: 'added',
        timestamp: new Date()
      };

      await middleware.applyAudit(context);

      // Should not throw, entity just won't have audit fields
      expect(entity).toBeDefined();
    });

    it('should use custom clock function', async () => {
      const customDate = new Date('2024-01-01');
      const mw = new AuditMiddleware({
        clock: () => customDate
      });

      const entity: any = { id: 1, title: 'Test' };
      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'added'
      };

      await mw.applyAudit(context);

      expect(entity.createdAt).toEqual(customDate);
    });
  });

  describe('Updated Audit Fields', () => {
    it('should set updatedAt on insert', async () => {
      const entity: any = { id: 1, title: 'New Document' };
      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'added',
        timestamp: new Date()
      };

      await middleware.applyAudit(context);

      expect(entity.updatedAt).toBeInstanceOf(Date);
    });

    it('should set updatedAt on update', async () => {
      const entity: any = { 
        id: 1, 
        title: 'Updated',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };

      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'modified',
        timestamp: new Date()
      };

      const originalUpdatedAt = entity.updatedAt;
      await new Promise(resolve => setTimeout(resolve, 10));

      await middleware.applyAudit(context);

      expect(entity.updatedAt).toBeInstanceOf(Date);
      expect(entity.updatedAt!.getTime()).toBeGreaterThan(originalUpdatedAt!.getTime());
    });

    it('should set updatedBy on insert', async () => {
      const entity: any = { id: 1, title: 'New Document' };
      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'added',
        timestamp: new Date(),
        currentUser: 'creator'
      };

      await middleware.applyAudit(context);

      expect(entity.updatedBy).toBe('creator');
    });

    it('should update updatedBy on modification', async () => {
      currentUser = 'user1';
      const entity: any = { 
        id: 1, 
        title: 'Document',
        createdBy: 'user1',
        updatedBy: 'user1'
      };

      const context1: AuditContext = {
        entity,
        entityClass: Document,
        state: 'added',
        timestamp: new Date()
      };
      await middleware.applyAudit(context1);

      // Change user and update
      currentUser = 'user2';
      const context2: AuditContext = {
        entity,
        entityClass: Document,
        state: 'modified',
        timestamp: new Date()
      };
      await middleware.applyAudit(context2);

      expect(entity.updatedBy).toBe('user2');
    });

    it('should not modify createdAt/createdBy on update', async () => {
      const originalCreatedAt = new Date('2024-01-01');
      const entity: any = { 
        id: 1, 
        title: 'Document',
        createdAt: originalCreatedAt,
        createdBy: 'original-user'
      };

      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'modified',
        timestamp: new Date(),
        currentUser: 'different-user'
      };

      await middleware.applyAudit(context);

      expect(entity.createdAt).toEqual(originalCreatedAt);
      expect(entity.createdBy).toBe('original-user');
    });
  });

  describe('Custom Column Names', () => {
    it('should support custom column names via options', async () => {
      const mw = new AuditMiddleware({
        createdAtColumn: 'created',
        updatedAtColumn: 'modified',
        createdByColumn: 'creator',
        updatedByColumn: 'modifier',
        getCurrentUser: () => 'custom-user'
      });

      @Entity()
      class CustomEntity {
        @PrimaryKey()
        @Column()
        id!: number;

        @Column({ nullable: true })
        created?: Date;

        @Column({ nullable: true })
        modified?: Date;

        @Column({ nullable: true })
        creator?: string;

        @Column({ nullable: true })
        modifier?: string;
      }

      const entity: any = { id: 1 };
      const context: AuditContext = {
        entity,
        entityClass: CustomEntity,
        state: 'added',
        timestamp: new Date()
      };

      await mw.applyAudit(context);

      expect(entity.created).toBeInstanceOf(Date);
      expect(entity.modified).toBeInstanceOf(Date);
      expect(entity.creator).toBe('custom-user');
      expect(entity.modifier).toBe('custom-user');
    });

    it('should support timeColumns configuration', async () => {
      const mw = new AuditMiddleware({
        timeColumns: {
          createdAt: 'created',
          updatedAt: 'modified'
        },
        getCurrentUser: () => 'user'
      });

      @Entity()
      class TimeEntity {
        @PrimaryKey()
        @Column()
        id!: number;

        @Column({ nullable: true })
        created?: Date;

        @Column({ nullable: true })
        modified?: Date;
      }

      const entity: any = { id: 1 };
      const context: AuditContext = {
        entity,
        entityClass: TimeEntity,
        state: 'added',
        timestamp: new Date()
      };

      await mw.applyAudit(context);

      expect(entity.created).toBeInstanceOf(Date);
      expect(entity.modified).toBeInstanceOf(Date);
    });
  });

  describe('Async getCurrentUser', () => {
    it('should support async getCurrentUser function', async () => {
      const mw = new AuditMiddleware({
        getCurrentUser: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'async-user';
        }
      });

      const entity: any = { id: 1, title: 'Test' };
      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'added',
        timestamp: new Date()
      };

      await mw.applyAudit(context);

      expect(entity.createdBy).toBe('async-user');
    });

    it('should handle getCurrentUser errors gracefully', async () => {
      const mw = new AuditMiddleware({
        getCurrentUser: () => {
          throw new Error('User not available');
        }
      });

      const entity: any = { id: 1, title: 'Test' };
      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'added',
        timestamp: new Date()
      };

      await mw.applyAudit(context);

      // Should not throw, createdBy should be undefined
      expect(entity.createdBy).toBeUndefined();
    });

    it('should support numeric user IDs', async () => {
      const mw = new AuditMiddleware({
        getCurrentUser: () => 12345
      });

      const entity: any = { id: 1, title: 'Test' };
      const context: AuditContext = {
        entity,
        entityClass: Document,
        state: 'added',
        timestamp: new Date()
      };

      await mw.applyAudit(context);

      expect(entity.createdBy).toBe(12345);
    });
  });
});
