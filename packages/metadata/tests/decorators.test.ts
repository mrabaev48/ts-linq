import { MetadataStorage } from '../src/MetadataStorage';
import { Entity } from '../src/Entity';
import { Column } from '../src/Column';
import { PrimaryKey } from '../src/PrimaryKey';
import { OneToMany, ManyToOne, OneToOne, ManyToMany } from '../src/Relationships';
import { ComputedColumn } from '../src/ComputedColumn';
import { DatabaseFunction } from '../src/DatabaseFunction';
import { ValidIf, RequiredIfOf, MinLengthOf, MaxLengthOf, PatternOf, RangeOf } from '../src/ValidIf';
import { CachePolicy, getCachePolicy } from '../src/CachePolicy';

describe('Decorators', () => {
  afterEach(() => {
    MetadataStorage.getInstance().clear();
  });

  describe('@Entity', () => {
    it('should register entity with custom table name', () => {
      class User {}
      
      Entity({ name: 'custom_users' })(User);
      
      const metadata = MetadataStorage.getEntity(User);
      expect(metadata).toBeDefined();
      expect(metadata?.tableName).toBe('custom_users');
    });

    it('should register entity with default table name', () => {
      class Product {}
      
      Entity()(Product);
      
      const metadata = MetadataStorage.getEntity(Product);
      expect(metadata).toBeDefined();
      expect(metadata?.tableName).toBe('Product');
    });
  });

  describe('@Column', () => {
    it('should register column with all options', () => {
      class User {}
      
      Column({
        name: 'user_email',
        type: 'VARCHAR',
        nullable: false,
        length: 255,
        defaultValue: 'unknown@example.com'
      })(User.prototype, 'email');
      
      const metadata = MetadataStorage.getEntity(User);
      const column = metadata?.columns.find(c => c.propertyName === 'email');
      
      expect(column).toBeDefined();
      expect(column?.columnName).toBe('user_email');
      expect(column?.type).toBe('VARCHAR');
      expect(column?.nullable).toBe(false);
      expect(column?.length).toBe(255);
      expect(column?.defaultValue).toBe('unknown@example.com');
    });

    it('should use defaults for minimal options', () => {
      class Product {}
      
      Column()(Product.prototype, 'title');
      
      const metadata = MetadataStorage.getEntity(Product);
      const column = metadata?.columns.find(c => c.propertyName === 'title');
      
      expect(column?.columnName).toBe('title');
      expect(column?.type).toBe('TEXT');
      expect(column?.nullable).toBe(true);
    });

    it('should support version column', () => {
      class Document {}
      
      Column({ version: true, type: 'INTEGER' })(Document.prototype, 'version');
      
      const metadata = MetadataStorage.getEntity(Document);
      const column = metadata?.columns.find(c => c.propertyName === 'version');
      
      expect(column?.isVersion).toBe(true);
    });
  });

  describe('@PrimaryKey', () => {
    it('should register primary key with auto-increment', () => {
      class User {}
      
      PrimaryKey({ autoIncrement: true })(User.prototype, 'id');
      
      const metadata = MetadataStorage.getEntity(User);
      const column = metadata?.columns.find(c => c.propertyName === 'id');
      
      expect(column).toBeDefined();
      expect(column?.type).toBe('INTEGER');
      expect(column?.nullable).toBe(false);
      expect(column?.isGenerated).toBe(true);
      expect(metadata?.primaryKeys).toContain('id');
    });

    it('should support branded primary keys', () => {
      class User {}
      
      PrimaryKey({ branded: true, autoIncrement: true })(User.prototype, 'id');
      
      const metadata = MetadataStorage.getEntity(User);
      const column = metadata?.columns.find(c => c.propertyName === 'id') as any;
      
      expect(column?.isBranded).toBe(true);
      expect(column?.brand).toBe('User');
    });

    it('should support custom type', () => {
      class Product {}
      
      PrimaryKey({ type: 'UUID' })(Product.prototype, 'id');
      
      const metadata = MetadataStorage.getEntity(Product);
      const column = metadata?.columns.find(c => c.propertyName === 'id');
      
      expect(column?.type).toBe('UUID');
    });
  });

  describe('Relationship decorators', () => {
    it('should register one-to-many relationship', () => {
      class User {}
      class Post {}
      
      OneToMany(() => Post, { inverseSide: 'author' })(User.prototype, 'posts');
      
      const metadata = MetadataStorage.getEntity(User);
      const relationship = metadata?.relationships.find(r => r.propertyName === 'posts');
      
      expect(relationship).toBeDefined();
      expect(relationship?.type).toBe('one-to-many');
      expect(relationship?.targetEntity).toBe(Post);
      expect(relationship?.inverseSide).toBe('author');
    });

    it('should register many-to-one relationship', () => {
      class Post {}
      class User {}
      
      ManyToOne(() => User, { foreignKey: 'userId' })(Post.prototype, 'author');
      
      const metadata = MetadataStorage.getEntity(Post);
      const relationship = metadata?.relationships.find(r => r.propertyName === 'author');
      
      expect(relationship?.type).toBe('many-to-one');
      expect(relationship?.foreignKey).toBe('userId');
    });

    it('should register one-to-one relationship', () => {
      class User {}
      class Profile {}
      
      OneToOne(() => Profile, { cascade: true })(User.prototype, 'profile');
      
      const metadata = MetadataStorage.getEntity(User);
      const relationship = metadata?.relationships.find(r => r.propertyName === 'profile');
      
      expect(relationship?.type).toBe('one-to-one');
      expect(relationship?.cascade).toBe(true);
    });

    it('should register many-to-many relationship', () => {
      class Student {}
      class Course {}
      
      ManyToMany(() => Course, {
        through: {
          table: 'student_courses',
          sourceFk: 'studentId',
          targetFk: 'courseId'
        }
      })(Student.prototype, 'courses');
      
      const metadata = MetadataStorage.getEntity(Student);
      const relationship = metadata?.relationships.find(r => r.propertyName === 'courses');
      
      expect(relationship?.type).toBe('many-to-many');
      expect(relationship?.through).toBeDefined();
    });
  });

  describe('@ComputedColumn', () => {
    it('should register computed column', () => {
      class User {}
      
      ComputedColumn({ expression: 'CONCAT(firstName, " ", lastName)' })(User.prototype, 'fullName');
      
      const metadata = MetadataStorage.getEntity(User);
      const column = metadata?.columns.find(c => c.propertyName === 'fullName');
      
      expect(column).toBeDefined();
      expect(column?.isComputed).toBe(true);
      expect(column?.computedExpression).toBe('CONCAT(firstName, " ", lastName)');
    });

    it('should support custom column name', () => {
      class Product {}
      
      ComputedColumn({
        name: 'total_price',
        expression: 'price * quantity'
      })(Product.prototype, 'totalPrice');
      
      const metadata = MetadataStorage.getEntity(Product);
      const column = metadata?.columns.find(c => c.propertyName === 'totalPrice');
      
      expect(column?.columnName).toBe('total_price');
    });
  });

  describe('@DatabaseFunction', () => {
    it('should register database function with simple expression', () => {
      class Order {}
      
      DatabaseFunction('NOW()')(Order.prototype, 'createdAt');
      
      const metadata = MetadataStorage.getEntity(Order);
      const column = metadata?.columns.find(c => c.propertyName === 'createdAt');
      
      expect(column).toBeDefined();
      expect(column?.defaultExpression).toBe('NOW()');
    });

    it('should support dialect-specific expressions', () => {
      class Event {}
      
      DatabaseFunction({
        sqlite: 'datetime("now")',
        postgresql: 'NOW()',
        mysql: 'NOW()',
        default: 'CURRENT_TIMESTAMP'
      })(Event.prototype, 'timestamp');
      
      const metadata = MetadataStorage.getEntity(Event);
      const column = metadata?.columns.find(c => c.propertyName === 'timestamp');
      
      expect(column?.defaultExpression).toBe('CURRENT_TIMESTAMP');
      expect(column?.defaultExpressionDialect).toBeDefined();
      expect(column?.defaultExpressionDialect?.sqlite).toBe('datetime("now")');
    });
  });

  describe('Validation decorators', () => {
    it('@ValidIf should register custom validation', () => {
      class User {}
      
      ValidIf((entity: any) => entity.age >= 18, 'Must be 18 or older')(User.prototype, 'age');
      
      const rules = MetadataStorage.getValidationRules(User);
      
      expect(rules).toHaveLength(1);
      expect(rules[0].propertyName).toBe('age');
      expect(rules[0].message).toBe('Must be 18 or older');
    });

    it('@RequiredIfOf should validate conditional requirement', () => {
      class Order {}
      
      RequiredIfOf((entity: any) => entity.isPaid, 'Payment details required')(Order.prototype, 'paymentMethod');
      
      const rules = MetadataStorage.getValidationRules(Order);
      
      expect(rules).toHaveLength(1);
      expect(rules[0].propertyName).toBe('paymentMethod');
    });

    it('@MinLengthOf should validate minimum length', () => {
      class User {}
      
      MinLengthOf(8, 'Password too short')(User.prototype, 'password');
      
      const rules = MetadataStorage.getValidationRules(User);
      const rule = rules.find(r => r.propertyName === 'password');
      
      expect(rule).toBeDefined();
      expect(rule?.message).toBe('Password too short');
    });

    it('@MaxLengthOf should validate maximum length', () => {
      class User {}
      
      MaxLengthOf(100)(User.prototype, 'bio');
      
      const rules = MetadataStorage.getValidationRules(User);
      const rule = rules.find(r => r.propertyName === 'bio');
      
      expect(rule?.message).toContain('<=');
    });

    it('@PatternOf should validate regex pattern', () => {
      class User {}
      
      PatternOf(/^[a-z0-9]+$/i, 'Invalid username format')(User.prototype, 'username');
      
      const rules = MetadataStorage.getValidationRules(User);
      const rule = rules.find(r => r.propertyName === 'username');
      
      expect(rule).toBeDefined();
      expect(rule?.message).toBe('Invalid username format');
    });

    it('@RangeOf should validate numeric range', () => {
      class Product {}
      
      RangeOf(0, 100, 'Score must be 0-100')(Product.prototype, 'score');
      
      const rules = MetadataStorage.getValidationRules(Product);
      const rule = rules.find(r => r.propertyName === 'score');
      
      expect(rule?.message).toBe('Score must be 0-100');
    });

    it('should support multiple validation rules', () => {
      class User {}
      
      MinLengthOf(3)(User.prototype, 'username');
      MaxLengthOf(20)(User.prototype, 'username');
      PatternOf(/^[a-z0-9]+$/)(User.prototype, 'username');
      
      const rules = MetadataStorage.getValidationRules(User);
      const usernameRules = rules.filter(r => r.propertyName === 'username');
      
      expect(usernameRules).toHaveLength(3);
    });
  });

  describe('@CachePolicy', () => {
    it('should register cache policy', () => {
      class User {}
      
      CachePolicy({ ttl: 3600, invalidateOn: ['Post', 'Comment'] })(User);
      
      const policy = getCachePolicy(User);
      
      expect(policy).toBeDefined();
      expect(policy?.ttl).toBe(3600);
      expect(policy?.invalidateOn).toEqual(['Post', 'Comment']);
    });

    it('should support minimal cache policy', () => {
      class Product {}
      
      CachePolicy({ ttl: 300 })(Product);
      
      const policy = getCachePolicy(Product);
      
      expect(policy?.ttl).toBe(300);
      expect(policy?.invalidateOn).toBeUndefined();
    });
  });

  describe('decorator execution order', () => {
    it('should preserve metadata when property decorators run before class decorator', () => {
      class User {}
      
      // Property decorators first (execute before class decorator)
      PrimaryKey({ autoIncrement: true })(User.prototype, 'id');
      Column({ type: 'VARCHAR' })(User.prototype, 'name');
      Column({ type: 'VARCHAR' })(User.prototype, 'email');
      
      // Class decorator last
      Entity({ name: 'users' })(User);
      
      const metadata = MetadataStorage.getEntity(User);
      
      expect(metadata?.tableName).toBe('users');
      expect(metadata?.columns).toHaveLength(3);
      expect(metadata?.primaryKeys).toContain('id');
    });

    it('should handle mixed decorator types', () => {
      class Post {}
      class User {}
      
      PrimaryKey()(Post.prototype, 'id');
      Column({ type: 'VARCHAR' })(Post.prototype, 'title');
      ManyToOne(() => User)(Post.prototype, 'author');
      ValidIf((e: any) => e.title.length > 0)(Post.prototype, 'title');
      Entity({ name: 'posts' })(Post);
      
      const metadata = MetadataStorage.getEntity(Post);
      
      expect(metadata?.tableName).toBe('posts');
      expect(metadata?.columns).toHaveLength(2);
      expect(metadata?.relationships).toHaveLength(1);
      expect(MetadataStorage.getValidationRules(Post)).toHaveLength(1);
    });
  });
});
