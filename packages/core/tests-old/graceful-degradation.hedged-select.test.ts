import 'reflect-metadata';
import { MetadataStorage } from '@ts-linq/metadata';
import { Entity, Column, PrimaryKey } from '@ts-linq/core';
import { Queryable } from '../src/query/Queryable';
import { ProviderStub } from './_stubs/ProviderStub';
import type { QueryFallback, FallbackRequest } from '@ts-linq/types';

function defineEntity() {
  @Entity()
  class Item {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column() name!: string;
  }
  return Item;
}

class DelayedSelectProvider extends ProviderStub {
  private readonly delayMs: number;
  constructor(delayMs: number) {
    super(':memory:');
    this.delayMs = delayMs;
  }
  protected async doExecuteQuery<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    if (/^\s*SELECT\s+\*/i.test(sql)) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    return await super.doExecuteQuery<T>(sql, params as never);
  }
}

describe('Graceful Degradation - hedged select', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it('fallback wins when primary is slow', async () => {
    const E = defineEntity();
    const provider = new DelayedSelectProvider(50);
    // Fill provider with some data (won't be used due to race)
    for (let i = 1; i <= 2; i++) {
      const e = new E();
      e.id = i;
      e.name = `P${i}`;
      await provider.insert(e, E);
    }

    const fallbackRows = [
      Object.assign(new E(), { id: 100, name: 'F1' }),
      Object.assign(new E(), { id: 101, name: 'F2' })
    ];
    const fastFallback: QueryFallback<InstanceType<typeof E>> = {
      label: 'replica',
      async fetch(_req: FallbackRequest<InstanceType<typeof E>>) {
        return fallbackRows;
      }
    };

    const q = new Queryable(E, provider)
      .fallbackTo(fastFallback)
      .withFallbackPolicy({ hedged: { enabled: true, delayMs: 1, sources: ['replica'] } });

    const rows = await q.toArray();
    expect(rows.map((r) => r.name)).toEqual(['F1', 'F2']);
  });

  it('primary wins when primary is fast enough', async () => {
    const E = defineEntity();
    const provider = new DelayedSelectProvider(1);
    // Provider data
    for (let i = 1; i <= 2; i++) {
      const e = new E();
      e.id = i;
      e.name = `P${i}`;
      await provider.insert(e, E);
    }

    const slowFallback: QueryFallback<InstanceType<typeof E>> = {
      label: 'replica',
      async fetch(_req: FallbackRequest<InstanceType<typeof E>>) {
        await new Promise((r) => setTimeout(r, 25));
        return [];
      }
    };

    const q = new Queryable(E, provider)
      .fallbackTo(slowFallback)
      .withFallbackPolicy({ hedged: { enabled: true, delayMs: 10, sources: ['replica'] } });

    const rows = await q.toArray();
    expect(rows.map((r) => r.name)).toEqual(['P1', 'P2']);
  });
});
