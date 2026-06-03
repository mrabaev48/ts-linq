import 'reflect-metadata';

import { MetadataStorage } from '@ts-linq/metadata';
import type { EntityCtor, RelationshipMetadata } from '@ts-linq/types';

/**
 * Options for configuring relationships between entities.
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

function defineRelationship(
  kind: RelationshipMetadata['type'],
  targetEntity: () => EntityCtor,
  options: RelationshipOptions,
  target: object,
  propertyKey: string | symbol
): void {
  const ctor =
    typeof target === 'function' ? target : (target as { constructor: Function }).constructor;
  const propertyName = String(propertyKey);

  const relationship: RelationshipMetadata = {
    propertyName,
    type: kind,
    targetEntity: targetEntity,
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
export function OneToMany(
  targetEntity: () => EntityCtor,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    defineRelationship('one-to-many', targetEntity, options, target, propertyKey);
  };
}

/**
 * Declares a many-to-one relationship on a reference navigation property.
 */
export function ManyToOne(
  targetEntity: () => EntityCtor,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    defineRelationship('many-to-one', targetEntity, options, target, propertyKey);
  };
}

/**
 * Declares a one-to-one relationship on a reference navigation property.
 */
export function OneToOne(
  targetEntity: () => EntityCtor,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    defineRelationship('one-to-one', targetEntity, options, target, propertyKey);
  };
}

/**
 * Declares a many-to-many relationship on a collection navigation property.
 */
export function ManyToMany(
  targetEntity: () => EntityCtor,
  options: RelationshipOptions = {}
): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol): void {
    defineRelationship('many-to-many', targetEntity, options, target, propertyKey);
  };
}
