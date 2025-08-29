import { MetadataStorage } from '../metadata/MetadataStorage';
import { RelationshipMetadata } from '../types';

export interface RelationshipOptions {
    foreignKey?: string;
    inverseSide?: string;
    cascade?: boolean;
}

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
