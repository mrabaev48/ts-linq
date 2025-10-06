'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const TypedQueryable_1 = require('../../src/query/TypedQueryable');
const types_1 = require('../../src/types');
const MetadataStorage_1 = require('../../src/metadata/MetadataStorage');
class User {}
class Order {}
// Manually register metadata for test entities (avoids decorator emit differences)
(function registerTestMetadata() {
  MetadataStorage_1.MetadataStorage.addEntity(User, 'users');
  const userIdCol = {
    propertyName: 'id',
    columnName: 'id',
    type: 'INTEGER',
    nullable: false,
    isGenerated: false
  };
  const userNameCol = {
    propertyName: 'name',
    columnName: 'name',
    type: 'TEXT',
    nullable: false
  };
  const userAgeCol = {
    propertyName: 'age',
    columnName: 'age',
    type: 'INTEGER',
    nullable: false
  };
  const userEmailCol = {
    propertyName: 'email',
    columnName: 'email',
    type: 'TEXT',
    nullable: false
  };
  MetadataStorage_1.MetadataStorage.addColumn(User, userIdCol);
  MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
  MetadataStorage_1.MetadataStorage.addColumn(User, userNameCol);
  MetadataStorage_1.MetadataStorage.addColumn(User, userAgeCol);
  MetadataStorage_1.MetadataStorage.addColumn(User, userEmailCol);
  MetadataStorage_1.MetadataStorage.addEntity(Order, 'orders');
  const orderIdCol = {
    propertyName: 'id',
    columnName: 'id',
    type: 'TEXT',
    nullable: false,
    isGenerated: false
  };
  const orderAmountCol = {
    propertyName: 'amount',
    columnName: 'amount',
    type: 'REAL',
    nullable: false
  };
  const orderUserIdCol = {
    propertyName: 'userId',
    columnName: 'userId',
    type: 'INTEGER',
    nullable: false
  };
  MetadataStorage_1.MetadataStorage.addColumn(Order, orderIdCol);
  MetadataStorage_1.MetadataStorage.addPrimaryKey(Order, 'id');
  MetadataStorage_1.MetadataStorage.addColumn(Order, orderAmountCol);
  MetadataStorage_1.MetadataStorage.addColumn(Order, orderUserIdCol);
})();
describe('TypedQueryable', () => {
  let mockQueryable;
  let typedQueryable;
  beforeEach(() => {
    // Create a mock queryable
    const q = {
      select: jest.fn(function () {
        return this;
      }),
      where: jest.fn(function () {
        return this;
      }),
      orderBy: jest.fn(function () {
        return this;
      }),
      orderByDescending: jest.fn(function () {
        return this;
      }),
      include: jest.fn(function () {
        return this;
      }),
      take: jest.fn(function () {
        return this;
      }),
      skip: jest.fn(function () {
        return this;
      }),
      distinct: jest.fn(function () {
        return this;
      }),
      first: jest.fn(async () => ({
        id: (0, types_1.brandId)(0),
        name: '',
        age: 0,
        email: ''
      })),
      firstOrDefault: jest.fn(async () => null),
      single: jest.fn(async () => ({
        id: (0, types_1.brandId)(1),
        name: 's',
        age: 1,
        email: 'e'
      })),
      any: jest.fn(async () => true),
      toArray: jest.fn(async () => []),
      count: jest.fn(async () => 0)
    };
    mockQueryable = q;
    typedQueryable = new TypedQueryable_1.TypedQueryable(mockQueryable);
  });
  describe('Type Safety', () => {
    it('should provide compile-time type safety for select operations', () => {
      const validQuery = typedQueryable.select((u) => ({
        id: u.id,
        name: u.name,
        age: u.age
      }));
      expect(validQuery).toBeInstanceOf(TypedQueryable_1.TypedQueryable);
      expect(mockQueryable.select).toHaveBeenCalledTimes(1);
    });
    it('should provide type safety for where clauses', () => {
      const query1 = typedQueryable.where((u) => u.age > 18);
      const query2 = typedQueryable.where((u) => u.name === 'John');
      expect(query1).toBeInstanceOf(TypedQueryable_1.TypedQueryable);
      expect(query2).toBeInstanceOf(TypedQueryable_1.TypedQueryable);
      expect(mockQueryable.where).toHaveBeenCalledTimes(2);
    });
    it('should provide type safety for orderBy operations', () => {
      const query1 = typedQueryable.orderBy((u) => u.name);
      const query2 = typedQueryable.orderBy((u) => u.age, 'DESC');
      expect(query1).toBeInstanceOf(TypedQueryable_1.TypedQueryable);
      expect(query2).toBeInstanceOf(TypedQueryable_1.TypedQueryable);
      expect(mockQueryable.orderBy).toHaveBeenCalledTimes(1);
      expect(mockQueryable.orderByDescending).toHaveBeenCalledTimes(1);
    });
    it('should provide type safety for include operations', () => {
      const query = typedQueryable.include((u) => u.orders);
      expect(query).toBeInstanceOf(TypedQueryable_1.TypedQueryable);
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
      expect(query).toBeInstanceOf(TypedQueryable_1.TypedQueryable);
      expect(mockQueryable.where).toHaveBeenCalledTimes(1);
      expect(mockQueryable.orderBy).toHaveBeenCalledTimes(1);
      expect(mockQueryable.take).toHaveBeenCalledTimes(1);
      expect(mockQueryable.skip).toHaveBeenCalledTimes(1);
    });
    it('should return proper types for result operations', async () => {
      mockQueryable.toArray.mockResolvedValue([
        {
          id: (0, types_1.brandId)(1),
          name: 'John',
          age: 25,
          email: 'john@example.com'
        }
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
          id: (0, types_1.brandId)(1),
          name: 'John',
          age: 25,
          email: 'john@example.com'
        },
        {
          id: (0, types_1.brandId)(2),
          name: 'Jane',
          age: 30,
          email: 'jane@example.com'
        },
        {
          id: (0, types_1.brandId)(3),
          name: 'Bob',
          age: 20,
          email: 'bob@example.com'
        }
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
        id: (0, types_1.brandId)(1),
        name: 'John',
        age: 25,
        email: 'john@example.com'
      };
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
      const typedFromHelper = (0, TypedQueryable_1.typed)(mockQueryable);
      expect(typedFromHelper).toBeInstanceOf(TypedQueryable_1.TypedQueryable);
    });
    it('should provide access to raw queryable when needed', () => {
      const rawQueryable = typedQueryable.raw;
      expect(rawQueryable).toBe(mockQueryable);
    });
  });
  describe('Branded ID Type Safety', () => {
    it('should work with branded ID types', () => {
      const userId = (0, types_1.brandId)(123);
      const orderId = (0, types_1.brandId)('order-456');
      expect(typeof userId).toBe('number');
      expect(typeof orderId).toBe('string');
      expect(userId).toBe(123);
      expect(orderId).toBe('order-456');
    });
  });
});
//# sourceMappingURL=TypedQueryable.test.js.map
