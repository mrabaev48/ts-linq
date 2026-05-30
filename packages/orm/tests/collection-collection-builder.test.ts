import 'reflect-metadata';

import { createMetadataRegistry } from '@ts-linq/metadata';

import { CollectionCollectionBuilder } from '../src/builders/CollectionCollectionBuilder';
import { EntityTypeBuilder } from '../src/builders/EntityTypeBuilder';

class Post {
  id!: number;
  tags: Tag[] = [];
}

class Tag {
  id!: number;
  posts: Post[] = [];
}

class Article {
  id!: number;
  categories: Category[] = [];
}

class Category {
  id!: number;
  articles: Article[] = [];
}

describe('CollectionCollectionBuilder', () => {
  describe('_applyToRegistry', () => {
    it('registers skip navigation on the left entity', () => {
      const registry = createMetadataRegistry();
      registry.addEntity(Post, 'posts');
      registry.addEntity(Tag, 'tags');
      registry.setFluentPrimaryKeys(Post, ['id']);
      registry.setFluentPrimaryKeys(Tag, ['id']);

      const builder = new CollectionCollectionBuilder<Post, Tag>(Post, 'tags', Tag, 'posts', []);
      builder._applyToRegistry(registry, 'id', 'id');

      const postMeta = registry.getEntity(Post);
      expect(postMeta?.skipNavigations).toHaveLength(1);
      const sn = postMeta!.skipNavigations![0];
      expect(sn.propertyName).toBe('tags');
      expect(sn.targetEntity).toBe(Tag);
      expect(sn.joinTableName).toBe('PostTag');
      expect(sn.leftForeignKey).toBe('postId');
      expect(sn.rightForeignKey).toBe('tagId');
      expect(sn.inverseSide).toBe('posts');
      expect(sn.isSynthesized).toBe(true);
    });

    it('registers inverse skip navigation on the right entity', () => {
      const registry = createMetadataRegistry();
      registry.addEntity(Post, 'posts');
      registry.addEntity(Tag, 'tags');

      const builder = new CollectionCollectionBuilder<Post, Tag>(Post, 'tags', Tag, 'posts', []);
      builder._applyToRegistry(registry, 'id', 'id');

      const tagMeta = registry.getEntity(Tag);
      expect(tagMeta?.skipNavigations).toHaveLength(1);
      const sn = tagMeta!.skipNavigations![0];
      expect(sn.propertyName).toBe('posts');
      expect(sn.targetEntity).toBe(Post);
      expect(sn.leftForeignKey).toBe('tagId');
      expect(sn.rightForeignKey).toBe('postId');
    });

    it('registers many-to-many relationship with through for include() support', () => {
      const registry = createMetadataRegistry();
      registry.addEntity(Post, 'posts');
      registry.addEntity(Tag, 'tags');

      const builder = new CollectionCollectionBuilder<Post, Tag>(Post, 'tags', Tag, 'posts', []);
      builder._applyToRegistry(registry, 'id', 'id');

      const postMeta = registry.getEntity(Post);
      const rel = postMeta?.relationships.find(
        (r) => r.propertyName === 'tags' && r.type === 'many-to-many'
      );
      expect(rel).toBeDefined();
      const through = rel!.through as { table: string; sourceFk: string; targetFk: string };
      expect(through.table).toBe('PostTag');
      expect(through.sourceFk).toBe('postId');
      expect(through.targetFk).toBe('tagId');
    });

    it('registers synthetic join entity in registry', () => {
      const registry = createMetadataRegistry();
      registry.addEntity(Post, 'posts');
      registry.addEntity(Tag, 'tags');

      const builder = new CollectionCollectionBuilder<Post, Tag>(Post, 'tags', Tag, 'posts', []);
      builder._applyToRegistry(registry, 'id', 'id');

      const postMeta = registry.getEntity(Post);
      const joinEntityCtor = postMeta!.skipNavigations![0].joinEntityCtor;
      const joinMeta = registry.getEntity(joinEntityCtor);
      expect(joinMeta).toBeDefined();
      expect(joinMeta!.tableName).toBe('PostTag');
      expect(joinMeta!.primaryKeys).toEqual(expect.arrayContaining(['postId', 'tagId']));
    });

    it('does not register inverse when rightPropertyName is undefined', () => {
      const registry = createMetadataRegistry();
      registry.addEntity(Post, 'posts');
      registry.addEntity(Tag, 'tags');

      const builder = new CollectionCollectionBuilder<Post, Tag>(Post, 'tags', Tag, undefined, []);
      builder._applyToRegistry(registry, 'id', 'id');

      const tagMeta = registry.getEntity(Tag);
      expect(tagMeta?.skipNavigations ?? []).toHaveLength(0);
    });
  });

  describe('EntityTypeBuilder.hasMany().withMany()', () => {
    it('registers skip navigation via EntityTypeBuilder fluent API', () => {
      const registry = createMetadataRegistry();
      registry.addEntity(Post, 'posts');
      registry.addEntity(Tag, 'tags');
      registry.setFluentPrimaryKeys(Post, ['id']);

      const postBuilder = new EntityTypeBuilder(Post);
      postBuilder.toTable('posts').hasKey('id');
      postBuilder.hasMany((p) => p.tags, Tag).withMany((t) => t.posts);

      postBuilder._applyToRegistry(registry);

      const postMeta = registry.getEntity(Post);
      expect(postMeta?.skipNavigations).toHaveLength(1);
      expect(postMeta!.skipNavigations![0].joinTableName).toBe('PostTag');
    });

    it('removes the stub relationship after applying registry', () => {
      const registry = createMetadataRegistry();
      registry.addEntity(Post, 'posts');
      registry.addEntity(Tag, 'tags');

      const postBuilder = new EntityTypeBuilder(Post);
      postBuilder.hasMany((p) => p.tags, Tag).withMany((t) => t.posts);
      postBuilder._applyToRegistry(registry);

      const postMeta = registry.getEntity(Post);
      const rels = postMeta?.relationships.filter((r) => r.propertyName === 'tags') ?? [];
      // Should have exactly one relationship with proper `through`
      expect(rels).toHaveLength(1);
      expect((rels[0].through as { table: string }).table).toBe('PostTag');
    });
  });

  describe('withMany() without inverse selector', () => {
    it('supports withMany() without inverse selector', () => {
      const registry = createMetadataRegistry();
      registry.addEntity(Article, 'articles');
      registry.addEntity(Category, 'categories');

      const articleBuilder = new EntityTypeBuilder(Article);
      articleBuilder.hasMany((a) => a.categories, Category).withMany();
      articleBuilder._applyToRegistry(registry);

      const articleMeta = registry.getEntity(Article);
      expect(articleMeta?.skipNavigations).toHaveLength(1);
      expect(articleMeta!.skipNavigations![0].inverseSide).toBeUndefined();
    });
  });
});
