import 'reflect-metadata';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { Queryable } from '../src/query/Queryable';
import { ProviderStub } from './_stubs/ProviderStub';
import type { QueryFallback, FallbackRequest } from '../src/types';

function defineA() {
  @Entity()
  class A {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column() name!: string;
  }
  return A;
}

describe('Hedged sources filtering', () => {
  beforeEach(() => MetadataStorage.getInstance().clear());

  it('uses only sources listed in hedged.sources', async () => {
    class Slow extends ProviderStub {
      protected async doExecuteQuery<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
        await new Promise((r) => setTimeout(r, 25));
        return await super.doExecuteQuery<T>(sql, params as never);
      }
    }
    const A = defineA();
    const provider = new Slow(':memory:');
    const fastReplica: QueryFallback<A> = {
      label: 'replica',
      async fetch(_req: FallbackRequest<A>) {
        return [Object.assign(new A(), { id: 1, name: 'R' })];
      }
    };
    const slowMemory: QueryFallback<A> = {
      label: 'memory',
      async fetch(_req: FallbackRequest<A>) {
        await new Promise((r) => setTimeout(r, 50));
        return [Object.assign(new A(), { id: 2, name: 'M' })];
      }
    };

    // Разрешаем только 'replica' в гонке — должен победить fastReplica
    await provider.connect();
    const meta = MetadataStorage.getEntity(A)!;
    await provider.createTable(meta);
    const q = new Queryable(A, provider)
      .fallbackTo(fastReplica)
      .fallbackTo(slowMemory)
      .withFallbackPolicy({ hedged: { enabled: true, delayMs: 1, sources: ['replica'] } });

    const res = await q.toArray();
    expect(res.map((x) => x.name)).toEqual(['R']);
  });
});


