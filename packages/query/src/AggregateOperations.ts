import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { SqlParameter } from '@ts-linq/types';

import { QueryBuilder } from './QueryBuilder';
import { QueryModel } from './QueryModel';

/**
 * Executes EF-style aggregate operations (average, sum, min, max, contains) against
 * an already-constructed and filter-applied QueryModel.
 *
 * Stateless — a single instance is shared across all clones of a Queryable chain.
 */
export class AggregateOperations<T> {
  constructor(
    private readonly entityClass: new () => T,
    private readonly provider: DatabaseProvider,
    private readonly sqlBuilder: QueryBuilder
  ) {}

  async average(model: QueryModel, colName: string): Promise<number> {
    const quotedCol = this.provider.getDialect().quoteIdentifier(colName);
    const { query, parameters } = this.sqlBuilder.generateFromModel(this.entityClass, model);
    const aggSql = `SELECT AVG(${quotedCol}) AS _result, COUNT(*) AS _count FROM (${query}) AS _agg`;
    const rows = await this.provider.executeQuery<{ _result: number | null; _count: number }>(
      aggSql,
      parameters
    );
    if (Number(rows[0]?._count ?? 0) === 0) throw new Error('Sequence contains no elements');
    return Number(rows[0]._result ?? 0);
  }

  async sum(model: QueryModel, colName: string): Promise<number> {
    const quotedCol = this.provider.getDialect().quoteIdentifier(colName);
    const { query, parameters } = this.sqlBuilder.generateFromModel(this.entityClass, model);
    const aggSql = `SELECT COALESCE(SUM(${quotedCol}), 0) AS _result FROM (${query}) AS _agg`;
    const rows = await this.provider.executeQuery<{ _result: number }>(aggSql, parameters);
    return Number(rows[0]?._result ?? 0);
  }

  async min<K extends keyof T>(model: QueryModel, colName: string): Promise<T[K]> {
    const quotedCol = this.provider.getDialect().quoteIdentifier(colName);
    const { query, parameters } = this.sqlBuilder.generateFromModel(this.entityClass, model);
    const aggSql = `SELECT MIN(${quotedCol}) AS _result, COUNT(*) AS _count FROM (${query}) AS _agg`;
    const rows = await this.provider.executeQuery<{ _result: T[K] | null; _count: number }>(
      aggSql,
      parameters
    );
    if (Number(rows[0]?._count ?? 0) === 0) throw new Error('Sequence contains no elements');
    return rows[0]._result as T[K];
  }

  async max<K extends keyof T>(model: QueryModel, colName: string): Promise<T[K]> {
    const quotedCol = this.provider.getDialect().quoteIdentifier(colName);
    const { query, parameters } = this.sqlBuilder.generateFromModel(this.entityClass, model);
    const aggSql = `SELECT MAX(${quotedCol}) AS _result, COUNT(*) AS _count FROM (${query}) AS _agg`;
    const rows = await this.provider.executeQuery<{ _result: T[K] | null; _count: number }>(
      aggSql,
      parameters
    );
    if (Number(rows[0]?._count ?? 0) === 0) throw new Error('Sequence contains no elements');
    return rows[0]._result as T[K];
  }

  /**
   * @param fallbackFetch  Called when no PK metadata is available; typically `() => queryable.toArray()`.
   *                       The callback avoids a circular import between AggregateOperations and Queryable.
   */
  async contains(
    model: QueryModel,
    item: T,
    fallbackFetch: () => Promise<T[]>
  ): Promise<boolean> {
    const meta = MetadataStorage.getEntity(this.entityClass);
    if (meta && meta.primaryKeys && meta.primaryKeys.length > 0) {
      const pk = meta.primaryKeys[0];
      const colMeta = meta.columns.find((c) => c.propertyName === pk);
      const colName = colMeta?.columnName ?? pk;
      const itemId = (item as unknown as Record<string, unknown>)[pk];
      if (itemId !== undefined && itemId !== null) {
        const quotedCol = this.provider.getDialect().quoteIdentifier(colName);
        const pkModel = model.clone();
        pkModel.where = pkModel.where ?? [];
        pkModel.where.push({
          condition: `${quotedCol} = ?`,
          parameters: [itemId as SqlParameter]
        });
        pkModel.limit = 1;
        const { query, parameters } = this.sqlBuilder.generateFromModel(this.entityClass, pkModel);
        const countSql = `SELECT COUNT(*) AS _count FROM (${query}) AS _exists`;
        const rows = await this.provider.executeQuery<{ _count: number }>(countSql, parameters);
        return Number(rows[0]?._count ?? 0) > 0;
      }
    }
    const entities = await fallbackFetch();
    const itemJson = JSON.stringify(item);
    return entities.some((entity) => JSON.stringify(entity) === itemJson);
  }
}
