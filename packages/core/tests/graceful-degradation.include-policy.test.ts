import 'reflect-metadata';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';
import { Queryable } from '../src/query/Queryable';
import { ProviderStub } from './_stubs/ProviderStub';
import type { QueryFallback, FallbackRequest } from '../src/types';

@Entity()
class User {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column() name!: string;
}

@Entity()
class Post {
  @PrimaryKey({ autoIncrement: true }) id!: number;
  @Column() title!: string;
  @Column() userId!: number;
}

describe('Graceful Degradation - include policy', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it("allowIncludesOnFallback='none' does not attempt include", async () => {
    const provider = new ProviderStub(':memory:');
    // Only fallback will be used; provider rows not required
    const fallbackRows = [Object.assign(new User(), { id: 1, name: 'U' })];
    const fb: QueryFallback<User> = {
      label: 'replica',
      async fetch(_req: FallbackRequest<User>) {
        return fallbackRows;
      }
    };

    const q = new Queryable(User, provider)
      .fallbackTo(fb)
      .withFallbackPolicy({ allowIncludesOnFallback: 'none' });

    const res = await q.include((u) => (u as unknown as { posts: Post[] }).posts).toArray();
    expect(res.length).toBe(1);
  });

  it("allowIncludesOnFallback='attempt' tries to include and ignores errors", async () => {
    const provider = new ProviderStub(':memory:');
    const fallbackRows = [Object.assign(new User(), { id: 1, name: 'U' })];
    const fb: QueryFallback<User> = {
      label: 'replica',
      async fetch(_req: FallbackRequest<User>) {
        return fallbackRows;
      }
    };

    const q = new Queryable(User, provider)
      .fallbackTo(fb)
      .withFallbackPolicy({ allowIncludesOnFallback: 'attempt' });

    const res = await q.include((u) => (u as unknown as { posts: Post[] }).posts).toArray();
    expect(res.length).toBe(1);
  });
});


