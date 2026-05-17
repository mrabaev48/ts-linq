import { beforeEach, describe, expect, it } from '@jest/globals';
import type { FallbackRequest } from '@ts-linq/types';

import { MemoryFallback } from '../src/fallbacks/MemoryFallback';

class TestEntity {
  id!: number;
  name!: string;
}

describe('MemoryFallback', () => {
  let testData: TestEntity[];
  let fallback: MemoryFallback<TestEntity>;

  beforeEach(() => {
    testData = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
      { id: 4, name: 'David' },
      { id: 5, name: 'Eve' }
    ];
    fallback = new MemoryFallback(() => testData);
  });

  it('should return all data when no query options provided', async () => {
    const request: FallbackRequest<TestEntity> = {
      operation: 'select',
      entityClass: TestEntity
    };

    const result = await fallback.fetch(request);

    expect(result).toHaveLength(5);
    expect(result[0].name).toBe('Alice');
    expect(result[4].name).toBe('Eve');
  });

  it('should apply offset from query options', async () => {
    const request: FallbackRequest<TestEntity> = {
      operation: 'select',
      entityClass: TestEntity,
      query: { offset: 2 }
    };

    const result = await fallback.fetch(request);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Charlie');
    expect(result[2].name).toBe('Eve');
  });

  it('should apply limit from query options', async () => {
    const request: FallbackRequest<TestEntity> = {
      operation: 'select',
      entityClass: TestEntity,
      query: { limit: 2 }
    };

    const result = await fallback.fetch(request);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Bob');
  });

  it('should apply both offset and limit', async () => {
    const request: FallbackRequest<TestEntity> = {
      operation: 'select',
      entityClass: TestEntity,
      query: { offset: 1, limit: 2 }
    };

    const result = await fallback.fetch(request);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Bob');
    expect(result[1].name).toBe('Charlie');
  });

  it('should return count of all data', async () => {
    const request: FallbackRequest<TestEntity> = {
      operation: 'count',
      entityClass: TestEntity
    };

    const count = await fallback.fetchCount(request);

    expect(count).toBe(5);
  });

  it('should apply offset/limit in fetchCount for pagination consistency', async () => {
    const request: FallbackRequest<TestEntity> = {
      operation: 'count',
      entityClass: TestEntity,
      query: { offset: 1, limit: 3 }
    };

    const count = await fallback.fetchCount(request);

    // Count should match paginated result: skip 1, take 3 = 3 items
    expect(count).toBe(3);
  });

  it('should execute count operation via execute() and return number', async () => {
    const request: FallbackRequest<TestEntity> = {
      operation: 'count',
      entityClass: TestEntity
    };

    const result = await fallback.execute(request);

    // Should return array with single number
    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe('number');
    expect(result[0]).toBe(5);
  });

  it('should throw for unsupported operations in execute()', async () => {
    const request: FallbackRequest<TestEntity> = {
      operation: 'insert',
      entityClass: TestEntity
    };

    await expect(fallback.execute(request)).rejects.toThrow(/does not support operation 'insert'/);
  });

  it('should always return true for canHandle', () => {
    const request: FallbackRequest<TestEntity> = {
      operation: 'select',
      entityClass: TestEntity
    };

    expect(fallback.canHandle(request)).toBe(true);
  });

  it('should execute via execute method', async () => {
    const request: FallbackRequest<TestEntity> = {
      operation: 'select',
      entityClass: TestEntity,
      query: { limit: 3 }
    };

    const result = await fallback.execute(request);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('Alice');
  });

  it('should cache data on first access', async () => {
    let callCount = 0;
    const supplier = () => {
      callCount++;
      return testData;
    };

    const cachingFallback = new MemoryFallback(supplier);
    const request: FallbackRequest<TestEntity> = {
      operation: 'select',
      entityClass: TestEntity
    };

    await cachingFallback.fetch(request);
    await cachingFallback.fetch(request);
    await cachingFallback.fetch(request);

    // Should only call supplier once
    expect(callCount).toBe(1);
  });

  it('should clear cache when clearCache is called', async () => {
    let callCount = 0;
    const supplier = () => {
      callCount++;
      return testData;
    };

    const cachingFallback = new MemoryFallback(supplier);
    const request: FallbackRequest<TestEntity> = {
      operation: 'select',
      entityClass: TestEntity
    };

    await cachingFallback.fetch(request);
    cachingFallback.clearCache();
    await cachingFallback.fetch(request);

    // Should call supplier twice (once before clear, once after)
    expect(callCount).toBe(2);
  });

  it('should accept options with custom label', () => {
    const customFallback = new MemoryFallback({
      label: 'replica-db',
      dataSupplier: () => testData
    });

    expect(customFallback.label).toBe('replica-db');
  });

  it('should support async data supplier', async () => {
    const asyncFallback = new MemoryFallback(async () => {
      return new Promise<TestEntity[]>((resolve) => {
        setTimeout(() => resolve(testData), 10);
      });
    });

    const request: FallbackRequest<TestEntity> = {
      operation: 'select',
      entityClass: TestEntity
    };

    const result = await asyncFallback.fetch(request);

    expect(result).toHaveLength(5);
    expect(result[0].name).toBe('Alice');
  });

  it('should refresh cache after refreshIntervalMs', async () => {
    let callCount = 0;
    const currentData = [...testData];

    const supplier = () => {
      callCount++;
      return currentData;
    };

    const refreshingFallback = new MemoryFallback({
      label: 'refreshing',
      dataSupplier: supplier,
      refreshIntervalMs: 50
    });

    const request: FallbackRequest<TestEntity> = {
      operation: 'select',
      entityClass: TestEntity
    };

    // First fetch
    await refreshingFallback.fetch(request);
    expect(callCount).toBe(1);

    // Immediate second fetch (should use cache)
    await refreshingFallback.fetch(request);
    expect(callCount).toBe(1);

    // Wait for refresh interval
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Third fetch (should refresh)
    await refreshingFallback.fetch(request);
    expect(callCount).toBe(2);
  });
});
