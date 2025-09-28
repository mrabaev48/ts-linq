import 'reflect-metadata';
import { MetadataStorage } from '../metadata/MetadataStorage';
import type { RelationshipMetadata } from '../types';

/**
 * Options for configuring relationships between entities.
 *
 * - foreignKey: Column name on the dependent side used as the foreign key.
 * - inverseSide: Name of the property on the related entity that points back.
 * - cascade: Whether related operations should cascade (insert/update/delete).
 */
export interface RelationshipOptions {
  foreignKey?: string;
  inverseSide?: string;
  cascade?: boolean;
}

function isStage3FieldContext(x: unknown): x is {
  kind: 'field';
  name: string | symbol;
  addInitializer?: (fn: (this: unknown) => void) => void;
} {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'field' && 'name' in x;
}

function defineRelationship(
  kind: RelationshipMetadata['type'],
  targetEntity: () => Function,
  options: RelationshipOptions,
  targetOrValue: unknown,
  propOrContext: unknown
): void | PropertyDecorator {
  // Stage-3 field decorator path
  if (isStage3FieldContext(propOrContext)) {
    const ctx = propOrContext;
    const name = ctx.name.toString();
    ctx.addInitializer?.(function (this: unknown) {
      const ctor = (this as { constructor?: Function })?.constructor;
      if (!ctor) return;
      const relationship: RelationshipMetadata = {
        propertyName: name,
        type: kind,
        targetEntity,
        foreignKey: options?.foreignKey,
        inverseSide: options?.inverseSide,
        cascade: options?.cascade || false
      };
      MetadataStorage.addRelationship(ctor, relationship);
      const existing: RelationshipMetadata[] =
        Reflect.getOwnMetadata('orm:relationships', ctor) || [];
      existing.push(relationship);
      Reflect.defineMetadata('orm:relationships', existing, ctor);
    });
    return;
  }
  // Legacy fallback
  const target = targetOrValue as object;
  const propertyKey = propOrContext as string | symbol;
  const propertyName = propertyKey.toString();
  const relationship: RelationshipMetadata = {
    propertyName,
    type: kind,
    targetEntity,
    foreignKey: options?.foreignKey,
    inverseSide: options?.inverseSide,
    cascade: options?.cascade || false
  };
  MetadataStorage.addRelationship((target as { constructor: Function }).constructor, relationship);
  const ctor = (target as { constructor: Function }).constructor;
  const existing: RelationshipMetadata[] = Reflect.getOwnMetadata('orm:relationships', ctor) || [];
  existing.push(relationship);
  Reflect.defineMetadata('orm:relationships', existing, ctor);
}

/**
 * Declares a one-to-many relationship on a collection navigation property.
 */
export function OneToMany(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (targetOrValue: unknown, propOrContext: unknown) {
    return defineRelationship(
      'one-to-many',
      targetEntity,
      options,
      targetOrValue,
      propOrContext
    ) as any;
  };
}

/**
 * Declares a many-to-one relationship on a reference navigation property.
 */
export function ManyToOne(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (targetOrValue: unknown, propOrContext: unknown) {
    return defineRelationship(
      'many-to-one',
      targetEntity,
      options,
      targetOrValue,
      propOrContext
    ) as any;
  };
}

/**
 * Declares a one-to-one relationship on a reference navigation property.
 */
export function OneToOne(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (targetOrValue: unknown, propOrContext: unknown) {
    return defineRelationship(
      'one-to-one',
      targetEntity,
      options,
      targetOrValue,
      propOrContext
    ) as any;
  };
}

/**
 * Declares a many-to-many relationship on a collection navigation property.
 */
export function ManyToMany(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (targetOrValue: unknown, propOrContext: unknown) {
    return defineRelationship(
      'many-to-many',
      targetEntity,
      options,
      targetOrValue,
      propOrContext
    ) as any;
  };
}
