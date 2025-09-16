"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OneToMany = OneToMany;
exports.ManyToOne = ManyToOne;
exports.OneToOne = OneToOne;
exports.ManyToMany = ManyToMany;
require("reflect-metadata");
const MetadataStorage_1 = require("../metadata/MetadataStorage");
/**
 * Declares a one-to-many relationship on a collection navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
function OneToMany(targetEntity, options = {}) {
    return function (target, propertyKey) {
        const propertyName = propertyKey.toString();
        const relationship = {
            propertyName,
            type: 'one-to-many',
            targetEntity: targetEntity,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false
        };
        MetadataStorage_1.MetadataStorage.addRelationship(target.constructor, relationship);
        // Persist relationship for rehydration
        const ctor = target.constructor;
        const existing = Reflect.getOwnMetadata('orm:relationships', ctor) || [];
        existing.push(relationship);
        Reflect.defineMetadata('orm:relationships', existing, ctor);
    };
}
/**
 * Declares a many-to-one relationship on a reference navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
function ManyToOne(targetEntity, options = {}) {
    return function (target, propertyKey) {
        const propertyName = propertyKey.toString();
        const relationship = {
            propertyName,
            type: 'many-to-one',
            targetEntity: targetEntity,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false
        };
        MetadataStorage_1.MetadataStorage.addRelationship(target.constructor, relationship);
        const ctor = target.constructor;
        const existing = Reflect.getOwnMetadata('orm:relationships', ctor) || [];
        existing.push(relationship);
        Reflect.defineMetadata('orm:relationships', existing, ctor);
    };
}
/**
 * Declares a one-to-one relationship on a reference navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
function OneToOne(targetEntity, options = {}) {
    return function (target, propertyKey) {
        const propertyName = propertyKey.toString();
        const relationship = {
            propertyName,
            type: 'one-to-one',
            targetEntity: targetEntity,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false
        };
        MetadataStorage_1.MetadataStorage.addRelationship(target.constructor, relationship);
        const ctor = target.constructor;
        const existing = Reflect.getOwnMetadata('orm:relationships', ctor) || [];
        existing.push(relationship);
        Reflect.defineMetadata('orm:relationships', existing, ctor);
    };
}
/**
 * Declares a many-to-many relationship on a collection navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
function ManyToMany(targetEntity, options = {}) {
    return function (target, propertyKey) {
        const propertyName = propertyKey.toString();
        const relationship = {
            propertyName,
            type: 'many-to-many',
            targetEntity: targetEntity,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false
        };
        MetadataStorage_1.MetadataStorage.addRelationship(target.constructor, relationship);
        const ctor = target.constructor;
        const existing = Reflect.getOwnMetadata('orm:relationships', ctor) || [];
        existing.push(relationship);
        Reflect.defineMetadata('orm:relationships', existing, ctor);
    };
}
//# sourceMappingURL=Relationships.js.map