import 'reflect-metadata';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';
import { Entity, Column, PrimaryKey } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

// Define test entity inside describe block to match working decorator tests
function createTestUser() {
  @Entity()
  class TestUser {
    @PrimaryKey({ autoIncrement: true })
    id!: number;

    @Column()
    name!: string;

    @Column()
    email!: string;
  }
  return TestUser;
}

describe('SQLiteProvider', () => {
  let provider: SQLiteProvider;
  let TestUser: ReturnType<typeof createTestUser>;

  beforeEach(async () => {
    MetadataStorage.getInstance().clear();
    // Create test entity
    TestUser = createTestUser();

    provider = new SQLiteProvider(':memory:');
    await provider.connect();
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  describe('connection', () => {
    it('should connect and disconnect successfully', async () => {
      expect(provider.connected).toBe(true);

      await provider.disconnect();
      expect(provider.connected).toBe(false);
    });
  });

  describe('createTable', () => {
    it('should create table from entity metadata', async () => {
      const metadata = MetadataStorage.getEntity(TestUser)!;
      await provider.createTable(metadata);

      // Verify table was created by trying to query it
      const result = await provider.executeQuery(
        'SELECT name FROM sqlite_master WHERE type="table" AND name="TestUser"'
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('CRUD operations', () => {
    beforeEach(async () => {
      const metadata = MetadataStorage.getEntity(TestUser)!;
      await provider.createTable(metadata);
    });

    it('should insert entity', async () => {
      const user = new TestUser();
      user.name = 'John Doe';
      user.email = 'john@example.com';

      const result = await provider.insert(user, TestUser);
      expect(result.id).toBeDefined();
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
    });

    it('should find entity by id', async () => {
      const user = new TestUser();
      user.name = 'John Doe';
      user.email = 'john@example.com';

      const inserted = await provider.insert(user, TestUser);
      const found = await provider.findById(inserted.id, TestUser);

      expect(found).toBeDefined();
      expect(found!.name).toBe('John Doe');
      expect(found!.email).toBe('john@example.com');
    });

    it('should find all entities', async () => {
      const user1 = new TestUser();
      user1.name = 'John Doe';
      user1.email = 'john@example.com';

      const user2 = new TestUser();
      user2.name = 'Jane Smith';
      user2.email = 'jane@example.com';

      await provider.insert(user1, TestUser);
      await provider.insert(user2, TestUser);

      const allUsers = await provider.findAll(TestUser);
      expect(allUsers).toHaveLength(2);
    });

    it('should update entity', async () => {
      const user = new TestUser();
      user.name = 'John Doe';
      user.email = 'john@example.com';

      const inserted = await provider.insert(user, TestUser);
      inserted.name = 'John Updated';

      await provider.update(inserted, TestUser);
      const found = await provider.findById(inserted.id, TestUser);

      expect(found!.name).toBe('John Updated');
    });

    it('should delete entity', async () => {
      const user = new TestUser();
      user.name = 'John Doe';
      user.email = 'john@example.com';

      const inserted = await provider.insert(user, TestUser);
      await provider.delete(inserted, TestUser);

      const found = await provider.findById(inserted.id, TestUser);
      expect(found).toBeNull();
    });
  });

  describe('transactions', () => {
    beforeEach(async () => {
      const metadata = MetadataStorage.getEntity(TestUser)!;
      await provider.createTable(metadata);
    });

    it('should commit transaction', async () => {
      await provider.beginTransaction();

      const user = new TestUser();
      user.name = 'Transaction User';
      user.email = 'transaction@example.com';

      await provider.insert(user, TestUser);
      await provider.commitTransaction();

      const allUsers = await provider.findAll(TestUser);
      expect(allUsers).toHaveLength(1);
    });

    it('should rollback transaction', async () => {
      await provider.beginTransaction();

      const user = new TestUser();
      user.name = 'Rollback User';
      user.email = 'rollback@example.com';

      await provider.insert(user, TestUser);
      await provider.rollbackTransaction();

      const allUsers = await provider.findAll(TestUser);
      expect(allUsers).toHaveLength(0);
    });
  });
});
