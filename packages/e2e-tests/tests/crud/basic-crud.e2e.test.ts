import { setupTestDatabase, teardownTestDatabase, TestHarness } from '../setup';
import { Entity, Column, PrimaryKey, MetadataStorage } from '@ts-linq/metadata';
import { DbContext } from '@ts-linq/orm';
import type { DatabaseProvider } from '@ts-linq/core';

@Entity({ name: 'users' })
class User {
  @PrimaryKey({ autoIncrement: true })
  id!: number;

  @Column()
  name!: string;

  @Column()
  email!: string;

  @Column()
  age!: number;

  @Column()
  isActive!: boolean;
}

class TestDbContext extends DbContext {
  constructor(provider: DatabaseProvider) {
    super({ provider });
  }
}

describe.each(['postgres'] as const)(
  'E2E CRUD Operations - %s',
  (providerName) => {
    let harness: TestHarness;
    let provider: DatabaseProvider;
    let context: TestDbContext;

    beforeEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }
      ({ harness, provider } = await setupTestDatabase(providerName));
      context = new TestDbContext(provider);
      const userMeta = MetadataStorage.getEntity(User);
      if (userMeta) {
        await provider.createTable(userMeta);
      }
    });

    afterEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }
      try {
        await provider.executeQuery('DROP TABLE IF EXISTS users', []);
      } catch { /* ignore */ }
      await teardownTestDatabase(harness);
    });

    it('should create a new user', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);
      const newUser = new User();
      newUser.name = 'Alice';
      newUser.email = 'alice@example.com';
      newUser.age = 30;
      newUser.isActive = true;

      userSet.add(newUser);
      await context.saveChanges();

      const users = await userSet.toArray();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });

    it('should read users from database', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);
      
      const user1 = new User();
      user1.name = 'Bob';
      user1.email = 'bob@example.com';
      user1.age = 25;
      user1.isActive = true;
      userSet.add(user1);

      const user2 = new User();
      user2.name = 'Carol';
      user2.email = 'carol@example.com';
      user2.age = 28;
      user2.isActive = false;
      userSet.add(user2);

      await context.saveChanges();

      const users = await userSet.toArray();
      expect(users.length).toBe(2);
    });

    it('should update a user', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);
      
      const user = new User();
      user.name = 'Original Name';
      user.email = 'original@example.com';
      user.age = 30;
      user.isActive = true;
      userSet.add(user);
      await context.saveChanges();

      user.name = 'Updated Name';
      user.age = 35;
      userSet.update(user);
      await context.saveChanges();

      const updated = await userSet.where((u: User) => u.id === user.id).firstOrDefault();
      expect(updated?.name).toBe('Updated Name');
      expect(Number(updated?.age)).toBe(35);
    });

    it('should delete a user', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);
      
      const user = new User();
      user.name = 'To Delete';
      user.email = 'delete@example.com';
      user.age = 25;
      user.isActive = true;
      userSet.add(user);
      await context.saveChanges();

      const initialCount = await userSet.count();
      
      userSet.remove(user);
      await context.saveChanges();

      const finalCount = await userSet.count();
      expect(Number(finalCount)).toBe(Number(initialCount) - 1);
    });

    it('should filter users with where clause', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);
      
      const activeUser = new User();
      activeUser.name = 'Active';
      activeUser.email = 'active@test.com';
      activeUser.age = 30;
      activeUser.isActive = true;
      userSet.add(activeUser);

      const inactiveUser = new User();
      inactiveUser.name = 'Inactive';
      inactiveUser.email = 'inactive@test.com';
      inactiveUser.age = 25;
      inactiveUser.isActive = false;
      userSet.add(inactiveUser);

      await context.saveChanges();

      const activeUsers = await userSet.where((u: User) => u.isActive === true).toArray();
      
      expect(activeUsers.every((u: User) => u.isActive)).toBe(true);
    });

    it('should sort users', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);
      
      const userA = new User();
      userA.name = 'Zack';
      userA.email = 'zack@test.com';
      userA.age = 30;
      userA.isActive = true;
      userSet.add(userA);

      const userB = new User();
      userB.name = 'Alice';
      userB.email = 'alice@test.com';
      userB.age = 25;
      userB.isActive = true;
      userSet.add(userB);

      await context.saveChanges();

      const sortedUsers = await userSet.orderBy((u: User) => u.name).toArray();
      
      for (let i = 1; i < sortedUsers.length; i++) {
        expect(sortedUsers[i].name >= sortedUsers[i - 1].name).toBe(true);
      }
    });

    it('should paginate users', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);
      
      for (let i = 0; i < 5; i++) {
        const user = new User();
        user.name = `User ${i}`;
        user.email = `user${i}@test.com`;
        user.age = 20 + i;
        user.isActive = true;
        userSet.add(user);
      }
      await context.saveChanges();

      const page1 = await userSet.skip(0).take(2).toArray();
      const page2 = await userSet.skip(2).take(2).toArray();
      
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });
  }
);
