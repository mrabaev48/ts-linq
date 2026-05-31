import { createMetadataRegistry } from '@ts-linq/metadata';
import { Entity, PrimaryKey } from '@ts-linq/metadata';

import { KeylessMutationError } from '../src/exceptions/KeylessMutationError';
import { ModelBuilder } from '../src/ModelBuilder';

// ── Test entities ─────────────────────────────────────────────────────────────

@Entity({ name: 'orders' })
class Order {
  @PrimaryKey()
  id!: number;

  total!: number;
}

class SalesSummary {
  region!: string;
  totalSales!: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeKeylessRegistry() {
  const registry = createMetadataRegistry();
  const mb = new ModelBuilder(registry);
  mb.entity<SalesSummary>(SalesSummary, (b) => {
    b.hasNoKey();
    b.toView('v_sales_summary');
  });
  mb._finalize();
  return registry;
}

function makeKeylessWithSqlRegistry() {
  const registry = createMetadataRegistry();
  const mb = new ModelBuilder(registry);
  mb.entity<SalesSummary>(SalesSummary, (b) => {
    b.hasNoKey();
    b.toView('v_sales_summary');
    b.hasViewSql('SELECT region, SUM(total) AS totalSales FROM orders GROUP BY region');
  });
  mb._finalize();
  return registry;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Keyless Entities (P1-26)', () => {
  describe('EntityMetadata registration', () => {
    it('hasNoKey() sets isKeyless=true in metadata', () => {
      const registry = makeKeylessRegistry();
      const meta = registry.getEntity(SalesSummary);
      expect(meta).toBeDefined();
      expect(meta!.isKeyless).toBe(true);
    });

    it('toView() sets viewName in metadata', () => {
      const registry = makeKeylessRegistry();
      const meta = registry.getEntity(SalesSummary);
      expect(meta!.viewName).toBe('v_sales_summary');
    });

    it('hasViewSql() sets viewSql in metadata', () => {
      const registry = makeKeylessWithSqlRegistry();
      const meta = registry.getEntity(SalesSummary);
      expect(meta!.viewSql).toBe(
        'SELECT region, SUM(total) AS totalSales FROM orders GROUP BY region'
      );
    });

    it('regular entity does not have isKeyless or viewName', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      mb.entity<Order>(Order);
      mb._finalize();
      const meta = registry.getEntity(Order);
      expect(meta!.isKeyless).toBeUndefined();
      expect(meta!.viewName).toBeUndefined();
    });

    it('fluent chaining returns this for all three methods', () => {
      const registry = createMetadataRegistry();
      const mb = new ModelBuilder(registry);
      let chainResult: unknown;
      mb.entity<SalesSummary>(SalesSummary, (b) => {
        chainResult = b.hasNoKey().toView('v_test').hasViewSql('SELECT 1');
        expect(chainResult).toBe(b);
      });
      mb._finalize();
    });
  });

  describe('KeylessMutationError', () => {
    it('has correct name and message', () => {
      const err = new KeylessMutationError('SalesSummary', 'add');
      expect(err.name).toBe('KeylessMutationError');
      expect(err.message).toContain('SalesSummary');
      expect(err.message).toContain('add');
    });

    it('is an instance of Error', () => {
      const err = new KeylessMutationError('Foo', 'remove');
      expect(err).toBeInstanceOf(Error);
    });
  });
});
