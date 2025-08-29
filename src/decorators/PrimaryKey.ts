import { MetadataStorage } from '../metadata/MetadataStorage';
import { Column, ColumnOptions } from './Column';

export interface PrimaryKeyOptions extends ColumnOptions {
    autoIncrement?: boolean;
}

export function PrimaryKey(options: PrimaryKeyOptions = {}): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const propertyName = propertyKey.toString();
        
        // Add as column first
        const columnOptions: ColumnOptions = {
            ...options,
            nullable: false,
            generated: options?.autoIncrement
        };
        
        Column(columnOptions)(target, propertyKey);
        
        // Then add as primary key
        MetadataStorage.addPrimaryKey(target.constructor, propertyName);
    };
}
