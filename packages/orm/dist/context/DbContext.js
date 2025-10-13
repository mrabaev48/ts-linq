"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbContext = void 0;
const ChangeTracker_1 = require("@ts-linq/core/dist/change-tracking/ChangeTracker");
const EntityLoader_1 = require("@ts-linq/core/dist/loading/EntityLoader");
const LoadingStrategy_1 = require("@ts-linq/core/dist/loading/LoadingStrategy");
const MetadataStorage_1 = require("@ts-linq/core/dist/metadata/MetadataStorage");
const LazyLoadingProxy_1 = require("@ts-linq/core/dist/loading/LazyLoadingProxy");
const types_1 = require("@ts-linq/core/dist/types");
const EntityCache_1 = require("@ts-linq/core/dist/utils/EntityCache");
const DbSet_1 = require("./DbSet");
const InsertCommand_1 = require("@ts-linq/core/dist/context/commands/InsertCommand");
const UpdateCommand_1 = require("@ts-linq/core/dist/context/commands/UpdateCommand");
const DeleteCommand_1 = require("@ts-linq/core/dist/context/commands/DeleteCommand");
const ChangeValidationService_1 = require("@ts-linq/core/dist/context/services/ChangeValidationService");
function getOriginal(target) {
    try {
        const gm = Reflect
            .getOwnMetadata;
        const original = (gm && gm('design:type', target)) || target;
        return original;
    }
    catch {
        return target;
    }
}
class DbContext {
    constructor(options) {
        this._dbSets = new Map();
        this._defaultLoadingStrategy = LoadingStrategy_1.LoadingStrategy.Eager;
        this._loadingDefaults = {};
        this._validationRulesCache = new WeakMap();
        this._provider = options.provider;
        this._softDelete = options.softDelete;
        try {
            this._provider.softDelete =
                options.softDelete;
        }
        catch { }
        this._audit = options.audit;
        this._globalFilters = options.globalFilters;
        this._validationOptions = options.validation;
        this._validationService = new ChangeValidationService_1.ChangeValidationService(this._validationOptions?.translate, this._audit);
        this._changeTracker = new ChangeTracker_1.ChangeTracker();
        this._entityLoader = new EntityLoader_1.EntityLoader(this._provider);
        this._insertCmd = new InsertCommand_1.InsertCommand(this._provider, (c) => this.updateEntityCache(c));
        this._updateCmd = new UpdateCommand_1.UpdateCommand(this._provider, (c) => this.updateEntityCache(c));
        this._deleteCmd = new DeleteCommand_1.DeleteCommand(this._provider, (c) => this.handleSoftDelete(c), (c) => this.removeFromEntityCache(c));
        if (options.performance?.enableEntityCache) {
            this._entityCache = new EntityCache_1.EntityCache(options.performance.entityCacheSize ?? 10000, this._provider.loggerRef, this._provider.providerLabel);
        }
        this._performanceOptions = options.performance;
        this._loadingDefaults = options.loading || {};
        if (this._loadingDefaults.strategy) {
            this._defaultLoadingStrategy = this._loadingDefaults.strategy;
            this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
        }
        else {
            this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
        }
        this.initializeDbSets();
    }
    set(entityClass) {
        return this._dbSets.get(entityClass) || this.registerDbSet(entityClass);
    }
    configure(options) {
        this._loadingDefaults = options.loading || this._loadingDefaults;
        if (this._loadingDefaults.strategy) {
            this._defaultLoadingStrategy = this._loadingDefaults.strategy;
            this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
        }
        this._performanceOptions = options.performance || this._performanceOptions;
        this._softDelete = options.softDelete ?? this._softDelete;
        this._audit = options.audit ?? this._audit;
        LazyLoadingProxy_1.LazyLoadingProxy.setLogger(options.logger);
    }
    get provider() {
        return this._provider;
    }
    get changeTracker() {
        return this._changeTracker;
    }
    async saveChanges() {
        try {
            this._changeTracker.detectChanges();
            const changes = this._changeTracker.getChanges();
            this._validationService.validate(changes.map((c) => ({
                entity: c.entity,
                entityClass: c.entityClass,
                state: c.state,
                originalValues: c.originalValues
            })));
            let affected = 0;
            for (const change of changes) {
                if (change.state === 'added') {
                    await this._insertCmd.execute(change);
                    affected++;
                }
                else if (change.state === 'modified') {
                    await this._updateCmd.execute(change);
                    affected++;
                }
                else if (change.state === 'deleted') {
                    await this._deleteCmd.execute(change);
                    affected++;
                }
            }
            this._changeTracker.acceptAllChanges();
            return (0, types_1.ok)(affected);
        }
        catch (e) {
            return (0, types_1.err)(e);
        }
    }
    async handleSoftDelete(change) {
        if (!this._softDelete?.enabled)
            return false;
        const meta = MetadataStorage_1.MetadataStorage.getEntity(change.entityClass);
        if (!meta)
            return false;
        const flag = this._softDelete.column ?? 'isDeleted';
        const deletedAt = this._softDelete.deletedAtColumn ?? 'deletedAt';
        const hasFlag = meta.columns.some((c) => c.propertyName === flag || c.columnName === flag);
        if (!hasFlag)
            return false;
        change.entity[flag] = true;
        const hasDeletedAt = meta.columns.some((c) => c.propertyName === deletedAt || c.columnName === deletedAt);
        if (hasDeletedAt)
            change.entity[deletedAt] = new Date();
        await this._provider.update(change.entity, change.entityClass);
        this.updateEntityCache(change);
        return true;
    }
    updateEntityCache(change) {
        if (!this._entityCache)
            return;
        const pk = this.getPrimaryKey(change.entityClass);
        if (!pk)
            return;
        this._entityCache.set(change.entityClass, change.entity[pk], change.entity);
    }
    removeFromEntityCache(change) {
        if (!this._entityCache)
            return;
        const pk = this.getPrimaryKey(change.entityClass);
        if (!pk)
            return;
        this._entityCache.remove(change.entityClass, change.entity[pk]);
    }
    getPrimaryKey(entityClass) {
        const meta = MetadataStorage_1.MetadataStorage.getEntity(entityClass);
        return meta?.primaryKeys[0];
    }
    initializeDbSets() {
        const entities = MetadataStorage_1.MetadataStorage.getEntities();
        for (const meta of entities) {
            this.registerDbSet(meta.target);
        }
    }
    registerDbSet(entityClass) {
        const set = new DbSet_1.DbSet(entityClass, this._provider, this._changeTracker, this._entityLoader, this._entityCache, this._performanceOptions, this._globalFilters);
        const propName = this.buildAutoPropertyName(entityClass.name);
        Object.defineProperty(this, propName, {
            get: () => set,
            enumerable: true,
            configurable: true
        });
        this._dbSets.set(entityClass, set);
        return set;
    }
    buildAutoPropertyName(typeName) {
        const n = typeName.charAt(0).toLowerCase() + typeName.slice(1);
        if (n.endsWith('y'))
            return `${n.slice(0, -1)}ies`;
        return `${n}s`;
    }
}
exports.DbContext = DbContext;
//# sourceMappingURL=DbContext.js.map