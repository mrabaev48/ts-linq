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

class DelayedCountProvider extends ProviderStub {
  private readonly delayMs: number;
  constructor(delayMs: number) {
    super(':memory:');
    this.delayMs = delayMs;
  }
  protected async doExecuteQuery<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    if (/SELECT\s+COUNT\(\*\)\s+AS\s+count/i.test(sql)) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    return await super.doExecuteQuery<T>(sql, params as never);
  }
}

describe('Graceful Degradation - hedged count', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it('fallback server-count wins the race when primary count is slow', async () => {
    const E = defineEntity();
    const provider = new DelayedCountProvider(50);

    // Populate some data so provider has rows
    for (let i = 1; i <= 5; i++) {
      const e = new E();
      e.id = i;
      e.name = `N${i}`;
      await provider.insert(e, E);
    }

    const fastCount = 1234;
    const fakeFallback: QueryFallback<InstanceType<typeof E>> = {
      label: 'replica',
      async fetchCount(_req: FallbackRequest<InstanceType<typeof E>>): Promise<number> {
        return fastCount;
      },
      async fetch(
        _req: FallbackRequest<InstanceType<typeof E>>
      ): Promise<ReadonlyArray<InstanceType<typeof E>>> {
        return [];
      }
    };

    const q = new Queryable(E, provider)
      .fallbackTo(fakeFallback)
      .withFallbackPolicy({ hedged: { enabled: true, delayMs: 1 }, allowOps: ['count'] });

    const n = await q.count();
    expect(n).toBe(fastCount);
  });
});
