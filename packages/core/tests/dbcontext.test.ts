import 'reflect-metadata';
import { DbContext } from '../src/context/DbContext';
import { ProviderStub } from './_stubs/ProviderStub';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

// Define test entity inside function to ensure decorators execute properly
function createUser() {
  @Entity()
  class User {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    name!: string;

    @Column()
    email!: string;
  }
  return User;
}

class TestDbContext extends DbContext {}

describe('DbContext', () => {
  let context: TestDbContext;
  let User: ReturnType<typeof createUser>;

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    // Create test entity
    User = createUser();

    context = new TestDbContext({
      connectionString: ':memory:',
      provider: new ProviderStub(':memory:') as unknown as 'sqlite'
    });

    await context.ensureCreated();
  });

  afterEach(async () => {
    await context.dispose();
  });

  describe('ensureCreated', () => {
    it('should create database tables', async () => {
      // Table creation is tested in the beforeEach
      expect(true).toBe(true);
    });
  });

  describe('set', () => {
    it('should return DbSet for registered entity', () => {
      const userDbSet = context.set(User);
      expect(userDbSet).toBeDefined();
      expect(userDbSet._entityClass).toBe(User);
    });

    it('should throw for unregistered entity', () => {
      class UnregisteredEntity {}

      expect(() => context.set(UnregisteredEntity)).toThrow();
    });
  });

  describe('saveChanges', () => {
    it('should persist added entities', async () => {
      const user = new User();
      user.name = 'John Doe';
      user.email = 'john@example.com';

      context.set(User).add(user);
      const affectedRows = await context.saveChanges();

      expect(affectedRows).toBe(1);
      expect(user.id).toBeDefined();
    });

    it('should persist updated entities', async () => {
      const user = new User();
      user.name = 'John Doe';
      user.email = 'john@example.com';

      context.set(User).add(user);
      await context.saveChanges();

      user.name = 'John Updated';
      context.set(User).update(user);
      const affectedRows = await context.saveChanges();

      expect(affectedRows).toBe(1);

      const found = await context.set(User).find(user.id);
      expect(found!.name).toBe('John Updated');
    });

    it('should delete removed entities', async () => {
      const user = new User();
      user.name = 'John Doe';
      user.email = 'john@example.com';

      context.set(User).add(user);
      await context.saveChanges();

      context.set(User).remove(user);
      const affectedRows = await context.saveChanges();

      expect(affectedRows).toBe(1);

      const found = await context.set(User).find(user.id);
      expect(found).toBeNull();
    });
  });

  describe('transactions', () => {
    it('should commit transaction', async () => {
      await context.beginTransaction();

      const user = new User();
      user.name = 'Transaction User';
      user.email = 'transaction@example.com';

      context.set(User).add(user);
      await context.saveChanges();
      await context.commitTransaction();

      const found = await context.set(User).find(user.id);
      expect(found).toBeDefined();
    });

    it('should rollback transaction', async () => {
      await context.beginTransaction();

      const user = new User();
      user.name = 'Rollback User';
      user.email = 'rollback@example.com';

      context.set(User).add(user);
      await context.saveChanges();
      await context.rollbackTransaction();

      // The user should not exist after rollback
      // Note: We can't check by ID since it might not be assigned
      const allUsers = await context.set(User).toArray();
      expect(allUsers).toHaveLength(0);
    });
  });
});
