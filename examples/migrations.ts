import 'reflect-metadata';
import { Migration, MigrationRunner } from '../src/migrations';
import { SQLiteProvider } from '../src/providers/SQLiteProvider';

// Example migration: Create initial schema
class CreateInitialSchema extends Migration {
    protected name = 'CreateInitialSchema';
    protected version = '001_create_initial_schema';

    constructor(private provider: SQLiteProvider) {
        super();
    }

    public async up(): Promise<void> {
        // Create users table
        await this.provider.executeNonQuery(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create posts table
        await this.provider.executeNonQuery(`
            CREATE TABLE posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                published BOOLEAN DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create categories table
        await this.provider.executeNonQuery(`
            CREATE TABLE categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Created initial schema: users, posts, categories tables');
    }

    public async down(): Promise<void> {
        await this.provider.executeNonQuery('DROP TABLE IF EXISTS posts');
        await this.provider.executeNonQuery('DROP TABLE IF EXISTS categories');
        await this.provider.executeNonQuery('DROP TABLE IF EXISTS users');
        
        console.log('Dropped initial schema tables');
    }
}

// Example migration: Add indexes for performance
class AddIndexes extends Migration {
    protected name = 'AddIndexes';
    protected version = '002_add_indexes';

    constructor(private provider: SQLiteProvider) {
        super();
    }

    public async up(): Promise<void> {
        // Index on user email for faster lookups
        await this.provider.executeNonQuery(`
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
        `);

        // Index on post user_id for faster joins
        await this.provider.executeNonQuery(`
            CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)
        `);

        // Index on post published status
        await this.provider.executeNonQuery(`
            CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published)
        `);

        // Composite index on posts for user queries
        await this.provider.executeNonQuery(`
            CREATE INDEX IF NOT EXISTS idx_posts_user_published ON posts(user_id, published)
        `);

        console.log('Added performance indexes');
    }

    public async down(): Promise<void> {
        await this.provider.executeNonQuery('DROP INDEX IF EXISTS idx_users_email');
        await this.provider.executeNonQuery('DROP INDEX IF EXISTS idx_posts_user_id');
        await this.provider.executeNonQuery('DROP INDEX IF EXISTS idx_posts_published');
        await this.provider.executeNonQuery('DROP INDEX IF EXISTS idx_posts_user_published');
        
        console.log('Dropped performance indexes');
    }
}

// Example migration: Add post tags feature
class AddPostTags extends Migration {
    protected name = 'AddPostTags';
    protected version = '003_add_post_tags';

    constructor(private provider: SQLiteProvider) {
        super();
    }

    public async up(): Promise<void> {
        // Create tags table
        await this.provider.executeNonQuery(`
            CREATE TABLE tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT DEFAULT '#007bff',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create post_tags junction table for many-to-many relationship
        await this.provider.executeNonQuery(`
            CREATE TABLE post_tags (
                post_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (post_id, tag_id),
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
        `);

        // Add indexes for the junction table
        await this.provider.executeNonQuery(`
            CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id)
        `);

        await this.provider.executeNonQuery(`
            CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id)
        `);

        // Insert some default tags
        await this.provider.executeNonQuery(`
            INSERT INTO tags (name, color) VALUES 
                ('Technology', '#007bff'),
                ('Programming', '#28a745'),
                ('Tutorial', '#ffc107'),
                ('News', '#dc3545'),
                ('Opinion', '#6f42c1')
        `);

        console.log('Added post tags feature with default tags');
    }

    public async down(): Promise<void> {
        await this.provider.executeNonQuery('DROP INDEX IF EXISTS idx_post_tags_post_id');
        await this.provider.executeNonQuery('DROP INDEX IF EXISTS idx_post_tags_tag_id');
        await this.provider.executeNonQuery('DROP TABLE IF EXISTS post_tags');
        await this.provider.executeNonQuery('DROP TABLE IF EXISTS tags');
        
        console.log('Removed post tags feature');
    }
}

// Example migration: Add user profiles
class AddUserProfiles extends Migration {
    protected name = 'AddUserProfiles';
    protected version = '004_add_user_profiles';

    constructor(private provider: SQLiteProvider) {
        super();
    }

    public async up(): Promise<void> {
        // Add profile fields to users table
        await this.provider.executeNonQuery(`
            ALTER TABLE users ADD COLUMN bio TEXT
        `);

        await this.provider.executeNonQuery(`
            ALTER TABLE users ADD COLUMN avatar_url TEXT
        `);

        await this.provider.executeNonQuery(`
            ALTER TABLE users ADD COLUMN website TEXT
        `);

        await this.provider.executeNonQuery(`
            ALTER TABLE users ADD COLUMN location TEXT
        `);

        await this.provider.executeNonQuery(`
            ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1
        `);

        console.log('Added user profile fields');
    }

    public async down(): Promise<void> {
        // SQLite doesn't support DROP COLUMN, so we need to recreate the table
        await this.provider.executeNonQuery(`
            CREATE TABLE users_backup (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.provider.executeNonQuery(`
            INSERT INTO users_backup (id, name, email, created_at, updated_at)
            SELECT id, name, email, created_at, updated_at FROM users
        `);

        await this.provider.executeNonQuery('DROP TABLE users');
        await this.provider.executeNonQuery('ALTER TABLE users_backup RENAME TO users');

        console.log('Removed user profile fields');
    }
}

async function runMigrationsExample() {
    console.log('=== Migration Example ===\n');

    const provider = new SQLiteProvider('./example_migrations.db');
    await provider.connect();

    const migrationRunner = new MigrationRunner(provider);

    try {
        // Add migrations in order
        migrationRunner.addMigration(new CreateInitialSchema(provider));
        migrationRunner.addMigration(new AddIndexes(provider));
        migrationRunner.addMigration(new AddPostTags(provider));
        migrationRunner.addMigration(new AddUserProfiles(provider));

        console.log('1. Running all migrations...');
        await migrationRunner.migrate();

        console.log('\n2. Checking applied migrations:');
        const appliedMigrations = await migrationRunner.getAppliedMigrations();
        appliedMigrations.forEach(migration => {
            console.log(`- ${migration.name} (${migration.version}) applied at ${migration.appliedAt}`);
        });

        console.log('\n3. Rolling back to version 002...');
        await migrationRunner.rollback('002_add_indexes');

        console.log('\n4. Checking migrations after rollback:');
        const migrationsAfterRollback = await migrationRunner.getAppliedMigrations();
        migrationsAfterRollback.forEach(migration => {
            console.log(`- ${migration.name} (${migration.version}) applied at ${migration.appliedAt}`);
        });

        console.log('\n5. Running migrations again to apply rolled back ones...');
        await migrationRunner.migrate();

        console.log('\nMigration example completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await provider.disconnect();
    }
}

// Advanced migration example with data transformation
class ConvertPostStatusToEnum extends Migration {
    protected name = 'ConvertPostStatusToEnum';
    protected version = '005_convert_post_status';

    constructor(private provider: SQLiteProvider) {
        super();
    }

    public async up(): Promise<void> {
        // Add new status column
        await this.provider.executeNonQuery(`
            ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'draft'
        `);

        // Migrate existing published boolean to status enum
        await this.provider.executeNonQuery(`
            UPDATE posts SET status = CASE 
                WHEN published = 1 THEN 'published'
                ELSE 'draft'
            END
        `);

        // Remove old published column (SQLite way)
        await this.provider.executeNonQuery(`
            CREATE TABLE posts_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                status TEXT DEFAULT 'draft',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await this.provider.executeNonQuery(`
            INSERT INTO posts_new (id, title, content, user_id, status, created_at, updated_at)
            SELECT id, title, content, user_id, status, created_at, updated_at FROM posts
        `);

        await this.provider.executeNonQuery('DROP TABLE posts');
        await this.provider.executeNonQuery('ALTER TABLE posts_new RENAME TO posts');

        // Recreate indexes
        await this.provider.executeNonQuery(`
            CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)
        `);

        await this.provider.executeNonQuery(`
            CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)
        `);

        console.log('Converted post published boolean to status enum');
    }

    public async down(): Promise<void> {
        // Add published column back
        await this.provider.executeNonQuery(`
            ALTER TABLE posts ADD COLUMN published BOOLEAN DEFAULT 0
        `);

        // Convert status back to boolean
        await this.provider.executeNonQuery(`
            UPDATE posts SET published = CASE 
                WHEN status = 'published' THEN 1
                ELSE 0
            END
        `);

        // Remove status column (SQLite way)
        await this.provider.executeNonQuery(`
            CREATE TABLE posts_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                published BOOLEAN DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await this.provider.executeNonQuery(`
            INSERT INTO posts_new (id, title, content, user_id, published, created_at, updated_at)
            SELECT id, title, content, user_id, published, created_at, updated_at FROM posts
        `);

        await this.provider.executeNonQuery('DROP TABLE posts');
        await this.provider.executeNonQuery('ALTER TABLE posts_new RENAME TO posts');

        console.log('Converted post status enum back to published boolean');
    }
}

// Run the example if this file is executed directly
if (require.main === module) {
    runMigrationsExample().catch(console.error);
}

export {
    CreateInitialSchema,
    AddIndexes,
    AddPostTags,
    AddUserProfiles,
    ConvertPostStatusToEnum,
    runMigrationsExample
};
