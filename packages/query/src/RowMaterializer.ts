import type { DatabaseProvider } from '@ts-linq/core';
import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityCacheLike, PerformanceOptions } from '@ts-linq/types';

export class RowMaterializer<T> {
  constructor(
    private readonly entityClass: new () => T,
    private readonly provider: DatabaseProvider,
    private readonly entityCache?: EntityCacheLike,
    private readonly performance?: PerformanceOptions
  ) {}

  public mapRowToEntity(row: unknown): T {
    const metadata = MetadataStorage.getEntity(this.entityClass);
    if (this.shouldUseL2Cache(metadata)) {
      const cached = this.tryGetFromCache(row, metadata!);
      if (cached) return cached;
      const entity = this.materializeEntity(row, metadata!);
      this.rememberInCache(row, metadata!, entity);
      this.notifyMaterialized(entity, metadata);
      return entity;
    }
    const entity = this.materializeEntity(row, metadata || null);
    this.notifyMaterialized(entity, metadata);
    return entity;
  }

  private shouldUseL2Cache(
    metadata: ReturnType<typeof MetadataStorage.getEntity> | undefined
  ): boolean {
    return (
      !!this.performance?.enableEntityCache &&
      !!this.entityCache &&
      !!metadata &&
      !!metadata.primaryKeys &&
      metadata.primaryKeys.length > 0
    );
  }

  private tryGetFromCache(
    row: unknown,
    metadata: {
      primaryKeys?: string[];
      columns: Array<{ propertyName: string; columnName: string }>;
    }
  ): T | null {
    if (!metadata.primaryKeys || metadata.primaryKeys.length === 0) return null;
    const pkProp = metadata.primaryKeys[0];
    const pkCol = metadata.columns.find((c) => c.propertyName === pkProp);
    const idValue = pkCol
      ? (row as Record<string, unknown>)[pkCol.columnName]
      : (row as Record<string, unknown>)[pkProp];
    const cached = this.entityCache!.get<T>(this.entityClass, idValue);
    if (!cached) return null;
    this.provider.loggerRef?.cache?.({
      cache: 'entityL2',
      hit: true,
      provider: this.provider.providerLabel
    });
    return cached;
  }

  private materializeEntity(
    row: unknown,
    metadata: { columns: Array<{ propertyName: string; columnName: string; type: string }> } | null
  ): T {
    const entity = new this.entityClass();
    if (metadata) {
      for (const column of metadata.columns) {
        const r = row as Record<string, unknown>;
        const val = Object.prototype.hasOwnProperty.call(r, column.columnName)
          ? r[column.columnName]
          : r[column.propertyName];
        if (val !== undefined) {
          (entity as unknown as Record<string, unknown>)[column.propertyName] = this.convertValue(
            val,
            column.type
          );
        }
      }
    } else {
      Object.assign(entity as object, row as object);
    }
    return entity;
  }

  private rememberInCache(
    row: unknown,
    metadata: {
      primaryKeys?: string[];
      columns: Array<{ propertyName: string; columnName: string }>;
    },
    entity: T
  ): void {
    if (!this.entityCache || !metadata.primaryKeys || metadata.primaryKeys.length === 0) return;
    const pkProp = metadata.primaryKeys[0];
    const pkCol = metadata.columns.find((c) => c.propertyName === pkProp);
    const idValue = pkCol
      ? (row as Record<string, unknown>)[pkCol.columnName]
      : (row as Record<string, unknown>)[pkProp];
    this.entityCache.set(this.entityClass, idValue, entity);
    this.provider.loggerRef?.cache?.({
      cache: 'entityL2',
      hit: false,
      provider: this.provider.providerLabel
    });
    try {
      this.provider.loggerRef?.cacheSize?.({
        cache: 'entityL2',
        size: this.entityCache.size?.() ?? -1,
        provider: this.provider.providerLabel
      });
    } catch {
      /* ignore */
    }
  }

  private notifyMaterialized(entity: T, metadata?: unknown): void {
    try {
      if (metadata)
        (
          this.provider as unknown as { notifyEntityMaterialized?: (e: T, m?: unknown) => void }
        ).notifyEntityMaterialized?.(entity, metadata);
    } catch {
      /* ignore */
    }
  }

  private convertValue(value: unknown, type: string): unknown {
    if (value == null) return value;
    switch (type.toUpperCase()) {
      case 'BOOLEAN':
        return Boolean(value);
      case 'INTEGER':
      case 'NUMBER':
        return Number(value);
      case 'DATETIME':
      case 'DATE':
        return new Date(value as string | number | Date);
      default:
        return value;
    }
  }
}
