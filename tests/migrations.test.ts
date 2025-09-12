import 'reflect-metadata';
import { Migration } from '../src/migrations/Migration';
import { MigrationRunner } from '../src/migrations/MigrationRunner';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';

class TestMigration001 extends Migration {
  protected name = 'CreateUsersTable';
  protected version = '001';

  public async up(): Promise<void> {
    await this.provider.executeNonQuery(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL
            )
        `);
  }

  public async down(): Promise<void> {
    await this.provider.executeNonQuery('DROP TABLE users');
  }

  constructor(private provider: any) {
    super();
  }
}

class TestMigration002 extends Migration {
  protected name = 'AddAgeColumnToUsers';
  protected version = '002';

  public async up(): Promise<void> {
    await this.provider.executeNonQuery(`
            ALTER TABLE users ADD COLUMN age INTEGER
        `);
  }

  public async down(): Promise<void> {
    // SQLite doesn't support DROP COLUMN, so this is a simplified version
    await this.provider.executeNonQuery(`
            CREATE TABLE users_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL
            )
        `);
    await this.provider.executeNonQuery(`
            INSERT INTO users_new (id, name, email)
            SELECT id, name, email FROM users
        `);
    await this.provider.executeNonQuery('DROP TABLE users');
    await this.provider.executeNonQuery('ALTER TABLE users_new RENAME TO users');
  }

  constructor(private provider: any) {
    super();
  }
}

describe('Migrations', () => {
  let provider: SQLiteProvider;
  let migrationRunner: MigrationRunner;

  beforeEach(async () => {
    provider = new SQLiteProvider(':memory:');
    await provider.connect();
    migrationRunner = new MigrationRunner(provider);
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  describe('MigrationRunner', () => {
    it('should create migration table', async () => {
      await migrationRunner.ensureMigrationTableExists();

      const result = await provider.executeQuery(
        'SELECT name FROM sqlite_master WHERE type="table" AND name="__migrations"'
      );
      expect(result).toHaveLength(1);
    });

    it('should run migrations in order', async () => {
      const migration1 = new TestMigration001(provider);
      const migration2 = new TestMigration002(provider);

      migrationRunner.addMigration(migration1);
      migrationRunner.addMigration(migration2);

      await migrationRunner.migrate();

      // Check that both migrations were applied
      const appliedMigrations = await migrationRunner.getAppliedMigrations();
      expect(appliedMigrations).toHaveLength(2);
      expect(appliedMigrations[0].version).toBe('001');
      expect(appliedMigrations[1].version).toBe('002');

      // Check that the table exists with the age column
      const tableInfo = await provider.executeQuery('PRAGMA table_info(users)');
      // After two migrations, columns: id, name, email, age
      expect(tableInfo).toHaveLength(4);
    });

    it('should not run already applied migrations', async () => {
      const migration1 = new TestMigration001(provider);
      migrationRunner.addMigration(migration1);

      // Run migration first time
      await migrationRunner.migrate();
      let appliedMigrations = await migrationRunner.getAppliedMigrations();
      expect(appliedMigrations).toHaveLength(1);

      // Run migration again
      await migrationRunner.migrate();
      appliedMigrations = await migrationRunner.getAppliedMigrations();
      expect(appliedMigrations).toHaveLength(1); // Should still be 1
    });

    it('should rollback migrations', async () => {
      const migration1 = new TestMigration001(provider);
      const migration2 = new TestMigration002(provider);

      migrationRunner.addMigration(migration1);
      migrationRunner.addMigration(migration2);

      // Apply migrations
      await migrationRunner.migrate();

      // Rollback to version 001
      await migrationRunner.rollback('001');

      const appliedMigrations = await migrationRunner.getAppliedMigrations();
      expect(appliedMigrations).toHaveLength(1);
      expect(appliedMigrations[0].version).toBe('001');

      // Check that age column was removed
      const tableInfo = await provider.executeQuery('PRAGMA table_info(users)');
      expect(tableInfo).toHaveLength(3); // id, name, email (no age)
    });

    it('should handle migration failures with rollback', async () => {
      class FailingMigration extends Migration {
        protected name = 'FailingMigration';
        protected version = '003';

        public async up(): Promise<void> {
          throw new Error('Migration failed');
        }

        public async down(): Promise<void> {
          // Won't be called in this test
        }
      }

      const migration1 = new TestMigration001(provider);
      const failingMigration = new FailingMigration();

      migrationRunner.addMigration(migration1);
      migrationRunner.addMigration(failingMigration);

      await expect(migrationRunner.migrate()).rejects.toThrow(
        'Failed to apply migration FailingMigration'
      );

      // Only the first migration should be applied
      const appliedMigrations = await migrationRunner.getAppliedMigrations();
      expect(appliedMigrations).toHaveLength(1);
      expect(appliedMigrations[0].version).toBe('001');
    });
  });
});
