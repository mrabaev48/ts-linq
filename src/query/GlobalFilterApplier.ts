import { MetadataStorage } from '../metadata/MetadataStorage';
import { GlobalFilter, SoftDeleteOptions, WhereClause } from '../types';

export class GlobalFilterApplier {
  public apply(
    entityClass: Function,
    model: { where?: WhereClause[] },
    softDeleteOptions: SoftDeleteOptions | undefined,
    globalFilters?: GlobalFilter[]
  ): void {
    const selfMeta = MetadataStorage.getEntity(entityClass);
    if (!selfMeta) return;
    model.where = model.where || [];

    // Soft-delete guard if enabled at provider level and entity has the column
    if (softDeleteOptions?.enabled) {
      const flagPropOrCol = softDeleteOptions.column ?? 'isDeleted';
      const col = selfMeta.columns.find(
        (c) => c.propertyName === flagPropOrCol || c.columnName === flagPropOrCol
      );
      if (col) {
        model.where.push({ condition: `${col.columnName} = 0`, parameters: [] });
      }
    }

    // Explicit global filters
    if (globalFilters && globalFilters.length > 0) {
      for (const globalFilter of globalFilters) {
        const filterMeta = MetadataStorage.getEntity(globalFilter.entity);
        if (filterMeta && selfMeta.tableName === filterMeta.tableName) {
          model.where.push({
            condition: globalFilter.where.condition,
            parameters: [...globalFilter.where.parameters]
          });
        }
      }
    }
  }
}
