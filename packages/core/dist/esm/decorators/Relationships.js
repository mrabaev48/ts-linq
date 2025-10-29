import 'reflect-metadata';
import { MetadataStorage } from '@ts-linq/metadata';
function defineRelationship(kind, targetEntity, options, target, propertyKey) {
    // For legacy decorators, target is the prototype, target.constructor is the class
    const ctor = (target?.constructor || target);
    const propertyName = String(propertyKey);
    // Resolve targetEntity to concrete constructor
    const te = targetEntity;
    const resolved = typeof te === 'function' && te.prototype
        ? te
        : te();
    const relationship = {
        propertyName,
        type: kind,
        targetEntity: resolved,
        foreignKey: options?.foreignKey,
        inverseSide: options?.inverseSide,
        cascade: options?.cascade || false,
        through: options?.through
    };
    MetadataStorage.addRelationship(ctor, relationship);
}
/**
 * Declares a one-to-many relationship on a collection navigation property.
 */
export function OneToMany(targetEntity, options = {}) {
    return function (target, propertyKey) {
        defineRelationship('one-to-many', targetEntity, options, target, propertyKey);
    };
}
/**
 * Declares a many-to-one relationship on a reference navigation property.
 */
export function ManyToOne(targetEntity, options = {}) {
    return function (target, propertyKey) {
        defineRelationship('many-to-one', targetEntity, options, target, propertyKey);
    };
}
/**
 * Declares a one-to-one relationship on a reference navigation property.
 */
export function OneToOne(targetEntity, options = {}) {
    return function (target, propertyKey) {
        defineRelationship('one-to-one', targetEntity, options, target, propertyKey);
    };
}
/**
 * Declares a many-to-many relationship on a collection navigation property.
 */
export function ManyToMany(targetEntity, options = {}) {
    return function (target, propertyKey) {
        defineRelationship('many-to-many', targetEntity, options, target, propertyKey);
    };
}
//# sourceMappingURL=Relationships.js.map