import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { CteDefinition, SqlParameter } from '@ts-linq/types';

import type { QueryExecutor } from './QueryExecutor';
import type { QueryModel } from './QueryModel';

/**
 * Encapsulates offset-based and keyset pagination logic extracted from Queryable.
 *
 * Queryable.paginate() / keysetPaginate() are thin delegates that construct a
 * PaginationBuilder with the current query state and call through.  This class
 * is independently testable with a minimal provider mock.
 * @internal
 */
export class PaginationBuilder<T> {
  constructor(
    private readonly entityClass: new () => T,
    private readonly provider: DatabaseProvider,
    private readonly executor: QueryExecutor<T>,
    private readonly includes: string[],
    private readonly cte: CteDefinition | undefined,
    private readonly modelFactory: () => QueryModel,
    /** Callback into Queryable.count() so cache/fallback logic is reused. */
    private readonly countFn: () => Promise<number>
  ) {}

  async paginate(
    page: number,
    size: number
  ): Promise<{ items: T[]; total: number; page: number; size: number }> {
    if (page < 1 || size < 1) throw new Error('paginate requires page >= 1 and size >= 1');
    const queryModel = this.modelFactory();
    queryModel.limit = size;
    queryModel.offset = (page - 1) * size;
    const items = await this.executor.executeAndMaterialize(queryModel, this.includes, this.cte);
    const total = await this.countFn();
    return { items, total, page, size };
  }

  async keysetPaginate<TKey extends keyof T>(
    key: TKey,
    after: T[TKey] | null,
    size: number
  ): Promise<{ items: T[]; pageSize: number; nextAfter: T[TKey] | null }> {
    if (size < 1) throw new Error('keysetPaginate requires size >= 1');
    const propName = String(key);
    const meta = MetadataStorage.getEntity(this.entityClass);
    const colName = meta?.columns.find((c) => c.propertyName === propName)?.columnName ?? propName;
    const quotedCol = this.provider.getDialect().quoteIdentifier(colName);

    const queryModel = this.modelFactory();
    queryModel.orderBy = queryModel.orderBy ?? [];
    const hasOrderByKey = queryModel.orderBy.some(
      (o) => o.column === colName || o.column === propName
    );
    if (!hasOrderByKey) queryModel.orderBy.push({ column: colName, direction: 'ASC' });
    queryModel.limit = size;

    if (after !== null && after !== undefined) {
      queryModel.where = queryModel.where ?? [];
      queryModel.where.push({
        condition: `${quotedCol} > ?`,
        parameters: [after as unknown as SqlParameter]
      });
    }

    const items = await this.executor.executeAndMaterialize(queryModel, this.includes, this.cte);
    const last =
      items.length > 0 ? (items[items.length - 1] as unknown as Record<string, unknown>) : null;
    const nextAfter = last ? (last[propName] as T[TKey] | null) : null;
    return { items, pageSize: size, nextAfter };
  }
}
