import 'reflect-metadata';
import { Entity, Column, PrimaryKey, OneToMany, ManyToOne } from '../src';
import { MetadataStorage } from '../src/metadata/MetadataStorage';

describe('Decorators', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
  });

  describe('@Entity', () => {
    it('should register entity metadata', () => {
      @Entity()
      class TestEntity {
        id!: number;
      }

      const metadata = MetadataStorage.getEntity(TestEntity);
      expect(metadata).toBeDefined();
      expect(metadata!.tableName).toBe('TestEntity');
    });

    it('should use custom table name', () => {
      @Entity({ name: 'custom_table' })
      class TestEntity {
        id!: number;
      }

      const metadata = MetadataStorage.getEntity(TestEntity);
      expect(metadata!.tableName).toBe('custom_table');
    });
  });

  describe('@Column', () => {
    it('should register column metadata', () => {
      @Entity()
      class TestEntity {
        @Column()
        name!: string;
      }
      // instantiate to trigger Stage-3 field initializers
      new TestEntity();
      const metadata = MetadataStorage.getEntity(TestEntity);
      expect(metadata!.columns).toHaveLength(1);
      expect(metadata!.columns[0].propertyName).toBe('name');
      expect(metadata!.columns[0].columnName).toBe('name');
    });

    it('should use custom column options', () => {
      @Entity()
      class TestEntity {
        @Column({ name: 'full_name', type: 'VARCHAR', length: 255, nullable: false })
        name!: string;
      }
      new TestEntity();
      const metadata = MetadataStorage.getEntity(TestEntity);
      const column = metadata!.columns[0];
      expect(column.columnName).toBe('full_name');
      expect(column.type).toBe('VARCHAR');
      expect(column.length).toBe(255);
      expect(column.nullable).toBe(false);
    });
  });

  describe('@PrimaryKey', () => {
    it('should register primary key', () => {
      @Entity()
      class TestEntity {
        @PrimaryKey()
        id!: number;
      }
      new TestEntity();
      const metadata = MetadataStorage.getEntity(TestEntity);
      expect(metadata!.primaryKeys).toContain('id');
      expect(metadata!.columns[0].nullable).toBe(false);
    });

    it('should support auto increment', () => {
      @Entity()
      class TestEntity {
        @PrimaryKey({ autoIncrement: true })
        id!: number;
      }
      new TestEntity();
      const metadata = MetadataStorage.getEntity(TestEntity);
      expect(metadata!.columns[0].isGenerated).toBe(true);
    });
  });

  describe('Relationship decorators', () => {
    it('should register one-to-many relationship', () => {
      @Entity()
      class User {
        @PrimaryKey()
        id!: number;

        @OneToMany(() => Post)
        posts!: Post[];
      }

      @Entity()
      class Post {
        @PrimaryKey()
        id!: number;

        @ManyToOne(() => User)
        user!: User;
      }

      // instantiate to ensure metadata finalized
      new User();
      new Post();
      const userMetadata = MetadataStorage.getEntity(User);
      const postMetadata = MetadataStorage.getEntity(Post);

      expect(userMetadata!.relationships).toHaveLength(1);
      expect(userMetadata!.relationships[0].type).toBe('one-to-many');
      const userTargetEntity = userMetadata!.relationships[0].targetEntity as unknown as Function;
      expect(userTargetEntity).toBe(Post);

      expect(postMetadata!.relationships).toHaveLength(1);
      expect(postMetadata!.relationships[0].type).toBe('many-to-one');
      const postTargetEntity = postMetadata!.relationships[0].targetEntity as unknown as Function;
      expect(postTargetEntity).toBe(User);
    });
  });
});
