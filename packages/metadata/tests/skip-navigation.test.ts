import 'reflect-metadata';

import type { SkipNavigationMetadata } from '@ts-linq/types';

import { createMetadataRegistry } from '../src';

class Post {
  id!: number;
  tags: Tag[] = [];
}

class Tag {
  id!: number;
  posts: Post[] = [];
}

class SyntheticPostTag {}

const baseNav = (): SkipNavigationMetadata => ({
  propertyName: 'tags',
  targetEntity: Tag,
  joinTableName: 'PostTag',
  joinEntityCtor: SyntheticPostTag,
  leftForeignKey: 'postId',
  rightForeignKey: 'tagId',
  inverseSide: 'posts',
  isSynthesized: true
});

describe('MetadataRegistry — skip navigations', () => {
  it('mergeFluentSkipNavigation registers skip nav on entity', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Post, 'posts');

    registry.mergeFluentSkipNavigation(Post, baseNav());

    const meta = registry.getEntity(Post);
    expect(meta?.skipNavigations).toHaveLength(1);
    expect(meta!.skipNavigations![0].propertyName).toBe('tags');
    expect(meta!.skipNavigations![0].joinTableName).toBe('PostTag');
  });

  it('mergeFluentSkipNavigation replaces existing nav by propertyName', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Post, 'posts');

    registry.mergeFluentSkipNavigation(Post, baseNav());
    registry.mergeFluentSkipNavigation(Post, { ...baseNav(), joinTableName: 'PostTagV2' });

    const meta = registry.getEntity(Post);
    expect(meta?.skipNavigations).toHaveLength(1);
    expect(meta!.skipNavigations![0].joinTableName).toBe('PostTagV2');
  });

  it('mergeFluentSkipNavigation appends distinct navigations', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Post, 'posts');

    registry.mergeFluentSkipNavigation(Post, baseNav());
    registry.mergeFluentSkipNavigation(Post, {
      ...baseNav(),
      propertyName: 'otherTags',
      joinTableName: 'PostOtherTag'
    });

    const meta = registry.getEntity(Post);
    expect(meta?.skipNavigations).toHaveLength(2);
  });

  it('EntityMetadataBuilder.addSkipNavigation stores navigation after getEntity call', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Post, 'posts');
    registry.mergeFluentSkipNavigation(Post, baseNav());

    // Calling getEntity triggers finalization of the builder
    const meta = registry.getEntity(Post);
    expect(meta?.skipNavigations).toHaveLength(1);
  });

  it('mergeFluentSkipNavigation works after entity metadata is built via getEntity', () => {
    const registry = createMetadataRegistry();
    registry.addEntity(Post, 'posts');
    // Trigger finalization by calling getEntity
    registry.getEntity(Post);

    // After finalization the entity is stored in entities map
    registry.mergeFluentSkipNavigation(Post, baseNav());

    const meta = registry.getEntity(Post);
    expect(meta?.skipNavigations).toHaveLength(1);
  });
});
