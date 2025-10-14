import 'reflect-metadata';
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
    // Simulate a degradable connection error
    throw new Error('connection timeout');
  }
}

describe('Graceful Degradation Policy', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it('does not fallback for select when policy forbids select', async () => {
    const E = defineEntity();
    const provider = new FailingProvider(':memory:');
    const memory = [
      Object.assign(new E(), { id: 1, name: 'A' }),
      Object.assign(new E(), { id: 2, name: 'B' })
    ];

    const q = new Queryable(E, provider)
      .fallbackTo(new MemoryFallback(() => memory))
      .withFallbackPolicy({ allowOps: ['count'] });

    await expect(q.toArray()).rejects.toThrow(/connection/i);
  });

  it('falls back for count when only count is allowed', async () => {
    const E = defineEntity();
    const provider = new FailingProvider(':memory:');
    const memory = [
      Object.assign(new E(), { id: 1, name: 'A' }),
      Object.assign(new E(), { id: 2, name: 'B' }),
      Object.assign(new E(), { id: 3, name: 'C' })
    ];

    const q = new Queryable(E, provider)
      .fallbackTo(new MemoryFallback(() => memory))
      .withFallbackPolicy({ allowOps: ['count'] });

    const n = await q.count();
    expect(n).toBe(3);
  });

  it('throws when no fallback sources configured', async () => {
    const E = defineEntity();
    const provider = new FailingProvider(':memory:');
    const q = new Queryable(E, provider).withFallbackPolicy({ allowOps: ['select', 'count'] });
    await expect(q.toArray()).rejects.toThrow(/connection/i);
  });
});
