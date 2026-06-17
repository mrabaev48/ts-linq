import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';
import { createMetadataRegistry } from '@ts-linq/metadata';
import type { SkipNavigationMetadata, TrackedEntity } from '@ts-linq/types';
import { EntityState } from '@ts-linq/types';

import { SkipNavigationTracker } from '../../src/changetracker/SkipNavigationTracker';

class PostTag {}
class Post {
  id!: number;
  tags: Tag[] = [];
}
class Tag {
  id!: number;
}

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
  registry.addEntity(Tag, 'tags');
  registry.setFluentPrimaryKeys(Tag, ['id']);
  registry.mergeFluentColumn(Tag, {
    propertyName: 'id',
    columnName: 'id',
    type: 'int',
    nullable: false
  });
  registry.addEntity(PostTag, 'PostTag');
  registry.setFluentPrimaryKeys(PostTag, ['postId', 'tagId']);

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

function tracked(post: Post): TrackedEntity {
  return { entity: post, entityClass: Post, state: EntityState.Unchanged };
}

describe('SkipNavigationTracker', () => {
  it('reports no changes right after snapshotting', () => {
    const sn = new SkipNavigationTracker(buildRegistry());
    const post: Post = { id: 1, tags: [{ id: 10 }] };
    sn.snapshot(post, Post);

    expect(sn.collectChanges([tracked(post)])).toHaveLength(0);
  });

  it('detects an inserted join row', () => {
    const sn = new SkipNavigationTracker(buildRegistry());
    const post: Post = { id: 1, tags: [] };
    sn.snapshot(post, Post);
    post.tags.push({ id: 10 });

    const changes = sn.collectChanges([tracked(post)]);
    expect(changes).toEqual([
      { joinRow: { postId: 1, tagId: 10 }, joinEntityCtor: PostTag, operation: 'insert' }
    ]);
  });

  it('detects a removed join row', () => {
    const sn = new SkipNavigationTracker(buildRegistry());
    const post: Post = { id: 1, tags: [{ id: 10 }, { id: 20 }] };
    sn.snapshot(post, Post);
    post.tags = post.tags.filter((t) => t.id !== 20);

    const changes = sn.collectChanges([tracked(post)]);
    expect(changes).toEqual([
      { joinRow: { postId: 1, tagId: 20 }, joinEntityCtor: PostTag, operation: 'delete' }
    ]);
  });

  it('forgets a snapshot so the entity yields no diff', () => {
    const sn = new SkipNavigationTracker(buildRegistry());
    const post: Post = { id: 1, tags: [{ id: 10 }] };
    sn.snapshot(post, Post);
    sn.forget(post);
    post.tags.push({ id: 20 });

    // With no snapshot, the original set is empty → both current items look "inserted".
    const ops = sn.collectChanges([tracked(post)]).map((c) => c.operation);
    expect(ops).toEqual(['insert', 'insert']);
  });
});
