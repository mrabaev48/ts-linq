import type { DatabaseProvider } from '@ts-linq/core';
import { QueryTrackingBehavior } from '@ts-linq/core';
import { DuplicateKeyError, type EntityAttacher } from '@ts-linq/types';

import type { QueryBuilder } from './QueryBuilder';
import type { QueryModel } from './QueryModel';
import type { RowMaterializer } from './RowMaterializer';

/**
 * Streams query results from the database using chunked OFFSET pagination, bounding memory to one
 * chunk at a time (ETL / export workloads).
 *
 * Stateless with respect to the chain — constructed once per `Queryable` with the entity binding,
 * provider, SQL builder and materializer; the per-chain query model and tracking config are passed
 * to {@link stream} so the same instance can be shared by reference across clones.
 */
export class StreamingExecutor<T> {
  constructor(
    private readonly entityClass: new () => T,
    private readonly provider: DatabaseProvider,
    private readonly sqlBuilder: QueryBuilder,
    private readonly materializer: RowMaterializer<T>
  ) {}

  /**
   * Build an `AsyncIterable<T>` that streams entities for the given (already filter-applied) model.
   *
   * The model's `offset`/`limit` are consumed as the streaming window and cleared from the model
   * before SQL generation — `model` is the caller's prepared clone, so this mutation is local.
   */
  stream(
    model: QueryModel,
    trackingMode: QueryTrackingBehavior,
    attacher: EntityAttacher | undefined,
    signal?: AbortSignal
  ): AsyncIterable<T> {
    const startOffset = model.offset ?? 0;
    const maxRows = model.limit;
    model.offset = undefined;
    model.limit = undefined;

    const { query: baseSql, parameters } = this.sqlBuilder.generateFromModel(
      this.entityClass,
      model
    );

    const provider = this.provider;
    const materializer = this.materializer;
    const entityClass = this.entityClass;

    return {
      [Symbol.asyncIterator]: async function* (): AsyncIterator<T> {
        for await (const row of provider.streamRows(
          baseSql,
          parameters,
          startOffset,
          maxRows,
          signal
        )) {
          const entity = materializer.mapRowToEntity(row);
          if (trackingMode === QueryTrackingBehavior.TrackAll && attacher) {
            attacher.attach(entity as object, entityClass);
          }
          yield entity;
        }
      }
    };
  }

  /**
   * Drain a stream into a `Map`, throwing on duplicate keys (EF Core `ToDictionaryAsync` parity).
   */
  async collectDictionary<K, V>(
    iterable: AsyncIterable<T>,
    keySelector: (entity: T) => K,
    elementSelector?: (entity: T) => V
  ): Promise<Map<K, V>> {
    const map = new Map<K, V>();
    for await (const entity of iterable) {
      const key = keySelector(entity);
      if (map.has(key)) {
        throw new DuplicateKeyError(
          `An item with the same key has already been added. Key: ${String(key)}`,
          { details: { key } }
        );
      }
      map.set(key, elementSelector ? elementSelector(entity) : (entity as unknown as V));
    }
    return map;
  }
}
