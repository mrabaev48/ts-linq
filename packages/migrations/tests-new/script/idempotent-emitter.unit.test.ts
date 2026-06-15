import { describe, expect, it } from '@jest/globals';
import { BundleBuildError, OrmErrorCode } from '@ts-linq/types';

import type { Dialect } from '../../src/Dialect';
import type { IdempotentMigrationStep } from '../../src/script/idempotent-emitter';
import { IdempotentEmitter } from '../../src/script/idempotent-emitter';

const singleStep: IdempotentMigrationStep = {
  version: '20241201000000',
  name: 'CreateUsers',
  upSql: ['CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)']
};

describe('IdempotentEmitter', () => {
  const emitter = new IdempotentEmitter();

  describe('header generation', () => {
    it('includes __migrations table creation for PostgreSQL', () => {
      const sql = emitter.emit([], 'postgresql');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS __migrations');
    });

    it('includes __migrations table creation for MSSQL', () => {
      const sql = emitter.emit([], 'mssql');
      expect(sql).toContain('CREATE TABLE __migrations');
    });

    it('includes __migrations table creation for MySQL', () => {
      const sql = emitter.emit([], 'mysql');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS __migrations');
    });
  });

  describe('PostgreSQL guard block', () => {
    it('wraps migration in DO $migration$ block', () => {
      const sql = emitter.emit([singleStep], 'postgresql');

      expect(sql).toContain('DO $migration$');
      expect(sql).toContain('$migration$;');
    });

    it('includes version check', () => {
      const sql = emitter.emit([singleStep], 'postgresql');

      expect(sql).toContain("WHERE version = '20241201000000'");
    });

    it('includes the UP SQL statement', () => {
      const sql = emitter.emit([singleStep], 'postgresql');

      expect(sql).toContain('CREATE TABLE users');
    });

    it('inserts into __migrations inside the guard', () => {
      const sql = emitter.emit([singleStep], 'postgresql');

      expect(sql).toContain('INSERT INTO __migrations');
      expect(sql).toContain("'20241201000000'");
      expect(sql).toContain("'CreateUsers'");
    });
  });

  describe('MSSQL guard block', () => {
    it('uses IF NOT EXISTS / BEGIN...END pattern', () => {
      const sql = emitter.emit([singleStep], 'mssql');

      expect(sql).toContain('IF NOT EXISTS');
      expect(sql).toContain('BEGIN');
      expect(sql).toContain('END');
    });

    it('does NOT include GO batch separator (programmatic-safe)', () => {
      const sql = emitter.emit([singleStep], 'mssql');
      expect(sql).not.toContain('GO');
    });

    it('includes the UP SQL statement', () => {
      const sql = emitter.emit([singleStep], 'mssql');
      expect(sql).toContain('CREATE TABLE users');
    });

    it('inserts into __migrations inside the guard', () => {
      const sql = emitter.emit([singleStep], 'mssql');
      expect(sql).toContain('INSERT INTO __migrations');
      expect(sql).toContain("'20241201000000'");
    });
  });

  describe('MySQL guard block', () => {
    it('uses INSERT IGNORE for idempotent history tracking (no DELIMITER)', () => {
      const sql = emitter.emit([singleStep], 'mysql');

      expect(sql).toContain('INSERT IGNORE INTO __migrations');
      expect(sql).not.toContain('DELIMITER');
    });

    it('does NOT use stored procedures or DELIMITER', () => {
      const sql = emitter.emit([singleStep], 'mysql');

      expect(sql).not.toContain('CREATE PROCEDURE');
      expect(sql).not.toContain('DELIMITER');
      expect(sql).not.toContain('CALL ');
    });

    it('includes the UP SQL statement', () => {
      const sql = emitter.emit([singleStep], 'mysql');
      expect(sql).toContain('CREATE TABLE users');
    });

    it('includes the version in INSERT IGNORE', () => {
      const sql = emitter.emit([singleStep], 'mysql');
      expect(sql).toContain("'20241201000000'");
    });
  });

  describe('emitStatements()', () => {
    it('returns an array of individually-executable statements', () => {
      const stmts = emitter.emitStatements([singleStep], 'postgresql');
      expect(Array.isArray(stmts)).toBe(true);
      expect(stmts.length).toBeGreaterThan(0);
    });

    it('PostgreSQL: returns header + one block per step', () => {
      const stmts = emitter.emitStatements([singleStep], 'postgresql');
      // header + 1 DO block
      expect(stmts).toHaveLength(2);
    });

    it('MSSQL: returns header + one block per step', () => {
      const stmts = emitter.emitStatements([singleStep], 'mssql');
      // header + 1 IF block
      expect(stmts).toHaveLength(2);
    });

    it('MySQL: returns header + DDL + INSERT IGNORE per step', () => {
      const stmts = emitter.emitStatements([singleStep], 'mysql');
      // header + 1 DDL statement + INSERT IGNORE
      expect(stmts).toHaveLength(3);
    });

    it('MySQL with multiple UP SQL statements returns all as separate statements', () => {
      const step: IdempotentMigrationStep = {
        version: '20241201000000',
        name: 'Multi',
        upSql: ['CREATE TABLE a (id INTEGER)', 'CREATE TABLE b (id INTEGER)']
      };
      const stmts = emitter.emitStatements([step], 'mysql');
      // header + ddl1 + ddl2 + INSERT IGNORE
      expect(stmts).toHaveLength(4);
    });

    it('emit() equals emitStatements().join for PostgreSQL', () => {
      const joined = emitter.emitStatements([singleStep], 'postgresql').join('\n\n');
      const emitted = emitter.emit([singleStep], 'postgresql');
      expect(emitted).toBe(joined);
    });
  });

  describe('multiple steps', () => {
    const steps: IdempotentMigrationStep[] = [
      {
        version: '20241201000000',
        name: 'CreateUsers',
        upSql: ['CREATE TABLE users (id INTEGER PRIMARY KEY)']
      },
      {
        version: '20241202000000',
        name: 'CreatePosts',
        upSql: ['CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER)']
      }
    ];

    it('emits blocks for all steps', () => {
      const sql = emitter.emit(steps, 'postgresql');

      expect(sql).toContain("'20241201000000'");
      expect(sql).toContain("'20241202000000'");
    });

    it('preserves migration order', () => {
      const sql = emitter.emit(steps, 'postgresql');
      const idx1 = sql.indexOf('20241201000000');
      const idx2 = sql.indexOf('20241202000000');

      expect(idx1).toBeLessThan(idx2);
    });
  });

  describe('empty steps', () => {
    it('returns only the header for empty steps', () => {
      const sql = emitter.emit([], 'postgresql');

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS __migrations');
      expect(sql).not.toContain('DO $migration$');
    });

    it('emitStatements returns single-element array for empty steps', () => {
      const stmts = emitter.emitStatements([], 'postgresql');
      expect(stmts).toHaveLength(1);
    });
  });

  describe('migration comment', () => {
    it('includes the migration name as a comment', () => {
      const sql = emitter.emit([singleStep], 'postgresql');

      expect(sql).toContain('-- Migration: 20241201000000_CreateUsers');
    });
  });

  describe('fail-fast validation of malformed steps', () => {
    const dialects: Dialect[] = ['postgresql', 'mssql', 'mysql'];

    const malformedSteps: Array<{ label: string; step: IdempotentMigrationStep }> = [
      {
        label: 'name containing a single quote (SQL injection attempt)',
        step: { version: '20241201000000', name: "Bad'Name", upSql: ['SELECT 1'] }
      },
      {
        label: 'name containing a hyphen',
        step: { version: '20241201000000', name: 'a-b', upSql: ['SELECT 1'] }
      },
      {
        label: 'name containing a space',
        step: { version: '20241201000000', name: 'Create Users', upSql: ['SELECT 1'] }
      },
      {
        label: 'version that is not 14 digits',
        step: { version: '123', name: 'CreateUsers', upSql: ['SELECT 1'] }
      },
      {
        label: 'version containing non-digits',
        step: { version: "2024'OR'1", name: 'CreateUsers', upSql: ['SELECT 1'] }
      }
    ];

    for (const dialect of dialects) {
      for (const { label, step } of malformedSteps) {
        it(`rejects ${label} (${dialect}) with a typed BundleBuildError`, () => {
          expect(() => emitter.emit([step], dialect)).toThrow(BundleBuildError);
          try {
            emitter.emitStatements([step], dialect);
            throw new Error('expected emitStatements to throw');
          } catch (e) {
            expect(e).toBeInstanceOf(BundleBuildError);
            expect((e as BundleBuildError).code).toBe(OrmErrorCode.BundleBuild);
            expect((e as BundleBuildError).details).toMatchObject({
              version: step.version,
              name: step.name,
              reason: 'invalid-migration-identifier'
            });
          }
        });
      }
    }

    it('accepts a well-formed step (no throw)', () => {
      expect(() => emitter.emit([singleStep], 'postgresql')).not.toThrow();
    });
  });

  describe('literal escaping of emitted values', () => {
    // A valid name/version is byte-for-byte unchanged through the literal encoder, so the
    // emitted SQL still contains the single-quoted form with no extra escaping.
    it('emits version/name as single-quoted SQL literals for PostgreSQL', () => {
      const sql = emitter.emit([singleStep], 'postgresql');
      expect(sql).toContain("'20241201000000'");
      expect(sql).toContain("'CreateUsers'");
    });

    it('emits version/name as single-quoted SQL literals for MySQL', () => {
      const sql = emitter.emit([singleStep], 'mysql');
      expect(sql).toContain("'20241201000000'");
      expect(sql).toContain("'CreateUsers'");
    });

    it('emits version/name as single-quoted SQL literals for MSSQL', () => {
      const sql = emitter.emit([singleStep], 'mssql');
      expect(sql).toContain("'20241201000000'");
      expect(sql).toContain("'CreateUsers'");
    });
  });
});
