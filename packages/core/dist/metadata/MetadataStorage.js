"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataStorage = void 0;
const EntityMetadata_1 = require("./EntityMetadata");
/**
 * Global singleton storage that collects metadata produced by decorators
 * and exposes finalized `EntityMetadata` for use by providers and loaders.
 */
class MetadataStorage {
    normalizeTarget(target) {
        // Map decorated Extended classes back to original constructors if present
        const getOwn = Reflect
            .getOwnMetadata;
        const maybe = getOwn?.('orm:original', target);
        const original = typeof maybe === 'function' ? maybe : undefined;
        return original ?? target;
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
        const builder = this.getOrCreateBuilder(target);
        if (tableName) {
            builder.setTableName(tableName);
        }
        // Do not finalize here; allow subsequent decorators to contribute
    }
    /** Add a column definition to the target entity's builder. */
    addColumnMetadata(target, column) {
        const builder = this.getOrCreateBuilder(target);
        builder.addColumn(column);
    }
    /** Add a primary key property to the target entity's builder. */
    addPrimaryKeyMetadata(target, propertyName) {
        const builder = this.getOrCreateBuilder(target);
        builder.addPrimaryKey(propertyName);
    }
    /** Add a relationship definition to the target entity's builder. */
    addRelationshipMetadata(target, relationship) {
        const builder = this.getOrCreateBuilder(target);
        builder.addRelationship(relationship);
    }
    /** Add an index definition to the target entity's builder. */
    addIndexMetadata(target, index) {
        const builder = this.getOrCreateBuilder(target);
        builder.addIndex(index);
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
        if (this.builders.has(key)) {
            this.finalizeEntity(key);
        }
        return this.entities.get(key);
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