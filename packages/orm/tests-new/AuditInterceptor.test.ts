import 'reflect-metadata';
import { describe, it, expect } from '@jest/globals';
import { AuditInterceptor } from '../src/services/AuditInterceptor';

// ── Mock helpers ─────────────────────────────────────────────────────────────

function makeMeta(columns: string[]) {
  return { columns: columns.map((propertyName) => ({ propertyName })) };
}

function makeChange(
  entity: Record<string, unknown>,
  state: 'added' | 'modified' | 'deleted'
) {
  return { entity, entityClass: class Entity {}, state };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuditInterceptor', () => {
  describe('apply() — disabled audit', () => {
    it('does nothing when audit is undefined', () => {
      const interceptor = new AuditInterceptor(undefined, () => makeMeta(['createdAt']));
      const entity: Record<string, unknown> = {};
      interceptor.apply({ entity, entityClass: class {}, state: 'added' });
      expect(entity).toEqual({});
    });

    it('does nothing when audit.enabled is false', () => {
      const interceptor = new AuditInterceptor(
        { enabled: false },
        () => makeMeta(['createdAt'])
      );
      const entity: Record<string, unknown> = {};
      interceptor.apply({ entity, entityClass: class {}, state: 'added' });
      expect(entity).toEqual({});
    });

    it('does nothing when getMeta returns undefined', () => {
      const interceptor = new AuditInterceptor({ enabled: true }, () => undefined);
      const entity: Record<string, unknown> = {};
      interceptor.apply({ entity, entityClass: class {}, state: 'added' });
      expect(entity).toEqual({});
    });
  });

  describe('apply() — insert (state: added)', () => {
    it('sets createdAt and updatedAt on insert', () => {
      const fixedNow = new Date('2024-01-15T10:00:00Z');
      const interceptor = new AuditInterceptor(
        { enabled: true, clock: () => fixedNow },
        () => makeMeta(['createdAt', 'updatedAt'])
      );
      const entity: Record<string, unknown> = {};
      interceptor.apply({ entity, entityClass: class {}, state: 'added' });
      expect(entity['createdAt']).toBe(fixedNow);
      expect(entity['updatedAt']).toBe(fixedNow);
    });

    it('sets createdBy and updatedBy when getCurrentUser returns a value', () => {
      const interceptor = new AuditInterceptor(
        { enabled: true, getCurrentUser: () => 'alice' },
        () => makeMeta(['createdAt', 'updatedAt', 'createdBy', 'updatedBy'])
      );
      const entity: Record<string, unknown> = {};
      interceptor.apply({ entity, entityClass: class {}, state: 'added' });
      expect(entity['createdBy']).toBe('alice');
      expect(entity['updatedBy']).toBe('alice');
    });

    it('does not set createdBy/updatedBy when getCurrentUser is not defined', () => {
      const interceptor = new AuditInterceptor(
        { enabled: true },
        () => makeMeta(['createdAt', 'updatedAt', 'createdBy', 'updatedBy'])
      );
      const entity: Record<string, unknown> = {};
      interceptor.apply({ entity, entityClass: class {}, state: 'added' });
      expect('createdBy' in entity).toBe(false);
      expect('updatedBy' in entity).toBe(false);
    });

    it('only sets columns that exist in entity meta', () => {
      const interceptor = new AuditInterceptor(
        { enabled: true, clock: () => new Date() },
        () => makeMeta(['updatedAt']) // no createdAt column
      );
      const entity: Record<string, unknown> = {};
      interceptor.apply({ entity, entityClass: class {}, state: 'added' });
      expect('createdAt' in entity).toBe(false);
      expect(entity['updatedAt']).toBeInstanceOf(Date);
    });
  });

  describe('apply() — update (state: modified)', () => {
    it('sets only updatedAt on update (not createdAt)', () => {
      const fixedNow = new Date('2024-06-01T12:00:00Z');
      const interceptor = new AuditInterceptor(
        { enabled: true, clock: () => fixedNow },
        () => makeMeta(['createdAt', 'updatedAt'])
      );
      const entity: Record<string, unknown> = { createdAt: new Date('2024-01-01') };
      const originalCreatedAt = entity['createdAt'];
      interceptor.apply({ entity, entityClass: class {}, state: 'modified' });
      expect(entity['createdAt']).toBe(originalCreatedAt); // unchanged
      expect(entity['updatedAt']).toBe(fixedNow);
    });

    it('sets updatedBy on update when getCurrentUser is defined', () => {
      const interceptor = new AuditInterceptor(
        { enabled: true, getCurrentUser: () => 'bob' },
        () => makeMeta(['updatedBy'])
      );
      const entity: Record<string, unknown> = {};
      interceptor.apply({ entity, entityClass: class {}, state: 'modified' });
      expect(entity['updatedBy']).toBe('bob');
    });
  });

  describe('apply() — custom column names', () => {
    it('uses timeColumns when provided', () => {
      const fixedNow = new Date('2024-03-10');
      const interceptor = new AuditInterceptor(
        {
          enabled: true,
          clock: () => fixedNow,
          timeColumns: { createdAt: 'created_at', updatedAt: 'updated_at' }
        },
        () => makeMeta(['created_at', 'updated_at'])
      );
      const entity: Record<string, unknown> = {};
      interceptor.apply({ entity, entityClass: class {}, state: 'added' });
      expect(entity['created_at']).toBe(fixedNow);
      expect(entity['updated_at']).toBe(fixedNow);
    });

    it('uses userColumns when provided', () => {
      const interceptor = new AuditInterceptor(
        {
          enabled: true,
          getCurrentUser: () => 'carol',
          userColumns: { createdBy: 'created_by', updatedBy: 'updated_by' }
        },
        () => makeMeta(['created_by', 'updated_by'])
      );
      const entity: Record<string, unknown> = {};
      interceptor.apply({ entity, entityClass: class {}, state: 'added' });
      expect(entity['created_by']).toBe('carol');
      expect(entity['updated_by']).toBe('carol');
    });
  });

  describe('extractAuditNames()', () => {
    it('returns undefined when audit is undefined', () => {
      const interceptor = new AuditInterceptor(undefined, () => undefined);
      expect(interceptor.extractAuditNames(undefined)).toBeUndefined();
    });

    it('returns default column names when no custom names configured', () => {
      const interceptor = new AuditInterceptor(undefined, () => undefined);
      const names = interceptor.extractAuditNames({ enabled: true });
      expect(names).toEqual({
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
        createdBy: 'createdBy',
        updatedBy: 'updatedBy'
      });
    });
  });
});
