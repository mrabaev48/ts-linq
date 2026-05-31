import { createMetadataRegistry } from '@ts-linq/metadata';
import { Column, Entity, PrimaryKey } from '@ts-linq/metadata';
import { DeleteBehavior } from '@ts-linq/types';

import { EntityTypeBuilder } from '../src/builders/EntityTypeBuilder';
import type { IEntityTypeConfiguration } from '../src/builders/IEntityTypeConfiguration';
import { ModelBuilder } from '../src/ModelBuilder';

// ── Test entity classes ──────────────────────────────────────────────────────

class Comment {
  id!: number;
  body!: string;
  postId!: number;
}

class Tag {
  id!: number;
  name!: string;
}

class Article {
  id!: number;
  title!: string;
  content!: string;
  comments?: Comment[];
  profile?: unknown;
}

@Entity({ name: 'decorated_users' })
class DecoratedUser {
  @PrimaryKey()
  id!: number;

  @Column({ type: 'TEXT', nullable: false })
  email!: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBuilder() {
  const registry = createMetadataRegistry();
  const mb = new ModelBuilder(registry);
  return { registry, mb };
}

// ── Unit tests ───────────────────────────────────────────────────────────────

describe('ModelBuilder', () => {
  describe('entity()', () => {
    it('registers an entity and sets table name', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => b.toTable('articles'));
      mb._finalize();
      const meta = registry.getEntity(Article);
      expect(meta?.tableName).toBe('articles');
    });

    it('multiple entity() calls for same class are merged', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => b.toTable('articles'));
      mb.entity(Article, (b) => b.hasKey('id'));
      mb._finalize();
      const meta = registry.getEntity(Article);
      expect(meta?.tableName).toBe('articles');
      expect(meta?.primaryKeys).toEqual(['id']);
    });
  });

  describe('property() — PropertyBuilder', () => {
    it('configures column name and max length', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => {
        b.property((a) => a.title)
          .hasColumnName('article_title')
          .hasMaxLength(200);
      });
      mb._finalize();
      const col = registry.getEntity(Article)?.columns.find((c) => c.propertyName === 'title');
      expect(col?.columnName).toBe('article_title');
      expect(col?.length).toBe(200);
    });

    it('isRequired sets nullable = false', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => {
        b.property((a) => a.title).isRequired();
      });
      mb._finalize();
      const col = registry.getEntity(Article)?.columns.find((c) => c.propertyName === 'title');
      expect(col?.nullable).toBe(false);
    });

    it('hasDefaultValue stores default', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => {
        b.property((a) => a.content).hasDefaultValue('');
      });
      mb._finalize();
      const col = registry.getEntity(Article)?.columns.find((c) => c.propertyName === 'content');
      expect(col?.defaultValue).toBe('');
    });

    it('hasDefaultValueSql stores expression', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => {
        b.property((a) => a.content).hasDefaultValueSql('now()');
      });
      mb._finalize();
      const col = registry.getEntity(Article)?.columns.find((c) => c.propertyName === 'content');
      expect(col?.defaultExpression).toBe('now()');
    });
  });

  describe('hasKey()', () => {
    it('sets primary keys', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => b.hasKey('id'));
      mb._finalize();
      expect(registry.getEntity(Article)?.primaryKeys).toEqual(['id']);
    });

    it('sets composite primary keys', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => b.hasKey('id', 'title'));
      mb._finalize();
      expect(registry.getEntity(Article)?.primaryKeys).toEqual(['id', 'title']);
    });
  });

  describe('hasIndex()', () => {
    it('registers an index with isUnique', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => {
        b.toTable('articles');
        b.property((a) => a.title)
          .hasColumnName('title')
          .hasColumnType('TEXT');
        b.hasIndex('title').isUnique();
      });
      mb._finalize();
      const meta = registry.getEntity(Article);
      const idx = meta?.indexes.find((i) => i.columns.includes('title'));
      expect(idx).toBeDefined();
      expect(idx?.unique).toBe(true);
    });
  });

  describe('hasOne() / hasMany() navigation builders', () => {
    it('hasOne().withOne() registers one-to-one relationship', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => {
        b.hasOne((a) => a.profile).withOne();
      });
      mb._finalize();
      const rel = registry
        .getEntity(Article)
        ?.relationships.find((r) => r.propertyName === 'profile');
      expect(rel?.type).toBe('one-to-one');
    });

    it('hasOne().withMany() registers many-to-one relationship', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => {
        b.hasOne((a) => a.profile).withMany();
      });
      mb._finalize();
      const rel = registry
        .getEntity(Article)
        ?.relationships.find((r) => r.propertyName === 'profile');
      expect(rel?.type).toBe('many-to-one');
    });

    it('hasMany().withOne() registers one-to-many relationship', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => {
        b.hasMany((a) => a.comments as Comment[], Comment).withOne();
      });
      mb._finalize();
      const rel = registry
        .getEntity(Article)
        ?.relationships.find((r) => r.propertyName === 'comments');
      expect(rel?.type).toBe('one-to-many');
      expect(rel?.targetEntity).toBe(Comment);
    });

    it('hasForeignKey sets foreignKey on relationship', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => {
        b.hasMany((a) => a.comments as Comment[], Comment)
          .withOne()
          .hasForeignKey((c: Comment) => c.postId);
      });
      mb._finalize();
      const rel = registry
        .getEntity(Article)
        ?.relationships.find((r) => r.propertyName === 'comments');
      expect(rel?.foreignKey).toBe('postId');
    });

    it('onDelete sets DeleteBehavior', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => {
        b.hasMany((a) => a.comments as Comment[], Comment)
          .withOne()
          .onDelete(DeleteBehavior.Cascade);
      });
      mb._finalize();
      const rel = registry
        .getEntity(Article)
        ?.relationships.find((r) => r.propertyName === 'comments');
      expect(rel?.onDelete).toBe(DeleteBehavior.Cascade);
    });
  });

  describe('toTable() with schema', () => {
    it('stores schema separately', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Article, (b) => b.toTable('articles', 'dbo'));
      mb._finalize();
      const meta = registry.getEntity(Article);
      expect(meta?.tableName).toBe('articles');
      expect(meta?.schema).toBe('dbo');
    });
  });

  describe('fluent-only model (no decorators)', () => {
    it('creates entity entirely from fluent config', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Tag, (b) => {
        b.toTable('tags');
        b.hasKey('id');
        b.property((t) => t.name)
          .hasMaxLength(100)
          .isRequired();
      });
      mb._finalize();
      const meta = registry.getEntity(Tag);
      expect(meta?.tableName).toBe('tags');
      expect(meta?.primaryKeys).toEqual(['id']);
      const col = meta?.columns.find((c) => c.propertyName === 'name');
      expect(col?.length).toBe(100);
      expect(col?.nullable).toBe(false);
    });
  });

  describe('hybrid override (decorator + fluent)', () => {
    it('fluent table name overrides decorator', () => {
      const { registry, mb } = makeBuilder();
      // Seed decorator metadata into this isolated registry
      registry.addEntity(DecoratedUser, 'decorated_users');
      registry.addColumn(DecoratedUser, {
        propertyName: 'email',
        columnName: 'email',
        type: 'TEXT',
        nullable: false
      });
      registry.addPrimaryKey(DecoratedUser, 'id');

      mb.entity(DecoratedUser, (b) => b.toTable('users_override'));
      mb._finalize();

      const meta = registry.getEntity(DecoratedUser);
      expect(meta?.tableName).toBe('users_override');
      expect(meta?.primaryKeys).toContain('id');
    });

    it('fluent hasKey overrides decorator primary key', () => {
      const { registry, mb } = makeBuilder();
      registry.addEntity(DecoratedUser, 'decorated_users');
      registry.addPrimaryKey(DecoratedUser, 'id');

      mb.entity(DecoratedUser, (b) => b.hasKey('id', 'email'));
      mb._finalize();

      const meta = registry.getEntity(DecoratedUser);
      expect(meta?.primaryKeys).toEqual(['id', 'email']);
    });
  });

  describe('applyConfiguration()', () => {
    it('applies IEntityTypeConfiguration', () => {
      class TagConfig implements IEntityTypeConfiguration<Tag> {
        readonly entityType = Tag;
        configure(builder: EntityTypeBuilder<Tag>): void {
          builder.toTable('tag_list');
        }
      }

      const { registry, mb } = makeBuilder();
      mb.applyConfiguration(new TagConfig());
      mb._finalize();

      expect(registry.getEntity(Tag)?.tableName).toBe('tag_list');
    });
  });

  describe('hasData()', () => {
    it('stores seed rows in registry after finalize', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Tag, (b) => {
        b.toTable('tags');
        b.hasKey('id');
        b.hasData({ id: 1, name: 'typescript' }, { id: 2, name: 'orm' });
      });
      mb._finalize();
      const meta = registry.getEntity(Tag);
      expect(meta?.seedData).toHaveLength(2);
      expect(meta?.seedData?.[0]).toMatchObject({ id: 1, name: 'typescript' });
    });

    it('supports fluent chaining on EntityTypeBuilder', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Tag, (b) => {
        // hasData returns `this` (EntityTypeBuilder), enabling chaining
        const result = b.toTable('tags').hasKey('id').hasData({ id: 1, name: 'a' });
        expect(result).toBe(b);
      });
      mb._finalize();
      expect(registry.getEntity(Tag)?.seedData).toHaveLength(1);
    });

    it('accumulates rows across multiple hasData() calls', () => {
      const { registry, mb } = makeBuilder();
      mb.entity(Tag, (b) => {
        b.toTable('tags');
        b.hasKey('id');
        b.hasData({ id: 1, name: 'a' });
        b.hasData({ id: 2, name: 'b' });
      });
      mb._finalize();
      const meta = registry.getEntity(Tag);
      expect(meta?.seedData).toHaveLength(2);
    });
  });

  describe('applyConfigurationsFromAssembly()', () => {
    it('discovers and applies configuration classes from module exports', () => {
      class CommentConfig implements IEntityTypeConfiguration<Comment> {
        readonly entityType = Comment;
        configure(builder: EntityTypeBuilder<Comment>): void {
          builder.toTable('comments_table');
          builder.hasKey('id');
        }
      }

      const { registry, mb } = makeBuilder();
      mb.applyConfigurationsFromAssembly([{ CommentConfig }]);
      mb._finalize();

      const meta = registry.getEntity(Comment);
      expect(meta?.tableName).toBe('comments_table');
      expect(meta?.primaryKeys).toEqual(['id']);
    });
  });
});
