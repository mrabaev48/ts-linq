import { MetadataStorage } from '../src/MetadataStorage';
import { MetadataRegistry } from '../src/MetadataRegistry';
import type { ColumnMetadata, RelationshipMetadata, IndexMetadata, ValidationRule } from '@ts-linq/types';

describe('MetadataStorage', () => {
  beforeEach(() => {
    MetadataStorage.reset();
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = MetadataStorage.getInstance();
      const instance2 = MetadataStorage.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('addEntity()', () => {
    it('should register entity with table name', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      
      const metadata = MetadataStorage.getEntity(User);
      expect(metadata).toBeDefined();
      expect(metadata?.tableName).toBe('users');
      expect(metadata?.target).toBe(User);
    });

    it('should register entity without table name', () => {
      class Product {}
      
      MetadataStorage.addEntity(Product);
      
      const metadata = MetadataStorage.getEntity(Product);
      expect(metadata).toBeDefined();
      expect(metadata?.target).toBe(Product);
    });

    it('should handle multiple entities', () => {
      class User {}
      class Post {}
      
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addEntity(Post, 'posts');
      
      const entities = MetadataStorage.getEntities();
      expect(entities).toHaveLength(2);
      expect(entities.map(e => e.tableName)).toContain('users');
      expect(entities.map(e => e.tableName)).toContain('posts');
    });
  });

  describe('addColumn()', () => {
    it('should register column metadata', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      
      const columnMeta: ColumnMetadata = {
        propertyName: 'name',
        columnName: 'name',
        type: 'VARCHAR',
        nullable: true,
        isGenerated: false,
        isVersion: false
      };
      
      MetadataStorage.addColumn(User, columnMeta);
      
      const metadata = MetadataStorage.getEntity(User);
      expect(metadata?.columns).toHaveLength(1);
      expect(metadata?.columns[0].propertyName).toBe('name');
      expect(metadata?.columns[0].type).toBe('VARCHAR');
    });

    it('should register multiple columns', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      
      MetadataStorage.addColumn(User, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false,
        isGenerated: true,
        isVersion: false
      });
      
      MetadataStorage.addColumn(User, {
        propertyName: 'name',
        columnName: 'name',
        type: 'VARCHAR',
        nullable: true,
        isGenerated: false,
        isVersion: false
      });
      
      MetadataStorage.addColumn(User, {
        propertyName: 'email',
        columnName: 'email',
        type: 'VARCHAR',
        nullable: false,
        isGenerated: false,
        isVersion: false
      });
      
      const metadata = MetadataStorage.getEntity(User);
      expect(metadata?.columns).toHaveLength(3);
      expect(metadata?.columns.map(c => c.propertyName)).toContain('id');
      expect(metadata?.columns.map(c => c.propertyName)).toContain('name');
      expect(metadata?.columns.map(c => c.propertyName)).toContain('email');
    });

    it('should support column options', () => {
      class Product {}
      
      MetadataStorage.addEntity(Product, 'products');
      
      MetadataStorage.addColumn(Product, {
        propertyName: 'price',
        columnName: 'price',
        type: 'DECIMAL',
        nullable: false,
        isGenerated: false,
        isVersion: false,
        precision: 10,
        scale: 2,
        defaultValue: 0
      });
      
      const metadata = MetadataStorage.getEntity(Product);
      const priceColumn = metadata?.columns.find(c => c.propertyName === 'price');
      
      expect(priceColumn?.precision).toBe(10);
      expect(priceColumn?.scale).toBe(2);
      expect(priceColumn?.defaultValue).toBe(0);
    });
  });

  describe('addPrimaryKey()', () => {
    it('should mark column as primary key', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addColumn(User, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false,
        isGenerated: true,
        isVersion: false
      });
      
      MetadataStorage.addPrimaryKey(User, 'id');
      
      const metadata = MetadataStorage.getEntity(User);
      expect(metadata?.primaryKeys).toEqual(['id']);
    });

    it('should support composite primary keys', () => {
      class OrderItem {}
      
      MetadataStorage.addEntity(OrderItem, 'order_items');
      MetadataStorage.addColumn(OrderItem, {
        propertyName: 'orderId',
        columnName: 'order_id',
        type: 'INTEGER',
        nullable: false,
        isGenerated: false,
        isVersion: false
      });
      
      MetadataStorage.addColumn(OrderItem, {
        propertyName: 'productId',
        columnName: 'product_id',
        type: 'INTEGER',
        nullable: false,
        isGenerated: false,
        isVersion: false
      });
      
      MetadataStorage.addPrimaryKey(OrderItem, 'orderId');
      MetadataStorage.addPrimaryKey(OrderItem, 'productId');
      
      const metadata = MetadataStorage.getEntity(OrderItem);
      expect(metadata?.primaryKeys).toHaveLength(2);
      expect(metadata?.primaryKeys).toContain('orderId');
      expect(metadata?.primaryKeys).toContain('productId');
    });
  });

  describe('addRelationship()', () => {
    it('should register relationship metadata', () => {
      class User {}
      class Post {}
      
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addEntity(Post, 'posts');
      
      const relationshipMeta: RelationshipMetadata = {
        type: 'one-to-many',
        propertyName: 'posts',
        targetEntity: Post,
        inverseSide: 'author'
      };
      
      MetadataStorage.addRelationship(User, relationshipMeta);
      
      const metadata = MetadataStorage.getEntity(User);
      expect(metadata?.relationships).toHaveLength(1);
      expect(metadata?.relationships[0].type).toBe('one-to-many');
      expect(metadata?.relationships[0].propertyName).toBe('posts');
    });

    it('should handle multiple relationships', () => {
      class User {}
      class Post {}
      class Comment {}
      
      MetadataStorage.addEntity(User, 'users');
      
      MetadataStorage.addRelationship(User, {
        type: 'one-to-many',
        propertyName: 'posts',
        targetEntity: Post
      });
      
      MetadataStorage.addRelationship(User, {
        type: 'one-to-many',
        propertyName: 'comments',
        targetEntity: Comment
      });
      
      const metadata = MetadataStorage.getEntity(User);
      expect(metadata?.relationships).toHaveLength(2);
      expect(metadata?.relationships.map(r => r.propertyName)).toContain('posts');
      expect(metadata?.relationships.map(r => r.propertyName)).toContain('comments');
    });
  });

  describe('addIndex()', () => {
    it('should register index metadata', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addColumn(User, {
        propertyName: 'email',
        columnName: 'email',
        type: 'VARCHAR',
        nullable: false,
        isGenerated: false,
        isVersion: false
      });
      
      const indexMeta: IndexMetadata = {
        name: 'idx_email',
        columns: ['email'],
        unique: true
      };
      
      MetadataStorage.addIndex(User, indexMeta);
      
      const metadata = MetadataStorage.getEntity(User);
      expect(metadata?.indexes).toHaveLength(1);
      expect(metadata?.indexes[0].name).toBe('idx_email');
      expect(metadata?.indexes[0].unique).toBe(true);
    });

    it('should support composite indexes', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addColumn(User, {
        propertyName: 'name',
        columnName: 'name',
        type: 'VARCHAR',
        nullable: true,
        isGenerated: false,
        isVersion: false
      });
      MetadataStorage.addColumn(User, {
        propertyName: 'email',
        columnName: 'email',
        type: 'VARCHAR',
        nullable: false,
        isGenerated: false,
        isVersion: false
      });
      
      MetadataStorage.addIndex(User, {
        name: 'idx_name_email',
        columns: ['name', 'email'],
        unique: false
      });
      
      const metadata = MetadataStorage.getEntity(User);
      const index = metadata?.indexes[0];
      
      expect(index?.columns).toHaveLength(2);
      expect(index?.columns).toContain('name');
      expect(index?.columns).toContain('email');
    });
  });

  describe('addValidationRule()', () => {
    it('should register validation rule', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      
      const validationRule: ValidationRule = {
        propertyName: 'email',
        predicate: (entity: any) => /@/.test(entity.email),
        message: 'Invalid email format'
      };
      
      MetadataStorage.addValidationRule(User, validationRule);
      
      const rules = MetadataStorage.getValidationRules(User);
      expect(rules).toHaveLength(1);
      expect(rules[0].propertyName).toBe('email');
      expect(rules[0].message).toBe('Invalid email format');
    });

    it('should support multiple validation rules', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      
      MetadataStorage.addValidationRule(User, {
        propertyName: 'email',
        predicate: (entity: any) => /@/.test(entity.email),
        message: 'Invalid email'
      });
      
      MetadataStorage.addValidationRule(User, {
        propertyName: 'age',
        predicate: (entity: any) => entity.age >= 18,
        message: 'Must be 18 or older'
      });
      
      const rules = MetadataStorage.getValidationRules(User);
      expect(rules).toHaveLength(2);
    });
  });

  describe('getEntity()', () => {
    it('should return undefined for unregistered entity', () => {
      class UnregisteredEntity {}
      
      const metadata = MetadataStorage.getEntity(UnregisteredEntity);
      expect(metadata).toBeUndefined();
    });

    it('should return metadata for registered entity', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      
      const metadata = MetadataStorage.getEntity(User);
      expect(metadata).toBeDefined();
      expect(metadata?.target).toBe(User);
    });

    it('should handle null/undefined target gracefully', () => {
      expect(MetadataStorage.getEntity(null as any)).toBeUndefined();
      expect(MetadataStorage.getEntity(undefined as any)).toBeUndefined();
    });
  });

  describe('getEntities()', () => {
    it('should return empty array when no entities registered', () => {
      const entities = MetadataStorage.getEntities();
      expect(entities).toEqual([]);
    });

    it('should return all registered entities', () => {
      class User {}
      class Post {}
      class Comment {}
      
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addEntity(Post, 'posts');
      MetadataStorage.addEntity(Comment, 'comments');
      
      const entities = MetadataStorage.getEntities();
      expect(entities).toHaveLength(3);
    });
  });

  describe('clear()', () => {
    it('should clear all metadata', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addColumn(User, {
        propertyName: 'name',
        columnName: 'name',
        type: 'VARCHAR',
        nullable: true,
        isGenerated: false,
        isVersion: false
      });
      
      expect(MetadataStorage.getEntities()).toHaveLength(1);
      
      MetadataStorage.getInstance().clear();
      
      expect(MetadataStorage.getEntities()).toHaveLength(0);
    });

    it('should allow re-registration after clear', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      expect(MetadataStorage.getEntities()).toHaveLength(1);
      
      MetadataStorage.getInstance().clear();
      
      MetadataStorage.addEntity(User, 'users');
      expect(MetadataStorage.getEntities()).toHaveLength(1);
    });
  });

  describe('metadata finalization', () => {
    it('should finalize metadata on first access', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.addColumn(User, {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false,
        isGenerated: false,
        isVersion: false
      });
      
      const metadata = MetadataStorage.getEntity(User);
      expect(metadata?.columns).toBeDefined();
      expect(metadata?.columns).toHaveLength(1);
    });

    it('should return consistent metadata across multiple accesses', () => {
      class User {}
      
      MetadataStorage.addEntity(User, 'users');
      
      const metadata1 = MetadataStorage.getEntity(User);
      const metadata2 = MetadataStorage.getEntity(User);
      
      expect(metadata1).toBe(metadata2);
    });
  });

  describe('branded primary key support', () => {
    it('should support branded primary keys via API', () => {
      class User {}

      MetadataStorage.addEntity(User, 'users');

      const columnMeta: ColumnMetadata & { isBranded?: boolean; brand?: string } = {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false,
        isGenerated: true,
        isVersion: false,
        isBranded: true,
        brand: 'User'
      };

      MetadataStorage.addColumn(User, columnMeta);
      MetadataStorage.addPrimaryKey(User, 'id');

      const metadata = MetadataStorage.getEntity(User);
      const idColumn = metadata?.columns.find(c => c.propertyName === 'id') as typeof columnMeta | undefined;

      expect(idColumn).toBeDefined();
      expect(idColumn?.isGenerated).toBe(true);
      expect(idColumn?.isBranded).toBe(true);
      expect(idColumn?.brand).toBe('User');
      expect(metadata?.primaryKeys).toContain('id');
    });
  });

  describe('reset()', () => {
    it('should discard all entities registered before the call', () => {
      class User {}
      MetadataStorage.addEntity(User, 'users');
      expect(MetadataStorage.getEntities()).toHaveLength(1);

      MetadataStorage.reset();

      expect(MetadataStorage.getEntities()).toHaveLength(0);
      expect(MetadataStorage.getEntity(User)).toBeUndefined();
    });

    it('should allow registration after reset', () => {
      class User {}
      MetadataStorage.addEntity(User, 'users');
      MetadataStorage.reset();

      class Fresh {}
      MetadataStorage.addEntity(Fresh, 'fresh');

      expect(MetadataStorage.getEntities()).toHaveLength(1);
      expect(MetadataStorage.getEntity(Fresh)).toBeDefined();
    });

    it('getInstance() after reset() returns a new empty registry', () => {
      class User {}
      MetadataStorage.addEntity(User, 'users');
      const before = MetadataStorage.getInstance();

      MetadataStorage.reset();

      const after = MetadataStorage.getInstance();
      expect(after).not.toBe(before);
      expect(after.getEntities()).toHaveLength(0);
    });
  });

  describe('setDefaultRegistry()', () => {
    it('should replace the process-wide registry', () => {
      class User {}
      MetadataStorage.addEntity(User, 'users');

      const isolated = new MetadataRegistry();
      MetadataStorage.setDefaultRegistry(isolated);

      expect(MetadataStorage.getEntities()).toHaveLength(0);
      expect(MetadataStorage.getInstance()).toBe(isolated);
    });

    it('should allow restoring the previous registry', () => {
      class User {}
      MetadataStorage.addEntity(User, 'users');
      const original = MetadataStorage.getInstance();

      const temp = new MetadataRegistry();
      MetadataStorage.setDefaultRegistry(temp);
      expect(MetadataStorage.getEntities()).toHaveLength(0);

      MetadataStorage.setDefaultRegistry(original);
      expect(MetadataStorage.getEntities()).toHaveLength(1);
    });
  });
});
