import 'reflect-metadata';

import { createMetadataRegistry } from '@ts-linq/metadata';
import type { SkipNavigationMetadata } from '@ts-linq/types';

import { ChangeTracker } from '../src/ChangeTracker';

// Synthetic join entity class
class PostTag {}

class Post {
  id!: number;
  tags: Tag[] = [];
}

class Tag {
  id!: number;
  posts: Post[] = [];
}

function buildRegistry() {
  const registry = createMetadataRegistry();

  // Register Post
  registry.addEntity(Post, 'posts');
  registry.setFluentPrimaryKeys(Post, ['id']);
  registry.mergeFluentColumn(Post, {
    propertyName: 'id',
    columnName: 'id',
    type: 'int',
    nullable: false
  });

  // Register Tag
  registry.addEntity(Tag, 'tags');
  registry.setFluentPrimaryKeys(Tag, ['id']);
  registry.mergeFluentColumn(Tag, {
    propertyName: 'id',
    columnName: 'id',
    type: 'int',
    nullable: false
  });

  // Register synthetic join entity
  registry.addEntity(PostTag, 'PostTag');
  registry.setFluentPrimaryKeys(PostTag, ['postId', 'tagId']);
  registry.mergeFluentColumn(PostTag, {
    propertyName: 'postId',
    columnName: 'postId',
    type: 'int',
    nullable: false
  });
  registry.mergeFluentColumn(PostTag, {
    propertyName: 'tagId',
    columnName: 'tagId',
    type: 'int',
    nullable: false
  });

  // Register skip navigation on Post
  const sn: SkipNavigationMetadata = {
    propertyName: 'tags',
    targetEntity: Tag,
    joinTableName: 'PostTag',
    joinEntityCtor: PostTag,
    leftForeignKey: 'postId',
    rightForeignKey: 'tagId',
    inverseSide: 'posts',
    isSynthesized: true
  };
  registry.mergeFluentSkipNavigation(Post, sn);

  return registry;
}

describe('ChangeTracker — skip navigation changes', () => {
  it('returns empty array when no tracked entities have skip nav changes', () => {
    const registry = buildRegistry();
    const tracker = new ChangeTracker(registry);

    const post = { id: 1, tags: [] as Tag[] };
    tracker.attach(post, Post);

    const changes = tracker.collectSkipNavigationChanges();
    expect(changes).toHaveLength(0);
  });

  it('detects newly added items in collection', () => {
    const registry = buildRegistry();
    const tracker = new ChangeTracker(registry);

    const post = { id: 1, tags: [] as Tag[] };
    tracker.attach(post, Post);

    // Add a tag after attaching
    const tag = { id: 10, posts: [] as Post[] };
    post.tags.push(tag);

    const changes = tracker.collectSkipNavigationChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].operation).toBe('insert');
    expect(changes[0].joinRow).toEqual({ postId: 1, tagId: 10 });
    expect(changes[0].joinEntityCtor).toBe(PostTag);
  });

  it('detects removed items from collection', () => {
    const registry = buildRegistry();
    const tracker = new ChangeTracker(registry);

    const tag = { id: 10, posts: [] as Post[] };
    const post = { id: 1, tags: [tag] };
    tracker.attach(post, Post);

    // Remove the tag
    post.tags.splice(0, 1);

    const changes = tracker.collectSkipNavigationChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0].operation).toBe('delete');
    expect(changes[0].joinRow).toEqual({ postId: 1, tagId: 10 });
  });

  it('detects both added and removed items', () => {
    const registry = buildRegistry();
    const tracker = new ChangeTracker(registry);

    const tag1 = { id: 10, posts: [] as Post[] };
    const tag2 = { id: 20, posts: [] as Post[] };
    const post = { id: 1, tags: [tag1] };
    tracker.attach(post, Post);

    // Remove tag1, add tag2
    post.tags.splice(0, 1, tag2);

    const changes = tracker.collectSkipNavigationChanges();
    const inserts = changes.filter((c) => c.operation === 'insert');
    const deletes = changes.filter((c) => c.operation === 'delete');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].joinRow).toEqual({ postId: 1, tagId: 20 });
    expect(deletes).toHaveLength(1);
    expect(deletes[0].joinRow).toEqual({ postId: 1, tagId: 10 });
  });

  it('resets snapshot after acceptAllChanges', () => {
    const registry = buildRegistry();
    const tracker = new ChangeTracker(registry);

    const tag = { id: 10, posts: [] as Post[] };
    const post = { id: 1, tags: [] as Tag[] };
    tracker.attach(post, Post);

    post.tags.push(tag);
    const beforeAccept = tracker.collectSkipNavigationChanges();
    expect(beforeAccept).toHaveLength(1);

    tracker.acceptAllChanges();

    // After accept, snapshot should be updated — no changes
    const afterAccept = tracker.collectSkipNavigationChanges();
    expect(afterAccept).toHaveLength(0);
  });

  it('skips deleted entities', () => {
    const registry = buildRegistry();
    const tracker = new ChangeTracker(registry);

    const tag = { id: 10, posts: [] as Post[] };
    const post = { id: 1, tags: [] as Tag[] };
    tracker.attach(post, Post);
    post.tags.push(tag);

    // Mark post as deleted
    tracker.remove(post, Post);

    const changes = tracker.collectSkipNavigationChanges();
    expect(changes).toHaveLength(0);
  });
});
