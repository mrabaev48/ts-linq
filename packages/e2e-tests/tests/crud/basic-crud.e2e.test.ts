import { Column, Entity, PrimaryKey } from '@ts-linq/core';
import { DbContext } from '@ts-linq/orm';
import { sampleUsers } from '@ts-linq/testkits';

import { setupTestDatabase, teardownTestDatabase } from '../../src/setup';

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

class TestDbContext extends DbContext {}

const run = process.env.SKIP_DB_TESTS !== '1';
(run
  ? describe.each(['postgresql', 'mysql', 'mssql'])
  : describe.skip.each(['postgresql', 'mysql', 'mssql']))(
  'E2E CRUD Operations - %s',
  (providerName) => {
    let harness: any;
    let provider: any;
    let context: TestDbContext;

    beforeEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }
      ({ harness, provider } = await setupTestDatabase(providerName as any));
      context = new TestDbContext({ provider });
      await context.ensureCreated();
    });

    afterEach(async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }
      await (context as any)?.dropDatabase?.();
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

      const users = await userSet.query().toArray();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Alice');
    });

    it('should read users from database', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);

      // Insert test data (isolated for this test)
      for (const userData of sampleUsers) {
        const user = Object.assign(new User(), userData);
        userSet.add(user);
      }
      await context.saveChanges();

      const users = await userSet.query().toArray();
      expect(users.length).toBe(sampleUsers.length);
    });

    it('should update a user', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);

      // Create user first (isolated)
      const user = new User();
      user.name = 'Original Name';
      user.email = 'original@example.com';
      user.age = 30;
      user.isActive = true;
      userSet.add(user);
      await context.saveChanges();

      // Update
      user.name = 'Updated Name';
      user.age = 35;
      userSet.update(user);
      await context.saveChanges();

      const updated = await userSet
        .query()
        .where((u) => u.id === user.id)
        .firstOrDefault();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.age).toBe(35);
    });

    it('should delete a user', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);

      // Create user first (isolated)
      const user = new User();
      user.name = 'To Delete';
      user.email = 'delete@example.com';
      user.age = 25;
      user.isActive = true;
      userSet.add(user);
      await context.saveChanges();

      const initialCount = await userSet.query().count();

      userSet.remove(user);
      await context.saveChanges();

      const finalCount = await userSet.query().count();
      expect(finalCount).toBe(initialCount - 1);
    });

    it('should filter users with where clause', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);
      const activeUsers = await userSet
        .query()
        .where((u) => u.isActive === true)
        .toArray();

      expect(activeUsers.every((u) => u.isActive)).toBe(true);
    });

    it('should sort users', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);
      const sortedUsers = await userSet.query().orderBy('name').toArray();

      for (let i = 1; i < sortedUsers.length; i++) {
        expect(sortedUsers[i].name >= sortedUsers[i - 1].name).toBe(true);
      }
    });

    it('should paginate users', async () => {
      if (process.env.SKIP_DB_TESTS === '1') {
        return;
      }

      const userSet = context.set(User);
      const page1 = await userSet.query().skip(0).take(2).toArray();
      const page2 = await userSet.query().skip(2).take(2).toArray();

      expect(page1).toHaveLength(Math.min(2, await userSet.query().count()));
      expect(page1[0].id).not.toBe(page2[0]?.id);
    });
  }
);
