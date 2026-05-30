/**
 * Integration test: Many-to-Many skip navigations (P0-08).
 *
 * Exercises:
 *   1. EntityTypeBuilder fluent API: hasMany().withMany() → CollectionCollectionBuilder
 *   2. ModelBuilder._finalize() correctly wires skip nav + join entity metadata
 *   3. ChangeTracker.collectSkipNavigationChanges() detects add/remove
 *   4. ModelSnapshotBuilder emits join table DDL
 *
 * No database connection required — uses in-process metadata + ChangeTracker.
 */
import 'reflect-metadata';

import { createMetadataRegistry } from '@ts-linq/metadata';
import { MetadataStorage } from '@ts-linq/metadata';

import { ModelSnapshotBuilder } from '../../../migrations/src/snapshot/model-snapshot';
import { EntityTypeBuilder } from '../../../orm/src/builders/EntityTypeBuilder';
import { ChangeTracker } from '../../../orm/src/ChangeTracker';

// ── Domain ──────────────────────────────────────────────────────────────────

class Post {
  id!: number;
  title!: string;
  tags: Tag[] = [];
}

class Tag {
  id!: number;
  name!: string;
  posts: Post[] = [];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildRegistry() {
  const registry = createMetadataRegistry();
  registry.addEntity(Post, 'posts');
  registry.setFluentPrimaryKeys(Post, ['id']);
  registry.mergeFluentColumn(Post, {
    propertyName: 'id',
    columnName: 'id',
    type: 'int',
    nullable: false
  });
  registry.mergeFluentColumn(Post, {
    propertyName: 'title',
    columnName: 'title',
    type: 'varchar',
    nullable: false
  });

  registry.addEntity(Tag, 'tags');
  registry.setFluentPrimaryKeys(Tag, ['id']);
  registry.mergeFluentColumn(Tag, {
    propertyName: 'id',
    columnName: 'id',
    type: 'int',
    nullable: false
  });
  registry.mergeFluentColumn(Tag, {
    propertyName: 'name',
    columnName: 'name',
    type: 'varchar',
    nullable: false
  });

  // Fluent many-to-many configuration
  const postBuilder = new EntityTypeBuilder(Post);
  postBuilder.toTable('posts').hasKey('id');
  postBuilder.hasMany((p) => p.tags, Tag).withMany((t) => t.posts);
  postBuilder._applyToRegistry(registry);

  return registry;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Skip Navigations (P0-08) — integration', () => {
  describe('Metadata wiring', () => {
    it('registers SkipNavigationMetadata on Post', () => {
      const registry = buildRegistry();

      const postMeta = registry.getEntity(Post);
      expect(postMeta?.skipNavigations).toHaveLength(1);
      const sn = postMeta!.skipNavigations![0];
      expect(sn.propertyName).toBe('tags');
      expect(sn.joinTableName).toBe('PostTag');
      expect(sn.leftForeignKey).toBe('postId');
      expect(sn.rightForeignKey).toBe('tagId');
      expect(sn.isSynthesized).toBe(true);
    });

    it('registers inverse SkipNavigationMetadata on Tag', () => {
      const registry = buildRegistry();

      const tagMeta = registry.getEntity(Tag);
      expect(tagMeta?.skipNavigations).toHaveLength(1);
      const sn = tagMeta!.skipNavigations![0];
      expect(sn.propertyName).toBe('posts');
      expect(sn.targetEntity).toBe(Post);
    });

    it('registers synthetic join entity in registry', () => {
      const registry = buildRegistry();

      const postMeta = registry.getEntity(Post);
      const joinCtor = postMeta!.skipNavigations![0].joinEntityCtor;
      const joinMeta = registry.getEntity(joinCtor);

      expect(joinMeta).toBeDefined();
      expect(joinMeta!.tableName).toBe('PostTag');
      expect(joinMeta!.primaryKeys).toEqual(expect.arrayContaining(['postId', 'tagId']));
    });

    it('registers many-to-many relationship for include() support', () => {
      const registry = buildRegistry();

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
  });

  describe('ChangeTracker skip navigation diffing', () => {
    it('detects add to collection → insert join row', () => {
      const registry = buildRegistry();
      const tracker = new ChangeTracker(registry);

      const post: Post = { id: 1, title: 'Hello', tags: [] };
      tracker.attach(post, Post);

      const tag: Tag = { id: 42, name: 'TypeScript', posts: [] };
      post.tags.push(tag);

      const changes = tracker.collectSkipNavigationChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].operation).toBe('insert');
      expect(changes[0].joinRow).toEqual({ postId: 1, tagId: 42 });
    });

    it('detects remove from collection → delete join row', () => {
      const registry = buildRegistry();
      const tracker = new ChangeTracker(registry);

      const tag: Tag = { id: 42, name: 'TypeScript', posts: [] };
      const post: Post = { id: 1, title: 'Hello', tags: [tag] };
      tracker.attach(post, Post);

      post.tags.splice(0, 1);

      const changes = tracker.collectSkipNavigationChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].operation).toBe('delete');
      expect(changes[0].joinRow).toEqual({ postId: 1, tagId: 42 });
    });

    it('handles multiple adds and removes in same collection', () => {
      const registry = buildRegistry();
      const tracker = new ChangeTracker(registry);

      const tag1: Tag = { id: 1, name: 'A', posts: [] };
      const tag2: Tag = { id: 2, name: 'B', posts: [] };
      const tag3: Tag = { id: 3, name: 'C', posts: [] };
      const post: Post = { id: 1, title: 'Hello', tags: [tag1, tag2] };
      tracker.attach(post, Post);

      // Remove tag1, add tag3
      post.tags = [tag2, tag3];

      const changes = tracker.collectSkipNavigationChanges();
      expect(changes.filter((c) => c.operation === 'insert')).toHaveLength(1);
      expect(changes.filter((c) => c.operation === 'delete')).toHaveLength(1);
      expect(changes.find((c) => c.operation === 'insert')!.joinRow.tagId).toBe(3);
      expect(changes.find((c) => c.operation === 'delete')!.joinRow.tagId).toBe(1);
    });
  });

  describe('Migration snapshot — join table DDL', () => {
    beforeEach(() => MetadataStorage.reset());
    afterEach(() => MetadataStorage.reset());

    it('emits PostTag join table in snapshot', () => {
      // Register entities in the default MetadataStorage for snapshot builder
      MetadataStorage.addEntity(Post, 'posts');
      MetadataStorage.addPrimaryKey(Post, 'id');
      MetadataStorage.addColumn(Post, {
        propertyName: 'id',
        columnName: 'id',
        type: 'int',
        nullable: false
      });

      MetadataStorage.addEntity(Tag, 'tags');
      MetadataStorage.addPrimaryKey(Tag, 'id');
      MetadataStorage.addColumn(Tag, {
        propertyName: 'id',
        columnName: 'id',
        type: 'int',
        nullable: false
      });

      // Get the skip nav metadata from our test registry
      const registry = buildRegistry();
      const postMeta = registry.getEntity(Post)!;
      const sn = postMeta.skipNavigations![0];

      // Register it in MetadataStorage (global) so snapshot builder picks it up
      MetadataStorage.mergeFluentSkipNavigation(Post, sn);

      const builder = new ModelSnapshotBuilder();
      const snapshot = builder.buildFromMetadata();

      const joinTable = snapshot.tables.find((t) => t.name === 'PostTag');
      expect(joinTable).toBeDefined();
      expect(joinTable!.primaryKeys).toEqual(expect.arrayContaining(['postId', 'tagId']));
      expect(joinTable!.columns.every((c) => !c.nullable)).toBe(true);
    });
  });
});
