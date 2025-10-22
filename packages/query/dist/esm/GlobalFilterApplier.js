import { MetadataStorage } from '@ts-linq/core';
export class GlobalFilterApplier {
    apply(entityClass, model, softDeleteOptions, globalFilters) {
        const selfMeta = MetadataStorage.getEntity(entityClass);
        if (!selfMeta)
            return;
        model.where = model.where || [];
        // Soft-delete guard if enabled at provider level and entity has the column
        if (softDeleteOptions?.enabled) {
            const flagPropOrCol = softDeleteOptions.column ?? 'isDeleted';
            const col = selfMeta.columns.find((c) => c.propertyName === flagPropOrCol || c.columnName === flagPropOrCol);
            if (col) {
                model.where.push({ condition: `${col.columnName} = 0`, parameters: [] });
            }
        }
        // Explicit global filters
        if (globalFilters && globalFilters.length > 0) {
            for (const globalFilter of globalFilters) {
                if (globalFilter.entity && globalFilter.where) {
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
}
//# sourceMappingURL=GlobalFilterApplier.js.map