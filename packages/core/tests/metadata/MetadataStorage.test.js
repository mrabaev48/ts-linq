"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MetadataStorage_1 = require("../../src/metadata/MetadataStorage");
const types_1 = require("../../src/types");
class T {
}
test('throws ValidationError when both defaultExpression and defaultValue are set', () => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    MetadataStorage_1.MetadataStorage.addEntity(T, 'T');
    const bad = {
        propertyName: 'x',
        columnName: 'x',
        type: 'INTEGER',
        nullable: false,
        defaultValue: 1,
        defaultExpression: 'CURRENT_TIMESTAMP'
    };
    expect(() => MetadataStorage_1.MetadataStorage.addColumn(T, bad)).toThrow(types_1.ValidationError);
});
test('addIndex validates duplicate name and column existence', () => {
    class User {
    }
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    MetadataStorage_1.MetadataStorage.addEntity(User, 'Users');
    const idCol = {
        propertyName: 'id',
        columnName: 'id',
        type: 'INTEGER',
        nullable: false
    };
    MetadataStorage_1.MetadataStorage.addColumn(User, idCol);
    // Unknown column should fail
    expect(() => {
        const badIdx = {
            name: 'idx_unknown',
            columns: ['missing'],
            unique: false
        };
        MetadataStorage_1.MetadataStorage.addIndex(User, badIdx);
    }).toThrow(types_1.ValidationError);
    // Valid index
    const okIdx = {
        name: 'idx_id',
        columns: ['id'],
        unique: false
    };
    MetadataStorage_1.MetadataStorage.addIndex(User, okIdx);
    // Duplicate name should fail
    expect(() => {
        const dupIdx = {
            name: 'idx_id',
            columns: ['id'],
            unique: false
        };
        MetadataStorage_1.MetadataStorage.addIndex(User, dupIdx);
    }).toThrow(types_1.ValidationError);
});
//# sourceMappingURL=MetadataStorage.test.js.map