"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataStorage = void 0;
const types_1 = require("@ts-linq/types");
const EntityMetadata_1 = require("./EntityMetadata");
const PendingMetadataCollector_1 = require("./PendingMetadataCollector");
/**
 * Global singleton storage that collects metadata produced by decorators
 * and exposes finalized `EntityMetadata` for use by providers and loaders.
 */
class MetadataStorage {
    normalizeTarget(target) {
        // Map decorated Extended classes back to original constructors if present
        if (!target || typeof target !== 'function') {
            return target;
        }
        try {
            const getOwn = Reflect
                .getOwnMetadata;
            const maybe = getOwn?.('orm:original', target);
            const original = typeof maybe === 'function' ? maybe : undefined;
            return original ?? target;
        }
        catch {
            return target;
        }
    }
    constructor() {
        this.entities = new Map();
        this.builders = new Map();
    }
    /** Get the singleton instance, creating it if necessary. */
    static getInstance() {
        if (!MetadataStorage.instance) {
            MetadataStorage.instance = new MetadataStorage();
        }
        return MetadataStorage.instance;
    }
    /** Get all finalized entities' metadata. */
    static getEntities() {
        return MetadataStorage.getInstance().getAllEntities();
    }
    /** Get metadata for a specific entity constructor. */
    static getEntity(target) {
        if (!target || typeof target !== 'function') {
            return undefined;
        }
        try {
            const getOwn = Reflect
                .getOwnMetadata;
            const maybe = getOwn?.('orm:original', target);
            const original = typeof maybe === 'function' ? maybe : target;
            const meta = MetadataStorage.getInstance().getEntityMetadata(original);
            if (!meta)
                return undefined;
            if (original !== target) {
                // Return a view of metadata with target set to the provided constructor (decorated class)
                return { ...meta, target };
            }
            return meta;
        }
        catch {
            return MetadataStorage.getInstance().getEntityMetadata(target);
        }
    }
    /** Register an entity and optionally set its table name. */
    static addEntity(target, tableName) {
        MetadataStorage.getInstance().registerEntity(target, tableName);
    }
    /** Add column metadata for an entity. */
    static addColumn(target, column) {
        MetadataStorage.getInstance().addColumnMetadata(target, column);
    }
    /** Mark a property as part of the primary key. */
    static addPrimaryKey(target, propertyName) {
        MetadataStorage.getInstance().addPrimaryKeyMetadata(target, propertyName);
    }
    /** Add relationship metadata for an entity. */
    static addRelationship(target, relationship) {
        MetadataStorage.getInstance().addRelationshipMetadata(target, relationship);
    }
    /** Add index metadata for an entity. */
    static addIndex(target, index) {
        MetadataStorage.getInstance().addIndexMetadata(target, index);
    }
    /** Add validation rule for an entity. */
    static addValidationRule(target, rule) {
        MetadataStorage.getInstance().addValidationRuleMetadata(target, rule);
    }
    /** Get all validation rules for an entity. */
    static getValidationRules(target) {
        const metadata = MetadataStorage.getEntity(target);
        return metadata?.validations ?? [];
    }
    /**
     * Get an existing metadata builder for a target or create a new one.
     */
    getOrCreateBuilder(target) {
        const key = this.normalizeTarget(target);
        if (!this.builders.has(key)) {
            this.builders.set(key, new EntityMetadata_1.EntityMetadataBuilder(key));
        }
        return this.builders.get(key);
    }
    /**
     * Register an entity constructor, optionally overriding the table name.
     * Finalization is deferred until metadata is consumed.
     */
    registerEntity(target, tableName) {
        const key = this.normalizeTarget(target);
        const finalized = this.entities.get(key);
        if (finalized && tableName) {
            // Entity is already finalized, just update tableName
            finalized.tableName = tableName;
            return;
        }
        const builder = this.getOrCreateBuilder(target);
        if (tableName) {
            builder.setTableName(tableName);
        }
        // Do not finalize here; allow subsequent decorators to contribute
    }
    /** Add a column definition to the target entity's builder or directly to finalized metadata. */
    addColumnMetadata(target, column) {
        // Guard: conflicting defaults are not allowed
        if (column.defaultExpression !== undefined && column.defaultValue !== undefined) {
            throw new types_1.ValidationError(`Column ${column.columnName} cannot have both defaultExpression and defaultValue`);
        }
        // Guard: computed columns cannot have defaults, be generated or versioned
        if (column.isComputed) {
            if (column.defaultValue !== undefined || column.defaultExpression !== undefined) {
                throw new types_1.ValidationError(`Computed column ${column.columnName} cannot have defaultValue/defaultExpression`);
            }
            if (column.isGenerated) {
                throw new types_1.ValidationError(`Computed column ${column.columnName} cannot be marked as isGenerated`);
            }
            if (column.isVersion) {
                throw new types_1.ValidationError(`Computed column ${column.columnName} cannot be a version column`);
            }
            // DX: computed columns are read-only by definition
            column.isReadOnly = true;
        }
        const key = this.normalizeTarget(target);
        const finalized = this.entities.get(key);
        if (finalized) {
            // Merge into existing finalized metadata
            if (!finalized.columns.some((c) => c.propertyName === column.propertyName)) {
                finalized.columns = [...finalized.columns, column];
            }
            return;
        }
        const builder = this.getOrCreateBuilder(target);
        builder.addColumn(column);
    }
    /** Add a primary key property to the target entity's builder or into finalized metadata. */
    addPrimaryKeyMetadata(target, propertyName) {
        const key = this.normalizeTarget(target);
        const finalized = this.entities.get(key);
        if (finalized) {
            if (!finalized.primaryKeys?.includes(propertyName)) {
                finalized.primaryKeys = [...(finalized.primaryKeys || []), propertyName];
            }
            return;
        }
        const builder = this.getOrCreateBuilder(target);
        builder.addPrimaryKey(propertyName);
    }
    /** Add a relationship definition to the target entity's builder. */
    addRelationshipMetadata(target, relationship) {
        // Normalize thunk target to constructor to keep tests stable
        const te = relationship.targetEntity;
        const resolved = typeof te === 'function' && te.prototype
            ? te
            : te();
        const key = this.normalizeTarget(target);
        const finalized = this.entities.get(key);
        if (finalized) {
            finalized.relationships = [
                ...finalized.relationships,
                { ...relationship, targetEntity: resolved }
            ];
            return;
        }
        const builder = this.getOrCreateBuilder(target);
        builder.addRelationship({ ...relationship, targetEntity: resolved });
    }
    /** Add an index definition to the target entity's builder. */
    addIndexMetadata(target, index) {
        const key = this.normalizeTarget(target);
        const finalized = this.entities.get(key);
        if (finalized) {
            // Validate duplicate name
            if (finalized.indexes.some((i) => i.name === index.name)) {
                throw new types_1.ValidationError(`Duplicate index name '${index.name}' on entity '${finalized.tableName}'`);
            }
            // Validate columns exist
            const existingCols = new Set(finalized.columns.map((c) => [c.columnName, c.propertyName]).flat());
            const missing = index.columns.filter((c) => !existingCols.has(c));
            if (missing.length > 0) {
                throw new types_1.ValidationError(`Index '${index.name}' on entity '${finalized.tableName}' references unknown columns: ${missing.join(', ')}`);
            }
            finalized.indexes = [...finalized.indexes, index];
            return;
        }
        // Builder path
        const builder = this.getOrCreateBuilder(target);
        const snapshot = builder.build();
        // Validate duplicate index name
        if ((snapshot.indexes || []).some((i) => i.name === index.name)) {
            throw new types_1.ValidationError(`Duplicate index name '${index.name}' on entity '${snapshot.tableName}'`);
        }
        // Validate columns exist (now works correctly with context.metadata approach)
        const existingCols = new Set((snapshot.columns || []).map((c) => [c.columnName, c.propertyName]).flat());
        const missing = index.columns.filter((c) => !existingCols.has(c));
        if (missing.length > 0) {
            throw new types_1.ValidationError(`Index '${index.name}' on entity '${snapshot.tableName}' references unknown columns: ${missing.join(', ')}`);
        }
        builder.addIndex(index);
    }
    /** Add a validation rule to the target entity's builder. */
    addValidationRuleMetadata(target, rule) {
        const key = this.normalizeTarget(target);
        const finalized = this.entities.get(key);
        if (finalized) {
            finalized.validations = [...(finalized.validations || []), rule];
            return;
        }
        const builder = this.getOrCreateBuilder(target);
        builder.addValidationRule(rule);
    }
    /**
     * Finalize and store metadata for a given target if a builder exists.
     */
    finalizeEntity(target) {
        const key = this.normalizeTarget(target);
        if (this.builders.has(key)) {
            const builder = this.builders.get(key);
            const metadata = builder.build();
            this.entities.set(key, metadata);
            this.builders.delete(key);
        }
    }
    /** Get finalized `EntityMetadata` for a specific constructor. */
    getEntityMetadata(target) {
        const key = this.normalizeTarget(target);
        // If still in builder phase, collect pending metadata before finalization
        if (this.builders.has(key)) {
            this.collectPendingMetadata(key);
            this.finalizeEntity(key);
        }
        return this.entities.get(key);
    }
    /**
     * Collect and register any pending metadata from PendingMetadataCollector.
     * This is called automatically by getEntityMetadata to handle Stage-3 decorators.
     */
    collectPendingMetadata(target) {
        const pendingColumns = PendingMetadataCollector_1.PendingMetadataCollector.getColumns(target);
        const pendingPrimaryKeys = PendingMetadataCollector_1.PendingMetadataCollector.getPrimaryKeys(target);
        const pendingIndexes = PendingMetadataCollector_1.PendingMetadataCollector.getIndexes(target);
        const pendingRelationships = PendingMetadataCollector_1.PendingMetadataCollector.getRelationships(target);
        // Only process if there's pending metadata
        if (pendingColumns.size > 0 || pendingPrimaryKeys.size > 0 ||
            pendingIndexes.length > 0 || pendingRelationships.size > 0) {
            // Register columns
            for (const [_propertyName, columnMeta] of pendingColumns.entries()) {
                this.addColumnMetadata(target, columnMeta);
            }
            // Register primary keys
            for (const propertyName of pendingPrimaryKeys) {
                this.addPrimaryKeyMetadata(target, propertyName);
            }
            // Register indexes
            for (const indexMeta of pendingIndexes) {
                this.addIndexMetadata(target, indexMeta);
            }
            // Register relationships
            for (const [_propertyName, relationMeta] of pendingRelationships.entries()) {
                this.addRelationshipMetadata(target, relationMeta);
            }
            // Clear pending metadata to free memory
            PendingMetadataCollector_1.PendingMetadataCollector.clear(target);
        }
    }
    /** Finalize and return metadata for all registered entities. */
    getAllEntities() {
        // Finalize any pending builders
        for (const target of this.builders.keys()) {
            this.finalizeEntity(target);
        }
        return Array.from(this.entities.values());
    }
    /** Clear all stored metadata and pending builders. */
    clear() {
        this.entities.clear();
        this.builders.clear();
    }
}
exports.MetadataStorage = MetadataStorage;
//# sourceMappingURL=MetadataStorage.js.map