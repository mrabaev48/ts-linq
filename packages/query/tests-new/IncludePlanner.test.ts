import type { EntityLoader } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';

import { IncludeResolutionError } from '../src/errors';
import { IncludePlanner } from '../src/IncludePlanner';

// ---------------------------------------------------------------------------
// Minimal entity fixtures
// ---------------------------------------------------------------------------

class Comment {
  id!: number;
  body!: string;
}

class Post {
  id!: number;
  title!: string;
  comments!: Comment[];
}

class Blog {
  id!: number;
  name!: string;
  posts!: Post[];
}

// ---------------------------------------------------------------------------
// Stub EntityLoader
// Implements only populateRelationshipsMany, the only method IncludePlanner calls.
// ---------------------------------------------------------------------------

type PopulateCallback = (entities: unknown[], entityClass: Function, propName: string) => void;

function makeLoader(onPopulate?: PopulateCallback): EntityLoader {
  return {
    populateRelationshipsMany: async (
      entities: unknown[],
      entityClass: Function,
      options: { includes?: string[] }
    ) => {
      if (onPopulate && options.includes) {
        for (const prop of options.includes) {
          onPopulate(entities, entityClass, prop);
        }
      }
    }
  } as unknown as EntityLoader;
}

// ---------------------------------------------------------------------------
// Metadata registration helpers
// ---------------------------------------------------------------------------

function registerBlogWithPosts(targetEntity: string | Function = Post): void {
  MetadataStorage.addEntity(Blog, 'blogs');
  MetadataStorage.addRelationship(Blog, {
    propertyName: 'posts',
    type: 'one-to-many',
    targetEntity
  });
}

function registerPost(): void {
  MetadataStorage.addEntity(Post, 'posts');
}

function registerPostWithComments(): void {
  registerPost();
  MetadataStorage.addRelationship(Post, {
    propertyName: 'comments',
    type: 'one-to-many',
    targetEntity: Comment
  });
}

function registerComment(): void {
  MetadataStorage.addEntity(Comment, 'comments');
}

// ---------------------------------------------------------------------------
// Helper: assert an async call throws a specific IncludeResolutionError
// ---------------------------------------------------------------------------

async function expectIncludeError(
  promise: Promise<unknown>,
  expected: {
    code: string;
    entityName?: string;
    propertyName?: string;
    propertyPath?: string;
  }
): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(IncludeResolutionError);
  const err = caught as IncludeResolutionError;
  expect(err.code).toBe(expected.code);
  if (expected.entityName !== undefined) expect(err.details.entityName).toBe(expected.entityName);
  if (expected.propertyName !== undefined)
    expect(err.details.propertyName).toBe(expected.propertyName);
  if (expected.propertyPath !== undefined)
    expect(err.details.propertyPath).toBe(expected.propertyPath);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IncludePlanner', () => {
  beforeEach(() => MetadataStorage.reset());

  // -------------------------------------------------------------------------
  // Early exits (no-ops)
  // -------------------------------------------------------------------------

  describe('early exits', () => {
    it('does nothing when entityLoader is undefined', async () => {
      const planner = new IncludePlanner<Blog>(undefined, Blog);
      await expect(planner.populateIncludes([], ['posts'])).resolves.toBeUndefined();
    });

    it('does nothing when includes is empty', async () => {
      const planner = new IncludePlanner<Blog>(makeLoader(), Blog);
      await expect(planner.populateIncludes([new Blog()], [])).resolves.toBeUndefined();
    });

    it('does nothing when limit is 1', async () => {
      const planner = new IncludePlanner<Blog>(makeLoader(), Blog);
      await expect(planner.populateIncludes([new Blog()], ['posts'], 1)).resolves.toBeUndefined();
    });

    it('does not throw for leaf-only includes even when entity is unregistered', async () => {
      // 'posts' has no nested paths → metadata check is skipped entirely
      const planner = new IncludePlanner<Blog>(makeLoader(), Blog);
      await expect(planner.populateIncludes([new Blog()], ['posts'])).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // ENTITY_NOT_REGISTERED
  // -------------------------------------------------------------------------

  describe('ENTITY_NOT_REGISTERED', () => {
    it('throws when root entity has no @Entity metadata and a nested path is requested', async () => {
      // Blog has no metadata; nestedPaths > 0 triggers the metadata guard
      const planner = new IncludePlanner<Blog>(makeLoader(), Blog);

      await expectIncludeError(planner.populateIncludes([new Blog()], ['posts.comments']), {
        code: 'ENTITY_NOT_REGISTERED',
        entityName: 'Blog',
        propertyName: 'posts'
      });
    });

    it('throws when a target entity in the chain has no @Entity metadata', async () => {
      // Blog IS registered with posts → Post, but Post is NOT registered.
      // The 3-level path forces recursion into Post with nestedPaths=['author'],
      // triggering the metadata guard on Post.
      registerBlogWithPosts(Post);

      const post = new Post();
      const loader = makeLoader((entities, _cls, prop) => {
        if (prop === 'posts') {
          for (const e of entities) {
            (e as Blog).posts = [post];
          }
        }
      });

      const blog = new Blog();
      const planner = new IncludePlanner<Blog>(loader, Blog);

      await expectIncludeError(planner.populateIncludes([blog], ['posts.comments.author']), {
        code: 'ENTITY_NOT_REGISTERED',
        entityName: 'Post'
      });
    });
  });

  // -------------------------------------------------------------------------
  // UNKNOWN_PROPERTY
  // -------------------------------------------------------------------------

  describe('UNKNOWN_PROPERTY', () => {
    it('throws when a nested path segment is not a declared relationship (typo)', async () => {
      // Blog → posts → Post (registered, but Post has NO 'comments' relationship)
      // Path 'posts.comments.author': 'comments' is not on Post → UNKNOWN_PROPERTY
      registerBlogWithPosts(Post);
      registerPost(); // no 'comments' relationship registered

      const post = new Post();
      const loader = makeLoader((entities, _cls, prop) => {
        if (prop === 'posts') {
          for (const e of entities) {
            (e as Blog).posts = [post];
          }
        }
      });

      const blog = new Blog();
      const planner = new IncludePlanner<Blog>(loader, Blog);

      await expectIncludeError(planner.populateIncludes([blog], ['posts.comments.author']), {
        code: 'UNKNOWN_PROPERTY',
        entityName: 'Post',
        propertyName: 'comments',
        propertyPath: 'posts.comments'
      });
    });
  });

  // -------------------------------------------------------------------------
  // UNRESOLVABLE_TARGET
  // -------------------------------------------------------------------------

  describe('UNRESOLVABLE_TARGET', () => {
    it('throws when targetEntity is a string reference', async () => {
      // resolveTargetCtor('Post') returns null for string refs
      registerBlogWithPosts('Post');

      const planner = new IncludePlanner<Blog>(makeLoader(), Blog);

      await expectIncludeError(planner.populateIncludes([new Blog()], ['posts.comments']), {
        code: 'UNRESOLVABLE_TARGET',
        entityName: 'Blog',
        propertyName: 'posts',
        propertyPath: 'posts'
      });
    });

    it('throws when targetEntity is a forward-ref factory that throws', async () => {
      MetadataStorage.addEntity(Blog, 'blogs');
      MetadataStorage.addRelationship(Blog, {
        propertyName: 'posts',
        type: 'one-to-many',
        targetEntity: () => {
          throw new Error('circular ref not ready');
        }
      });

      const planner = new IncludePlanner<Blog>(makeLoader(), Blog);

      await expectIncludeError(planner.populateIncludes([new Blog()], ['posts.comments']), {
        code: 'UNRESOLVABLE_TARGET',
        entityName: 'Blog',
        propertyName: 'posts'
      });
    });
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe('happy path', () => {
    it('resolves a two-level nested include chain without throwing', async () => {
      registerBlogWithPosts(Post);
      registerPostWithComments();
      registerComment();

      const comment = Object.assign(new Comment(), { id: 1, body: 'hi' });
      const post = new Post();
      post.id = 1;
      post.title = 't';
      post.comments = [];
      const blog = new Blog();
      blog.id = 1;
      blog.name = 'b';
      blog.posts = [];

      const loader = makeLoader((entities, cls, prop) => {
        if (cls === Blog && prop === 'posts') {
          (entities[0] as Blog).posts = [post];
        }
        if (cls === Post && prop === 'comments') {
          (entities[0] as Post).comments = [comment];
        }
      });

      const planner = new IncludePlanner<Blog>(loader, Blog);

      await expect(planner.populateIncludes([blog], ['posts.comments'])).resolves.toBeUndefined();

      expect(blog.posts).toHaveLength(1);
      expect(blog.posts[0].comments).toHaveLength(1);
      expect(blog.posts[0].comments[0].body).toBe('hi');
    });

    it('skips recursion when nav entities are empty after population', async () => {
      registerBlogWithPosts(Post);
      registerPostWithComments();

      const blog = new Blog();
      blog.id = 1;
      blog.name = 'b';
      blog.posts = [];

      // Loader does NOT populate posts → navEntities stays empty → no recursion
      const planner = new IncludePlanner<Blog>(makeLoader(), Blog);

      await expect(planner.populateIncludes([blog], ['posts.comments'])).resolves.toBeUndefined();
    });
  });
});
