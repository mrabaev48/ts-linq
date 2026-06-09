import type { EntityCtorRef, EntityMetadata, SqlDialect, SqlParameter } from '@ts-linq/types';
import { InvalidIdentifierError } from '@ts-linq/types';

import { DatabaseProvider } from '../src/DatabaseProvider';

/**
 * Minimal dialect whose `quoteIdentifier` mimics PostgreSQL double-quoting so the
 * test can assert that junction identifiers are quoted (not raw-interpolated).
 */
function makeDialect(quote: (id: string) => string): SqlDialect {
  return {
    buildSelect: () => ({ query: '', parameters: [] }) as never,
    quoteIdentifier: quote
  } as unknown as SqlDialect;
}

/**
 * Concrete provider that captures the SQL + params handed to `doExecuteQuery`
 * so the parameterization/quoting of `queryJunction` can be asserted directly,
 * without a real database connection.
 */
class TestProvider extends DatabaseProvider {
  public lastSql?: string;
  public lastParams?: readonly SqlParameter[];

  constructor(private readonly dialect: SqlDialect) {
    super('test://connection');
  }

  public getDialect(): SqlDialect {
    return this.dialect;
  }

  protected async doConnect(): Promise<void> {}
  protected async doDisconnect(): Promise<void> {}
  public async createTable(_metadata: EntityMetadata): Promise<void> {}
  public async insert<T extends object>(entity: T, _entityClass: EntityCtorRef): Promise<T> {
    return entity;
  }
  public async update<T extends object>(entity: T, _entityClass: EntityCtorRef): Promise<T> {
    return entity;
  }
  public async delete<T extends object>(_entity: T, _entityClass: EntityCtorRef): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> {
    return null;
  }
  public async findAll<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhere<T extends object>(): Promise<T[]> {
    return [];
  }
  public async findWhereIn<T extends object>(): Promise<T[]> {
    return [];
  }

  protected async doExecuteQuery<T>(sql: string, params?: readonly SqlParameter[]): Promise<T[]> {
    this.lastSql = sql;
    this.lastParams = params;
    return [] as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> {
    return 0;
  }
  protected async doBeginTransaction(): Promise<void> {}
  protected async doCommitTransaction(): Promise<void> {}
  protected async doRollbackTransaction(): Promise<void> {}
}

describe('DatabaseProvider.queryJunction', () => {
  const pgQuote = (id: string): string => `"${id.replace(/"/g, '""')}"`;

  it('builds a quoted, fully parameterized junction query', async () => {
    const provider = new TestProvider(makeDialect(pgQuote));

    await provider.queryJunction({
      table: 'post_tags',
      selectColumns: ['post_id', 'tag_id'],
      whereColumn: 'post_id',
      whereValues: [1, 2]
    });

    expect(provider.lastSql).toBe(
      'SELECT "post_id", "tag_id" FROM "post_tags" WHERE "post_id" IN (?, ?)'
    );
    expect(provider.lastParams).toEqual([1, 2]);
  });

  it('returns [] without executing when there are no filter values', async () => {
    const provider = new TestProvider(makeDialect(pgQuote));

    const rows = await provider.queryJunction({
      table: 'post_tags',
      selectColumns: ['tag_id'],
      whereColumn: 'post_id',
      whereValues: []
    });

    expect(rows).toEqual([]);
    expect(provider.lastSql).toBeUndefined();
  });

  describe('fails closed on malicious identifiers', () => {
    const malicious: Array<[string, Partial<{ table: string; col: string }>]> = [
      ['table with space', { table: 'post tags' }],
      ['table with quote', { table: 'post"tags' }],
      ['table with semicolon', { table: 'post_tags; DROP TABLE users' }],
      ['column with comment', { col: 'post_id -- ' }],
      ['column with paren', { col: 'post_id) OR 1=1 --' }]
    ];

    it.each(malicious)(
      'rejects %s with a typed error and emits no SQL',
      async (_name, override) => {
        const provider = new TestProvider(makeDialect(pgQuote));

        await expect(
          provider.queryJunction({
            table: override.table ?? 'post_tags',
            selectColumns: [override.col ?? 'tag_id'],
            whereColumn: 'post_id',
            whereValues: [1]
          })
        ).rejects.toBeInstanceOf(InvalidIdentifierError);

        expect(provider.lastSql).toBeUndefined();
      }
    );

    it('preserves the offending identifier in error details and code', async () => {
      const provider = new TestProvider(makeDialect(pgQuote));

      try {
        await provider.queryJunction({
          table: 'post_tags',
          selectColumns: ['tag_id'],
          whereColumn: 'post_id; DROP TABLE users',
          whereValues: [1]
        });
        throw new Error('expected queryJunction to throw');
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidIdentifierError);
        const err = e as InvalidIdentifierError;
        expect(err.code).toBe('INVALID_IDENTIFIER');
        expect(err.details?.identifier).toBe('post_id; DROP TABLE users');
      }
    });
  });
});
