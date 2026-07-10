import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import { requireBulk } from '@ts-linq/types';

import type { QueryModel } from './QueryModel';
import { type ISetPropertyCalls, SetPropertyCalls } from './SetPropertyCalls';

/**
 * Executes bulk UPDATE / DELETE statements without materialising entities (EF Core
 * `ExecuteUpdateAsync` / `ExecuteDeleteAsync` parity).
 *
 * Constructed once per `Queryable` with the entity binding + provider; the per-chain WHERE model
 * is supplied lazily so the same instance can be shared across clones. The dialect-capability guard
 * delegates to the shared {@link requireBulk} assertion (typed `UnsupportedOperationError`); the
 * remaining include/metadata guard messages are preserved from the original facade implementation.
 */
export class BulkDmlExecutor<T> {
  constructor(
    private readonly entityClass: new () => T,
    private readonly provider: DatabaseProvider
  ) {}

  async update(
    setters: (s: ISetPropertyCalls<T>) => ISetPropertyCalls<T>,
    hasIncludes: boolean,
    prepareModel: () => QueryModel
  ): Promise<number> {
    if (hasIncludes) {
      throw new Error(
        'Cannot call executeUpdate() after include(). ' +
          'Bulk DML does not support eager loading. Remove the include() call.'
      );
    }

    const metadata = MetadataStorage.getEntity(this.entityClass);
    if (!metadata) {
      throw new Error(
        `ts-linq: entity metadata not found for ${this.entityClass.name}. ` +
          'Ensure the class is decorated with @Entity().'
      );
    }

    const collector = new SetPropertyCalls<T>();
    setters(collector);
    const setterSpecs = collector.toSetterSpecs(metadata.columns);

    if (setterSpecs.length === 0) {
      throw new Error('executeUpdate() requires at least one setProperty() call.');
    }

    const queryModel = prepareModel();
    const dialect = this.provider.getDialect();
    requireBulk(dialect);

    const { sql, parameters } = dialect.buildBulkUpdate({
      tableName: metadata.tableName,
      setters: setterSpecs,
      where: queryModel.where ?? []
    });

    return this.provider.executeNonQuery(sql, parameters);
  }

  async delete(hasIncludes: boolean, prepareModel: () => QueryModel): Promise<number> {
    if (hasIncludes) {
      throw new Error(
        'Cannot call executeDelete() after include(). ' +
          'Bulk DML does not support eager loading. Remove the include() call.'
      );
    }

    const metadata = MetadataStorage.getEntity(this.entityClass);
    if (!metadata) {
      throw new Error(
        `ts-linq: entity metadata not found for ${this.entityClass.name}. ` +
          'Ensure the class is decorated with @Entity().'
      );
    }

    const queryModel = prepareModel();
    const dialect = this.provider.getDialect();
    requireBulk(dialect);

    const { sql, parameters } = dialect.buildBulkDelete({
      tableName: metadata.tableName,
      where: queryModel.where ?? []
    });

    return this.provider.executeNonQuery(sql, parameters);
  }
}
