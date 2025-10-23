"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbContext = void 0;
const ChangeTracker_1 = require("./ChangeTracker");
const core_1 = require("@ts-linq/core");
const core_2 = require("@ts-linq/core");
const metadata_1 = require("@ts-linq/metadata");
const core_3 = require("@ts-linq/core");
const DbSet_1 = require("./DbSet");
const InsertCommand_1 = require("./commands/InsertCommand");
const UpdateCommand_1 = require("./commands/UpdateCommand");
const DeleteCommand_1 = require("./commands/DeleteCommand");
const ChangeValidationService_1 = require("./services/ChangeValidationService");
const types_1 = require("@ts-linq/types");
const core_4 = require("@ts-linq/core");
// import { logInternalError } from '@ts-linq/core'; // REMOVED
function getOriginal(target) {
    try {
        const gm = Reflect
            .getOwnMetadata;
        const original = gm?.('orm:original', target) || target;
        return original;
    }
    catch {
        return target;
    }
}
/**
 * Base unit-of-work style context that orchestrates entity sets, change tracking
 * and database provider interactions. Similar to Entity Framework's `DbContext`.
 *
 * Note about auto-generated DbSet properties:
 * - For each registered entity class `User`, a property is created on the context instance
 *   using a simple pluralization of the lowercased class name:
 *   `<ClassName>.toLowerCase() + 's'`, with a basic `y → ies` rule.
 *   Examples: `Author` → `authors`, `Book` → `books`, `Category` → `categories`.
 * - If you want a different property name, either add your own getter that returns `set(YourEntity)`,
 *   or use `set(YourEntity)` directly instead of the auto-generated property.
 */
class DbContext {
    /**
     * Create a new database context instance.
     *
     * @param options Connection and provider configuration.
     */
    constructor(options) {
        this._dbSets = new Map();
        this._defaultLoadingStrategy = core_2.LoadingStrategy.Eager;
        this._loadingDefaults = {};
        /** Cache of validation rules per entity class to avoid repeated metadata lookups. */
        this._validationRulesCache = new WeakMap();
        /** Simple cache utilities (warm-up etc.). */
        this.cache = {
            warmUp: async (options = {}) => {
                const tasks = (options.queries || []).map(async (fn) => {
                    try {
                        await fn();
                    }
                    catch (e) {
                        // logInternalError('DbContext.cache.warmUp.task', e);
                    }
                });
                await Promise.all(tasks);
            },
            invalidateByEntity: (entityNames) => {
                try {
                    const qb = require('../query/QueryBuilder');
                    for (const name of entityNames)
                        qb.QueryBuilder.invalidateForEntity(name);
                }
                catch (e) {
                    // logInternalError('DbContext.cache.invalidateByEntity.sqlCache', e);
                }
                try {
                    const extCount = this._performanceOptions?.countCache;
                    if (extCount?.invalidateBy) {
                        for (const name of entityNames) {
                            extCount.invalidateBy((k) => k.includes(`|count|`) && k.includes(`${name}|`));
                        }
                    }
                }
                catch (e) {
                    // logInternalError('DbContext.cache.invalidateByEntity.countCache', e);
                }
            },
            reportMetrics: () => {
                try {
                    const sqlCache = this._sqlBuilder;
                    const sqlMetrics = sqlCache?.getCacheMetrics?.();
                    const countCache = this._performanceOptions?.countCache;
                    const countMetrics = countCache?.getMetrics?.();
                    const logger = this._provider.loggerRef;
                    if (sqlMetrics)
                        logger?.cacheSize?.({
                            cache: 'sqlGen',
                            size: sqlMetrics.currentSize ?? -1,
                            provider: this._provider.providerLabel
                        });
                    if (countMetrics)
                        logger?.cacheSize?.({
                            cache: 'count',
                            size: countMetrics.currentSize ?? -1,
                            provider: this._provider.providerLabel
                        });
                    if (this._entityCache)
                        logger?.cacheSize?.({
                            cache: 'entityL2',
                            size: this._entityCache.size?.() ?? -1,
                            provider: this._provider.providerLabel
                        });
                }
                catch (e) {
                    // logInternalError('DbContext.cache.reportMetrics', e);
                }
            }
        };
        // Initialize database provider from options
        this._provider = options.provider;
        this._softDelete = options.softDelete;
        // Propagate soft-delete settings into provider for GlobalFilterApplier and ProviderStub
        try {
            this._provider.softDelete =
                options.softDelete;
        }
        catch {
            /* ignore */
        }
        this._audit = options.audit;
        this._globalFilters = options.globalFilters;
        this._diagnostics = options.diagnostics;
        // Start external memory profiler if provided
        try {
            const mp = this._diagnostics?.memoryProfiler;
            if (mp) {
                this._memoryProfiler = mp;
                mp.start?.();
            }
        }
        catch (e) {
            // logInternalError('DbContext.constructor.memoryProfiler.start', e);
        }
        this._validationOptions = options.validation;
        this._validationService = new ChangeValidationService_1.ChangeValidationService(this._validationOptions?.translate, this._audit);
        this._changeTracker = new ChangeTracker_1.ChangeTracker();
        this._entityLoader = new core_1.EntityLoader(this._provider);
        this._insertCmd = new InsertCommand_1.InsertCommand(this._provider, (c) => this.updateEntityCache(c));
        this._updateCmd = new UpdateCommand_1.UpdateCommand(this._provider, (c) => this.updateEntityCache(c));
        this._deleteCmd = new DeleteCommand_1.DeleteCommand(this._provider, (c) => this.handleSoftDelete(c), (c) => this.removeFromEntityCache(c));
        // Initialize optional L2 entity cache
        if (options.performance?.enableEntityCache) {
            this._entityCache =
                options.performance.entityCache ??
                    new core_4.EntityCache(options.performance.entityCacheSize ?? 10000, this._provider.loggerRef, this._provider.providerLabel);
        }
        // Store performance options for downstream consumers
        this._performanceOptions = options.performance;
        // Propagate query performance analysis options into provider if available
        try {
            const analysis = options.performance?.analysis;
            if (analysis &&
                typeof this._provider
                    .configureQueryAnalysis === 'function') {
                this._provider.configureQueryAnalysis(analysis);
            }
        }
        catch {
            /* ignore */
        }
        // Apply configurable IN() chunk size into loader
        this._entityLoader.setInChunkSize(this._performanceOptions?.inClauseChunkSize);
        this._loadingDefaults = options.loading || {};
        // Apply loading strategy from options or keep default
        if (this._loadingDefaults.strategy) {
            this._defaultLoadingStrategy = this._loadingDefaults.strategy;
            this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
        }
        else {
            this._entityLoader.setDefaultStrategy(this._defaultLoadingStrategy);
        }
        this.initializeDbSets();
    }
    /**
     * Get a DbSet for the specified entity type
     *
     * @param entityClass Constructor of the entity type.
     * @returns Configured `DbSet` instance.
     */
    set(entityClass) {
        const getOwn = Reflect
            .getOwnMetadata;
        const maybe = getOwn?.('orm:original', entityClass);
        const normalized = typeof maybe === 'function' ? maybe : entityClass;
        if (!this._dbSets.has(normalized)) {
            throw new Error(`DbSet for ${entityClass.name} is not configured`);
        }
        const dbSet = this._dbSets.get(normalized);
        // Ensure the DbSet reflects the exact (possibly decorated) class passed in
        dbSet._entityClass = entityClass;
        return dbSet;
    }
    /**
     * Initialize the database and create tables
     *
     * Connects the provider and creates tables for all registered entities.
     */
    async ensureCreated() {
        await this._provider.connect();
        // Unconditionally pre-warm Stage-3 field decorators by instantiating each entity once
        const prereg = metadata_1.MetadataStorage.getEntities();
        for (const e of prereg) {
            try {
                if (!e.target)
                    continue;
                const original = getOriginal(e.target);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const _tmp = new original();
            }
            catch {
                // ignore constructors with side-effects/args
            }
        }
        const entities = metadata_1.MetadataStorage.getEntities();
        for (const entity of entities) {
            await this._provider.createTable(entity);
        }
    }
    /**
     * Save all changes tracked by the change tracker
     * Similar to Entity Framework's SaveChanges()
     *
     * @returns Number of affected rows.
     */
    async saveChanges() {
        const changes = this._changeTracker.getChanges();
        if (!changes || changes.length === 0)
            return 0;
        this.prefillDefaults(changes);
        const normalizedForValidation = this.normalizeForValidation(changes);
        this._validationService.validate(normalizedForValidation);
        let affectedRows = 0;
        for (const change of changes) {
            const normalized = this.normalizeChange(change);
            this.applyAudit(normalized);
            affectedRows += await this.processChange(normalized);
        }
        // Smart invalidation after successful DML
        const normalizedForInvalidation = normalizedForValidation.map((c) => ({
            entity: c.entity,
            entityClass: c.entityClass,
            state: c.state
        }));
        this.invalidateCachesAfterSave(normalizedForInvalidation);
        this._changeTracker.acceptAllChanges();
        return affectedRows;
    }
    /** Try-version of saveChanges without throwing exceptions. */
    async trySaveChanges() {
        try {
            const affected = await this.saveChanges();
            return (0, types_1.ok)(affected);
        }
        catch (e) {
            return (0, types_1.err)(e);
        }
    }
    /**
     * Start a database transaction
     */
    async beginTransaction() {
        await this._provider.beginTransaction();
    }
    /**
     * Commit the current transaction
     */
    async commitTransaction() {
        await this._provider.commitTransaction();
        // Invalidate count cache after commit to avoid stale totals across contexts
        // This is a coarse-grained approach since count cache is global
        try {
            require('../query/Queryable').Queryable.clearCountCache();
            // Smart invalidation: clear L2 cache for entities that declare dependencies
            this.invalidateCachesOnCommit();
            if (this._entityCache) {
                const { safeCacheSize } = require('@ts-linq/metrics-safe');
                safeCacheSize(this._provider.loggerRef, {
                    cache: 'entityL2',
                    size: this._entityCache.size?.() ?? -1,
                    provider: this._provider.providerLabel
                });
            }
        }
        catch (e) {
            // logInternalError('DbContext.commitTransaction.invalidateCaches', e);
        }
    }
    /**
     * Rollback the current transaction
     */
    async rollbackTransaction() {
        await this._provider.rollbackTransaction();
        // Invalidate L2 cache and count cache on rollback to ensure consistency
        if (this._entityCache) {
            try {
                this._entityCache.clear();
                const { safeCacheSize } = require('@ts-linq/metrics-safe');
                safeCacheSize(this._provider.loggerRef, {
                    cache: 'entityL2',
                    size: this._entityCache.size?.() ?? 0,
                    provider: this._provider.providerLabel
                });
            }
            catch (e) {
                // logInternalError('DbContext.rollbackTransaction.entityCacheClear', e);
            }
        }
        try {
            require('../query/Queryable').Queryable.clearCountCache();
        }
        catch (e) {
            // logInternalError('DbContext.rollbackTransaction.countCacheClear', e);
        }
    }
    /**
     * Smart invalidation hook executed on successful commit.
     * Current implementation clears entire L2 cache; later can be refined per-entity via metadata.
     */
    invalidateCachesOnCommit() {
        try {
            if (this._entityCache)
                this._entityCache.clear();
            // Future: inspect changeTracker changes and Reflect.getMetadata('orm:cachePolicy', entity)
            // to perform targeted invalidation per-entity/table.
        }
        catch (e) {
            // logInternalError('DbContext.invalidateCachesOnCommit', e);
        }
    }
    /**
     * Targeted cache invalidation after saveChanges.
     * - Removes deleted entities from L2 by primary key
     * - Clears L2 entirely if any dependent CachePolicy requires invalidation
     * - Clears global count cache (best-effort)
     */
    invalidateCachesAfterSave(changes) {
        try {
            const changedNames = new Set(changes.map((c) => c.entityClass.name));
            const needFullL2Clear = this.computeNeedFullL2Clear(changedNames);
            this.removeDeletedFromEntityCache(changes, needFullL2Clear);
            this.invalidateSqlCacheByNames(changedNames);
            this.invalidateCountCacheByNames(changedNames);
        }
        catch (e) {
            // logInternalError('DbContext.invalidateCachesAfterSave', e);
        }
    }
    computeNeedFullL2Clear(changedNames) {
        try {
            const entities = require('../metadata/MetadataStorage').MetadataStorage.getEntities();
            for (const e of entities) {
                const meta = Reflect.getOwnMetadata?.('orm:cachePolicy', e.target);
                if (meta?.invalidateOn && meta.invalidateOn.some((n) => changedNames.has(n))) {
                    return true;
                }
            }
        }
        catch {
            /* ignore */
        }
        return false;
    }
    removeDeletedFromEntityCache(changes, needFullClear) {
        if (!this._entityCache)
            return;
        try {
            for (const c of changes) {
                if (c.state === 'deleted') {
                    const pk = this.getPrimaryKey(c.entityClass);
                    if (pk !== undefined) {
                        this._entityCache.remove(c.entityClass, c.entity[pk]);
                    }
                }
            }
            if (needFullClear)
                this._entityCache.clear();
        }
        catch (e) {
            // logInternalError('DbContext.removeDeletedFromEntityCache', e);
        }
    }
    invalidateSqlCacheByNames(changedNames) {
        try {
            const qb = require('../query/QueryBuilder');
            for (const name of changedNames)
                qb.QueryBuilder.invalidateForEntity(name);
        }
        catch (e) {
            // logInternalError('DbContext.invalidateCachesAfterSave.sqlCache', e);
        }
    }
    invalidateCountCacheByNames(changedNames) {
        try {
            const extCount = this._performanceOptions?.countCache;
            if (!extCount?.invalidateBy)
                return;
            for (const name of changedNames) {
                extCount.invalidateBy((k) => k.startsWith(name + '|count|'));
            }
        }
        catch (e) {
            // logInternalError('DbContext.invalidateCachesAfterSave.countCache', e);
        }
    }
    /**
     * Dispose of the database connection
     */
    async dispose() {
        await this._provider.disconnect();
        // Stop external memory profiler if started
        try {
            this._memoryProfiler?.stop?.();
        }
        catch (e) {
            // logInternalError('DbContext.dispose.memoryProfiler.stop', e);
        }
    }
    /**
     * Get the underlying database provider
     *
     * @returns The active `DatabaseProvider` implementation.
     */
    get provider() {
        return this._provider;
    }
    /**
     * Get the change tracker
     *
     * @returns The `ChangeTracker` handling entity states.
     */
    get changeTracker() {
        return this._changeTracker;
    }
    /**
     * Get the entity loader
     *
     * @returns The `EntityLoader` used for eager/lazy loading.
     */
    get entityLoader() {
        return this._entityLoader;
    }
    /**
     * Set the default loading strategy
     *
     * @param strategy Loading strategy to use by default.
     */
    setLoadingStrategy(strategy) {
        this._defaultLoadingStrategy = strategy;
        this._entityLoader.setDefaultStrategy(strategy);
    }
    /**
     * Find an entity by ID with loading options.
     * Entity Framework style method that returns lazy loading proxies by default.
     *
     * @param entityClass Constructor of the entity type.
     * @param id Primary key value.
     * @param options Loading options (strategy, includes, depth).
     * @returns The found entity or null with lazy loading enabled by default.
     */
    async find(entityClass, id, options) {
        const loadingOptions = {
            strategy: this._loadingDefaults.strategy ?? this._defaultLoadingStrategy,
            depth: this._loadingDefaults.depth ?? options?.depth,
            ...(options || {})
        };
        return await this._entityLoader.loadEntity(entityClass, id, loadingOptions);
    }
    /**
     * Find entities with loading options.
     * Entity Framework style method that returns lazy loading proxies by default.
     *
     * @param entityClass Constructor of the entity type.
     * @param options Loading options (strategy, includes, depth).
     * @returns Array of loaded entities with lazy loading enabled by default.
     */
    async findAll(entityClass, options) {
        const loadingOptions = {
            strategy: this._loadingDefaults.strategy ?? this._defaultLoadingStrategy,
            depth: this._loadingDefaults.depth ?? options?.depth,
            ...(options || {})
        };
        return await this._entityLoader.loadEntities(entityClass, loadingOptions);
    }
    /**
     * Load navigation properties for an entity (Entity Framework style Include).
     * Useful for explicitly loading relationships on already-loaded entities.
     */
    async include(entity, entityClass, ...propertyNames) {
        if (core_3.LazyLoadingProxy.isLazyProxy(entity)) {
            // Preload relationships for lazy proxy
            await core_3.LazyLoadingProxy.preloadRelationships([entity], entityClass, propertyNames, this._provider);
        }
        else {
            // Use entity loader for regular entities
            await this._entityLoader.populateRelationships(entity, entityClass, {
                strategy: core_2.LoadingStrategy.Eager,
                includes: propertyNames
            });
        }
    }
    /**
     * Check if navigation property is loaded (Entity Framework style IsLoaded).
     */
    isLoaded(entity, propertyName) {
        if (core_3.LazyLoadingProxy.isLazyProxy(entity)) {
            return core_3.LazyLoadingProxy.isRelationshipLoaded(entity, propertyName);
        }
        // For non-proxy entities, check if property key exists (even if undefined/null)
        const record = entity;
        return propertyName in record;
    }
    // Removed string-based include API in favor of predicate-based include on Queryable
    /**
     * Initialize DbSets for all registered entities.
     *
     * This method also defines auto-generated properties on the context instance
     * for each entity using a simple naming convention (see class JSDoc). If your
     * code expects different names, prefer `set(Entity)` or add your own proxy
     * getters that delegate to `set(Entity)`.
     */
    initializeDbSets() {
        const entities = metadata_1.MetadataStorage.getEntities();
        for (const entity of entities) {
            if (!entity.target)
                continue;
            const original = getOriginal(entity.target);
            const dbSet = new DbSet_1.DbSet(original, this._provider, this._changeTracker, this._entityLoader, this._entityCache, this._performanceOptions, this._globalFilters);
            this._dbSets.set(original, dbSet);
            // Create property on context instance for easy access
            const base = original.name.toLowerCase();
            const propertyName = base.endsWith('y') ? base.slice(0, -1) + 'ies' : base + 's';
            Object.defineProperty(this, propertyName, {
                get: () => dbSet,
                enumerable: true,
                configurable: true
            });
        }
    }
    /** Basic model validation: not-null and length. */
    validateChanges(changes) {
        const errors = [];
        for (const change of changes) {
            if (change.state !== 'added' && change.state !== 'modified')
                continue;
            const meta = metadata_1.MetadataStorage.getEntity(change.entityClass);
            if (!meta)
                continue;
            const audit = this._audit?.enabled ? this._audit : undefined;
            const auditNames = this.extractAuditNames(audit);
            for (const col of meta.columns) {
                this.validateComputedColumn(meta, col, change, errors);
                this.validateNullAndLength(meta, col, change, audit, auditNames, errors);
            }
            this.runConditionalValidations(change, meta, errors);
        }
        if (errors.length > 0)
            throw new types_1.ValidationError('Model validation failed');
    }
    // ================= Helpers extracted from saveChanges =================
    prefillDefaults(changes) {
        for (const change of changes) {
            if (change.state !== 'added')
                continue;
            const meta = metadata_1.MetadataStorage.getEntity(change.entityClass);
            if (!meta)
                continue;
            for (const col of meta.columns) {
                const record = change.entity;
                if (record[col.propertyName] === undefined && col.defaultValue !== undefined) {
                    record[col.propertyName] = col.defaultValue;
                }
            }
        }
    }
    normalizeForValidation(changes) {
        return changes.map((c) => ({
            entity: c.entity,
            entityClass: c.entityClass,
            state: c.state,
            originalValues: c.originalValues
        }));
    }
    normalizeChange(change) {
        return {
            entity: change.entity,
            entityClass: change.entityClass,
            state: change.state
        };
    }
    applyAudit(change) {
        if (!this._audit?.enabled)
            return;
        const meta = metadata_1.MetadataStorage.getEntity(change.entityClass);
        if (!meta)
            return;
        const names = this.extractAuditNames(this._audit);
        if (!names)
            return;
        const now = (this._audit.clock ?? (() => new Date()))();
        const currentUser = this._audit.getCurrentUser?.();
        if (change.state === 'added') {
            this.applyCreatedAudit(meta, change.entity, names, now, currentUser);
        }
        if (change.state === 'added' || change.state === 'modified') {
            this.applyUpdatedAudit(meta, change.entity, names, now, currentUser);
        }
    }
    applyCreatedAudit(meta, entity, names, now, currentUser) {
        if (this.hasProperty(meta, names.createdAt))
            entity[names.createdAt] = now;
        if (this.hasProperty(meta, names.createdBy) && currentUser !== undefined)
            entity[names.createdBy] = currentUser;
    }
    applyUpdatedAudit(meta, entity, names, now, currentUser) {
        if (this.hasProperty(meta, names.updatedAt))
            entity[names.updatedAt] = now;
        if (this.hasProperty(meta, names.updatedBy) && currentUser !== undefined)
            entity[names.updatedBy] = currentUser;
    }
    hasProperty(meta, propertyName) {
        return meta.columns.some((c) => c.propertyName === propertyName);
    }
    async processChange(change) {
        switch (change.state) {
            case 'added':
                await this.applyInsert(change);
                return 1;
            case 'modified':
                await this.applyUpdate(change);
                return 1;
            case 'deleted':
                return (await this.applyDelete(change)) ? 1 : 0;
            default:
                return 0;
        }
    }
    async applyInsert(change) {
        await this._insertCmd.execute({ ...change, state: 'added' });
    }
    async applyUpdate(change) {
        await this._updateCmd.execute({ ...change, state: 'modified' });
    }
    async applyDelete(change) {
        return await this._deleteCmd.execute({ ...change, state: 'deleted' });
    }
    async handleSoftDelete(change) {
        if (!this._softDelete?.enabled)
            return false;
        const meta = metadata_1.MetadataStorage.getEntity(change.entityClass);
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
        const meta = metadata_1.MetadataStorage.getEntity(entityClass);
        return meta?.primaryKeys?.[0];
    }
    /**
     * Retrieve cached validation rules for an entity class (Reflect metadata → cache).
     */
    getValidationRules(entityClass) {
        const cached = this._validationRulesCache.get(entityClass);
        if (cached)
            return cached;
        // Stage-3: Use MetadataStorage instead of Reflect API
        const rules = metadata_1.MetadataStorage.getValidationRules(entityClass).slice();
        this._validationRulesCache.set(entityClass, rules);
        return rules;
    }
    extractAuditNames(audit) {
        if (!audit)
            return undefined;
        return {
            createdAt: audit.timeColumns?.createdAt ?? audit.createdAtColumn ?? 'createdAt',
            updatedAt: audit.timeColumns?.updatedAt ?? audit.updatedAtColumn ?? 'updatedAt',
            createdBy: audit.userColumns?.createdBy ?? audit.createdByColumn ?? 'createdBy',
            updatedBy: audit.userColumns?.updatedBy ?? audit.updatedByColumn ?? 'updatedBy'
        };
    }
    validateComputedColumn(meta, col, change, errors) {
        if (!col.isComputed)
            return;
        const value = change.entity[col.propertyName];
        if (change.state === 'added') {
            if (value !== undefined)
                errors.push(this.buildValidationDetail(meta, col.propertyName, 'Computed column is read-only and cannot be set on insert'));
            return;
        }
        if (change.state === 'modified' && change.originalValues) {
            const prev = change.originalValues[col.propertyName];
            if (value !== prev)
                errors.push(this.buildValidationDetail(meta, col.propertyName, 'Computed column is read-only and cannot be updated'));
        }
    }
    validateNullAndLength(meta, col, change, audit, auditNames, errors) {
        const value = change.entity[col.propertyName];
        const isGeneratedPk = this.isGeneratedPrimaryKey(meta, col, change);
        const hasDbDefault = col.defaultValue !== undefined && change.state === 'added';
        const satisfiableByAudit = this.canBeSatisfiedByAudit(audit, auditNames, change.state, col.propertyName);
        if (!col.nullable &&
            (value === null || value === undefined) &&
            !isGeneratedPk &&
            !hasDbDefault &&
            !satisfiableByAudit) {
            errors.push(this.buildValidationDetail(meta, col.propertyName, 'Value cannot be null'));
        }
        if (col.length && typeof value === 'string' && value.length > col.length) {
            errors.push(this.buildValidationDetail(meta, col.propertyName, `Length exceeds ${col.length}`));
        }
    }
    isGeneratedPrimaryKey(meta, col, change) {
        return (!!meta &&
            !!meta.primaryKeys &&
            meta.primaryKeys.includes(col.propertyName) &&
            !!col.isGenerated &&
            change.state === 'added');
    }
    canBeSatisfiedByAudit(audit, auditNames, state, propertyName) {
        if (!audit || !auditNames)
            return false;
        if (state === 'added' &&
            (propertyName === auditNames.createdAt || propertyName === auditNames.createdBy)) {
            return propertyName === auditNames.createdAt || audit.getCurrentUser !== undefined;
        }
        if ((state === 'added' || state === 'modified') &&
            (propertyName === auditNames.updatedAt || propertyName === auditNames.updatedBy)) {
            return propertyName === auditNames.updatedAt || audit.getCurrentUser !== undefined;
        }
        return false;
    }
    runConditionalValidations(change, meta, errors) {
        try {
            const rules = this.getValidationRules(change.entityClass);
            for (const rule of rules) {
                const phase = rule.phase || 'always';
                if (phase === 'onCreate' && change.state !== 'added')
                    continue;
                if (phase === 'onUpdate' && change.state !== 'modified')
                    continue;
                const ok = !!rule.predicate(change.entity);
                if (!ok) {
                    const msgKey = rule.messageKey;
                    const msgParams = rule.messageParams;
                    const translated = msgKey && this._validationOptions?.translate
                        ? this._validationOptions.translate(msgKey, msgParams)
                        : undefined;
                    const baseMsg = translated || rule.message || 'Validation rule failed';
                    errors.push(this.buildValidationDetail(meta, rule.propertyName, baseMsg));
                }
            }
        }
        catch {
            /* ignore */
        }
    }
    buildValidationDetail(meta, property, message) {
        const table = meta?.tableName || 'unknown_table';
        const typeName = meta?.target?.name || 'UnknownEntity';
        const col = meta?.columns.find((c) => c.propertyName === property)?.columnName || property;
        const fullMessage = `${typeName}.${property} (${table}.${col}): ${message}`;
        return {
            entity: table,
            property,
            message,
            entityClass: typeName,
            table,
            column: col,
            fullMessage
        };
    }
}
exports.DbContext = DbContext;
//# sourceMappingURL=DbContext.js.map