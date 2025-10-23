import 'reflect-metadata';
import { EntityLoader } from '../../src/loading/EntityLoader';
import { ProviderStub } from '../_stubs/ProviderStub';
import { LoadingStrategy } from '../../src/loading/LoadingStrategy';
import { Entity, Column, PrimaryKey, OneToMany, ManyToOne } from '../../src';
import { MetadataStorage } from '../../src/metadata/MetadataStorage';

function createEntities() {
  @Entity()
  class U {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column() name!: string;
    @Column() bestFriendId?: number;
    @OneToMany(() => P, { foreignKey: 'userId' }) posts!: P[];
    @ManyToOne(() => U, { foreignKey: 'bestFriendId' }) bestFriend!: U;
  }

  @Entity()
  class P {
    @PrimaryKey({ autoIncrement: true }) id!: number;
    @Column() title!: string;
    @Column() userId!: number;
    @ManyToOne(() => U, { foreignKey: 'userId' }) user!: U;
  }

  return { U, P };
}

describe('EntityLoader batched + depth', () => {
  let provider: ProviderStub;
  let loader: EntityLoader;
  let U: ReturnType<typeof createEntities>['U'];
  let P: ReturnType<typeof createEntities>['P'];

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    const entities = createEntities();
    U = entities.U;
    P = entities.P;
    provider = new ProviderStub(':memory:');
    await provider.connect();
    await provider.createTable(MetadataStorage.getEntity(U)!);
    await provider.createTable(MetadataStorage.getEntity(P)!);
    loader = new EntityLoader(provider);

    // seed: 3 users, each 2 posts
    for (let i = 1; i <= 3; i++) {
      const u = new U();
      u.name = `U${i}`;
      if (i > 1) u.bestFriendId = i - 1;
      const ui = await provider.insert(u, U);
      for (let j = 1; j <= 2; j++) {
        const p = new P();
        p.title = `U${i}-P${j}`;
        p.userId = ui.id;
        await provider.insert(p, P);
      }
    }
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  test('batched one-to-many: loadEntities with eager groups posts by user', async () => {
    const users = await loader.loadEntities(U, { strategy: LoadingStrategy.Eager });
    expect(users).toHaveLength(3);
    for (const u of users) {
      expect(u.posts).toBeDefined();
      expect(u.posts).toHaveLength(2);
    }
  });

  test('batched many-to-one: prefetch users for posts in one go', async () => {
    const posts = await loader.loadEntities(P, { strategy: LoadingStrategy.Eager });
    expect(posts).toHaveLength(6);
    for (const p of posts) {
      expect(p.user).toBeDefined();
      expect(p.user.id).toBe(p.userId);
    }
  });

  test('depth=0: no relationships loaded', async () => {
    const users = await loader.loadEntities(U, { strategy: LoadingStrategy.Eager, depth: 0 });
    for (const u of users) {
      expect(u.posts).toBeUndefined();
    }
  });

  test('depth=1: only immediate relationships loaded', async () => {
    const users = await loader.loadEntities(U, { strategy: LoadingStrategy.Eager, depth: 1 });
    for (const u of users) {
      expect(u.posts).toBeDefined();
      expect(u.posts).toHaveLength(2);
      // no deeper traversal to p.user when starting from U with depth=1
      for (const p of u.posts) expect((p as any).user).toBeUndefined();
    }
  });

  test('includes: load only posts for user, skip other props', async () => {
    const users = await loader.loadEntities(U, { includes: ['posts'] });
    for (const u of users) {
      expect(u.posts).toBeDefined();
      expect(u.posts).toHaveLength(2);
      expect((u as any).bestFriend).toBeUndefined();
    }
  });

  test('includes: load only self to-one relation (bestFriend)', async () => {
    const users = await loader.loadEntities(U, { includes: ['bestFriend'] });
    for (const u of users) {
      if (u.bestFriendId) {
        expect(u.bestFriend).toBeDefined();
        expect(u.bestFriend.id).toBe(u.bestFriendId);
      } else {
        expect((u as any).bestFriend).toBeUndefined();
      }
      expect((u as any).posts).toBeUndefined();
    }
  });

  test('invalid include should throw (loadEntities)', async () => {
    await expect(loader.loadEntities(U, { includes: ['nonExisting'] as any })).rejects.toThrow(
      /Invalid include 'nonExisting'/
    );
  });

  test('invalid include should throw (loadEntity)', async () => {
    const one = await provider.findById(1, U);
    expect(one).toBeTruthy();
    await expect(loader.loadEntity(U, 1, { includes: ['nope'] as any })).rejects.toThrow(
      /Invalid include 'nope'/
    );
  });
});
