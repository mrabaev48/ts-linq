import { describe, expect, it } from '@jest/globals';

import {
  buildMssqlBatchDelete,
  buildMssqlBatchInsert,
  buildMssqlBatchUpdate,
  MSSQL_PARAM_LIMIT
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

// ── buildMssqlBatchInsert ─────────────────────────────────────────────────────

describe('buildMssqlBatchInsert', () => {
  it('generates multi-row INSERT with OUTPUT INSERTED for generated PK', () => {
    const entities = [
      { name: 'Alice', email: 'a@a.com' },
      { name: 'Bob', email: 'b@b.com' }
    ];
    const { sql, parameters } = buildMssqlBatchInsert(entities, meta());

    expect(sql).toContain('INSERT INTO [users]');
    expect(sql).toContain('OUTPUT INSERTED.[id]');
    expect(sql).toContain('VALUES (@p1,@p2),(@p3,@p4)');
    expect(parameters).toEqual(['Alice', 'a@a.com', 'Bob', 'b@b.com']);
  });

  it('converts ? to @p1..@pN', () => {
    const entities = [{ name: 'X', email: 'x@x.com' }];
    const { sql } = buildMssqlBatchInsert(entities, meta());
    expect(sql).not.toContain('?');
    expect(sql).toContain('@p1');
    expect(sql).toContain('@p2');
  });

  it('omits OUTPUT when PK is not generated', () => {
    const entities = [{ id: 5, name: 'X', email: 'x@x.com' }];
    const metadata = meta({
      columns: [
        { propertyName: 'id', columnName: 'id', isGenerated: false, isComputed: false },
        { propertyName: 'name', columnName: 'name', isGenerated: false, isComputed: false },
        { propertyName: 'email', columnName: 'email', isGenerated: false, isComputed: false }
      ]
    });
    const { sql } = buildMssqlBatchInsert(entities, metadata);
    expect(sql).not.toContain('OUTPUT');
  });

  it('throws for empty entity array', () => {
    expect(() => buildMssqlBatchInsert([], meta())).toThrow(/empty entity list/i);
  });
});

// ── buildMssqlBatchUpdate ─────────────────────────────────────────────────────

describe('buildMssqlBatchUpdate', () => {
  it('generates VALUES JOIN bulk UPDATE', () => {
    const entities = [
      { id: 1, name: 'Alice', email: 'a@a.com' },
      { id: 2, name: 'Bob', email: 'b@b.com' }
    ];
    const { sql, parameters } = buildMssqlBatchUpdate(entities, meta());

    expect(sql).toContain('UPDATE t SET');
    expect(sql).toContain('t.[name]=b.[name]');
    expect(sql).toContain('FROM [users] t');
    expect(sql).toContain('JOIN (VALUES');
    expect(sql).toContain('ON t.[id]=b.[id]');
    expect(parameters).toHaveLength(6);
    // @pN placeholders
    expect(sql).not.toContain('?');
    expect(sql).toContain('@p1');
  });

  it('throws for empty entity array', () => {
    expect(() => buildMssqlBatchUpdate([], meta())).toThrow(/empty entity list/i);
  });

  it('throws when no primary key', () => {
    expect(() => buildMssqlBatchUpdate([{ name: 'X' }], meta({ primaryKeys: [] }))).toThrow(
      /no primary key/i
    );
  });
});

// ── buildMssqlBatchDelete ─────────────────────────────────────────────────────

describe('buildMssqlBatchDelete', () => {
  it('generates DELETE WHERE [pk] IN (@p1,...)', () => {
    const entities = [{ id: 1 }, { id: 2 }];
    const { sql, parameters } = buildMssqlBatchDelete(entities, meta());

    expect(sql).toBe('DELETE FROM [users] WHERE [id] IN (@p1,@p2)');
    expect(parameters).toEqual([1, 2]);
  });

  it('throws for empty entity array', () => {
    expect(() => buildMssqlBatchDelete([], meta())).toThrow(/empty entity list/i);
  });
});

// ── MSSQL_PARAM_LIMIT ─────────────────────────────────────────────────────────

describe('MSSQL_PARAM_LIMIT', () => {
  it('is 2100', () => {
    expect(MSSQL_PARAM_LIMIT).toBe(2100);
  });
});
