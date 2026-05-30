import type { ExpressionNode } from '@ts-linq/ast';
import { MetadataStorage } from '@ts-linq/metadata';
import type { ColumnResolver } from '@ts-linq/sql-visitor';
import { SqlVisitor } from '@ts-linq/sql-visitor';
import type {
  GlobalFilter,
  QueryFilterMetadata,
  SoftDeleteOptions,
  WhereClause
} from '@ts-linq/types';

export class GlobalFilterApplier {
  public apply(
    entityClass: Function,
    model: { where?: WhereClause[] },
    softDeleteOptions: SoftDeleteOptions | undefined,
    globalFilters?: GlobalFilter[],
    ignoredFilters?: Set<string> | 'all',
    columnResolver?: ColumnResolver,
    entityQueryFilters?: ReadonlyArray<QueryFilterMetadata>
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
        model.where.push({ condition: `${col.columnName} = ?`, parameters: [false] });
      }
    }

    // Explicit global filters (DbContextOptions-level)
    if (globalFilters && globalFilters.length > 0) {
      for (const globalFilter of globalFilters) {
        if (globalFilter.entity && globalFilter.where) {
          const filterMeta = MetadataStorage.getEntity(globalFilter.entity as unknown as Function);
          if (filterMeta && selfMeta.tableName === filterMeta.tableName) {
            model.where.push({
              condition: globalFilter.where.condition,
              parameters: [...globalFilter.where.parameters]
            });
          }
        }
      }
    }

    // Per-context model-level named query filters (P0-11)
    if (entityQueryFilters && entityQueryFilters.length > 0 && ignoredFilters !== 'all') {
      const visitor = new SqlVisitor();
      for (const filter of entityQueryFilters) {
        if (ignoredFilters && ignoredFilters.has(filter.name)) continue;
        try {
          const result = visitor.toSql(
            filter.ast as ExpressionNode,
            filter.parameters as unknown[],
            columnResolver
          );
          model.where.push({ condition: result.condition, parameters: result.parameters });
        } catch {
          // Silently skip filters that produce invalid SQL (e.g., unsupported AST nodes)
        }
      }
    }
  }
}
