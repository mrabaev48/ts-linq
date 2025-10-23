import { describe, test, expect, beforeEach } from 'vitest';
import { MetadataStorage } from '@ts-linq/metadata';
import { Entity, Column, PrimaryKey, ManyToOne, OneToMany } from '@ts-linq/metadata';
import { Index } from '@ts-linq/core/decorators';
import { ValidationError } from '@ts-linq/types';

describe('MetadataStorage - Decorator-based Metadata', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  describe('Entity Registration', () => {
    test('should register entity with @Entity decorator', () => {
      @Entity()
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;
      }

      const metadata = MetadataStorage.getEntity(User);
      expect(metadata).toBeDefined();
      expect(metadata!.tableName).toBe('User');
    });

    test('should register entity with custom table name', () => {
      @Entity({ tableName: 'custom_users' })
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;
      }

      const metadata = MetadataStorage.getEntity(User);
      expect(metadata).toBeDefined();
      expect(metadata!.tableName).toBe('custom_users');
    });

    test('should register multiple entities', () => {
      @Entity()
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;
      }

      @Entity()
      class Post {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;
      }

      const userMeta = MetadataStorage.getEntity(User);
      const postMeta = MetadataStorage.getEntity(Post);

      expect(userMeta).toBeDefined();
      expect(postMeta).toBeDefined();
      expect(userMeta!.tableName).toBe('User');
      expect(postMeta!.tableName).toBe('Post');
    });
  });

  describe('Column Metadata', () => {
    test('should register column with @Column decorator', () => {
      @Entity()
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;

        @Column({ type: 'TEXT' })
        name!: string;

        @Column({ type: 'TEXT' })
        email!: string;
      }

      const metadata = MetadataStorage.getEntity(User);
      expect(metadata!.columns).toHaveLength(3);
      
      const nameCol = metadata!.columns.find(c => c.propertyName === 'name');
      expect(nameCol).toBeDefined();
      expect(nameCol!.type).toBe('TEXT');
      expect(nameCol!.nullable).toBe(false);
    });

    test('should handle nullable columns', () => {
      @Entity()
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;

        @Column({ type: 'INTEGER', nullable: true })
        age?: number;
      }

      const metadata = MetadataStorage.getEntity(User);
      const ageCol = metadata!.columns.find(c => c.propertyName === 'age');
      
      expect(ageCol!.nullable).toBe(true);
    });

    test('should handle column with custom name', () => {
      @Entity()
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;

        @Column({ type: 'TEXT', columnName: 'user_name' })
        name!: string;
      }

      const metadata = MetadataStorage.getEntity(User);
      const nameCol = metadata!.columns.find(c => c.propertyName === 'name');
      
      expect(nameCol!.columnName).toBe('user_name');
    });

    test('should handle column with default value', () => {
      @Entity()
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;

        @Column({ type: 'INTEGER', defaultValue: 0 })
        score!: number;
      }

      const metadata = MetadataStorage.getEntity(User);
      const scoreCol = metadata!.columns.find(c => c.propertyName === 'score');
      
      expect(scoreCol!.defaultValue).toBe(0);
    });
  });

  describe('Primary Key Metadata', () => {
    test('should register primary key', () => {
      @Entity()
      class User {
        @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
        id!: number;
      }

      const metadata = MetadataStorage.getEntity(User);
      expect(metadata!.primaryKeys).toContain('id');
      
      const idCol = metadata!.columns.find(c => c.propertyName === 'id');
      expect(idCol!.isGenerated).toBe(true);
    });

    test('should handle composite primary keys', () => {
      @Entity()
      class UserRole {
        @PrimaryKey({ type: 'INTEGER' })
        userId!: number;

        @PrimaryKey({ type: 'INTEGER' })
        roleId!: number;
      }

      const metadata = MetadataStorage.getEntity(UserRole);
      expect(metadata!.primaryKeys).toHaveLength(2);
      expect(metadata!.primaryKeys).toContain('userId');
      expect(metadata!.primaryKeys).toContain('roleId');
    });
  });

  describe('Index Metadata', () => {
    test('should register index with @Index decorator', () => {
      @Entity()
      @Index('idx_email', ['email'], { unique: true })
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;

        @Column({ type: 'TEXT' })
        email!: string;
      }

      const metadata = MetadataStorage.getEntity(User);
      expect(metadata!.indexes).toHaveLength(1);
      expect(metadata!.indexes[0].columns).toContain('email');
      expect(metadata!.indexes[0].unique).toBe(true);
    });

    test('should register multiple indexes', () => {
      @Entity()
      @Index('idx_email', ['email'], { unique: true })
      @Index('idx_name', ['name'])
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;

        @Column({ type: 'TEXT' })
        name!: string;

        @Column({ type: 'TEXT' })
        email!: string;
      }

      const metadata = MetadataStorage.getEntity(User);
      expect(metadata!.indexes).toHaveLength(2);
    });

    test('should register composite index', () => {
      @Entity()
      @Index('idx_fullname', ['firstName', 'lastName'])
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;

        @Column({ type: 'TEXT' })
        firstName!: string;

        @Column({ type: 'TEXT' })
        lastName!: string;
      }

      const metadata = MetadataStorage.getEntity(User);
      const index = metadata!.indexes[0];
      
      expect(index.columns).toHaveLength(2);
      expect(index.columns).toContain('firstName');
      expect(index.columns).toContain('lastName');
    });
  });

  describe('Relationship Metadata', () => {
    test('should register @ManyToOne relationship', () => {
      @Entity()
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;
      }

      @Entity()
      class Post {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;

        @Column({ type: 'INTEGER' })
        userId!: number;

        @ManyToOne(() => User, { inverseSide: 'posts' })
        user!: User;
      }

      const metadata = MetadataStorage.getEntity(Post);
      expect(metadata!.relations).toBeDefined();
      
      const userRel = metadata!.relations?.find(r => r.propertyName === 'user');
      expect(userRel).toBeDefined();
      expect(userRel!.type).toBe('many-to-one');
    });

    test('should register @OneToMany relationship', () => {
      @Entity()
      class Post {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;
      }

      @Entity()
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;

        @OneToMany(() => Post, { inverseSide: 'userId' })
        posts!: Post[];
      }

      const metadata = MetadataStorage.getEntity(User);
      const postsRel = metadata!.relations?.find(r => r.propertyName === 'posts');
      
      expect(postsRel).toBeDefined();
      expect(postsRel!.type).toBe('one-to-many');
    });
  });

  describe('Metadata Retrieval', () => {
    test('should get all registered entities', () => {
      @Entity()
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;
      }

      @Entity()
      class Post {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;
      }

      const allEntities = MetadataStorage.getEntities();
      expect(allEntities.length).toBeGreaterThanOrEqual(2);
    });

    test('should return undefined for unregistered entity', () => {
      class UnregisteredEntity {}
      
      const metadata = MetadataStorage.getEntity(UnregisteredEntity);
      expect(metadata).toBeUndefined();
    });
  });

  describe('Metadata Clear', () => {
    test('should clear all metadata', () => {
      @Entity()
      class User {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;
      }

      const beforeClear = MetadataStorage.getEntity(User);
      expect(beforeClear).toBeDefined();

      MetadataStorage.getInstance().clear();

      const afterClear = MetadataStorage.getEntities();
      expect(afterClear).toHaveLength(0);
    });
  });

  describe('Complex Entity Scenarios', () => {
    test('should handle entity with all metadata types', () => {
      @Entity({ tableName: 'users' })
      @Index('idx_email', ['email'], { unique: true })
      @Index('idx_created', ['createdAt'])
      class User {
        @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
        id!: number;

        @Column({ type: 'TEXT', columnName: 'user_name' })
        name!: string;

        @Column({ type: 'TEXT' })
        email!: string;

        @Column({ type: 'INTEGER', nullable: true })
        age?: number;

        @Column({ type: 'TEXT', defaultValue: 'active' })
        status!: string;

        @Column({ type: 'INTEGER' })
        createdAt!: number;

        @OneToMany(() => Post, { inverseSide: 'userId' })
        posts!: Post[];
      }

      @Entity()
      class Post {
        @PrimaryKey({ type: 'INTEGER' })
        id!: number;

        @Column({ type: 'INTEGER' })
        userId!: number;

        @ManyToOne(() => User, { inverseSide: 'posts' })
        user!: User;
      }

      const metadata = MetadataStorage.getEntity(User);
      
      expect(metadata!.tableName).toBe('users');
      expect(metadata!.columns.length).toBeGreaterThanOrEqual(6);
      expect(metadata!.indexes).toHaveLength(2);
      expect(metadata!.relations).toBeDefined();
      expect(metadata!.primaryKeys).toContain('id');
    });
  });
});
