"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OneToMany = OneToMany;
exports.ManyToOne = ManyToOne;
exports.OneToOne = OneToOne;
exports.ManyToMany = ManyToMany;
const MetadataStorage_1 = require("./MetadataStorage");
/**
 * Declares a one-to-many relationship on a collection navigation property.
 */
function OneToMany(targetEntity, options = {}) {
    return function (target, propertyKey) {
        const name = propertyKey.toString();
        const ctor = target.constructor;
        // Resolve targetEntity thunk
        const resolved = targetEntity();
        const relationship = {
            propertyName: name,
            type: 'one-to-many',
            targetEntity: resolved,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false,
            through: options?.through
        };
        MetadataStorage_1.MetadataStorage.addRelationship(ctor, relationship);
    };
}
/**
 * Declares a many-to-one relationship on a reference navigation property.
 */
function ManyToOne(targetEntity, options = {}) {
    return function (target, propertyKey) {
        const name = propertyKey.toString();
        const ctor = target.constructor;
        const resolved = targetEntity();
        const relationship = {
            propertyName: name,
            type: 'many-to-one',
            targetEntity: resolved,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false,
            through: options?.through
        };
        MetadataStorage_1.MetadataStorage.addRelationship(ctor, relationship);
    };
}
/**
 * Declares a one-to-one relationship on a reference navigation property.
 */
function OneToOne(targetEntity, options = {}) {
    return function (target, propertyKey) {
        const name = propertyKey.toString();
        const ctor = target.constructor;
        const resolved = targetEntity();
        const relationship = {
            propertyName: name,
            type: 'one-to-one',
            targetEntity: resolved,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false,
            through: options?.through
        };
        MetadataStorage_1.MetadataStorage.addRelationship(ctor, relationship);
    };
}
/**
 * Declares a many-to-many relationship on a collection navigation property.
 */
function ManyToMany(targetEntity, options = {}) {
    return function (target, propertyKey) {
        const name = propertyKey.toString();
        const ctor = target.constructor;
        const resolved = targetEntity();
        const relationship = {
            propertyName: name,
            type: 'many-to-many',
            targetEntity: resolved,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false,
            through: options?.through
        };
        MetadataStorage_1.MetadataStorage.addRelationship(ctor, relationship);
    };
}
//# sourceMappingURL=Relationships.js.map