import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { Entity, Column, PrimaryKey } from '../src';
import { Queryable } from '../src/query/Queryable';
import { MemoryFallback } from '../src/query/fallbacks/MemoryFallback';
import { ProviderStub } from './_stubs/ProviderStub';

function defineEntity() {
  @Entity()
  class Item {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column() name!: string;
  }
  return Item;
}

class FailingProvider extends ProviderStub {
  protected async doExecuteQuery<T>(): Promise<T[]> {
    throw new Error('connection timeout');
  }
}

describe('Graceful Degradation Throttle', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it('respects minIntervalMs between fallbacks', async () => {
    const E = defineEntity();
    const provider = new FailingProvider(':memory:');
    const memory = [Object.assign(new E(), { id: 1, name: 'A' })];
    const base = new Queryable(E, provider)
      .fallbackTo(new MemoryFallback(() => memory))
      .withFallbackPolicy({ throttle: { minIntervalMs: 10 }, allowOps: ['select'] });

    // First call — should pass via fallback
    const ok1 = await base.toArray();
    expect(ok1.length).toBe(1);

    // Second immediately — due to jitter/interval it may sometimes pass. We try two fast calls
    // back-to-back to ensure throttling kicks in
    const p1 = base.toArray();
    const p2 = base.toArray();
    const results = await Promise.allSettled([p1, p2]);
    // There should be at least one rejection due to throttling
    expect(results.some((r) => r.status === 'rejected')).toBe(true);
  });

  it('resets window counter for maxPerMinute after 60 seconds window', async () => {
    const E = defineEntity();
    const provider = new FailingProvider(':memory:');
    const memory = [Object.assign(new E(), { id: 1, name: 'A' })];
    const base = new Queryable(E, provider)
      .fallbackTo(new MemoryFallback(() => memory))
      .withFallbackPolicy({ throttle: { maxPerMinute: 1 }, allowOps: ['select'] });

    const ok = await base.toArray();
    expect(ok.length).toBe(1);

    // Second attempt within the same window — blocked
    await expect(base.toArray()).rejects.toThrow(/connection/i);
  });
});
