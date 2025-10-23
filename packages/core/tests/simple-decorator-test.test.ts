import { describe, test, expect, beforeEach } from 'vitest';
import { MetadataStorage } from '@ts-linq/metadata';
import { Entity, Column, PrimaryKey, clearOrphanedMetadata } from '../src/decorators';

describe('Simple Decorator Test - Orphaned Pattern', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    clearOrphanedMetadata();
  });

  test('should register entity with field metadata', () => {
    @Entity()
    class TestUser {
      @PrimaryKey({ type: 'INTEGER' })
      id!: number;

      @Column({ type: 'TEXT' })
      name!: string;
    }

    const metadata = MetadataStorage.getEntity(TestUser);
    expect(metadata).toBeDefined();
    expect(metadata!.tableName).toBe('TestUser');
    expect(metadata!.columns.length).toBeGreaterThan(0);
  });

  test('should work without creating instances', () => {
    @Entity({ name: 'products' })
    class Product {
      @PrimaryKey({ type: 'INTEGER' })
      id!: number;

      @Column({ type: 'TEXT' })
      title!: string;
    }

    // No `new Product()` needed!
    const metadata = MetadataStorage.getEntity(Product);
    expect(metadata).toBeDefined();
    expect(metadata!.tableName).toBe('products');
  });
});
