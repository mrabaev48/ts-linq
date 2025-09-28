'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.OneToMany = OneToMany;
exports.ManyToOne = ManyToOne;
exports.OneToOne = OneToOne;
exports.ManyToMany = ManyToMany;
require('reflect-metadata');
const MetadataStorage_1 = require('../metadata/MetadataStorage');
function isStage3FieldContext(x) {
  return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
function defineRelationship(kind, targetEntity, options, targetOrValue, propOrContext) {
  // Stage-3 field decorator path
  if (isStage3FieldContext(propOrContext)) {
    const ctx = propOrContext;
    const name = ctx.name.toString();
    ctx.addInitializer?.(function () {
      const ctor = this?.constructor;
      if (!ctor) return;
      const relationship = {
        propertyName: name,
        type: kind,
        targetEntity,
        foreignKey: options?.foreignKey,
        inverseSide: options?.inverseSide,
        cascade: options?.cascade || false
      };
      MetadataStorage_1.MetadataStorage.addRelationship(ctor, relationship);
      const existing = Reflect.getOwnMetadata('orm:relationships', ctor) || [];
      existing.push(relationship);
      Reflect.defineMetadata('orm:relationships', existing, ctor);
    });
    return;
  }
  // Legacy fallback
  const target = targetOrValue;
  const propertyKey = propOrContext;
  const propertyName = propertyKey.toString();
  const relationship = {
    propertyName,
    type: kind,
    targetEntity,
    foreignKey: options?.foreignKey,
    inverseSide: options?.inverseSide,
    cascade: options?.cascade || false
  };
  MetadataStorage_1.MetadataStorage.addRelationship(target.constructor, relationship);
  const ctor = target.constructor;
  const existing = Reflect.getOwnMetadata('orm:relationships', ctor) || [];
  existing.push(relationship);
  Reflect.defineMetadata('orm:relationships', existing, ctor);
}
/**
 * Declares a one-to-many relationship on a collection navigation property.
 */
function OneToMany(targetEntity, options = {}) {
  return function (targetOrValue, propOrContext) {
    return defineRelationship('one-to-many', targetEntity, options, targetOrValue, propOrContext);
  };
}
/**
 * Declares a many-to-one relationship on a reference navigation property.
 */
function ManyToOne(targetEntity, options = {}) {
  return function (targetOrValue, propOrContext) {
    return defineRelationship('many-to-one', targetEntity, options, targetOrValue, propOrContext);
  };
}
/**
 * Declares a one-to-one relationship on a reference navigation property.
 */
function OneToOne(targetEntity, options = {}) {
  return function (targetOrValue, propOrContext) {
    return defineRelationship('one-to-one', targetEntity, options, targetOrValue, propOrContext);
  };
}
/**
 * Declares a many-to-many relationship on a collection navigation property.
 */
function ManyToMany(targetEntity, options = {}) {
  return function (targetOrValue, propOrContext) {
    return defineRelationship('many-to-many', targetEntity, options, targetOrValue, propOrContext);
  };
}
//# sourceMappingURL=Relationships.js.map
