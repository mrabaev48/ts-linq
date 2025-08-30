import { MetadataStorage } from '../metadata/MetadataStorage';
import { RelationshipMetadata } from '../types';

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

/**
 * Declares a one-to-many relationship on a collection navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
export function OneToMany(targetEntity: () => Function, options: RelationshipOptions = {}): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const propertyName = propertyKey.toString();
        
        const relationship: RelationshipMetadata = {
            propertyName,
            type: 'one-to-many',
            targetEntity: targetEntity,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false
        };

        MetadataStorage.addRelationship(target.constructor, relationship);
    };
}

/**
 * Declares a many-to-one relationship on a reference navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
export function ManyToOne(targetEntity: () => Function, options: RelationshipOptions = {}): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const propertyName = propertyKey.toString();
        
        const relationship: RelationshipMetadata = {
            propertyName,
            type: 'many-to-one',
            targetEntity: targetEntity,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false
        };

        MetadataStorage.addRelationship(target.constructor, relationship);
    };
}

/**
 * Declares a one-to-one relationship on a reference navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
export function OneToOne(targetEntity: () => Function, options: RelationshipOptions = {}): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const propertyName = propertyKey.toString();
        
        const relationship: RelationshipMetadata = {
            propertyName,
            type: 'one-to-one',
            targetEntity: targetEntity,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false
        };

        MetadataStorage.addRelationship(target.constructor, relationship);
    };
}

/**
 * Declares a many-to-many relationship on a collection navigation property.
 *
 * @param targetEntity Function returning the target entity constructor.
 * @param options Relationship configuration options.
 * @returns Property decorator marking the relationship.
 */
export function ManyToMany(targetEntity: () => Function, options: RelationshipOptions = {}): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const propertyName = propertyKey.toString();
        
        const relationship: RelationshipMetadata = {
            propertyName,
            type: 'many-to-many',
            targetEntity: targetEntity,
            foreignKey: options?.foreignKey,
            inverseSide: options?.inverseSide,
            cascade: options?.cascade || false
        };

        MetadataStorage.addRelationship(target.constructor, relationship);
    };
}
