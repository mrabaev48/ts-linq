import { MetadataStorage } from '../metadata/MetadataStorage';
import { ColumnMetadata } from '../types';

export interface ColumnOptions {
    name?: string;
    type?: string;
    nullable?: boolean;
    defaultValue?: any;
    length?: number;
    precision?: number;
    scale?: number;
    generated?: boolean;
}

export function Column(options: ColumnOptions = {}): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const propertyName = propertyKey.toString();
        
        // Get the design type using reflect-metadata
        const designType = Reflect.getMetadata('design:type', target, propertyKey);
        
        const columnMetadata: ColumnMetadata = {
            propertyName,
            columnName: options?.name || propertyName,
            type: options?.type || getTypeString(designType),
            nullable: options?.nullable !== false,
            defaultValue: options?.defaultValue,
            length: options?.length,
            precision: options?.precision,
            scale: options?.scale,
            isGenerated: options?.generated || false
        };

        MetadataStorage.addColumn(target.constructor, columnMetadata);
    };
}

function getTypeString(type: any): string {
    if (!type) return 'TEXT';
    
    switch (type.name) {
        case 'String':
            return 'TEXT';
        case 'Number':
            return 'INTEGER';
        case 'Boolean':
            return 'BOOLEAN';
        case 'Date':
            return 'DATETIME';
        case 'Array':
            return 'TEXT'; // Store as JSON
        case 'Object':
            return 'TEXT'; // Store as JSON
        default:
            return 'TEXT';
    }
}
