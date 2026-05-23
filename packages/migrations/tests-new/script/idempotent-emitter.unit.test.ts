import { describe, expect, it } from '@jest/globals';

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

    it('includes GO batch separator', () => {
      const sql = emitter.emit([singleStep], 'mssql');
      expect(sql).toContain('GO');
    });

    it('includes the UP SQL statement', () => {
      const sql = emitter.emit([singleStep], 'mssql');
      expect(sql).toContain('CREATE TABLE users');
    });
  });

  describe('MySQL guard block', () => {
    it('uses stored procedure pattern', () => {
      const sql = emitter.emit([singleStep], 'mysql');

      expect(sql).toContain('CREATE PROCEDURE');
      expect(sql).toContain('DELIMITER //');
      expect(sql).toContain('CALL ');
      expect(sql).toContain('DROP PROCEDURE IF EXISTS');
    });

    it('includes IF NOT EXISTS check inside procedure', () => {
      const sql = emitter.emit([singleStep], 'mysql');

      expect(sql).toContain('IF NOT EXISTS');
    });

    it('includes the UP SQL statement', () => {
      const sql = emitter.emit([singleStep], 'mysql');
      expect(sql).toContain('CREATE TABLE users');
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
      // No migration blocks
      expect(sql).not.toContain('DO $migration$');
    });
  });

  describe('migration comment', () => {
    it('includes the migration name as a comment', () => {
      const sql = emitter.emit([singleStep], 'postgresql');

      expect(sql).toContain('-- Migration: 20241201000000_CreateUsers');
    });
  });
});
