import 'reflect-metadata';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { EntityLoader } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';

import { IncludePlanner, IncludeResolutionError } from '../src/IncludePlanner';

// Minimal EntityLoader stub that does nothing
function makeEntityLoader(): EntityLoader {
  return {
    populateRelationshipsMany: jest.fn().mockImplementation(() => Promise.resolve())
  } as unknown as EntityLoader;
}

class User {
  id = 0;
  posts: Post[] = [];
}

class Post {
  id = 0;
  title = '';
}

beforeEach(() => {
  MetadataStorage.reset();
});

afterEach(() => {
  MetadataStorage.reset();
});

describe('IncludePlanner.populateIncludes', () => {
  describe('early returns (no-ops)', () => {
    it('does nothing when entityLoader is undefined', async () => {
      const planner = new IncludePlanner<User>(undefined, User);
      await expect(planner.populateIncludes([new User()], ['posts'])).resolves.toBeUndefined();
    });

    it('does nothing when includes list is empty', async () => {
      const planner = new IncludePlanner<User>(makeEntityLoader(), User);
      await expect(planner.populateIncludes([new User()], [])).resolves.toBeUndefined();
    });

    it('does nothing when limit === 1', async () => {
      const planner = new IncludePlanner<User>(makeEntityLoader(), User);
      await expect(planner.populateIncludes([new User()], ['posts'], 1)).resolves.toBeUndefined();
    });

    it('does nothing when entities array is empty', async () => {
      MetadataStorage.addEntity(User, 'users');
      const planner = new IncludePlanner<User>(makeEntityLoader(), User);
      // Empty entities → loadLevel exits early without touching metadata
      await expect(planner.populateIncludes([], ['posts'])).resolves.toBeUndefined();
    });
  });

  describe('IncludeResolutionError — missing metadata (ISSUE-004)', () => {
    it('throws when entity has no registered metadata', async () => {
      const loader = makeEntityLoader();
      const planner = new IncludePlanner<User>(loader, User);
      // User not registered — metadata lookup returns undefined
      await expect(planner.populateIncludes([new User()], ['posts.comments'])).rejects.toThrow(
        IncludeResolutionError
      );
    });

    it('includes the entity name in the error message', async () => {
      const loader = makeEntityLoader();
      const planner = new IncludePlanner<User>(loader, User);
      await expect(planner.populateIncludes([new User()], ['posts.comments'])).rejects.toThrow(
        /User/
      );
    });
  });

  describe('IncludeResolutionError — missing relationship (ISSUE-004)', () => {
    it('throws when include path references a non-existent property', async () => {
      MetadataStorage.addEntity(User, 'users');
      // No relationship "postss" registered — should throw
      const loader = makeEntityLoader();
      const planner = new IncludePlanner<User>(loader, User);
      await expect(planner.populateIncludes([new User()], ['postss.comments'])).rejects.toThrow(
        IncludeResolutionError
      );
    });

    it('includes both entity name and property name in the error', async () => {
      MetadataStorage.addEntity(User, 'users');
      const loader = makeEntityLoader();
      const planner = new IncludePlanner<User>(loader, User);
      await expect(planner.populateIncludes([new User()], ['athor.posts'])).rejects.toThrow(
        /User.*athor/
      );
    });
  });

  describe('valid top-level includes (no nested paths)', () => {
    it('calls populateRelationshipsMany once and does not recurse', async () => {
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addRelationship(User, {
        propertyName: 'posts',
        type: 'one-to-many',
        targetEntity: Post
      });

      const loader = makeEntityLoader();
      const planner = new IncludePlanner<User>(loader, User);
      const users = [new User()];
      await planner.populateIncludes(users, ['posts']);

      expect(loader.populateRelationshipsMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('valid nested includes', () => {
    it('recurses into nested paths when navEntities are present', async () => {
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addRelationship(User, {
        propertyName: 'posts',
        type: 'one-to-many',
        targetEntity: Post
      });
      MetadataStorage.addEntity(Post, 'posts');

      const loader = makeEntityLoader();
      const planner = new IncludePlanner<User>(loader, User);

      const post = new Post();
      const user = new User();
      user.posts = [post];

      // posts.comments.author → recurses into Post, looks for 'comments' relationship
      // Post has no 'comments' relationship → throws IncludeResolutionError
      // This proves loadLevel was called recursively (populateRelationshipsMany called twice)
      await expect(planner.populateIncludes([user], ['posts.comments.author'])).rejects.toThrow(
        IncludeResolutionError
      );
      // Called twice: once for User (top level), once recursing into Post
      expect(loader.populateRelationshipsMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('TDZ forward-ref (null from resolveEntityRef)', () => {
    it('skips nested loading gracefully when targetEntity resolves to null (TDZ)', async () => {
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addRelationship(User, {
        propertyName: 'posts',
        type: 'one-to-many',
        // Thunk that simulates a TDZ ReferenceError
        targetEntity: () => {
          throw new ReferenceError('Cannot access before initialization');
        }
      });

      const loader = makeEntityLoader();
      const planner = new IncludePlanner<User>(loader, User);
      const user = new User();
      user.posts = [new Post()];

      // Should not throw — TDZ null is a graceful skip
      await expect(planner.populateIncludes([user], ['posts.comments'])).resolves.toBeUndefined();
    });
  });
});
