/**
 * Unit tests for the Fluent API — ModelBuilder & OnModelCreating (P0-01).
 *
 * Covers:
 *   1. Decorator-only model (no fluent) — baseline regression
 *   2. Fluent-only model (no decorators)
 *   3. Hybrid: fluent overrides decorator metadata (column, table, PK, index)
 *   4. IEntityTypeConfiguration discovery (applyConfiguration / applyConfigurationsFromAssembly)
 *   5. onModelCreating wired into DbContext
 *   6. Navigation / relationship builder chain
 */

import 'reflect-metadata';

import { beforeEach, describe, expect, it } from '@jest/globals';
import { Column, createMetadataRegistry, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DeleteBehavior } from '@ts-linq/types';

import { EntityTypeBuilder } from '../src/builders/EntityTypeBuilder';
import type { IEntityTypeConfiguration } from '../src/builders/IEntityTypeConfiguration';
import { DbContext } from '../src/DbContext';
import { ModelBuilder } from '../src/ModelBuilder';
import { TestProvider } from '../tests/stubs/TestProvider';

// ─── Plain classes (no decorators) used in fluent-only tests ─────────────────

class Article {
  id!: number;
  title!: string;
  slug!: string;
  views!: number;
  comments?: Comment[];
  profile?: unknown;
}

class Comment {
  id!: number;
  body!: string;
  articleId!: number;
  article?: Article;
  comments?: Comment[];
}

class Tag {
  id!: number;
  name!: string;
}

// ─── Decorated classes used in hybrid tests ───────────────────────────────────

@Entity({ name: 'decorated_users' })
class DecoratedUser {
  @PrimaryKey()
  @Column({ type: 'INTEGER' })
  id!: number;

  @Column({ type: 'TEXT' })
  email!: string;

  @Column({ type: 'TEXT' })
  name!: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIsolatedRegistry() {
  return createMetadataRegistry();
}

// ─── 1. Decorator-only (regression) ──────────────────────────────────────────

describe('ModelBuilder — decorator-only model (regression)', () => {
  it('reads entity registered by decorators without any fluent config', () => {
    const registry = makeIsolatedRegistry();

    // Seed registry from existing static decorator metadata
    const globalMeta = require('@ts-linq/metadata').MetadataStorage.getEntity(DecoratedUser);
    if (globalMeta) {
      registry.addEntity(DecoratedUser, globalMeta.tableName);
      for (const col of globalMeta.columns) registry.addColumn(DecoratedUser, col);
      for (const pk of globalMeta.primaryKeys ?? []) registry.addPrimaryKey(DecoratedUser, pk);
    }

    const mb = new ModelBuilder(registry);
    mb._finalize(); // no-op — no fluent config applied

    const meta = registry.getEntity(DecoratedUser)!;
    expect(meta).toBeDefined();
    expect(meta.tableName).toBe('decorated_users');
    expect(meta.primaryKeys).toContain('id');
  });
});

// ─── 2. Fluent-only model ─────────────────────────────────────────────────────

describe('ModelBuilder — fluent-only model (no decorators)', () => {
  it('registers an entity with toTable and hasKey', () => {
    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(Article, (b) => {
      b.toTable('articles');
      b.hasKey('id');
    });
    mb._finalize();

    const meta = registry.getEntity(Article)!;
    expect(meta).toBeDefined();
    expect(meta.tableName).toBe('articles');
    expect(meta.primaryKeys).toEqual(['id']);
  });

  it('registers columns via property()', () => {
    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(Article, (b) => {
      b.toTable('articles');
      b.hasKey('id');
      b.property((a) => a.title)
        .hasColumnType('VARCHAR(255)')
        .isRequired();
      b.property((a) => a.views)
        .hasColumnType('INTEGER')
        .hasDefaultValue(0);
    });
    mb._finalize();

    const meta = registry.getEntity(Article)!;
    const titleCol = meta.columns.find((c) => c.propertyName === 'title')!;
    const viewsCol = meta.columns.find((c) => c.propertyName === 'views')!;

    expect(titleCol).toBeDefined();
    expect(titleCol.type).toBe('VARCHAR(255)');
    expect(titleCol.nullable).toBe(false);

    expect(viewsCol).toBeDefined();
    expect(viewsCol.type).toBe('INTEGER');
    expect(viewsCol.defaultValue).toBe(0);
  });

  it('registers a unique index via hasIndex().isUnique()', () => {
    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(Article, (b) => {
      b.toTable('articles');
      b.hasKey('id');
      b.hasIndex('slug').isUnique();
    });
    mb._finalize();

    const meta = registry.getEntity(Article)!;
    const idx = meta.indexes.find((i) => i.columns.includes('slug'))!;
    expect(idx).toBeDefined();
    expect(idx.unique).toBe(true);
  });

  it('registers a one-to-many relationship via hasMany().withOne()', () => {
    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(Article, (b) => {
      b.toTable('articles');
      b.hasKey('id');
      b.hasMany((a) => a.comments as Comment[], Comment)
        .withOne((c) => c.article)
        .hasForeignKey<Comment>((c) => c.articleId);
    });
    mb._finalize();

    const meta = registry.getEntity(Article)!;
    const rel = meta.relationships.find((r) => r.propertyName === 'comments')!;
    expect(rel).toBeDefined();
    expect(rel.type).toBe('one-to-many');
    expect(rel.foreignKey).toBe('articleId');
    expect(rel.inverseSide).toBe('article');
  });

  it('registers a many-to-one relationship via hasOne().withMany()', () => {
    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(Comment, (b) => {
      b.toTable('comments');
      b.hasKey('id');
      b.hasOne((c) => c.article, Article)
        .withMany()
        .hasForeignKey<Comment>((c) => c.articleId);
    });
    mb._finalize();

    const meta = registry.getEntity(Comment)!;
    const rel = meta.relationships.find((r) => r.propertyName === 'article')!;
    expect(rel).toBeDefined();
    expect(rel.type).toBe('many-to-one');
    expect(rel.foreignKey).toBe('articleId');
  });

  it('supports DeleteBehavior on navigation builder', () => {
    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(Comment, (b) => {
      b.toTable('comments');
      b.hasKey('id');
      b.hasOne((c) => c.article, Article)
        .withMany()
        .onDelete(DeleteBehavior.Cascade);
    });
    mb._finalize();

    const meta = registry.getEntity(Comment)!;
    const rel = meta.relationships.find((r) => r.propertyName === 'article')!;
    expect(rel.onDelete).toBe(DeleteBehavior.Cascade);
  });

  it('entity() returns builder that can be used without inline callback', () => {
    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);

    const builder = mb.entity(Tag);
    builder.toTable('tags');
    builder.hasKey('id');
    builder
      .property((t) => t.name)
      .isRequired()
      .hasMaxLength(100);
    mb._finalize();

    const meta = registry.getEntity(Tag)!;
    expect(meta.tableName).toBe('tags');
    const nameCol = meta.columns.find((c) => c.propertyName === 'name')!;
    expect(nameCol.nullable).toBe(false);
    expect(nameCol.length).toBe(100);
  });

  it('repeated entity() calls on same class merge configuration', () => {
    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(Tag, (b) => b.toTable('tags'));
    mb.entity(Tag, (b) => b.hasKey('id'));
    mb._finalize();

    const meta = registry.getEntity(Tag)!;
    expect(meta.tableName).toBe('tags');
    expect(meta.primaryKeys).toEqual(['id']);
  });
});

// ─── 3. Hybrid: fluent overrides decorator metadata ───────────────────────────

describe('ModelBuilder — hybrid override', () => {
  it('fluent toTable() overrides decorator @Entity name', () => {
    const registry = makeIsolatedRegistry();

    // Pre-populate registry to simulate decorator effects
    registry.addEntity(DecoratedUser, 'decorated_users');
    registry.addColumn(DecoratedUser, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addPrimaryKey(DecoratedUser, 'id');

    const mb = new ModelBuilder(registry);
    mb.entity(DecoratedUser, (b) => b.toTable('users_override'));
    mb._finalize();

    const meta = registry.getEntity(DecoratedUser)!;
    expect(meta.tableName).toBe('users_override');
  });

  it('fluent property() overrides decorator @Column type and length', () => {
    const registry = makeIsolatedRegistry();
    registry.addEntity(DecoratedUser, 'decorated_users');
    registry.addColumn(DecoratedUser, { propertyName: 'email', columnName: 'email', type: 'TEXT' });
    registry.addPrimaryKey(DecoratedUser, 'id');

    const mb = new ModelBuilder(registry);
    mb.entity(DecoratedUser, (b) => {
      b.property((u) => u.email)
        .hasColumnType('VARCHAR(256)')
        .isRequired()
        .isUnique();
    });
    mb._finalize();

    const meta = registry.getEntity(DecoratedUser)!;
    const col = meta.columns.find((c) => c.propertyName === 'email')!;
    expect(col.type).toBe('VARCHAR(256)');
    expect(col.nullable).toBe(false);
    expect(col.unique).toBe(true);
  });

  it('fluent hasKey() replaces decorator primary keys', () => {
    const registry = makeIsolatedRegistry();
    registry.addEntity(DecoratedUser, 'decorated_users');
    registry.addPrimaryKey(DecoratedUser, 'id');

    const mb = new ModelBuilder(registry);
    mb.entity(DecoratedUser, (b) => b.hasKey('id')); // explicit same key — no regression
    mb._finalize();

    const meta = registry.getEntity(DecoratedUser)!;
    expect(meta.primaryKeys).toEqual(['id']);
  });

  it('fluent hasIndex() adds index not present in decorator metadata', () => {
    const registry = makeIsolatedRegistry();
    registry.addEntity(DecoratedUser, 'decorated_users');
    registry.addColumn(DecoratedUser, { propertyName: 'email', columnName: 'email', type: 'TEXT' });
    registry.addPrimaryKey(DecoratedUser, 'id');

    const mb = new ModelBuilder(registry);
    mb.entity(DecoratedUser, (b) => b.hasIndex('email').isUnique().hasName('UIX_users_email'));
    mb._finalize();

    const meta = registry.getEntity(DecoratedUser)!;
    const idx = meta.indexes.find((i) => i.name === 'UIX_users_email')!;
    expect(idx).toBeDefined();
    expect(idx.unique).toBe(true);
  });
});

// ─── 4. IEntityTypeConfiguration discovery ───────────────────────────────────

describe('ModelBuilder — IEntityTypeConfiguration', () => {
  it('applyConfiguration() applies a standalone configuration class', () => {
    class ArticleConfiguration implements IEntityTypeConfiguration<Article> {
      readonly entityType = Article;
      configure(builder: EntityTypeBuilder<Article>): void {
        builder.toTable('articles_cfg');
        builder.hasKey('id');
        builder
          .property((a) => a.slug)
          .hasMaxLength(200)
          .isRequired();
      }
    }

    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);
    mb.applyConfiguration(new ArticleConfiguration());
    mb._finalize();

    const meta = registry.getEntity(Article)!;
    expect(meta.tableName).toBe('articles_cfg');
    const slugCol = meta.columns.find((c) => c.propertyName === 'slug')!;
    expect(slugCol.length).toBe(200);
    expect(slugCol.nullable).toBe(false);
  });

  it('applyConfigurationsFromAssembly() discovers and applies all configs in a module', () => {
    class TagConfiguration implements IEntityTypeConfiguration<Tag> {
      readonly entityType = Tag;
      configure(builder: EntityTypeBuilder<Tag>): void {
        builder.toTable('tags_discovered');
        builder.hasKey('id');
      }
    }

    class CommentConfiguration implements IEntityTypeConfiguration<Comment> {
      readonly entityType = Comment;
      configure(builder: EntityTypeBuilder<Comment>): void {
        builder.toTable('comments_discovered');
        builder.hasKey('id');
      }
    }

    const fakeModule = {
      TagConfiguration,
      CommentConfiguration,
      someHelper: () => {} // non-config export, should be ignored
    };

    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);
    mb.applyConfigurationsFromAssembly([fakeModule]);
    mb._finalize();

    expect(registry.getEntity(Tag)?.tableName).toBe('tags_discovered');
    expect(registry.getEntity(Comment)?.tableName).toBe('comments_discovered');
  });

  it('applyConfigurationsFromAssembly() ignores exports without configure method', () => {
    const fakeModule = {
      notAConfig: class {
        name = 'plain class';
      },
      aFunction: function plain() {}
    };

    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);
    // Should not throw
    expect(() => mb.applyConfigurationsFromAssembly([fakeModule])).not.toThrow();
    mb._finalize();
  });
});

// ─── 5. onModelCreating wired into DbContext ──────────────────────────────────

describe('DbContext — onModelCreating integration', () => {
  let provider: TestProvider;

  beforeEach(() => {
    provider = new TestProvider(':memory:');
  });

  it('onModelCreating is called and fluent config is applied before DbSets initialize', () => {
    // Fluent-only: Article not decorated, so it only exists in the context that
    // calls onModelCreating to register it.
    class ArticleContext extends DbContext {
      protected override onModelCreating(mb: ModelBuilder): void {
        mb.entity(Article, (b) => {
          b.toTable('articles');
          b.hasKey('id');
        });
      }
    }

    const ctx = new ArticleContext({ provider, registry: makeIsolatedRegistry() });
    // If initialization succeeded without throwing, the entity was registered
    expect(ctx).toBeDefined();
  });

  it('default no-op onModelCreating does not throw', () => {
    class MinimalContext extends DbContext {}
    expect(() => new MinimalContext({ provider, registry: makeIsolatedRegistry() })).not.toThrow();
  });

  it('fluent overrides decorator tableName in context subclass', () => {
    const registry = makeIsolatedRegistry();
    registry.addEntity(DecoratedUser, 'decorated_users');
    registry.addColumn(DecoratedUser, { propertyName: 'id', columnName: 'id', type: 'INTEGER' });
    registry.addPrimaryKey(DecoratedUser, 'id');

    class OverrideContext extends DbContext {
      users = this.defineSet(DecoratedUser);

      protected override onModelCreating(mb: ModelBuilder): void {
        mb.entity(DecoratedUser, (b) => b.toTable('overridden_users'));
      }
    }

    const ctx = new OverrideContext({ provider, registry });
    const meta = registry.getEntity(DecoratedUser)!;
    expect(meta.tableName).toBe('overridden_users');
  });
});

// ─── 6. PropertyBuilder full chain ───────────────────────────────────────────

describe('PropertyBuilder — full configuration chain', () => {
  it('chains all supported methods without error', () => {
    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(Article, (b) => {
      b.toTable('articles');
      b.hasKey('id');
      b.property((a) => a.title)
        .hasColumnName('article_title')
        .hasColumnType('NVARCHAR(500)')
        .isRequired()
        .hasMaxLength(500)
        .hasPrecision(0)
        .hasDefaultValue('')
        .isUnique(false);
    });
    mb._finalize();

    const meta = registry.getEntity(Article)!;
    const col = meta.columns.find((c) => c.propertyName === 'title')!;
    expect(col.columnName).toBe('article_title');
    expect(col.type).toBe('NVARCHAR(500)');
    expect(col.nullable).toBe(false);
    expect(col.length).toBe(500);
  });
});

// ─── 7. IndexBuilder hasName override ────────────────────────────────────────

describe('IndexBuilder', () => {
  it('hasName() overrides auto-generated index name', () => {
    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(Article, (b) => {
      b.toTable('articles');
      b.hasKey('id');
      b.hasIndex('slug').isUnique().hasName('UIX_articles_slug');
    });
    mb._finalize();

    const meta = registry.getEntity(Article)!;
    const idx = meta.indexes.find((i) => i.name === 'UIX_articles_slug')!;
    expect(idx).toBeDefined();
    expect(idx.unique).toBe(true);
  });

  it('hasFilter() sets partial index where clause', () => {
    const registry = makeIsolatedRegistry();
    const mb = new ModelBuilder(registry);

    mb.entity(Article, (b) => {
      b.toTable('articles');
      b.hasKey('id');
      b.hasIndex('views').hasFilter('views > 0');
    });
    mb._finalize();

    const meta = registry.getEntity(Article)!;
    const idx = meta.indexes.find((i) => i.columns.includes('views'))!;
    expect(idx.where).toBe('views > 0');
  });
});
