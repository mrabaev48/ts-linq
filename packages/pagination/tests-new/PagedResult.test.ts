import { describe, expect, it } from '@jest/globals';

import type { PagedResult } from '../src/index';

describe('PagedResult', () => {
  describe('type definition', () => {
    it('should accept paginated data', () => {
      const result: PagedResult<string> = {
        data: ['item1', 'item2', 'item3'],
        page: 1,
        pageSize: 10,
        total: 100,
        totalPages: 10
      };

      expect(result.data).toHaveLength(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(100);
      expect(result.totalPages).toBe(10);
    });

    it('should support generic types', () => {
      interface User {
        id: number;
        name: string;
      }

      const result: PagedResult<User> = {
        data: [{ id: 1, name: 'Alice' }],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1
      };

      expect(result.data[0].name).toBe('Alice');
    });

    it('should handle empty data array', () => {
      const result: PagedResult<number> = {
        data: [],
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0
      };

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should support all numeric page metadata', () => {
      const result: PagedResult<string> = {
        data: ['item'],
        page: 5,
        pageSize: 25,
        total: 250,
        totalPages: 10
      };

      expect(typeof result.page).toBe('number');
      expect(typeof result.pageSize).toBe('number');
      expect(typeof result.total).toBe('number');
      expect(typeof result.totalPages).toBe('number');
    });
  });

  describe('practical usage', () => {
    it('should represent first page', () => {
      const result: PagedResult<string> = {
        data: ['a', 'b', 'c'],
        page: 1,
        pageSize: 3,
        total: 10,
        totalPages: 4
      };

      const hasNextPage = result.page < result.totalPages;
      const hasPrevPage = result.page > 1;

      expect(hasNextPage).toBe(true);
      expect(hasPrevPage).toBe(false);
    });

    it('should represent last page', () => {
      const result: PagedResult<string> = {
        data: ['a'],
        page: 4,
        pageSize: 3,
        total: 10,
        totalPages: 4
      };

      const hasNextPage = result.page < result.totalPages;
      const hasPrevPage = result.page > 1;

      expect(hasNextPage).toBe(false);
      expect(hasPrevPage).toBe(true);
    });

    it('should represent middle page', () => {
      const result: PagedResult<string> = {
        data: ['a', 'b', 'c'],
        page: 2,
        pageSize: 3,
        total: 10,
        totalPages: 4
      };

      const hasNextPage = result.page < result.totalPages;
      const hasPrevPage = result.page > 1;

      expect(hasNextPage).toBe(true);
      expect(hasPrevPage).toBe(true);
    });
  });
});
