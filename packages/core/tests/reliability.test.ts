import 'reflect-metadata';
import { DatabaseProvider } from '../src/providers/DatabaseProvider';
import type { SqlLogger, SqlParameter } from '../src/types';
import { PredicateParser } from '../src/query/PredicateParser';

describe('Reliability & Errors', () => {
  test('SqlLogger receives start/end with timings and optional error', async () => {
    const events: Array<Record<string, unknown>> = [];
    const logger: SqlLogger = {
      queryStart: (i) => events.push({ t: 'start', ...i }),
      queryEnd: (i) => events.push({ t: 'end', ...i })
    };

    class ProviderStub extends DatabaseProvider {
      public async connect(): Promise<void> {}
      public async disconnect(): Promise<void> {}
      public async createTable(): Promise<void> {}
      public async insert<T>(e: T): Promise<T> {
        return e;
      }
      public async update<T>(e: T): Promise<T> {
        return e;
      }
      public async delete<T>(): Promise<void> {}
      public async findById<T>(): Promise<T | null> {
        return null;
      }
      public async findAll<T>(): Promise<T[]> {
        return [];
      }
      public async findWhere<T>(): Promise<T[]> {
        return [];
      }
      public async findWhereIn<T>(): Promise<T[]> {
        return [];
      }
      protected async doExecuteQuery<T>(
        sql: string,
        params?: readonly SqlParameter[]
      ): Promise<T[]> {
        if (sql.includes('FAIL')) throw new Error('boom');
        return [{ ok: true }] as unknown as T[];
      }
      protected async doExecuteNonQuery(): Promise<number> {
        return 1;
      }
      public async beginTransaction(): Promise<void> {}
      public async commitTransaction(): Promise<void> {}
      public async rollbackTransaction(): Promise<void> {}
      constructor() {
        super('memory', logger);
      }
    }

    const provider = new ProviderStub();
    const rows = await provider.executeQuery('SELECT 1', [1]);
    expect(rows.length).toBe(1);
    expect(events[0].t).toBe('start');
    expect(events[1].t).toBe('end');
    expect(typeof events[1].durationMs).toBe('number');

    events.length = 0;
    await expect(provider.executeQuery('FAIL', [])).rejects.toThrow('boom');
    expect(events[0].t).toBe('start');
    expect(events[1].t).toBe('end');
    expect(events[1].error).toBeInstanceOf(Error);
  });

  test('PredicateParser guard rails produce null for complex predicates', () => {
    const parser = new PredicateParser<{ price: number; stock: number }>();
    const complex = (a: { price: number; stock: number }) => {
      const x = a.price > 10 || a.stock > 0;
      return x;
    };
    const res = parser.parse(complex);
    expect(res).toBeNull();
  });
});
