"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entity = Entity;
const MetadataStorage_1 = require("./MetadataStorage");
/**
 * Class decorator that registers a class as a database entity (table).
 * Uses legacy TypeScript decorators (experimentalDecorators: true).
 */
function Entity(options = {}) {
    return function (target) {
        const tableName = options?.name || target.name;
        MetadataStorage_1.MetadataStorage.addEntity(target, tableName);
        return target;
    };
}
//# sourceMappingURL=Entity.js.map