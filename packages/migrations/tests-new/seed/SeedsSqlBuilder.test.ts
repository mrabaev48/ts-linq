import { SeedsSqlBuilder } from '../../src/builders/SeedsSqlBuilder';
import type { SeedRowOp } from '../../src/DiffTypes';

describe('SeedsSqlBuilder', () => {
  describe('postgresql', () => {
    const builder = new SeedsSqlBuilder('postgresql');

    it('generates INSERT and reverse DELETE for insert op', () => {
      const ops: SeedRowOp[] = [
        { kind: 'insert', table: 'roles', pkColumns: ['id'], row: { id: 1, name: 'admin' } }
      ];
      const up: string[] = [];
      const down: string[] = [];
      builder.generate(ops, up, down);

      expect(up[0]).toBe(`INSERT INTO "roles" ("id", "name") VALUES (1, 'admin')`);
      expect(down[0]).toBe(`DELETE FROM "roles" WHERE "id" = 1`);
    });

    it('generates UPDATE and reverse UPDATE for update op', () => {
      const ops: SeedRowOp[] = [
        {
          kind: 'update',
          table: 'roles',
          pkColumns: ['id'],
          row: { id: 1, name: 'superadmin' },
          prev: { id: 1, name: 'admin' }
        }
      ];
      const up: string[] = [];
      const down: string[] = [];
      builder.generate(ops, up, down);

      expect(up[0]).toBe(`UPDATE "roles" SET "name" = 'superadmin' WHERE "id" = 1`);
      expect(down[0]).toBe(`UPDATE "roles" SET "name" = 'admin' WHERE "id" = 1`);
    });

    it('generates DELETE and reverse INSERT for delete op', () => {
      const ops: SeedRowOp[] = [
        { kind: 'delete', table: 'roles', pkColumns: ['id'], row: { id: 1, name: 'admin' } }
      ];
      const up: string[] = [];
      const down: string[] = [];
      builder.generate(ops, up, down);

      expect(up[0]).toBe(`DELETE FROM "roles" WHERE "id" = 1`);
      expect(down[0]).toBe(`INSERT INTO "roles" ("id", "name") VALUES (1, 'admin')`);
    });

    it('handles NULL values', () => {
      const ops: SeedRowOp[] = [
        { kind: 'insert', table: 't', pkColumns: ['id'], row: { id: 1, desc: null } }
      ];
      const up: string[] = [];
      const down: string[] = [];
      builder.generate(ops, up, down);
      expect(up[0]).toContain('NULL');
    });
  });

  describe('mysql', () => {
    const builder = new SeedsSqlBuilder('mysql');

    it('uses backtick quoting', () => {
      const ops: SeedRowOp[] = [
        { kind: 'insert', table: 'roles', pkColumns: ['id'], row: { id: 1, name: 'admin' } }
      ];
      const up: string[] = [];
      const down: string[] = [];
      builder.generate(ops, up, down);
      expect(up[0]).toContain('`roles`');
    });
  });

  describe('mssql', () => {
    const builder = new SeedsSqlBuilder('mssql');

    it('uses bracket quoting', () => {
      const ops: SeedRowOp[] = [
        { kind: 'insert', table: 'roles', pkColumns: ['id'], row: { id: 1, name: 'admin' } }
      ];
      const up: string[] = [];
      const down: string[] = [];
      builder.generate(ops, up, down);
      expect(up[0]).toContain('[roles]');
    });
  });

  describe('injection-safe quoting (task-1)', () => {
    it('escapes a single-quote in a string value (cannot break out)', () => {
      const ops: SeedRowOp[] = [
        { kind: 'insert', table: 'users', pkColumns: ['id'], row: { id: 1, name: "O'Brien" } }
      ];
      const up: string[] = [];
      const down: string[] = [];
      new SeedsSqlBuilder('postgresql').generate(ops, up, down);
      expect(up[0]).toBe(`INSERT INTO "users" ("id", "name") VALUES (1, 'O''Brien')`);
    });

    it('escapes the dialect quote char embedded in a column/table identifier', () => {
      const ops: SeedRowOp[] = [
        { kind: 'insert', table: 'ro"les', pkColumns: ['id'], row: { id: 1, 'na"me': 'admin' } }
      ];
      const up: string[] = [];
      const down: string[] = [];
      new SeedsSqlBuilder('postgresql').generate(ops, up, down);
      expect(up[0]).toBe(`INSERT INTO "ro""les" ("id", "na""me") VALUES (1, 'admin')`);
    });

    it('MySQL doubles a backtick in an identifier', () => {
      const ops: SeedRowOp[] = [
        { kind: 'insert', table: 'ro`les', pkColumns: ['id'], row: { id: 1 } }
      ];
      const up: string[] = [];
      const down: string[] = [];
      new SeedsSqlBuilder('mysql').generate(ops, up, down);
      expect(up[0]).toContain('`ro``les`');
    });
  });
});
