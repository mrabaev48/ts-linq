import type { SoftDeleteOptions } from '@ts-linq/types';

interface ColumnMeta {
  propertyName: string;
  columnName?: string;
}

interface EntityMeta {
  columns: ReadonlyArray<ColumnMeta>;
}

type GetMeta = (entityClass: Function) => EntityMeta | undefined;
type ExecuteUpdate = (entity: Record<string, unknown>, entityClass: Function) => Promise<void>;
type OnCacheUpdate = (change: {
  entity: Record<string, unknown>;
  entityClass: Function;
}) => void;

export class SoftDeleteInterceptor {
  constructor(
    private readonly softDelete: SoftDeleteOptions | undefined,
    private readonly getMeta: GetMeta,
    private readonly executeUpdate: ExecuteUpdate,
    private readonly onCacheUpdate: OnCacheUpdate
  ) {}

  async apply(change: {
    entity: Record<string, unknown>;
    entityClass: Function;
  }): Promise<boolean> {
    if (!this.softDelete?.enabled) return false;
    const meta = this.getMeta(change.entityClass);
    if (!meta) return false;

    const flag = this.softDelete.column ?? 'isDeleted';
    const deletedAt = this.softDelete.deletedAtColumn ?? 'deletedAt';

    const hasFlag = meta.columns.some(
      (c) => c.propertyName === flag || c.columnName === flag
    );
    if (!hasFlag) return false;

    change.entity[flag] = true as unknown as boolean;

    const hasDeletedAt = meta.columns.some(
      (c) => c.propertyName === deletedAt || c.columnName === deletedAt
    );
    if (hasDeletedAt) change.entity[deletedAt] = new Date();

    await this.executeUpdate(change.entity, change.entityClass);
    this.onCacheUpdate(change);
    return true;
  }
}
