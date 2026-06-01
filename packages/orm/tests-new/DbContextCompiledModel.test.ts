import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';
import type { CompiledModel } from '@ts-linq/metadata';
import { Column, createMetadataRegistry, Entity, PrimaryKey } from '@ts-linq/metadata';

import { DbContext } from '../src/DbContext';
import { TestProvider } from '../tests/stubs/TestProvider';

@Entity()
class OrderItem {
  @PrimaryKey({ type: 'INTEGER', autoIncrement: true })
  id!: number;

  @Column({ type: 'TEXT' })
  name!: string;
}

class OrderCtx extends DbContext {}

describe('DbContext — compiled model bootstrap', () => {
  it('pre-populates registry from compiledModel without reflection', () => {
    const compiledModel: CompiledModel = {
      version: 1,
      contextClassName: 'OrderCtx',
      generatedAt: '2026-06-01T00:00:00.000Z',
      entities: [
        {
          entityClassName: 'OrderItem',
          tableName: 'order_items',
          primaryKeys: ['id'],
          columns: [
            { propertyName: 'id', columnName: 'id', type: 'int', nullable: false },
            { propertyName: 'name', columnName: 'name', type: 'varchar', nullable: false }
          ],
          relationships: [],
          indexes: []
        }
      ]
    };

    const registry = createMetadataRegistry();
    const provider = new TestProvider(':memory:');

    new OrderCtx({
      provider,
      registry,
      compiledModel,
      compiledModelClassMap: { OrderItem }
    });

    const entities = registry.getEntities();
    expect(entities.length).toBeGreaterThanOrEqual(1);

    const orderItemEntity = entities.find((e) => e.tableName === 'order_items');
    expect(orderItemEntity).toBeDefined();
    expect(orderItemEntity?.primaryKeys).toEqual(['id']);
    expect(orderItemEntity?.columns).toHaveLength(2);
  });

  it('falls back to reflection scan when compiledModel is not set', () => {
    // Without compiledModel, DbContext uses MetadataStorage (global singleton)
    // which is populated by @Entity/@Column decorators on class declaration.
    const provider = new TestProvider(':memory:');
    const ctx = new OrderCtx({ provider });

    // Just verify the context instantiates without errors
    expect(ctx).toBeDefined();
  });

  it('still calls onModelCreating with compiled model for query filters', () => {
    let onModelCreatingCalled = false;

    class TrackingCtx extends DbContext {
      protected override onModelCreating() {
        onModelCreatingCalled = true;
      }
    }

    const compiledModel: CompiledModel = {
      version: 1,
      contextClassName: 'TrackingCtx',
      generatedAt: '2026-06-01T00:00:00.000Z',
      entities: [
        {
          entityClassName: 'OrderItem',
          tableName: 'order_items',
          primaryKeys: ['id'],
          columns: [{ propertyName: 'id', columnName: 'id', type: 'int', nullable: false }],
          relationships: [],
          indexes: []
        }
      ]
    };

    const provider = new TestProvider(':memory:');
    new TrackingCtx({
      provider,
      registry: createMetadataRegistry(),
      compiledModel,
      compiledModelClassMap: { OrderItem }
    });

    expect(onModelCreatingCalled).toBe(true);
  });
});
