import { MetadataStorage } from './MetadataStorage';
import type { RelationshipMetadata } from '@ts-linq/types';

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
  through?: {
    table: string;
    sourceFk?: string;
    targetFk?: string;
    sourcePk?: string;
    targetPk?: string;
  };
}

/**
 * Declares a one-to-many relationship on a collection navigation property.
 */
export function OneToMany(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const name = propertyKey.toString();
    const ctor =
      typeof target === 'function' ? target : (target as { constructor: Function }).constructor;
    
    // Resolve targetEntity thunk
    // Start of fix: defer resolution to avoid circular dependency TDZ issues
    const resolved = targetEntity; // Store function itself
    // End of fix
    
    const relationship: RelationshipMetadata = {
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
export function ManyToOne(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const name = propertyKey.toString();
    const ctor =
      typeof target === 'function' ? target : (target as { constructor: Function }).constructor;
    
    let resolved;
    try {
        resolved = targetEntity();
    } catch (e) {
        resolved = targetEntity;
    }
    
    const relationship: RelationshipMetadata = {
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
export function OneToOne(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const name = propertyKey.toString();
    const ctor =
      typeof target === 'function' ? target : (target as { constructor: Function }).constructor;
    
    const resolved = targetEntity();
    
    const relationship: RelationshipMetadata = {
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
export function ManyToMany(
  targetEntity: () => Function,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    const name = propertyKey.toString();
    const ctor =
      typeof target === 'function' ? target : (target as { constructor: Function }).constructor;
    
    const resolved = targetEntity();
    
    const relationship: RelationshipMetadata = {
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
