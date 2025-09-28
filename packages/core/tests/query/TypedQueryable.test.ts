import { TypedQueryable, typed } from './TypedQueryable';
import type { Queryable } from './Queryable';
import type { EntityId } from '../types';
import { brandId, type ColumnMetadata } from '../types';
import { DbContext } from '../context/DbContext';
import { MetadataStorage } from '../metadata/MetadataStorage';

// Sample entity types for testing
type UserId = EntityId<number, 'User'>;
type OrderId = EntityId<string, 'Order'>;

class User {
  id!: UserId;
  name!: string;
  age!: number;
  email!: string;
  orders!: Order[];
}

class Order {
  id!: OrderId;
  amount!: number;
  userId!: UserId;
  user!: User;
}

// Manually register metadata for test entities (avoids decorator emit differences)
(function registerTestMetadata() {
  MetadataStorage.addEntity(User, 'users');
  const userIdCol: ColumnMetadata = {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false,
    isGenerated: false
  };
  const userNameCol: ColumnMetadata = {
    propertyName: 'name',
    columnName: 'name',
    type: 'TEXT',
    nullable: false
  };
  const userAgeCol: ColumnMetadata = {
    propertyName: 'age',
    columnName: 'age',
    type: 'INTEGER',
    nullable: false
  };
  const userEmailCol: ColumnMetadata = {
    propertyName: 'email',
    columnName: 'email',
    type: 'TEXT',
    nullable: false
  };
  MetadataStorage.addColumn(User, userIdCol);
  MetadataStorage.addPrimaryKey(User, 'id');
  MetadataStorage.addColumn(User, userNameCol);
  MetadataStorage.addColumn(User, userAgeCol);
  MetadataStorage.addColumn(User, userEmailCol);

  MetadataStorage.addEntity(Order, 'orders');
  const orderIdCol: ColumnMetadata = {
    propertyName: 'id',
    columnName: 'id',
    type: 'TEXT',
    nullable: false,
    isGenerated: false
  };
  const orderAmountCol: ColumnMetadata = {
    propertyName: 'amount',
    columnName: 'amount',
    type: 'REAL',
    nullable: false
  };
  const orderUserIdCol: ColumnMetadata = {
    propertyName: 'userId',
    columnName: 'userId',
    type: 'INTEGER',
    nullable: false
  };
  MetadataStorage.addColumn(Order, orderIdCol);
  MetadataStorage.addPrimaryKey(Order, 'id');
  MetadataStorage.addColumn(Order, orderAmountCol);
  MetadataStorage.addColumn(Order, orderUserIdCol);
})();

describe('TypedQueryable', () => {
  let mockQueryable: jest.Mocked<Queryable<User>>;
  let typedQueryable: TypedQueryable<User>;

  beforeEach(() => {
    // Create a mock queryable
    const q: Partial<jest.Mocked<Queryable<User>>> = {
      select: jest.fn(function (this: Queryable<User>) {
        return this;
      }) as unknown as jest.Mock,
      where: jest.fn(function (this: Queryable<User>) {
        return this;
      }) as unknown as jest.Mock,
      orderBy: jest.fn(function (this: Queryable<User>) {
        return this;
      }) as unknown as jest.Mock,
      orderByDescending: jest.fn(function (this: Queryable<User>) {
        return this;
      }) as unknown as jest.Mock,
      include: jest.fn(function (this: Queryable<User>) {
        return this;
      }) as unknown as jest.Mock,
      take: jest.fn(function (this: Queryable<User>) {
        return this;
      }) as unknown as jest.Mock,
      skip: jest.fn(function (this: Queryable<User>) {
        return this;
      }) as unknown as jest.Mock,
      distinct: jest.fn(function (this: Queryable<User>) {
        return this;
      }) as unknown as jest.Mock,
      first: jest.fn(
        async () =>
          ({
            id: brandId<number, 'User'>(0) as unknown as UserId,
            name: '',
            age: 0,
            email: ''
          }) as User
      ),
      firstOrDefault: jest.fn(async () => null as User | null),
      single: jest.fn(
        async () =>
          ({
            id: brandId<number, 'User'>(1) as unknown as UserId,
            name: 's',
            age: 1,
            email: 'e'
          }) as User
      ),
      any: jest.fn(async () => true),
      toArray: jest.fn(async () => [] as User[]),
      count: jest.fn(async () => 0)
    };
    mockQueryable = q as unknown as jest.Mocked<Queryable<User>>;

    typedQueryable = new TypedQueryable(mockQueryable);
  });

  describe('Type Safety', () => {
    it('should provide compile-time type safety for select operations', () => {
      const validQuery = typedQueryable.select((u) => ({
        id: u.id,
        name: u.name,
        age: u.age
      }));

      expect(validQuery).toBeInstanceOf(TypedQueryable);
      expect(mockQueryable.select).toHaveBeenCalledTimes(1);
    });

    it('should provide type safety for where clauses', () => {
      const query1 = typedQueryable.where((u) => u.age > 18);
      const query2 = typedQueryable.where((u) => u.name === 'John');

      expect(query1).toBeInstanceOf(TypedQueryable);
      expect(query2).toBeInstanceOf(TypedQueryable);
      expect(mockQueryable.where).toHaveBeenCalledTimes(2);
    });

    it('should provide type safety for orderBy operations', () => {
      const query1 = typedQueryable.orderBy((u) => u.name);
      const query2 = typedQueryable.orderBy((u) => u.age, 'DESC');

      expect(query1).toBeInstanceOf(TypedQueryable);
      expect(query2).toBeInstanceOf(TypedQueryable);
      expect(mockQueryable.orderBy).toHaveBeenCalledTimes(1);
      expect(mockQueryable.orderByDescending).toHaveBeenCalledTimes(1);
    });

    it('should provide type safety for include operations', () => {
      const query = typedQueryable.include((u) => u.orders);

      expect(query).toBeInstanceOf(TypedQueryable);
      expect(mockQueryable.include).toHaveBeenCalledTimes(1);
    });
  });

  describe('Method Chaining', () => {
    it('should support fluent method chaining', () => {
      const query = typedQueryable
        .where((u) => u.age > 18)
        .orderBy((u) => u.name)
        .take(10)
        .skip(5);

      expect(query).toBeInstanceOf(TypedQueryable);
      expect(mockQueryable.where).toHaveBeenCalledTimes(1);
      expect(mockQueryable.orderBy).toHaveBeenCalledTimes(1);
      expect(mockQueryable.take).toHaveBeenCalledTimes(1);
      expect(mockQueryable.skip).toHaveBeenCalledTimes(1);
    });

    it('should return proper types for result operations', async () => {
      mockQueryable.toArray.mockResolvedValue([
        {
          id: brandId<number, 'User'>(1) as unknown as UserId,
          name: 'John',
          age: 25,
          email: 'john@example.com'
        } as User
      ]);

      const results = await typedQueryable.toArray();
      expect(Array.isArray(results)).toBe(true);
      expect(mockQueryable.toArray).toHaveBeenCalledTimes(1);
    });
  });

  describe('Execution Methods', () => {
    beforeEach(() => {
      const mockUsers = [
        {
          id: brandId<number, 'User'>(1) as unknown as UserId,
          name: 'John',
          age: 25,
          email: 'john@example.com'
        } as User,
        {
          id: brandId<number, 'User'>(2) as unknown as UserId,
          name: 'Jane',
          age: 30,
          email: 'jane@example.com'
        } as User,
        {
          id: brandId<number, 'User'>(3) as unknown as UserId,
          name: 'Bob',
          age: 20,
          email: 'bob@example.com'
        } as User
      ];
      mockQueryable.toArray.mockResolvedValue(mockUsers);
      mockQueryable.first.mockResolvedValue(mockUsers[0]);
      mockQueryable.count.mockResolvedValue(mockUsers.length);
    });

    it('should execute first() correctly', async () => {
      const result = await typedQueryable.first();
      expect(result).toBeTruthy();
      expect(mockQueryable.first).toHaveBeenCalledTimes(1);
    });

    it('should execute toArray() correctly', async () => {
      const results = await typedQueryable.toArray();
      expect(results).toHaveLength(3);
      expect(mockQueryable.toArray).toHaveBeenCalledTimes(1);
    });

    it('should execute count() correctly', async () => {
      const count = await typedQueryable.count();
      expect(count).toBe(3);
      expect(mockQueryable.count).toHaveBeenCalledTimes(1);
    });

    it('should execute single() correctly', async () => {
      const mockUser = {
        id: brandId<number, 'User'>(1) as unknown as UserId,
        name: 'John',
        age: 25,
        email: 'john@example.com'
      } as User;
      mockQueryable.single.mockResolvedValue(mockUser);

      const result = await typedQueryable.single();
      expect(result).toBeTruthy();
      expect(result.name).toBe('John');
    });

    it('should throw error in single() when no elements', async () => {
      mockQueryable.single.mockRejectedValue(new Error('Sequence contains no elements'));

      await expect(typedQueryable.single()).rejects.toThrow('Sequence contains no elements');
    });

    it('should throw error in single() when multiple elements', async () => {
      mockQueryable.single.mockRejectedValue(new Error('Sequence contains more than one element'));

      await expect(typedQueryable.single()).rejects.toThrow(
        'Sequence contains more than one element'
      );
    });

    it('should execute any() correctly', async () => {
      const hasResults = await typedQueryable.any();
      expect(hasResults).toBe(true);
      expect(mockQueryable.any).toHaveBeenCalledTimes(1);
    });
  });

  describe('Utility Functions', () => {
    it('should create typed queryable from regular queryable using helper function', () => {
      const typedFromHelper = typed(mockQueryable);
      expect(typedFromHelper).toBeInstanceOf(TypedQueryable);
    });

    it('should provide access to raw queryable when needed', () => {
      const rawQueryable = typedQueryable.raw;
      expect(rawQueryable).toBe(mockQueryable);
    });
  });

  describe('Branded ID Type Safety', () => {
    it('should work with branded ID types', () => {
      const userId: UserId = brandId<number, 'User'>(123);
      const orderId: OrderId = brandId<string, 'Order'>('order-456');
      expect(typeof userId).toBe('number');
      expect(typeof orderId).toBe('string');
      expect(userId).toBe(123);
      expect(orderId).toBe('order-456');
    });
  });
});
