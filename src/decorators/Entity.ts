import { MetadataStorage } from '../metadata/MetadataStorage';

export interface EntityOptions {
    name?: string;
}

export function Entity(options: EntityOptions = {}): ClassDecorator {
    return function (target: Function) {
        const tableName = options?.name || target.name;
        MetadataStorage.addEntity(target, tableName);
    };
}
