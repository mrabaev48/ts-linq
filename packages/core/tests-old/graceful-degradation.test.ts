import { Queryable } from '../src/query/Queryable';
import { MemoryFallback } from '../src/query/fallbacks/MemoryFallback';
import { MetadataStorage } from '@ts-linq/metadata';
import { Entity, Column, PrimaryKey } from '@ts-linq/core';
import { ProviderStub } from './_stubs/ProviderStub';
import type { QueryFallback } from '@ts-linq/types';
import { QueryContext } from '@ts-linq/query/internal';

function createEntity() {
  @Entity()
  class User {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column() name!: string;
  }
  return User;
}

describe('Graceful Degradation - fallbackTo', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it('uses memory fallback when provider errors with connection issue', async () => {
    const E = createEntity();
    const provider = new (class BrokenProvider extends ProviderStub {
      protected async doExecuteQuery<T>(): Promise<T[]> {
        throw new Error('connection timeout');
      }
    })(':memory:');

    const memory: Array<InstanceType<typeof E>> = [];
    for (let i = 1; i <= 2; i++) {
      const u = new E();
      u.id = i;
      u.name = `U${i}`;
      memory.push(u);
    }

    const q = new Queryable(E, QueryContext.fromProvider(provider)).fallbackTo(
      new MemoryFallback<InstanceType<typeof E>>(() => memory)
    );
    const res = await q.toArray();
    expect(res.map((u) => u.name)).toEqual(['U1', 'U2']);
  });
});
