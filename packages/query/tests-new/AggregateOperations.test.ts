import { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { SqlDialect, SqlParameter } from '@ts-linq/types';

import { AggregateOperations } from '../src/AggregateOperations';
import { QueryBuilder } from '../src/QueryBuilder';
import { QueryModel } from '../src/QueryModel';

class Order {
  id!: number;
  amount!: number;
}

type AggRow = { _result?: number | null; _count?: number };

class TestDialect implements SqlDialect {
  public buildSelect<T>(
    entityClass: new () => T
  ): { query: string; parameters: readonly SqlParameter[] } {
    const meta = MetadataStorage.getEntity(entityClass) || { tableName: entityClass.name };
    return { query: `SELECT * FROM ${meta.tableName}`, parameters: [] };
  }
  public quoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }
}

class TestProvider extends DatabaseProvider {
  private _rows: AggRow[] = [];
  private readonly dialect = new TestDialect();

  setRows(rows: AggRow[]): void {
    this._rows = rows;
  }

  public async connect(): Promise<void> {}
  public async disconnect(): Promise<void> {}
  public async createTable(): Promise<void> {}
  public getDialect(): SqlDialect { return this.dialect; }
  public async insert<T extends object>(e: T): Promise<T> { return e; }
  public async update<T extends object>(e: T): Promise<T> { return e; }
  public async delete(): Promise<void> {}
  public async findById<T extends object>(): Promise<T | null> { return null; }
  public async findAll<T extends object>(): Promise<T[]> { return []; }
  public async findWhere<T extends object>(): Promise<T[]> { return []; }
  public async findWhereIn<T extends object>(): Promise<T[]> { return []; }
  protected async doExecuteQuery<T>(): Promise<T[]> {
    return this._rows as unknown as T[];
  }
  protected async doExecuteNonQuery(): Promise<number> { return 0; }
  public async beginTransaction(): Promise<void> {}
  public async commitTransaction(): Promise<void> {}
  public async rollbackTransaction(): Promise<void> {}
  constructor() {
    super('memory://', undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    (this as unknown as { providerName: string }).providerName = 'test';
  }
}

function buildAggregates(provider: TestProvider): AggregateOperations<Order> {
  const sqlBuilder = new QueryBuilder(
    provider.getDialect(),
    undefined,
    'test'
  );
  return new AggregateOperations<Order>(Order, provider, sqlBuilder);
}

function makeModel(): QueryModel {
  return new QueryModel();
}

describe('AggregateOperations', () => {
  let provider: TestProvider;
  let agg: AggregateOperations<Order>;

  beforeEach(() => {
    MetadataStorage.getInstance().clear();
    MetadataStorage.addEntity(Order, 'orders');
    MetadataStorage.addColumn(Order, { propertyName: 'id', columnName: 'id', type: 'INTEGER', primaryKey: true });
    MetadataStorage.addPrimaryKey(Order, 'id');
    MetadataStorage.addColumn(Order, { propertyName: 'amount', columnName: 'amount', type: 'DECIMAL' });

    provider = new TestProvider();
    agg = buildAggregates(provider);
  });

  describe('average', () => {
    it('returns average value when rows exist', async () => {
      provider.setRows([{ _result: 42, _count: 3 }]);
      const result = await agg.average(makeModel(), 'amount');
      expect(result).toBe(42);
    });

    it('throws when sequence is empty (_count = 0)', async () => {
      provider.setRows([{ _result: null, _count: 0 }]);
      await expect(agg.average(makeModel(), 'amount')).rejects.toThrow(
        'Sequence contains no elements'
      );
    });
  });

  describe('sum', () => {
    it('returns summed value', async () => {
      provider.setRows([{ _result: 100 }]);
      const result = await agg.sum(makeModel(), 'amount');
      expect(result).toBe(100);
    });

    it('returns 0 on empty sequence (COALESCE)', async () => {
      provider.setRows([{ _result: 0 }]);
      const result = await agg.sum(makeModel(), 'amount');
      expect(result).toBe(0);
    });
  });

  describe('min', () => {
    it('returns minimum value', async () => {
      provider.setRows([{ _result: 5, _count: 4 }]);
      const result = await agg.min(makeModel(), 'amount');
      expect(result).toBe(5);
    });

    it('throws when sequence is empty', async () => {
      provider.setRows([{ _result: null, _count: 0 }]);
      await expect(agg.min(makeModel(), 'amount')).rejects.toThrow(
        'Sequence contains no elements'
      );
    });
  });

  describe('max', () => {
    it('returns maximum value', async () => {
      provider.setRows([{ _result: 999, _count: 7 }]);
      const result = await agg.max(makeModel(), 'amount');
      expect(result).toBe(999);
    });

    it('throws when sequence is empty', async () => {
      provider.setRows([{ _result: null, _count: 0 }]);
      await expect(agg.max(makeModel(), 'amount')).rejects.toThrow(
        'Sequence contains no elements'
      );
    });
  });

  describe('contains', () => {
    it('uses COUNT query path when PK metadata is present and id is set', async () => {
      provider.setRows([{ _count: 1 }]);
      const item = Object.assign(new Order(), { id: 7, amount: 50 });
      const result = await agg.contains(makeModel(), item, async () => []);
      expect(result).toBe(true);
    });

    it('returns false when COUNT query returns 0', async () => {
      provider.setRows([{ _count: 0 }]);
      const item = Object.assign(new Order(), { id: 99, amount: 0 });
      const result = await agg.contains(makeModel(), item, async () => []);
      expect(result).toBe(false);
    });

    it('falls back to fallbackFetch when id is undefined', async () => {
      const existingItem = Object.assign(new Order(), { id: 1, amount: 10 });
      const itemWithNoId = { amount: 10 } as Order;
      const fallback = jest.fn(async () => [existingItem]);
      const result = await agg.contains(makeModel(), itemWithNoId, fallback);
      expect(fallback).toHaveBeenCalled();
      expect(typeof result).toBe('boolean');
    });

    it('falls back to fallbackFetch when no PK metadata', async () => {
      MetadataStorage.getInstance().clear();
      const fallback = jest.fn(async () => [] as Order[]);
      await agg.contains(makeModel(), new Order(), fallback);
      expect(fallback).toHaveBeenCalled();
    });
  });
});
