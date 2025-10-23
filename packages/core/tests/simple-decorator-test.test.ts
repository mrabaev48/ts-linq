import 'reflect-metadata';
import { describe, test, expect, beforeEach } from 'vitest';
import { MetadataStorage } from '@ts-linq/metadata';
import { Entity, Column, PrimaryKey } from '../src/decorators';

describe('Simple Decorator Test - Legacy Decorators', () => {
  beforeEach(() => {
    MetadataStorage.getInstance().clear();
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

    // No `new Product()` needed with legacy decorators!
    const metadata = MetadataStorage.getEntity(Product);
    expect(metadata).toBeDefined();
    expect(metadata!.tableName).toBe('products');
  });

  test('should register primary key', () => {
    @Entity()
    class Item {
      @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
      id!: number;

      @Column({ type: 'TEXT' })
      description!: string;
    }

    const metadata = MetadataStorage.getEntity(Item);
    expect(metadata!.primaryKeys).toContain('id');
  });
});
