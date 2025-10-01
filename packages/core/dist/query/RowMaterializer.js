"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RowMaterializer = void 0;
const MetadataStorage_1 = require("../metadata/MetadataStorage");
class RowMaterializer {
    constructor(entityClass, provider, entityCache, performance) {
        this.entityClass = entityClass;
        this.provider = provider;
        this.entityCache = entityCache;
        this.performance = performance;
    }
    mapRowToEntity(row) {
        const metadata = MetadataStorage_1.MetadataStorage.getEntity(this.entityClass);
        if (this.shouldUseL2Cache(metadata)) {
            const cached = this.tryGetFromCache(row, metadata);
            if (cached)
                return cached;
            const entity = this.materializeEntity(row, metadata);
            this.rememberInCache(row, metadata, entity);
            this.notifyMaterialized(entity, metadata);
            return entity;
        }
        const entity = this.materializeEntity(row, metadata || null);
        this.notifyMaterialized(entity, metadata);
        return entity;
    }
    shouldUseL2Cache(metadata) {
        return (!!this.performance?.enableEntityCache &&
            !!this.entityCache &&
            !!metadata &&
            metadata.primaryKeys.length > 0);
    }
    tryGetFromCache(row, metadata) {
        const pkProp = metadata.primaryKeys[0];
        const pkCol = metadata.columns.find((c) => c.propertyName === pkProp);
        const idValue = pkCol
            ? row[pkCol.columnName]
            : row[pkProp];
        const cached = this.entityCache.get(this.entityClass, idValue);
        if (!cached)
            return null;
        this.provider.loggerRef?.cache?.({
            cache: 'entityL2',
            hit: true,
            provider: this.provider.providerLabel
        });
        return cached;
    }
    materializeEntity(row, metadata) {
        const entity = new this.entityClass();
        if (metadata) {
            for (const column of metadata.columns) {
                const r = row;
                const val = Object.prototype.hasOwnProperty.call(r, column.columnName)
                    ? r[column.columnName]
                    : r[column.propertyName];
                if (val !== undefined) {
                    entity[column.propertyName] = this.convertValue(val, column.type);
                }
            }
        }
        else {
            Object.assign(entity, row);
        }
        return entity;
    }
    rememberInCache(row, metadata, entity) {
        if (!this.entityCache)
            return;
        const pkProp = metadata.primaryKeys[0];
        const pkCol = metadata.columns.find((c) => c.propertyName === pkProp);
        const idValue = pkCol
            ? row[pkCol.columnName]
            : row[pkProp];
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
        }
        catch {
            /* ignore */
        }
    }
    notifyMaterialized(entity, metadata) {
        try {
            if (metadata)
                this.provider.notifyEntityMaterialized?.(entity, metadata);
        }
        catch {
            /* ignore */
        }
    }
    convertValue(value, type) {
        if (value == null)
            return value;
        switch (type.toUpperCase()) {
            case 'BOOLEAN':
                return Boolean(value);
            case 'INTEGER':
            case 'NUMBER':
                return Number(value);
            case 'DATETIME':
            case 'DATE':
                return new Date(value);
            default:
                return value;
        }
    }
}
exports.RowMaterializer = RowMaterializer;
//# sourceMappingURL=RowMaterializer.js.map