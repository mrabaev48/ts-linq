"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimaryKey = PrimaryKey;
const MetadataStorage_1 = require("../metadata/MetadataStorage");
const Column_1 = require("./Column");
/**
 * Property decorator that marks a property as the primary key.
 *
 * This decorator first registers the property as a non-nullable column and optionally
 * marks it as generated (auto-increment), then records the primary key metadata.
 *
 * @param options Primary key configuration options.
 * @returns A property decorator.
 */
function PrimaryKey(options = {}) {
    return function (target, propertyKey) {
        const propertyName = propertyKey.toString();
        // Add as column first
        const columnOptions = {
            ...options,
            nullable: false,
            generated: options?.autoIncrement
        };
        (0, Column_1.Column)(columnOptions)(target, propertyKey);
        // Then add as primary key
        MetadataStorage_1.MetadataStorage.addPrimaryKey(target.constructor, propertyName);
        // Persist PK for rehydration
        const ctor = target.constructor;
        const existing = Reflect.getOwnMetadata('orm:primaryKeys', ctor) || [];
        if (!existing.includes(propertyName)) {
            existing.push(propertyName);
        }
        Reflect.defineMetadata('orm:primaryKeys', existing, ctor);
    };
}
//# sourceMappingURL=PrimaryKey.js.map