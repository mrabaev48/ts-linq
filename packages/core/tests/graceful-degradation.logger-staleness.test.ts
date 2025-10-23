import type { SqlLogger } from '@ts-linq/types';
import { Queryable } from '../src/query/Queryable';
import { ProviderStub } from './_stubs/ProviderStub';
import { Entity, Column, PrimaryKey } from '@ts-linq/core';
import type { QueryFallback, FallbackRequest } from '@ts-linq/types';

@Entity()
class U {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column() name!: string;
}

describe('Graceful Degradation - staleness logging', () => {
  it('logger receives staleness fields on fallback', async () => {
    const events: any[] = [];
    const logger: SqlLogger = {
      fallback: (i) => events.push(i)
    };
    class P extends ProviderStub {
      constructor() {
        super(':memory:', logger);
      }
      protected async doExecuteQuery<T>(): Promise<T[]> {
        throw new Error('connection timeout');
      }
    }
    const provider = new P();
    const fb: QueryFallback<U> = {
      label: 'replica',
      async fetch(_req: FallbackRequest<U>) {
        return [Object.assign(new U(), { id: 1, name: 'x' })];
      }
    };

    const q = new Queryable(U, provider).fallbackTo(fb);
    const rows = await q.toArray();
    expect(rows.length).toBe(1);
    const last = events[events.length - 1];
    expect(last).toBeTruthy();
    expect(last?.attempted).toBe(true);
    expect(last?.succeeded).toBe(true);
    expect(last?.isStale).toBe(true);
    expect(typeof last?.asOf === 'number').toBe(true);
    expect(last?.fallback).toBe('replica');
  });
});
