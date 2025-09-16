import { TypedQueryable, typed } from './TypedQueryable';
import { Queryable } from './Queryable';
import { EntityId, brandId } from '../types';
import { DbContext } from '../context/DbContext';
import { Entity } from '../decorators/Entity';
import { Column } from '../decorators/Column';
import { PrimaryKey } from '../decorators/PrimaryKey';
import { OneToMany } from '../decorators/Relationships';

// Sample entity types for testing
type UserId = EntityId<number, 'User'>;
type OrderId = EntityId<string, 'Order'>;

@Entity({ name: 'users' })
class User {
  @PrimaryKey({ branded: true, type: 'INTEGER' })
  id!: UserId;

  @Column({ type: 'TEXT' })
  name!: string;

  @Column({ type: 'INTEGER' })
  age!: number;

  @Column({ type: 'TEXT' })
  email!: string;

  orders!: Order[];
}

@Entity({ name: 'orders' })
class Order {
  @PrimaryKey({ branded: true, type: 'TEXT' })
  id!: OrderId;

  @Column({ type: 'REAL' })
  amount!: number;

  @Column({ type: 'INTEGER' })
  userId!: UserId;

  user!: User;
}

describe('TypedQueryable', () => {
  let mockQueryable: jest.Mocked<Queryable<User>>;
  let typedQueryable: TypedQueryable<User>;

  beforeEach(() => {
    // Create a mock queryable
    mockQueryable = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      orderByDescending: jest.fn().mockReturnThis(),
      include: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      firstOrDefault: jest.fn().mockResolvedValue(null),
      single: jest.fn().mockResolvedValue(null),
      any: jest.fn().mockResolvedValue(true),
      toArray: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    } as any;

    typedQueryable = new TypedQueryable(mockQueryable);
  });

  describe('Type Safety', () => {
    it('should provide compile-time type safety for select operations', () => {
      // This test primarily validates TypeScript compilation
      // In a real scenario, these would be compile-time errors:

      // ✅ Valid selections should compile
      const validQuery = typedQueryable.select(u => ({
        id: u.id,
        name: u.name,
        age: u.age
      }));

      expect(validQuery).toBeInstanceOf(TypedQueryable);
      expect(mockQueryable.select).toHaveBeenCalledTimes(1);
    });

    it('should provide type safety for where clauses', () => {
      // ✅ Valid where clauses should compile
      const query1 = typedQueryable.where(u => u.age > 18);
      const query2 = typedQueryable.where(u => u.name === 'John');

      expect(query1).toBeInstanceOf(TypedQueryable);
      expect(query2).toBeInstanceOf(TypedQueryable);
      expect(mockQueryable.where).toHaveBeenCalledTimes(2);
    });

    it('should provide type safety for orderBy operations', () => {
      // ✅ Valid order by operations should compile
      const query1 = typedQueryable.orderBy(u => u.name);
      const query2 = typedQueryable.orderBy(u => u.age, 'DESC');

      expect(query1).toBeInstanceOf(TypedQueryable);
      expect(query2).toBeInstanceOf(TypedQueryable);
      expect(mockQueryable.orderBy).toHaveBeenCalledTimes(1); // ASC case
      expect(mockQueryable.orderByDescending).toHaveBeenCalledTimes(1); // DESC case
    });

    it('should provide type safety for include operations', () => {
      // ✅ Valid include operations should compile
      const query = typedQueryable.include(u => u.orders);

      expect(query).toBeInstanceOf(TypedQueryable);
      expect(mockQueryable.include).toHaveBeenCalledTimes(1);
    });
  });

  describe('Method Chaining', () => {
    it('should support fluent method chaining', () => {
      const query = typedQueryable
        .where(u => u.age > 18)
        .orderBy(u => u.name)
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
        { id: brandId<number, 'User'>(1), name: 'John', age: 25, email: 'john@example.com' } as User
      ]);

      const results = await typedQueryable.toArray();
      expect(Array.isArray(results)).toBe(true);
      expect(mockQueryable.toArray).toHaveBeenCalledTimes(1);
    });
  });

  describe('Execution Methods', () => {
    beforeEach(() => {
      const mockUsers = [
        { id: brandId<number, 'User'>(1), name: 'John', age: 25, email: 'john@example.com' } as User,
        { id: brandId<number, 'User'>(2), name: 'Jane', age: 30, email: 'jane@example.com' } as User,
        { id: brandId<number, 'User'>(3), name: 'Bob', age: 20, email: 'bob@example.com' } as User
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
      const mockUser = { id: brandId<number, 'User'>(1), name: 'John', age: 25, email: 'john@example.com' } as User;
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

      await expect(typedQueryable.single()).rejects.toThrow('Sequence contains more than one element');
    });

    it('should execute any() correctly', async () => {
      const hasResults = await typedQueryable.any();
      expect(hasResults).toBe(true);
      expect(mockQueryable.any).toHaveBeenCalledTimes(1);
    });
  });

  // Aggregation methods have been removed to prevent performance issues.
  // They previously materialized all rows in memory which is problematic for large datasets.

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
      // This test validates TypeScript compilation with branded types
      const userId: UserId = brandId<number, 'User'>(123);
      const orderId: OrderId = brandId<string, 'Order'>('order-456');

      // These should compile without errors
      expect(typeof userId).toBe('number');
      expect(typeof orderId).toBe('string');

      // At runtime, branded types are just their underlying types
      expect(userId).toBe(123);
      expect(orderId).toBe('order-456');
    });
  });
});