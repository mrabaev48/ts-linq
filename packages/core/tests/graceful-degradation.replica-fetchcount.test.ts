import 'reflect-metadata';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { Queryable } from '../src/query/Queryable';
import { ProviderStub } from './_stubs/ProviderStub';
import type { QueryFallback, FallbackRequest } from '../src/types';

@Entity()
class E {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column() name!: string;
}

describe('ReplicaFallback.fetchCount', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it('uses server-side fetchCount when available', async () => {
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

    const q = new Queryable(E, provider).fallbackTo(fb).withFallbackPolicy({ allowOps: ['count'] });
    const n = await q.count();
    expect(n).toBe(42);
  });

  it('falls back to SELECT length when fetchCount not provided', async () => {
    const provider = new (class P extends ProviderStub {
      protected async doExecuteQuery<T>(): Promise<T[]> {
        throw new Error('connection timeout');
      }
    })(':memory:');

    const rows = [Object.assign(new E(), { id: 1, name: 'a' }), Object.assign(new E(), { id: 2, name: 'b' })];
    const fb: QueryFallback<E> = {
      label: 'replica',
      async fetch(_req: FallbackRequest<E>) {
        return rows;
      }
    } as QueryFallback<E>;

    const q = new Queryable(E, provider).fallbackTo(fb).withFallbackPolicy({ allowOps: ['count'] });
    const n = await q.count();
    expect(n).toBe(2);
  });
});


