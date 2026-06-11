/**
 * Unit tests for Queryable temporal API — P2-36.
 *
 * Coverage:
 * - All five EF Core temporal operators are exposed on Queryable
 * - Each operator returns a new Queryable (immutability)
 * - QueryModel.temporal is set with the correct TemporalClause
 * - clone() preserves temporal clause
 * - QueryModel.clone() includes temporal
 */

import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { QueryContext } from '@ts-linq/query/internal';
import type { SqlDialect, SqlParameter, TemporalClause } from '@ts-linq/types';

import { Queryable } from '../src/Queryable';
import { QueryModel } from '../src/QueryModel';

// ---------------------------------------------------------------------------
// Entity fixture
// ---------------------------------------------------------------------------

class Employee {
  id!: number;
  name!: string;
  department!: string;
}

// ---------------------------------------------------------------------------
// Stub dialect / provider
// ---------------------------------------------------------------------------

class StubDialect implements SqlDialect {
  buildSelect<T>(
    entityClass: new () => T,
    options: unknown
  ): { query: string; parameters: readonly SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass);
    return { query: `SELECT * FROM ${meta?.tableName ?? 'unknown'}`, parameters: [] };
  }
  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }
}

class StubProvider extends DatabaseProvider {
  private readonly _dialect = new StubDialect();

  constructor() {
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
  }

  protected override async doConnect(): Promise<void> {}
  protected override async doDisconnect(): Promise<void> {}
  async createTable(): Promise<void> {}
  getDialect(): SqlDialect {
    return this._dialect;
  }
  async insert<T extends object>(e: T): Promise<T> {
    return e;
  }
  async update<T extends object>(e: T): Promise<T> {
    return e;
  }
  async delete(): Promise<void> {}
  async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  async findAll<T extends object>(): Promise<T[]> {
    return [];
  }
  async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }
  async insertMany<T extends object>(entities: T[]): Promise<T[]> {
    return entities;
  }
  async updateMany<T extends object>(entities: T[]): Promise<T[]> {
    return entities;
  }
  async upsert<T extends object>(e: T): Promise<T> {
    return e;
  }
  async upsertMany<T extends object>(entities: T[]): Promise<T[]> {
    return entities;
  }
  protected override async doExecuteQuery<T>(): Promise<T[]> {
    return [] as T[];
  }
  protected override async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
  protected override async doBeginTransaction(): Promise<void> {}
  protected override async doCommitTransaction(): Promise<void> {}
  protected override async doRollbackTransaction(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryable(): Queryable<Employee> {
  return new Queryable<Employee>(Employee, QueryContext.fromProvider(new StubProvider()));
}

// ---------------------------------------------------------------------------
// QueryModel.temporal clone
// ---------------------------------------------------------------------------

describe('QueryModel.temporal', () => {
  it('temporal is undefined by default', () => {
    const model = new QueryModel();
    expect(model.temporal).toBeUndefined();
  });

  it('clone() copies temporal clause', () => {
    const model = new QueryModel();
    const clause: TemporalClause = { mode: 'AsOf', from: new Date('2023-01-01') };
    model.temporal = clause;
    const cloned = model.clone();
    expect(cloned.temporal).toEqual(clause);
  });

  it('clone() copies All temporal clause', () => {
    const model = new QueryModel();
    const clause: TemporalClause = { mode: 'All' };
    model.temporal = clause;
    const cloned = model.clone();
    expect(cloned.temporal).toEqual({ mode: 'All' });
  });
});

// ---------------------------------------------------------------------------
// Queryable temporal methods — return type and immutability
// ---------------------------------------------------------------------------

describe('Queryable temporal methods — immutability', () => {
  beforeEach(() => {
    MetadataStorage.reset();
    MetadataStorage.addEntity(Employee, 'employees');
  });

  it('temporalAsOf() returns a new Queryable instance', () => {
    const q = makeQueryable();
    const tq = q.temporalAsOf(new Date('2023-01-01'));
    expect(tq).not.toBe(q);
    expect(tq).toBeInstanceOf(Queryable);
  });

  it('temporalAll() returns a new Queryable instance', () => {
    const q = makeQueryable();
    const tq = q.temporalAll();
    expect(tq).not.toBe(q);
    expect(tq).toBeInstanceOf(Queryable);
  });

  it('temporalBetween() returns a new Queryable instance', () => {
    const q = makeQueryable();
    const tq = q.temporalBetween(new Date('2023-01-01'), new Date('2024-01-01'));
    expect(tq).not.toBe(q);
    expect(tq).toBeInstanceOf(Queryable);
  });

  it('temporalFromTo() returns a new Queryable instance', () => {
    const q = makeQueryable();
    const tq = q.temporalFromTo(new Date('2023-01-01'), new Date('2024-01-01'));
    expect(tq).not.toBe(q);
    expect(tq).toBeInstanceOf(Queryable);
  });

  it('temporalContainedIn() returns a new Queryable instance', () => {
    const q = makeQueryable();
    const tq = q.temporalContainedIn(new Date('2023-01-01'), new Date('2024-01-01'));
    expect(tq).not.toBe(q);
    expect(tq).toBeInstanceOf(Queryable);
  });

  it('original Queryable is not mutated by temporalAsOf()', () => {
    const q = makeQueryable();
    q.temporalAsOf(new Date('2023-01-01'));
    expect((q as any)._model.temporal).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Queryable temporal methods — TemporalClause values
// ---------------------------------------------------------------------------

describe('Queryable temporal methods — TemporalClause', () => {
  const pointInTime = new Date('2023-06-15T12:00:00Z');
  const from = new Date('2023-01-01T00:00:00Z');
  const to = new Date('2024-01-01T00:00:00Z');

  beforeEach(() => {
    MetadataStorage.reset();
    MetadataStorage.addEntity(Employee, 'employees');
  });

  it('temporalAsOf() sets mode=AsOf and from', () => {
    const q = makeQueryable().temporalAsOf(pointInTime);
    const clause = (q as any)._model.temporal as TemporalClause;
    expect(clause.mode).toBe('AsOf');
    expect(clause.from).toBe(pointInTime);
    expect(clause.to).toBeUndefined();
  });

  it('temporalAll() sets mode=All with no dates', () => {
    const q = makeQueryable().temporalAll();
    const clause = (q as any)._model.temporal as TemporalClause;
    expect(clause.mode).toBe('All');
    expect(clause.from).toBeUndefined();
    expect(clause.to).toBeUndefined();
  });

  it('temporalBetween() sets mode=Between with from and to', () => {
    const q = makeQueryable().temporalBetween(from, to);
    const clause = (q as any)._model.temporal as TemporalClause;
    expect(clause.mode).toBe('Between');
    expect(clause.from).toBe(from);
    expect(clause.to).toBe(to);
  });

  it('temporalFromTo() sets mode=FromTo with from and to', () => {
    const q = makeQueryable().temporalFromTo(from, to);
    const clause = (q as any)._model.temporal as TemporalClause;
    expect(clause.mode).toBe('FromTo');
    expect(clause.from).toBe(from);
    expect(clause.to).toBe(to);
  });

  it('temporalContainedIn() sets mode=ContainedIn with from and to', () => {
    const q = makeQueryable().temporalContainedIn(from, to);
    const clause = (q as any)._model.temporal as TemporalClause;
    expect(clause.mode).toBe('ContainedIn');
    expect(clause.from).toBe(from);
    expect(clause.to).toBe(to);
  });
});

// ---------------------------------------------------------------------------
// Queryable.clone() preserves temporal
// ---------------------------------------------------------------------------

describe('Queryable.clone() preserves temporal clause', () => {
  beforeEach(() => {
    MetadataStorage.reset();
    MetadataStorage.addEntity(Employee, 'employees');
  });

  it('clone() preserves AsOf temporal clause', () => {
    const pointInTime = new Date('2023-06-01');
    const q = makeQueryable().temporalAsOf(pointInTime);
    const cloned = q.clone();
    const clause = (cloned as any)._model.temporal as TemporalClause;
    expect(clause.mode).toBe('AsOf');
    expect(clause.from).toBe(pointInTime);
  });

  it('clone() preserves All temporal clause', () => {
    const q = makeQueryable().temporalAll();
    const cloned = q.clone();
    const clause = (cloned as any)._model.temporal as TemporalClause;
    expect(clause.mode).toBe('All');
  });

  it('clone() preserves Between temporal clause', () => {
    const from = new Date('2022-01-01');
    const to = new Date('2023-01-01');
    const q = makeQueryable().temporalBetween(from, to);
    const cloned = q.clone();
    const clause = (cloned as any)._model.temporal as TemporalClause;
    expect(clause.mode).toBe('Between');
    expect(clause.from).toBe(from);
    expect(clause.to).toBe(to);
  });
});
