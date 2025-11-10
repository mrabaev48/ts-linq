import { MetadataStorage } from './MetadataStorage';
/**
 * Declares a one-to-many relationship on a collection navigation property.
 */
export function OneToMany(targetEntity, options = {}) {
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
        MetadataStorage.addRelationship(ctor, relationship);
    };
}
/**
 * Declares a many-to-one relationship on a reference navigation property.
 */
export function ManyToOne(targetEntity, options = {}) {
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
        MetadataStorage.addRelationship(ctor, relationship);
    };
}
/**
 * Declares a one-to-one relationship on a reference navigation property.
 */
export function OneToOne(targetEntity, options = {}) {
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
        MetadataStorage.addRelationship(ctor, relationship);
    };
}
/**
 * Declares a many-to-many relationship on a collection navigation property.
 */
export function ManyToMany(targetEntity, options = {}) {
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
        MetadataStorage.addRelationship(ctor, relationship);
    };
}
//# sourceMappingURL=Relationships.js.map