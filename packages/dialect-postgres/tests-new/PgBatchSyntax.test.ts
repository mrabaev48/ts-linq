import { describe, expect, it } from '@jest/globals';

import {
  buildPgBatchDelete,
  buildPgBatchInsert,
  buildPgBatchUpdate,
  PG_PARAM_LIMIT
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

// ── buildPgBatchInsert ────────────────────────────────────────────────────────

describe('buildPgBatchInsert', () => {
  it('generates multi-row INSERT with RETURNING *', () => {
    const entities = [
      { name: 'Alice', email: 'a@a.com' },
      { name: 'Bob', email: 'b@b.com' }
    ];
    const { sql, parameters } = buildPgBatchInsert(entities, meta());

    expect(sql).toContain('INSERT INTO "users"');
    expect(sql).toContain('"name"');
    expect(sql).toContain('"email"');
    expect(sql).toContain('($1,$2),($3,$4)');
    expect(sql).toContain('RETURNING *');
    expect(parameters).toEqual(['Alice', 'a@a.com', 'Bob', 'b@b.com']);
  });

  it('uses $1..$n positional placeholders', () => {
    const entities = [{ name: 'X', email: 'x@x.com' }];
    const { sql } = buildPgBatchInsert(entities, meta());
    expect(sql).toContain('$1');
    expect(sql).not.toContain('?');
  });

  it('excludes generated PK when not supplied', () => {
    const entities = [{ name: 'X', email: 'x@x.com' }];
    const { sql } = buildPgBatchInsert(entities, meta());
    expect(sql).not.toContain('"id"');
  });

  it('includes explicitly supplied PK', () => {
    const entities = [{ id: 99, name: 'X', email: 'x@x.com' }];
    const { sql } = buildPgBatchInsert(entities, meta());
    expect(sql).toContain('"id"');
  });

  it('throws for empty entity array', () => {
    expect(() => buildPgBatchInsert([], meta())).toThrow(/empty entity list/i);
  });
});

// ── buildPgBatchUpdate ────────────────────────────────────────────────────────

describe('buildPgBatchUpdate', () => {
  it('generates CTE-based bulk UPDATE', () => {
    const entities = [
      { id: 1, name: 'Alice', email: 'a@a.com' },
      { id: 2, name: 'Bob', email: 'b@b.com' }
    ];
    const { sql, parameters } = buildPgBatchUpdate(entities, meta());

    expect(sql).toContain('WITH _batch(');
    expect(sql).toContain('VALUES ($1,$2,$3),($4,$5,$6)');
    expect(sql).toContain('UPDATE "users"');
    // SET and WHERE clauses include ::type casts for PG type resolution in CTEs
    expect(sql).toContain('SET "name"=_batch."name"::');
    expect(sql).toContain('FROM _batch');
    expect(sql).toContain('WHERE "users"."id"=_batch."id"::');
    expect(parameters).toHaveLength(6);
  });

  it('throws when no primary key defined', () => {
    expect(() => buildPgBatchUpdate([{ name: 'X' }], meta({ primaryKeys: [] }))).toThrow(
      /no primary key/i
    );
  });

  it('throws for empty entity array', () => {
    expect(() => buildPgBatchUpdate([], meta())).toThrow(/empty entity list/i);
  });
});

// ── buildPgBatchDelete ────────────────────────────────────────────────────────

describe('buildPgBatchDelete', () => {
  it('generates DELETE WHERE pk IN (...)', () => {
    const entities = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const { sql, parameters } = buildPgBatchDelete(entities, meta());

    expect(sql).toBe('DELETE FROM "users" WHERE "id" IN ($1,$2,$3)');
    expect(parameters).toEqual([1, 2, 3]);
  });

  it('throws for empty entity array', () => {
    expect(() => buildPgBatchDelete([], meta())).toThrow(/empty entity list/i);
  });

  it('throws when no primary key defined', () => {
    expect(() => buildPgBatchDelete([{ id: 1 }], meta({ primaryKeys: [] }))).toThrow(
      /no primary key/i
    );
  });
});

// ── PG_PARAM_LIMIT ────────────────────────────────────────────────────────────

describe('PG_PARAM_LIMIT', () => {
  it('is 65535', () => {
    expect(PG_PARAM_LIMIT).toBe(65535);
  });
});
