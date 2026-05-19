/**
 * Integration test: Fluent API — DDL parity with decorator-based configuration.
 *
 * Verifies that a model configured exclusively through the Fluent API produces
 * the same Postgres DDL as an equivalent decorator-based model.
 */

import { PostgresDdlStrategy } from '@ts-linq/dialect-postgres';
import { createMetadataRegistry } from '@ts-linq/metadata';
import { ModelBuilder } from '@ts-linq/orm';

afterEach(() => {
  // Tests use isolated registries — no global state to clean up.
});

const strategy = new PostgresDdlStrategy();

// ─── Entity shapes (no decorators) ───────────────────────────────────────────

class FluentUser {
  id!: number;
  email!: string;
  name!: string;
  posts?: FluentPost[];
  profile?: unknown;
}

class FluentPost {
  id!: number;
  title!: string;
  content!: string;
  authorId!: number;
  author?: FluentUser;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Postgres DDL — Fluent API parity', () => {
  describe('CREATE TABLE', () => {
    it('fluent-only entity produces correct CREATE TABLE SQL', () => {
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
      expect(meta).toBeDefined();
      expect(meta.tableName).toBe('fluent_users');
      expect(meta.primaryKeys).toEqual(['id']);

      const sql = strategy.generateCreateTableSql(meta);

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS "fluent_users"');
      expect(sql).toContain('"id" INTEGER');
      expect(sql).toContain('"email" TEXT NOT NULL');
      expect(sql).toContain('"name" TEXT NOT NULL');
      expect(sql).toContain('PRIMARY KEY ("id")');
    });

    it('fluent toTable with schema is stored on metadata', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);

      mb.entity(FluentUser, (b) => {
        b.toTable('fluent_users', 'app');
        b.hasKey('id');
      });
      mb._finalize();

      const meta = registry.getEntity(FluentUser)!;
      expect(meta.schema).toBe('app');
    });

    it('fluent hasDefaultValue() appears in DDL', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);

      mb.entity(FluentPost, (b) => {
        b.toTable('fluent_posts');
        b.hasKey('id');
        b.property((p) => p.id).hasColumnType('INTEGER');
        b.property((p) => p.title)
          .hasColumnType('TEXT')
          .isRequired();
        b.property((p) => p.content)
          .hasColumnType('TEXT')
          .hasDefaultValue('');
        b.property((p) => p.authorId)
          .hasColumnType('INTEGER')
          .isRequired();
      });
      mb._finalize();

      const meta = registry.getEntity(FluentPost)!;
      const sql = strategy.generateCreateTableSql(meta);

      expect(sql).toContain('"content" TEXT');
      expect(sql).toContain("DEFAULT ''");
      expect(sql).toContain('"title" TEXT NOT NULL');
    });

    it('fluent hasIndex() generates CREATE INDEX SQL', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);

      mb.entity(FluentUser, (b) => {
        b.toTable('fluent_users');
        b.hasKey('id');
        b.property((u) => u.email).hasColumnType('TEXT');
        b.hasIndex('email').isUnique().hasName('UIX_fluent_users_email');
      });
      mb._finalize();

      const meta = registry.getEntity(FluentUser)!;
      const idx = meta.indexes.find((i) => i.name === 'UIX_fluent_users_email')!;
      expect(idx).toBeDefined();

      // Cast needed: IndexMetadata.using is string but dialect expects literal union
      const sql = strategy.generateCreateIndexSql(meta.tableName, {
        name: idx.name,
        columns: idx.columns,
        unique: idx.unique ?? false
      });
      expect(sql).toBe(
        'CREATE UNIQUE INDEX IF NOT EXISTS "UIX_fluent_users_email" ON "fluent_users" ("email")'
      );
    });
  });

  describe('Relationship metadata', () => {
    it('one-to-many relationship is registered correctly', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);

      mb.entity(FluentUser, (b) => {
        b.toTable('fluent_users');
        b.hasKey('id');
        b.hasMany((u) => u.posts as FluentPost[], FluentPost)
          .withOne((p) => p.author)
          .hasForeignKey<FluentPost>((p) => p.authorId);
      });
      mb._finalize();

      const meta = registry.getEntity(FluentUser)!;
      const rel = meta.relationships.find((r) => r.propertyName === 'posts');
      expect(rel).toBeDefined();
      expect(rel!.type).toBe('one-to-many');
      expect(rel!.foreignKey).toBe('authorId');
      expect(rel!.inverseSide).toBe('author');
      expect(rel!.targetEntity).toBe(FluentPost);
    });

    it('hasOne().withOne() creates one-to-one relationship', () => {
      class Profile {
        id!: number;
        bio!: string;
        userId!: number;
        user?: FluentUser;
      }

      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);

      mb.entity(FluentUser, (b) => {
        b.toTable('fluent_users');
        b.hasKey('id');
        b.hasOne((u) => u.profile as Profile | undefined, Profile)
          .withOne((p) => p.user)
          .hasForeignKey<Profile>((p) => p.userId);
      });
      mb._finalize();

      const meta = registry.getEntity(FluentUser)!;
      const rel = meta.relationships.find((r) => r.propertyName === 'profile');
      expect(rel).toBeDefined();
      expect(rel!.type).toBe('one-to-one');
      expect(rel!.foreignKey).toBe('userId');
      expect(rel!.inverseSide).toBe('user');
    });
  });

  describe('Fluent vs decorator DDL equivalence', () => {
    it('decorator-defined and fluent-defined entities produce equivalent CREATE TABLE', () => {
      // Simulate decorator-equivalent metadata built manually:
      const decoratorRegistry = createMetadataRegistry();
      decoratorRegistry.addEntity(FluentUser, 'fluent_users');
      decoratorRegistry.addColumn(FluentUser, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false
      });
      decoratorRegistry.addColumn(FluentUser, {
        propertyName: 'email',
        columnName: 'email',
        type: 'TEXT',
        nullable: false
      });
      decoratorRegistry.addColumn(FluentUser, {
        propertyName: 'name',
        columnName: 'name',
        type: 'TEXT',
        nullable: false
      });
      decoratorRegistry.addPrimaryKey(FluentUser, 'id');

      const decoratorMeta = decoratorRegistry.getEntity(FluentUser)!;
      const decoratorSql = strategy.generateCreateTableSql(decoratorMeta);

      // Build equivalent model via Fluent API:
      const fluentRegistry = createMetadataRegistry();
      const mb = new ModelBuilder(fluentRegistry);
      mb.entity(FluentUser, (b) => {
        b.toTable('fluent_users');
        b.hasKey('id');
        b.property((u) => u.id)
          .hasColumnType('INTEGER')
          .isNullable(false);
        b.property((u) => u.email)
          .hasColumnType('TEXT')
          .isRequired();
        b.property((u) => u.name)
          .hasColumnType('TEXT')
          .isRequired();
      });
      mb._finalize();

      const fluentMeta = fluentRegistry.getEntity(FluentUser)!;
      const fluentSql = strategy.generateCreateTableSql(fluentMeta);

      expect(fluentSql).toBe(decoratorSql);
    });
  });
});
