import { describe, expect, it } from '@jest/globals';

import {
  buildMysqlBatchDelete,
  buildMysqlBatchInsert,
  buildMysqlBatchUpdate,
  MYSQL_PARAM_LIMIT
} from '../src/batch-syntax';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function meta(overrides: Partial<any> = {}): any {
  return {
    tableName: 'users',
    primaryKeys: ['id'],
    columns: [
      { propertyName: 'id', columnName: 'id', isGenerated: true, isComputed: false },
      { propertyName: 'name', columnName: 'name', isGenerated: false, isComputed: false },
      { propertyName: 'email', columnName: 'email', isGenerated: false, isComputed: false }
    ],
    ...overrides
  };
}

// ── buildMysqlBatchInsert ─────────────────────────────────────────────────────

describe('buildMysqlBatchInsert', () => {
  it('generates multi-row INSERT with ? placeholders', () => {
    const entities = [
      { name: 'Alice', email: 'a@a.com' },
      { name: 'Bob', email: 'b@b.com' }
    ];
    const { sql, parameters } = buildMysqlBatchInsert(entities, meta());

    expect(sql).toContain('INSERT INTO `users`');
    expect(sql).toContain('`name`');
    expect(sql).toContain('`email`');
    expect(sql).toContain('(?,?),(?,?)');
    expect(parameters).toEqual(['Alice', 'a@a.com', 'Bob', 'b@b.com']);
  });

  it('uses backtick-quoted identifiers', () => {
    const entities = [{ name: 'X', email: 'x@x.com' }];
    const { sql } = buildMysqlBatchInsert(entities, meta());
    expect(sql).toMatch(/`users`/);
    expect(sql).toMatch(/`name`/);
  });

  it('throws for empty entity array', () => {
    expect(() => buildMysqlBatchInsert([], meta())).toThrow(/empty entity list/i);
  });
});

// ── buildMysqlBatchUpdate ─────────────────────────────────────────────────────

describe('buildMysqlBatchUpdate', () => {
  it('returns multiple per-row UPDATE statements', () => {
    const entities = [
      { id: 1, name: 'Alice', email: 'a@a.com' },
      { id: 2, name: 'Bob', email: 'b@b.com' }
    ];
    const { statements } = buildMysqlBatchUpdate(entities, meta());

    expect(statements).toHaveLength(2);
    expect(statements![0].sql).toContain('UPDATE `users` SET');
    expect(statements![0].sql).toContain('`name`=?');
    expect(statements![0].sql).toContain('WHERE `id`=?');
    expect(statements![0].parameters).toEqual(['Alice', 'a@a.com', 1]);
    expect(statements![1].parameters).toEqual(['Bob', 'b@b.com', 2]);
  });

  it('throws for empty entity array', () => {
    expect(() => buildMysqlBatchUpdate([], meta())).toThrow(/empty entity list/i);
  });

  it('throws when no primary key defined', () => {
    expect(() => buildMysqlBatchUpdate([{ name: 'X' }], meta({ primaryKeys: [] }))).toThrow(
      /no primary key/i
    );
  });
});

// ── buildMysqlBatchDelete ─────────────────────────────────────────────────────

describe('buildMysqlBatchDelete', () => {
  it('generates DELETE WHERE pk IN (?,?,?)', () => {
    const entities = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const { sql, parameters } = buildMysqlBatchDelete(entities, meta());

    expect(sql).toBe('DELETE FROM `users` WHERE `id` IN (?,?,?)');
    expect(parameters).toEqual([1, 2, 3]);
  });

  it('throws for empty entity array', () => {
    expect(() => buildMysqlBatchDelete([], meta())).toThrow(/empty entity list/i);
  });
});

// ── MYSQL_PARAM_LIMIT ─────────────────────────────────────────────────────────

describe('MYSQL_PARAM_LIMIT', () => {
  it('is 65535', () => {
    expect(MYSQL_PARAM_LIMIT).toBe(65535);
  });
});
