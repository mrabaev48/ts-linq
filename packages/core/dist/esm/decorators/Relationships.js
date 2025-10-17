import { MetadataStorage } from '../metadata/MetadataStorage';
function isStage3FieldContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
function defineRelationship(kind, targetEntity, options, targetOrValue, propOrContext) {
    // Stage-3 field decorator path only
    if (isStage3FieldContext(propOrContext)) {
        const ctx = propOrContext;
        const name = ctx.name.toString();
        ctx.addInitializer?.(function () {
            const ctor = this?.constructor;
            if (!ctor)
                return;
            // Resolve targetEntity immediately to concrete ctor to avoid anonymous thunks in tests
            const te = targetEntity;
            const resolved = typeof te === 'function' && te.prototype
                ? te
                : te();
            const relationship = {
                propertyName: name,
                type: kind,
                targetEntity: resolved,
                foreignKey: options?.foreignKey,
                inverseSide: options?.inverseSide,
                cascade: options?.cascade || false,
                through: options?.through
            };
            MetadataStorage.addRelationship(ctor, relationship);
        });
        return;
    }
    throw new Error('Relationship decorators require TS5 Stage-3 decorators');
}
/**
 * Declares a one-to-many relationship on a collection navigation property.
 */
export function OneToMany(targetEntity, options = {}) {
    return function (targetOrValue, propOrContext) {
        defineRelationship('one-to-many', targetEntity, options, targetOrValue, propOrContext);
    };
}
/**
 * Declares a many-to-one relationship on a reference navigation property.
 */
export function ManyToOne(targetEntity, options = {}) {
    return function (targetOrValue, propOrContext) {
        defineRelationship('many-to-one', targetEntity, options, targetOrValue, propOrContext);
    };
}
/**
 * Declares a one-to-one relationship on a reference navigation property.
 */
export function OneToOne(targetEntity, options = {}) {
    return function (targetOrValue, propOrContext) {
        defineRelationship('one-to-one', targetEntity, options, targetOrValue, propOrContext);
    };
}
/**
 * Declares a many-to-many relationship on a collection navigation property.
 */
export function ManyToMany(targetEntity, options = {}) {
    return function (targetOrValue, propOrContext) {
        defineRelationship('many-to-many', targetEntity, options, targetOrValue, propOrContext);
    };
}
//# sourceMappingURL=Relationships.js.map