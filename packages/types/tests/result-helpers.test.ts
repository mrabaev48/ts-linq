import type { Result } from '../src/index';
import { err, ok } from '../src/index';

describe('Result Type Helpers', () => {
  describe('ok()', () => {
    it('should create a successful Result with value', () => {
      const result = ok(42);

      expect(result.success).toBe(true);
      expect(result.value).toBe(42);
      expect(result.error).toBeUndefined();
    });

    it('should handle string values', () => {
      const result = ok('test');

      expect(result.success).toBe(true);
      expect(result.value).toBe('test');
    });

    it('should handle object values', () => {
      const obj = { id: 1, name: 'Test' };
      const result = ok(obj);

      expect(result.success).toBe(true);
      expect(result.value).toBe(obj);
      expect(result.value).toEqual({ id: 1, name: 'Test' });
    });

    it('should handle null values', () => {
      const result = ok(null);

      expect(result.success).toBe(true);
      expect(result.value).toBe(null);
    });

    it('should handle undefined values', () => {
      const result = ok(undefined);

      expect(result.success).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('should handle array values', () => {
      const arr = [1, 2, 3];
      const result = ok(arr);

      expect(result.success).toBe(true);
      expect(result.value).toBe(arr);
    });
  });

  describe('err()', () => {
    it('should create a failed Result with error', () => {
      const error = new Error('Something went wrong');
      const result = err(error);

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.value).toBeUndefined();
    });

    it('should handle string errors', () => {
      const result = err('error message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('error message');
    });

    it('should handle custom error objects', () => {
      const customError = { code: 404, message: 'Not found' };
      const result = err(customError);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(customError);
    });

    it('should handle Error instances', () => {
      const error = new TypeError('Type error');
      const result = err(error);

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.error).toBeInstanceOf(TypeError);
    });
  });

  describe('Result type', () => {
    it('should allow type-safe access to success results', () => {
      const result: Result<number> = ok(42);

      if (result.success) {
        const value: number | undefined = result.value;
        expect(value).toBe(42);
      }
    });

    it('should allow type-safe access to error results', () => {
      const result: Result<number, string> = err('failed');

      if (!result.success) {
        const error: string | undefined = result.error;
        expect(error).toBe('failed');
      }
    });
  });
});
