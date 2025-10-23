import 'reflect-metadata';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { Queryable } from '../src/query/Queryable';
import { ProviderStub } from './_stubs/ProviderStub';
import type { QueryFallback, FallbackRequest } from '../src/types';

function defineE() {
  @Entity()
  class E {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column() name!: string;
  }
  return E;
}

describe('ReplicaFallback.fetchCount', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it('uses server-side fetchCount when available', async () => {
    const E = defineE();
    const provider = new (class P extends ProviderStub {
      protected async doExecuteQuery<T>(): Promise<T[]> {
        throw new Error('connection timeout');
      }
    })(':memory:');

    const fb: QueryFallback<E> = {
      label: 'replica',
      async fetchCount(_req: FallbackRequest<E>) {
        return 42;
      },
      async fetch(_req: FallbackRequest<E>) {
        return [];
      }
    };

    // Ensure metadata is registered for E
    await provider.connect();
    // ProviderStub.createTable expects EntityMetadata; fetch it from the storage
    const meta = MetadataStorage.getEntity(E)!;
    await provider.createTable(meta);

    const q = new Queryable(E, provider).fallbackTo(fb).withFallbackPolicy({ allowOps: ['count'] });
    const n = await q.count();
    expect(n).toBe(42);
  });

  it('falls back to SELECT length when fetchCount not provided', async () => {
    const E = defineE();
    const provider = new (class P extends ProviderStub {
      protected async doExecuteQuery<T>(): Promise<T[]> {
        throw new Error('connection timeout');
      }
    })(':memory:');

    const rows = [
      Object.assign(new E(), { id: 1, name: 'a' }),
      Object.assign(new E(), { id: 2, name: 'b' })
    ];
    const fb: QueryFallback<E> = {
      label: 'replica',
      async fetch(_req: FallbackRequest<E>) {
        return rows;
      }
    } as QueryFallback<E>;

    await provider.connect();
    const meta2 = MetadataStorage.getEntity(E)!;
    await provider.createTable(meta2);

    const q = new Queryable(E, provider).fallbackTo(fb).withFallbackPolicy({ allowOps: ['count'] });
    const n = await q.count();
    expect(n).toBe(2);
  });
});
