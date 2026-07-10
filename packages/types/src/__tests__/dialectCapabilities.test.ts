/**
 * Unit + type-level coverage for the dialect capability model (`DialectCapabilities`, the
 * segregated `SupportsX` interfaces, and the `require*` assertion functions).
 *
 * Verifies: (1) a dialect with an explicit `capabilities` matrix is checked against that matrix;
 * (2) a dialect without `capabilities` falls back to method-presence sniffing, so existing
 * `SqlDialect` implementers (test doubles, custom dialects) are unaffected; (3) the thrown error is
 * the existing, typed `OrmError` subclass, not a bare `Error`; (4) after a `require*` call, the
 * dialect is statically narrowed so the guarded method is callable without `?.`.
 */

import type {
  BatchInsertResult,
  BatchUpdateResult,
  BulkDeleteContext,
  BulkUpdateContext,
  ColumnMetadata,
  DialectCapabilities,
  EntityMetadata,
  QueryOptions,
  SpCallSyntax,
  SqlDialect,
  SqlQueryResult,
  SqlWithParams,
  SqlWithReturning
} from '..';
import {
  requireBatch,
  requireBulk,
  requireCrud,
  requireStoredProcedures,
  requireTemporal,
  TemporalNotSupportedError,
  UnsupportedOperationError
} from '..';

/** Minimal dialect stub — only `buildSelect`/`quoteIdentifier` are truly required by `SqlDialect`. */
class MinimalDialect implements SqlDialect {
  constructor(public readonly capabilities?: DialectCapabilities) {}

  buildSelect<T>(_entityClass: new () => T, _options: QueryOptions): SqlQueryResult {
    return { query: 'SELECT 1', parameters: [] };
  }

  quoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }
}

/** A dialect that implements every optional method (no `capabilities` declared) — legacy shape. */
class FullMethodDialect extends MinimalDialect {
  buildInsert(_entity: Record<string, unknown>, _metadata: EntityMetadata): SqlWithReturning {
    return { sql: 'INSERT', parameters: [] };
  }
  buildUpdate(
    _entity: Record<string, unknown>,
    _metadata: EntityMetadata,
    _versionCol?: ColumnMetadata,
    _concurrencyTokens?: ColumnMetadata[],
    _originalValues?: Record<string, unknown>
  ): SqlWithParams {
    return { sql: 'UPDATE', parameters: [] };
  }
  buildDelete(_entity: Record<string, unknown>, _metadata: EntityMetadata): SqlWithParams {
    return { sql: 'DELETE', parameters: [] };
  }
  buildBatchInsert(
    _entities: Record<string, unknown>[],
    _metadata: EntityMetadata
  ): BatchInsertResult {
    return { sql: 'INSERT BATCH', parameters: [] };
  }
  buildBatchUpdate(
    _entities: Record<string, unknown>[],
    _metadata: EntityMetadata
  ): BatchUpdateResult {
    return { sql: 'UPDATE BATCH', parameters: [] };
  }
  buildBatchDelete(_entities: Record<string, unknown>[], _metadata: EntityMetadata): SqlWithParams {
    return { sql: 'DELETE BATCH', parameters: [] };
  }
  buildBulkUpdate(_ctx: BulkUpdateContext): SqlWithParams {
    return { sql: 'BULK UPDATE', parameters: [] };
  }
  buildBulkDelete(_ctx: BulkDeleteContext): SqlWithParams {
    return { sql: 'BULK DELETE', parameters: [] };
  }
  getSpCallSyntax(): SpCallSyntax {
    return {
      emitCall: () => ({ sql: 'CALL', parameters: [] }),
      extractRowsAffected: () => 0,
      extractOutputValues: () => ({})
    } as unknown as SpCallSyntax;
  }
}

describe('DialectCapabilities / require*', () => {
  describe('requireCrud', () => {
    it('throws UnsupportedOperationError when capabilities.crud is false', () => {
      const dialect = new MinimalDialect({
        crud: false,
        batch: false,
        bulk: false,
        storedProcedures: false,
        temporal: false
      });
      expect(() => requireCrud(dialect)).toThrow(UnsupportedOperationError);
    });

    it('does not throw when capabilities.crud is true', () => {
      const dialect = new FullMethodDialect({
        crud: true,
        batch: true,
        bulk: true,
        storedProcedures: true,
        temporal: false
      });
      expect(() => requireCrud(dialect)).not.toThrow();
    });

    it('falls back to method-presence sniffing when capabilities is absent (legacy dialect)', () => {
      const withMethods = new FullMethodDialect();
      expect(() => requireCrud(withMethods)).not.toThrow();

      const withoutMethods = new MinimalDialect();
      expect(() => requireCrud(withoutMethods)).toThrow(UnsupportedOperationError);
    });

    it('narrows the type so buildInsert/buildUpdate/buildDelete are callable without `?.`', () => {
      const dialect: SqlDialect = new FullMethodDialect({
        crud: true,
        batch: true,
        bulk: true,
        storedProcedures: true,
        temporal: false
      });
      requireCrud(dialect);
      // No `?.` needed after the assertion — a compile error here would fail `tsc --noEmit`.
      const meta = {} as EntityMetadata;
      expect(dialect.buildInsert({}, meta).sql).toBe('INSERT');
      expect(dialect.buildUpdate({}, meta).sql).toBe('UPDATE');
      expect(dialect.buildDelete({}, meta).sql).toBe('DELETE');
    });
  });

  describe('requireBatch', () => {
    it('throws when capabilities.batch is false', () => {
      const dialect = new MinimalDialect({
        crud: true,
        batch: false,
        bulk: true,
        storedProcedures: true,
        temporal: false
      });
      expect(() => requireBatch(dialect)).toThrow(UnsupportedOperationError);
    });

    it('does not throw and narrows when capabilities.batch is true', () => {
      const dialect: SqlDialect = new FullMethodDialect({
        crud: true,
        batch: true,
        bulk: true,
        storedProcedures: true,
        temporal: false
      });
      requireBatch(dialect);
      const meta = {} as EntityMetadata;
      expect(dialect.buildBatchInsert([], meta).sql).toBe('INSERT BATCH');
    });
  });

  describe('requireBulk', () => {
    it('throws when capabilities.bulk is false', () => {
      const dialect = new MinimalDialect({
        crud: true,
        batch: true,
        bulk: false,
        storedProcedures: true,
        temporal: false
      });
      expect(() => requireBulk(dialect)).toThrow(UnsupportedOperationError);
    });

    it('does not throw and narrows when capabilities.bulk is true', () => {
      const dialect: SqlDialect = new FullMethodDialect({
        crud: true,
        batch: true,
        bulk: true,
        storedProcedures: true,
        temporal: false
      });
      requireBulk(dialect);
      expect(dialect.buildBulkUpdate({ tableName: 't', setters: [], where: [] }).sql).toBe(
        'BULK UPDATE'
      );
    });
  });

  describe('requireStoredProcedures', () => {
    it('throws when capabilities.storedProcedures is false', () => {
      const dialect = new MinimalDialect({
        crud: true,
        batch: true,
        bulk: true,
        storedProcedures: false,
        temporal: false
      });
      expect(() => requireStoredProcedures(dialect)).toThrow(UnsupportedOperationError);
    });

    it('does not throw and narrows when capabilities.storedProcedures is true', () => {
      const dialect: SqlDialect = new FullMethodDialect({
        crud: true,
        batch: true,
        bulk: true,
        storedProcedures: true,
        temporal: false
      });
      requireStoredProcedures(dialect);
      expect(dialect.getSpCallSyntax()).toBeDefined();
    });
  });

  describe('requireTemporal', () => {
    it('throws TemporalNotSupportedError when capabilities.temporal is false', () => {
      const dialect = new MinimalDialect({
        crud: true,
        batch: true,
        bulk: true,
        storedProcedures: true,
        temporal: false
      });
      expect(() => requireTemporal(dialect)).toThrow(TemporalNotSupportedError);
    });

    it('throws TemporalNotSupportedError when capabilities is absent (no method to sniff)', () => {
      const dialect = new MinimalDialect();
      expect(() => requireTemporal(dialect)).toThrow(TemporalNotSupportedError);
    });

    it('does not throw when capabilities.temporal is true', () => {
      const dialect = new MinimalDialect({
        crud: true,
        batch: true,
        bulk: true,
        storedProcedures: true,
        temporal: true
      });
      expect(() => requireTemporal(dialect)).not.toThrow();
    });
  });
});
