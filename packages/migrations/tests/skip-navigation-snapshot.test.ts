import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';
import type { SkipNavigationMetadata } from '@ts-linq/types';

import { ModelSnapshotBuilder } from '../src/snapshot/model-snapshot';

class Post {
  id!: number;
  tags: Tag[] = [];
}

class Tag {
  id!: number;
  posts: Post[] = [];
}

class SyntheticPostTag {}

describe('ModelSnapshotBuilder — skip navigation join tables', () => {
  beforeEach(() => {
    MetadataStorage.reset();
  });

  afterEach(() => {
    MetadataStorage.reset();
  });

  it('emits join table DDL for a synthesized many-to-many', () => {
    // Register Post
    MetadataStorage.addEntity(Post, 'posts');
    MetadataStorage.addPrimaryKey(Post, 'id');
    MetadataStorage.addColumn(Post, {
      propertyName: 'id',
      columnName: 'id',
      type: 'int',
      nullable: false
    });

    // Register Tag
    MetadataStorage.addEntity(Tag, 'tags');
    MetadataStorage.addPrimaryKey(Tag, 'id');
    MetadataStorage.addColumn(Tag, {
      propertyName: 'id',
      columnName: 'id',
      type: 'int',
      nullable: false
    });

    // Register skip navigation
    const sn: SkipNavigationMetadata = {
      propertyName: 'tags',
      targetEntity: Tag,
      joinTableName: 'PostTag',
      joinEntityCtor: SyntheticPostTag,
      leftForeignKey: 'postId',
      rightForeignKey: 'tagId',
      isSynthesized: true
    };
    MetadataStorage.mergeFluentSkipNavigation(Post, sn);

    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    const joinTable = snapshot.tables.find((t) => t.name === 'PostTag');
    expect(joinTable).toBeDefined();
    expect(joinTable!.primaryKeys).toEqual(expect.arrayContaining(['postId', 'tagId']));
    expect(joinTable!.columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['postId', 'tagId'])
    );
    const postIdCol = joinTable!.columns.find((c) => c.name === 'postId');
    const tagIdCol = joinTable!.columns.find((c) => c.name === 'tagId');
    expect(postIdCol!.nullable).toBe(false);
    expect(postIdCol!.isPrimaryKey).toBe(true);
    expect(tagIdCol!.nullable).toBe(false);
    expect(tagIdCol!.isPrimaryKey).toBe(true);
  });

  it('emits the join table only once even if both sides have skip nav metadata', () => {
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

    const snLeft: SkipNavigationMetadata = {
      propertyName: 'tags',
      targetEntity: Tag,
      joinTableName: 'PostTag',
      joinEntityCtor: SyntheticPostTag,
      leftForeignKey: 'postId',
      rightForeignKey: 'tagId',
      isSynthesized: true
    };
    const snRight: SkipNavigationMetadata = {
      propertyName: 'posts',
      targetEntity: Post,
      joinTableName: 'PostTag',
      joinEntityCtor: SyntheticPostTag,
      leftForeignKey: 'tagId',
      rightForeignKey: 'postId',
      isSynthesized: true
    };
    MetadataStorage.mergeFluentSkipNavigation(Post, snLeft);
    MetadataStorage.mergeFluentSkipNavigation(Tag, snRight);

    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    const joinTables = snapshot.tables.filter((t) => t.name === 'PostTag');
    expect(joinTables).toHaveLength(1);
  });

  it('does not emit join table for non-synthesized skip navigations', () => {
    MetadataStorage.addEntity(Post, 'posts');
    MetadataStorage.addColumn(Post, {
      propertyName: 'id',
      columnName: 'id',
      type: 'int',
      nullable: false
    });

    MetadataStorage.addEntity(Tag, 'tags');
    MetadataStorage.addColumn(Tag, {
      propertyName: 'id',
      columnName: 'id',
      type: 'int',
      nullable: false
    });

    const sn: SkipNavigationMetadata = {
      propertyName: 'tags',
      targetEntity: Tag,
      joinTableName: 'ExistingJoinTable',
      joinEntityCtor: SyntheticPostTag,
      leftForeignKey: 'postId',
      rightForeignKey: 'tagId',
      isSynthesized: false // explicit — DDL already managed by user
    };
    MetadataStorage.mergeFluentSkipNavigation(Post, sn);

    const builder = new ModelSnapshotBuilder();
    const snapshot = builder.buildFromMetadata();

    const joinTable = snapshot.tables.find((t) => t.name === 'ExistingJoinTable');
    expect(joinTable).toBeUndefined();
  });
});
