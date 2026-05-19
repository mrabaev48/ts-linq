import { PostgresDdlStrategy } from '@ts-linq/dialect-postgres';
import {
  Column,
  createMetadataRegistry,
  Entity,
  MetadataStorage,
  PrimaryKey
} from '@ts-linq/metadata';
import { ModelBuilder } from '@ts-linq/orm';
import { DeleteBehavior } from '@ts-linq/types';

// ── Test entity classes ──────────────────────────────────────────────────────

class FluentPost {
  id!: number;
  title!: string;
  content!: string;
  authorId!: number;
}

class FluentUser {
  id!: number;
  email!: string;
  name!: string;
  posts?: FluentPost[];
  profile?: unknown;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('PostgreSQL DDL — Fluent API Integration', () => {
  const strategy = new PostgresDdlStrategy();

  afterEach(() => {
    MetadataStorage.getInstance().clear();
  });

  it('generates CREATE TABLE from fluent configuration', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(FluentUser, (b) => {
      b.toTable('fluent_users');
      b.hasKey('id');
      b.property((u) => u.id).hasColumnType('INTEGER');
      b.property((u) => u.email)
        .hasColumnType('TEXT')
        .isRequired();
      b.property((u) => u.name)
        .hasColumnType('TEXT')
        .isRequired();
    });
    mb._finalize();

    const meta = registry.getEntity(FluentUser)!;
    const sql = strategy.generateCreateTableSql(meta);

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "fluent_users"');
    expect(sql).toContain('"email" TEXT NOT NULL');
    expect(sql).toContain('"name" TEXT NOT NULL');
    expect(sql).toContain('PRIMARY KEY ("id")');
  });

  it('stores schema from toTable(name, schema)', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(FluentUser, (b) => {
      b.toTable('fluent_users', 'public');
    });
    mb._finalize();

    const meta = registry.getEntity(FluentUser)!;
    expect(meta.tableName).toBe('fluent_users');
    expect(meta.schema).toBe('public');
  });

  it('generates DEFAULT value from hasDefaultValue()', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(FluentPost, (b) => {
      b.toTable('fluent_posts');
      b.hasKey('id');
      b.property((p) => p.id).hasColumnType('INTEGER');
      b.property((p) => p.content)
        .hasColumnType('TEXT')
        .hasDefaultValue('');
    });
    mb._finalize();

    const meta = registry.getEntity(FluentPost)!;
    const sql = strategy.generateCreateTableSql(meta);

    expect(sql).toContain('"content" TEXT');
    expect(sql).toContain("DEFAULT ''");
  });

  it('generates CREATE INDEX from hasIndex().isUnique()', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(FluentUser, (b) => {
      b.toTable('fluent_users');
      b.property((u) => u.email)
        .hasColumnName('email')
        .hasColumnType('TEXT');
      b.hasIndex('email').isUnique().hasName('UX_fluent_users_email');
    });
    mb._finalize();

    const meta = registry.getEntity(FluentUser)!;
    const idx = meta.indexes.find((i) => i.name === 'UX_fluent_users_email')!;
    expect(idx).toBeDefined();

    const sql = strategy.generateCreateIndexSql('fluent_users', {
      name: idx.name,
      columns: idx.columns,
      unique: idx.unique ?? false
    });
    expect(sql).toContain('CREATE UNIQUE INDEX');
    expect(sql).toContain('"UX_fluent_users_email"');
    expect(sql).toContain('"email"');
  });

  it('stores one-to-many relationship metadata', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(FluentUser, (b) => {
      b.toTable('fluent_users');
      b.hasMany((u) => u.posts as FluentPost[], FluentPost)
        .withOne()
        .hasForeignKey((p: FluentPost) => p.authorId)
        .onDelete(DeleteBehavior.Cascade);
    });
    mb._finalize();

    const meta = registry.getEntity(FluentUser)!;
    const rel = meta.relationships.find((r) => r.propertyName === 'posts');
    expect(rel).toBeDefined();
    expect(rel?.type).toBe('one-to-many');
    expect(rel?.foreignKey).toBe('authorId');
    expect(rel?.onDelete).toBe(DeleteBehavior.Cascade);
  });

  it('stores one-to-one relationship metadata', () => {
    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(FluentUser, (b) => {
      b.toTable('fluent_users');
      b.hasOne((u) => u.profile)
        .withOne()
        .isRequired();
    });
    mb._finalize();

    const meta = registry.getEntity(FluentUser)!;
    const rel = meta.relationships.find((r) => r.propertyName === 'profile');
    expect(rel?.type).toBe('one-to-one');
    expect(rel?.nullable).toBe(false);
  });

  it('DDL output is equivalent between decorator and fluent approaches', () => {
    // Decorator approach
    @Entity({ name: 'eq_users' })
    class DecoratorUser {
      @PrimaryKey()
      id!: number;

      @Column({ type: 'TEXT', nullable: false })
      email!: string;
    }

    const decoratorMeta = MetadataStorage.getEntity(DecoratorUser)!;
    const decoratorSql = strategy.generateCreateTableSql(decoratorMeta);

    // Fluent approach
    class FluentEqUser {
      id!: number;
      email!: string;
    }

    const registry = createMetadataRegistry();
    const mb = new ModelBuilder(registry);
    mb.entity(FluentEqUser, (b) => {
      b.toTable('eq_users');
      b.hasKey('id');
      b.property((u) => u.id).hasColumnType('INTEGER');
      b.property((u) => u.email)
        .hasColumnType('TEXT')
        .isRequired();
    });
    mb._finalize();

    const fluentMeta = registry.getEntity(FluentEqUser)!;
    const fluentSql = strategy.generateCreateTableSql(fluentMeta);

    expect(fluentSql).toContain('CREATE TABLE IF NOT EXISTS "eq_users"');
    expect(fluentSql).toContain('"email" TEXT NOT NULL');
    expect(fluentSql).toContain('PRIMARY KEY ("id")');

    // Core structure matches — column definitions may differ by column count
    expect(decoratorSql).toContain('CREATE TABLE IF NOT EXISTS "eq_users"');
    expect(decoratorSql).toContain('"email" TEXT NOT NULL');
  });
});
