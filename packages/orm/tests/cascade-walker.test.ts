import 'reflect-metadata';

import { createMetadataRegistry } from '@ts-linq/metadata';
import type { EntityCtorRef } from '@ts-linq/types';
import type { TrackedEntity } from '@ts-linq/types';
import { DeleteBehavior, EntityState } from '@ts-linq/types';

import { CascadeWalker } from '../src/changetracker/CascadeWalker';

// ── Domain models (no decorators — manually registered) ────────────────────

class Blog {
  id!: number;
  title!: string;
}

class Post {
  id!: number;
  title!: string;
  blogId!: number | null;
  blog?: Blog;
}

class Comment {
  id!: number;
  text!: string;
  postId!: number | null;
  post?: Post;
}

// ── Registry helpers ────────────────────────────────────────────────────────

function buildRegistry(postDeleteBehavior: DeleteBehavior, commentDeleteBehavior?: DeleteBehavior) {
  const registry = createMetadataRegistry();

  // Blog entity
  registry.addEntity(Blog, 'blogs');
  registry.setFluentPrimaryKeys(Blog, ['id']);
  registry.mergeFluentColumn(Blog, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false
  });
  registry.mergeFluentColumn(Blog, {
    propertyName: 'title',
    columnName: 'title',
    type: 'TEXT',
    nullable: false
  });

  // Post entity with FK to Blog
  registry.addEntity(Post, 'posts');
  registry.setFluentPrimaryKeys(Post, ['id']);
  registry.mergeFluentColumn(Post, {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false
  });
  registry.mergeFluentColumn(Post, {
    propertyName: 'title',
    columnName: 'title',
    type: 'TEXT',
    nullable: false
  });
  registry.mergeFluentColumn(Post, {
    propertyName: 'blogId',
    columnName: 'blogId',
    type: 'INTEGER',
    nullable: true
  });
  registry.mergeFluentRelationship(Post, {
    propertyName: 'blog',
    type: 'many-to-one',
    targetEntity: Blog,
    foreignKey: 'blogId',
    onDelete: postDeleteBehavior
  });

  // Comment entity with FK to Post
  if (commentDeleteBehavior !== undefined) {
    registry.addEntity(Comment, 'comments');
    registry.setFluentPrimaryKeys(Comment, ['id']);
    registry.mergeFluentColumn(Comment, {
      propertyName: 'id',
      columnName: 'id',
      type: 'INTEGER',
      nullable: false
    });
    registry.mergeFluentColumn(Comment, {
      propertyName: 'text',
      columnName: 'text',
      type: 'TEXT',
      nullable: false
    });
    registry.mergeFluentColumn(Comment, {
      propertyName: 'postId',
      columnName: 'postId',
      type: 'INTEGER',
      nullable: true
    });
    registry.mergeFluentRelationship(Comment, {
      propertyName: 'post',
      type: 'many-to-one',
      targetEntity: Post,
      foreignKey: 'postId',
      onDelete: commentDeleteBehavior
    });
  }

  return registry;
}

function makeTracked<T extends object>(
  entity: T,
  entityClass: EntityCtorRef,
  state: EntityState
): TrackedEntity {
  return { entity, entityClass, state };
}

function makeTrackedMap(entries: TrackedEntity[]): Map<object, TrackedEntity> {
  const map = new Map<object, TrackedEntity>();
  for (const te of entries) map.set(te.entity, te);
  return map;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CascadeWalker', () => {
  describe('Cascade', () => {
    it('marks dependent entity Deleted when principal is Deleted', () => {
      const registry = buildRegistry(DeleteBehavior.Cascade);
      const blog = Object.assign(new Blog(), { id: 1, title: 'My Blog' });
      const post = Object.assign(new Post(), { id: 10, title: 'Hello', blogId: 1 });

      const tracked = makeTrackedMap([
        makeTracked(blog, Blog, EntityState.Deleted),
        makeTracked(post, Post, EntityState.Unchanged)
      ]);

      new CascadeWalker(registry).walk(tracked);

      expect(tracked.get(post)!.state).toBe(EntityState.Deleted);
    });

    it('cascades recursively through multiple levels', () => {
      const registry = buildRegistry(DeleteBehavior.Cascade, DeleteBehavior.Cascade);
      const blog = Object.assign(new Blog(), { id: 1, title: 'My Blog' });
      const post = Object.assign(new Post(), { id: 10, title: 'Hello', blogId: 1 });
      const comment = Object.assign(new Comment(), { id: 100, text: 'Hi', postId: 10 });

      const tracked = makeTrackedMap([
        makeTracked(blog, Blog, EntityState.Deleted),
        makeTracked(post, Post, EntityState.Unchanged),
        makeTracked(comment, Comment, EntityState.Unchanged)
      ]);

      new CascadeWalker(registry).walk(tracked);

      expect(tracked.get(post)!.state).toBe(EntityState.Deleted);
      expect(tracked.get(comment)!.state).toBe(EntityState.Deleted);
    });

    it('does not affect entities with different FK values', () => {
      const registry = buildRegistry(DeleteBehavior.Cascade);
      const blog1 = Object.assign(new Blog(), { id: 1, title: 'Blog 1' });
      const blog2 = Object.assign(new Blog(), { id: 2, title: 'Blog 2' });
      const post = Object.assign(new Post(), { id: 10, title: 'Hello', blogId: 2 });

      const tracked = makeTrackedMap([
        makeTracked(blog1, Blog, EntityState.Deleted),
        makeTracked(blog2, Blog, EntityState.Unchanged),
        makeTracked(post, Post, EntityState.Unchanged)
      ]);

      new CascadeWalker(registry).walk(tracked);

      expect(tracked.get(post)!.state).toBe(EntityState.Unchanged);
    });
  });

  describe('ClientCascade', () => {
    it('marks dependent entity Deleted (same as Cascade but client-side only)', () => {
      const registry = buildRegistry(DeleteBehavior.ClientCascade);
      const blog = Object.assign(new Blog(), { id: 1, title: 'Blog' });
      const post = Object.assign(new Post(), { id: 10, title: 'Post', blogId: 1 });

      const tracked = makeTrackedMap([
        makeTracked(blog, Blog, EntityState.Deleted),
        makeTracked(post, Post, EntityState.Unchanged)
      ]);

      new CascadeWalker(registry).walk(tracked);

      expect(tracked.get(post)!.state).toBe(EntityState.Deleted);
    });
  });

  describe('SetNull', () => {
    it('sets FK column to null and marks dependent as Modified', () => {
      const registry = buildRegistry(DeleteBehavior.SetNull);
      const blog = Object.assign(new Blog(), { id: 1, title: 'Blog' });
      const post = Object.assign(new Post(), { id: 10, title: 'Post', blogId: 1 });

      const tracked = makeTrackedMap([
        makeTracked(blog, Blog, EntityState.Deleted),
        makeTracked(post, Post, EntityState.Unchanged)
      ]);

      new CascadeWalker(registry).walk(tracked);

      expect(post.blogId).toBeNull();
      expect(tracked.get(post)!.state).toBe(EntityState.Modified);
    });

    it('preserves existing Modified state when setting null', () => {
      const registry = buildRegistry(DeleteBehavior.SetNull);
      const blog = Object.assign(new Blog(), { id: 1, title: 'Blog' });
      const post = Object.assign(new Post(), { id: 10, title: 'Post', blogId: 1 });

      const tracked = makeTrackedMap([
        makeTracked(blog, Blog, EntityState.Deleted),
        makeTracked(post, Post, EntityState.Modified)
      ]);

      new CascadeWalker(registry).walk(tracked);

      expect(post.blogId).toBeNull();
      expect(tracked.get(post)!.state).toBe(EntityState.Modified);
    });
  });

  describe('ClientSetNull', () => {
    it('sets FK column to null (client-side variant)', () => {
      const registry = buildRegistry(DeleteBehavior.ClientSetNull);
      const blog = Object.assign(new Blog(), { id: 1, title: 'Blog' });
      const post = Object.assign(new Post(), { id: 10, title: 'Post', blogId: 1 });

      const tracked = makeTrackedMap([
        makeTracked(blog, Blog, EntityState.Deleted),
        makeTracked(post, Post, EntityState.Unchanged)
      ]);

      new CascadeWalker(registry).walk(tracked);

      expect(post.blogId).toBeNull();
      expect(tracked.get(post)!.state).toBe(EntityState.Modified);
    });
  });

  describe('NoAction / Restrict / ClientNoAction', () => {
    it.each([DeleteBehavior.NoAction, DeleteBehavior.Restrict, DeleteBehavior.ClientNoAction])(
      '%s leaves dependent state unchanged',
      (behavior) => {
        const registry = buildRegistry(behavior);
        const blog = Object.assign(new Blog(), { id: 1, title: 'Blog' });
        const post = Object.assign(new Post(), { id: 10, title: 'Post', blogId: 1 });

        const tracked = makeTrackedMap([
          makeTracked(blog, Blog, EntityState.Deleted),
          makeTracked(post, Post, EntityState.Unchanged)
        ]);

        new CascadeWalker(registry).walk(tracked);

        expect(tracked.get(post)!.state).toBe(EntityState.Unchanged);
        expect(post.blogId).toBe(1);
      }
    );
  });

  describe('Cycle detection', () => {
    it('handles self-referencing FK without infinite loop', () => {
      const registry = createMetadataRegistry();

      class Node {
        id!: number;
        parentId!: number | null;
      }

      registry.addEntity(Node, 'nodes');
      registry.setFluentPrimaryKeys(Node, ['id']);
      registry.mergeFluentColumn(Node, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false
      });
      registry.mergeFluentColumn(Node, {
        propertyName: 'parentId',
        columnName: 'parentId',
        type: 'INTEGER',
        nullable: true
      });
      registry.mergeFluentRelationship(Node, {
        propertyName: 'parent',
        type: 'many-to-one',
        targetEntity: Node,
        foreignKey: 'parentId',
        onDelete: DeleteBehavior.Cascade
      });

      const root = Object.assign(new Node(), { id: 1, parentId: null });
      const child = Object.assign(new Node(), { id: 2, parentId: 1 });

      const tracked = makeTrackedMap([
        makeTracked(root, Node, EntityState.Deleted),
        makeTracked(child, Node, EntityState.Unchanged)
      ]);

      // Should not throw/hang due to cycle detection.
      expect(() => new CascadeWalker(registry).walk(tracked)).not.toThrow();
      expect(tracked.get(child)!.state).toBe(EntityState.Deleted);
    });
  });

  describe('Untracked entities', () => {
    it('does not affect entities not in the tracked map', () => {
      const registry = buildRegistry(DeleteBehavior.Cascade);
      const blog = Object.assign(new Blog(), { id: 1, title: 'Blog' });

      // post is NOT tracked — only blog is deleted
      const tracked = makeTrackedMap([makeTracked(blog, Blog, EntityState.Deleted)]);

      expect(() => new CascadeWalker(registry).walk(tracked)).not.toThrow();
    });
  });
});
