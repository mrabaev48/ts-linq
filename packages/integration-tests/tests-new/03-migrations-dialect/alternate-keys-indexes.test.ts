import { MssqlDdlStrategy } from '@ts-linq/dialect-mssql';
import { MySqlDdlStrategy } from '@ts-linq/dialect-mysql';
import { PostgresDdlStrategy } from '@ts-linq/dialect-postgres';
import { createMetadataRegistry, MetadataStorage } from '@ts-linq/metadata';
import {
  buildAddUniqueConstraintSql,
  buildCreateIndexSql,
  buildDropUniqueConstraintSql,
  compareSchemas,
  SchemaSnapshotBuilder
} from '@ts-linq/migrations';
import { ModelBuilder } from '@ts-linq/orm';

// ── Test entity classes ──────────────────────────────────────────────────────

class User {
  id!: number;
  email!: string;
  name!: string;
}

class Order {
  id!: number;
  tenantId!: string;
  publicNumber!: string;
}

class Post {
  id!: number;
  authorId!: number;
  publishedAt!: string;
  title!: string;
  slug!: string;
  deletedAt?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

afterEach(() => {
  MetadataStorage.getInstance().clear();
});

// ── Alternate key DDL — per dialect ──────────────────────────────────────────

describe('Alternate Keys — DDL generation', () => {
  describe('PostgreSQL', () => {
    const strategy = new PostgresDdlStrategy();

    it('generates ADD CONSTRAINT ... UNIQUE for a single-column alternate key', () => {
      const sql = strategy.generateAddUniqueConstraintSql('users', 'AK_User_email', ['email']);
      expect(sql).toBe('ALTER TABLE "users" ADD CONSTRAINT "AK_User_email" UNIQUE ("email")');
    });

    it('generates ADD CONSTRAINT ... UNIQUE for a multi-column alternate key', () => {
      const sql = strategy.generateAddUniqueConstraintSql(
        'orders',
        'AK_Order_tenantId_publicNumber',
        ['tenantId', 'publicNumber']
      );
      expect(sql).toBe(
        'ALTER TABLE "orders" ADD CONSTRAINT "AK_Order_tenantId_publicNumber" UNIQUE ("tenantId", "publicNumber")'
      );
    });

    it('generates DROP CONSTRAINT IF EXISTS for removing an alternate key', () => {
      const sql = strategy.generateDropUniqueConstraintSql('users', 'AK_User_email');
      expect(sql).toBe('ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "AK_User_email"');
    });
  });

  describe('MySQL', () => {
    const strategy = new MySqlDdlStrategy();

    it('generates ADD UNIQUE KEY for a single-column alternate key', () => {
      const sql = strategy.generateAddUniqueConstraintSql('users', 'AK_User_email', ['email']);
      expect(sql).toBe('ALTER TABLE `users` ADD UNIQUE KEY `AK_User_email` (`email`)');
    });

    it('generates DROP INDEX for removing an alternate key', () => {
      const sql = strategy.generateDropUniqueConstraintSql('users', 'AK_User_email');
      expect(sql).toBe('ALTER TABLE `users` DROP INDEX `AK_User_email`');
    });
  });

  describe('MSSQL', () => {
    const strategy = new MssqlDdlStrategy();

    it('generates ADD CONSTRAINT ... UNIQUE for a single-column alternate key', () => {
      const sql = strategy.generateAddUniqueConstraintSql('users', 'AK_User_email', ['email']);
      expect(sql).toBe('ALTER TABLE [users] ADD CONSTRAINT [AK_User_email] UNIQUE ([email])');
    });

    it('generates DROP CONSTRAINT for removing an alternate key', () => {
      const sql = strategy.generateDropUniqueConstraintSql('users', 'AK_User_email');
      expect(sql).toBe('ALTER TABLE [users] DROP CONSTRAINT [AK_User_email]');
    });
  });
});

// ── MigrationHandlers helper functions ───────────────────────────────────────

describe('buildAddUniqueConstraintSql / buildDropUniqueConstraintSql', () => {
  it('PG: wraps columns in double-quotes', () => {
    const sql = buildAddUniqueConstraintSql('postgresql', 'users', {
      name: 'AK_User_email',
      columns: ['email']
    });
    expect(sql).toContain('"AK_User_email"');
    expect(sql).toContain('"email"');
  });

  it('MySQL: wraps identifiers in backticks', () => {
    const sql = buildAddUniqueConstraintSql('mysql', 'users', {
      name: 'AK_User_email',
      columns: ['email']
    });
    expect(sql).toContain('`AK_User_email`');
    expect(sql).toContain('`email`');
  });

  it('MSSQL: wraps identifiers in square brackets', () => {
    const sql = buildAddUniqueConstraintSql('mssql', 'users', {
      name: 'AK_User_email',
      columns: ['email']
    });
    expect(sql).toContain('[AK_User_email]');
    expect(sql).toContain('[email]');
  });

  it('PG drop: emits DROP CONSTRAINT IF EXISTS', () => {
    const sql = buildDropUniqueConstraintSql('postgresql', 'users', 'AK_User_email');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS');
  });

  it('MySQL drop: emits DROP INDEX', () => {
    const sql = buildDropUniqueConstraintSql('mysql', 'users', 'AK_User_email');
    expect(sql).toContain('DROP INDEX');
  });
});

// ── Covering index (INCLUDE) DDL ─────────────────────────────────────────────

describe('Covering index (includeProperties / INCLUDE)', () => {
  it('PG: buildCreateIndexSql includes INCLUDE clause', () => {
    const sql = buildCreateIndexSql('postgresql', 'posts', {
      name: 'IX_posts_authorId',
      columns: ['authorId'],
      unique: false,
      include: ['title', 'slug']
    });
    expect(sql).toContain('INCLUDE ("title", "slug")');
  });

  it('MSSQL: buildCreateIndexSql includes INCLUDE clause', () => {
    const sql = buildCreateIndexSql('mssql', 'posts', {
      name: 'IX_posts_authorId',
      columns: ['authorId'],
      unique: false,
      include: ['title', 'slug']
    });
    expect(sql).toContain('INCLUDE ([title], [slug])');
  });
});

// ── Filtered index (hasFilter / WHERE) DDL ───────────────────────────────────

describe('Filtered index (hasFilter / WHERE)', () => {
  it('PG: buildCreateIndexSql includes WHERE clause', () => {
    const sql = buildCreateIndexSql('postgresql', 'posts', {
      name: 'IX_posts_active',
      columns: ['authorId'],
      unique: true,
      where: 'deleted_at IS NULL'
    });
    expect(sql).toContain('WHERE deleted_at IS NULL');
    expect(sql).toContain('UNIQUE');
  });

  it('MSSQL: buildCreateIndexSql includes WHERE clause (filtered index)', () => {
    const sql = buildCreateIndexSql('mssql', 'posts', {
      name: 'IX_posts_active',
      columns: ['authorId'],
      unique: true,
      where: 'deleted_at IS NULL'
    });
    expect(sql).toContain('WHERE deleted_at IS NULL');
  });

  it('MySQL: WHERE clause is silently dropped (not supported)', () => {
    const sql = buildCreateIndexSql('mysql', 'posts', {
      name: 'IX_posts_active',
      columns: ['authorId'],
      unique: true,
      where: 'deleted_at IS NULL'
    });
    expect(sql).not.toContain('WHERE');
  });
});

// ── hasAlternateKey() → SchemaSnapshot → migration diff ─────────────────────

describe('hasAlternateKey — ModelBuilder → SchemaSnapshot → diff', () => {
  it('captures alternate key in SchemaSnapshot', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);
    mb.entity(User, (b) => {
      b.toTable('users');
      b.property((u) => u.id)
        .hasColumnName('id')
        .hasColumnType('INTEGER');
      b.property((u) => u.email)
        .hasColumnName('email')
        .hasColumnType('TEXT');
      b.hasAlternateKey((u) => u.email);
    });
    mb._finalize();

    const entities = registry.getEntities();
    const orig = MetadataStorage.getEntities.bind(MetadataStorage);
    MetadataStorage.getEntities = () => entities;
    let snapshot;
    try {
      snapshot = new SchemaSnapshotBuilder().buildExpectedFromMetadata();
    } finally {
      MetadataStorage.getEntities = orig;
    }
    const table = snapshot.tables.find((t) => t.name === 'users');

    expect(table?.uniqueConstraints).toHaveLength(1);
    expect(table?.uniqueConstraints?.[0].name).toBe('AK_User_email');
    expect(table?.uniqueConstraints?.[0].columns).toEqual(['email']);
  });

  it('diff emits uniqueConstraintCreates when alternate key is added', () => {
    const expectedTable = {
      name: 'users',
      columns: [{ name: 'id', type: 'INTEGER', nullable: false }],
      primaryKeys: ['id'],
      indexes: [],
      foreignKeys: [],
      uniqueConstraints: [{ name: 'AK_User_email', columns: ['email'] }]
    };
    const actualTable = {
      name: 'users',
      columns: [{ name: 'id', type: 'INTEGER', nullable: false }],
      primaryKeys: ['id'],
      indexes: [],
      foreignKeys: []
    };

    const diff = compareSchemas({ tables: [expectedTable] }, { tables: [actualTable] });

    expect(diff.tables[0].uniqueConstraintCreates).toHaveLength(1);
    expect(diff.tables[0].uniqueConstraintCreates?.[0].name).toBe('AK_User_email');
  });

  it('diff emits uniqueConstraintDrops when alternate key is removed', () => {
    const expectedTable = {
      name: 'users',
      columns: [{ name: 'id', type: 'INTEGER', nullable: false }],
      primaryKeys: ['id'],
      indexes: [],
      foreignKeys: []
    };
    const actualTable = {
      name: 'users',
      columns: [{ name: 'id', type: 'INTEGER', nullable: false }],
      primaryKeys: ['id'],
      indexes: [],
      foreignKeys: [],
      uniqueConstraints: [{ name: 'AK_User_email', columns: ['email'] }]
    };

    const diff = compareSchemas({ tables: [expectedTable] }, { tables: [actualTable] });

    expect(diff.tables[0].uniqueConstraintDrops).toContain('AK_User_email');
  });
});

// ── isDescending — SchemaSnapshot orders mapping ─────────────────────────────

describe('isDescending — IndexMetadata → IndexDef orders', () => {
  it('maps isDescending flags to orders in SchemaSnapshot', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);
    mb.entity(Post, (b) => {
      b.toTable('posts');
      b.property((p) => p.authorId)
        .hasColumnName('authorId')
        .hasColumnType('INTEGER');
      b.property((p) => p.publishedAt)
        .hasColumnName('publishedAt')
        .hasColumnType('TEXT');
      b.hasIndex((p) => [p.authorId, p.publishedAt]).isDescending([false, true]);
    });
    mb._finalize();

    const entities = registry.getEntities();
    const orig2 = MetadataStorage.getEntities.bind(MetadataStorage);
    MetadataStorage.getEntities = () => entities;
    let snapshot;
    try {
      snapshot = new SchemaSnapshotBuilder().buildExpectedFromMetadata();
    } finally {
      MetadataStorage.getEntities = orig2;
    }
    const table = snapshot.tables.find((t) => t.name === 'posts');
    const idx = table?.indexes.find((i) => i.columns.includes('authorId'));

    expect(idx?.orders?.['authorId']).toBe('ASC');
    expect(idx?.orders?.['publishedAt']).toBe('DESC');
  });
});
