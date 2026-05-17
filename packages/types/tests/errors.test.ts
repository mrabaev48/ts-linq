import {
  DatabaseError,
  ForeignKeyConstraintError,
  OptimisticConcurrencyError,
  UniqueConstraintError,
  ValidationError
} from '../src/errors';

describe('Error Classes', () => {
  describe('DatabaseError', () => {
    it('should create error with message', () => {
      const error = new DatabaseError('Database connection failed');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.message).toBe('Database connection failed');
      expect(error.name).toBe('DatabaseError');
    });

    it('should accept optional cause', () => {
      const cause = new Error('Connection timeout');
      const error = new DatabaseError('Database error', cause);

      expect(error.cause).toBe(cause);
      expect(error.message).toBe('Database error');
    });

    it('should work without cause', () => {
      const error = new DatabaseError('Database error');

      expect(error.cause).toBeUndefined();
    });

    it('should maintain proper prototype chain', () => {
      const error = new DatabaseError('Test');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof DatabaseError).toBe(true);
    });

    it('should have stack trace', () => {
      const error = new DatabaseError('Test error');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('OptimisticConcurrencyError', () => {
    it('should create error with message', () => {
      const error = new OptimisticConcurrencyError('Concurrency conflict detected');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(OptimisticConcurrencyError);
      expect(error.message).toBe('Concurrency conflict detected');
      expect(error.name).toBe('OptimisticConcurrencyError');
    });

    it('should extend DatabaseError', () => {
      const error = new OptimisticConcurrencyError('Test');

      expect(error instanceof DatabaseError).toBe(true);
    });

    it('should have proper error name', () => {
      const error = new OptimisticConcurrencyError('Version mismatch');

      expect(error.name).toBe('OptimisticConcurrencyError');
    });
  });

  describe('UniqueConstraintError', () => {
    it('should create error with message only', () => {
      const error = new UniqueConstraintError('Unique constraint violation');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(UniqueConstraintError);
      expect(error.message).toBe('Unique constraint violation');
      expect(error.name).toBe('UniqueConstraintError');
    });

    it('should accept table parameter', () => {
      const error = new UniqueConstraintError('Duplicate entry', 'users');

      expect(error.table).toBe('users');
      expect(error.column).toBeUndefined();
    });

    it('should accept table and column parameters', () => {
      const error = new UniqueConstraintError('Duplicate email', 'users', 'email');

      expect(error.table).toBe('users');
      expect(error.column).toBe('email');
    });

    it('should work with undefined table and column', () => {
      const error = new UniqueConstraintError('Error');

      expect(error.table).toBeUndefined();
      expect(error.column).toBeUndefined();
    });

    it('should extend DatabaseError', () => {
      const error = new UniqueConstraintError('Test');

      expect(error instanceof DatabaseError).toBe(true);
    });
  });

  describe('ForeignKeyConstraintError', () => {
    it('should create error with message only', () => {
      const error = new ForeignKeyConstraintError('Foreign key constraint failed');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error).toBeInstanceOf(ForeignKeyConstraintError);
      expect(error.message).toBe('Foreign key constraint failed');
      expect(error.name).toBe('ForeignKeyConstraintError');
    });

    it('should accept table parameter', () => {
      const error = new ForeignKeyConstraintError('FK violation', 'orders');

      expect(error.table).toBe('orders');
      expect(error.constraint).toBeUndefined();
    });

    it('should accept table and constraint parameters', () => {
      const error = new ForeignKeyConstraintError('FK violation', 'orders', 'fk_orders_user_id');

      expect(error.table).toBe('orders');
      expect(error.constraint).toBe('fk_orders_user_id');
    });

    it('should work with undefined table and constraint', () => {
      const error = new ForeignKeyConstraintError('Error');

      expect(error.table).toBeUndefined();
      expect(error.constraint).toBeUndefined();
    });

    it('should extend DatabaseError', () => {
      const error = new ForeignKeyConstraintError('Test');

      expect(error instanceof DatabaseError).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('should create error with message', () => {
      const error = new ValidationError('Validation failed');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed');
      expect(error.name).toBe('ValidationError');
    });

    it('should NOT extend DatabaseError', () => {
      const error = new ValidationError('Test');

      expect(error instanceof DatabaseError).toBe(false);
      expect(error instanceof Error).toBe(true);
    });

    it('should have proper error name', () => {
      const error = new ValidationError('Invalid input');

      expect(error.name).toBe('ValidationError');
    });

    it('should have stack trace', () => {
      const error = new ValidationError('Test error');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('Error hierarchy', () => {
    it('should maintain proper inheritance chain', () => {
      const dbError = new DatabaseError('DB error');
      const concurrencyError = new OptimisticConcurrencyError('Concurrency');
      const uniqueError = new UniqueConstraintError('Unique');
      const fkError = new ForeignKeyConstraintError('FK');
      const validationError = new ValidationError('Validation');

      expect(dbError instanceof Error).toBe(true);
      expect(dbError instanceof DatabaseError).toBe(true);

      expect(concurrencyError instanceof Error).toBe(true);
      expect(concurrencyError instanceof DatabaseError).toBe(true);
      expect(concurrencyError instanceof OptimisticConcurrencyError).toBe(true);

      expect(uniqueError instanceof Error).toBe(true);
      expect(uniqueError instanceof DatabaseError).toBe(true);
      expect(uniqueError instanceof UniqueConstraintError).toBe(true);

      expect(fkError instanceof Error).toBe(true);
      expect(fkError instanceof DatabaseError).toBe(true);
      expect(fkError instanceof ForeignKeyConstraintError).toBe(true);

      expect(validationError instanceof Error).toBe(true);
      expect(validationError instanceof ValidationError).toBe(true);
      expect(validationError instanceof DatabaseError).toBe(false);
    });
  });
});
