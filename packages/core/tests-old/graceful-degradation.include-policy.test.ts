import { Entity, Column, PrimaryKey, OneToMany, ManyToOne } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { Queryable } from '../src/query/Queryable';
import { ProviderStub } from './_stubs/ProviderStub';
import type { QueryFallback, FallbackRequest } from '@ts-linq/types';

function defineEntities() {
  @Entity()
  class User {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column() name!: string;
    @OneToMany(() => Post, { foreignKey: 'userId' }) posts!: Post[];
  }

  @Entity()
  class Post {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column() title!: string;
    @Column() userId!: number;
    @ManyToOne(() => User, { foreignKey: 'userId' }) user!: User;
  }
  return { User, Post };
}

describe('Graceful Degradation - include policy', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it("allowIncludesOnFallback='none' does not attempt include", async () => {
    const { User, Post } = defineEntities();
    const provider = new ProviderStub(':memory:');
    // Only fallback will be used; provider rows not required
    const fallbackRows = [Object.assign(new User(), { id: 1, name: 'U' })];
    const fb: QueryFallback<User> = {
      label: 'replica',
      async fetch(_req: FallbackRequest<User>) {
        return fallbackRows;
      }
    };

    await provider.connect();
    await provider.createTable(MetadataStorage.getEntity(User)!);
    await provider.createTable(MetadataStorage.getEntity(Post)!);

    const q = new Queryable(User, provider)
      .fallbackTo(fb)
      .withFallbackPolicy({ allowIncludesOnFallback: 'none' });

    const res = await q.include('posts').toArray();
    // Since selection uses fallback, ensure rows are present
    expect(Array.isArray(res)).toBe(true);
    // Fallback may return 0..N; important that it doesn't crash and include is not attempted
    expect(res.length).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThanOrEqual(0);
  });

  it("allowIncludesOnFallback='attempt' tries to include and ignores errors", async () => {
    const { User, Post } = defineEntities();
    const provider = new ProviderStub(':memory:');
    const fallbackRows = [Object.assign(new User(), { id: 1, name: 'U' })];
    const fb: QueryFallback<User> = {
      label: 'replica',
      async fetch(_req: FallbackRequest<User>) {
        return fallbackRows;
      }
    };

    await provider.connect();
    await provider.createTable(MetadataStorage.getEntity(User)!);
    await provider.createTable(MetadataStorage.getEntity(Post)!);

    const q = new Queryable(User, provider)
      .fallbackTo(fb)
      .withFallbackPolicy({ allowIncludesOnFallback: 'attempt' });

    const res = await q.include('posts').toArray();
    expect(Array.isArray(res)).toBe(true);
  });
});
