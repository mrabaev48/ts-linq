"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MetadataStorage_1 = require("../../src/metadata/MetadataStorage");
class User {
}
describe('ComputedColumn metadata registration', () => {
    test('stores computed column flags and expression in metadata', () => {
        MetadataStorage_1.MetadataStorage.getInstance().clear();
        MetadataStorage_1.MetadataStorage.addEntity(User, 'Users');
        const cols = [
            { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
            { propertyName: 'name', columnName: 'name', type: 'TEXT', nullable: false },
            {
                propertyName: 'nameLength',
                columnName: 'name_len',
                type: 'INTEGER',
                nullable: true,
                isComputed: true,
                computedExpression: 'length(name)'
            }
        ];
        cols.forEach((c) => MetadataStorage_1.MetadataStorage.addColumn(User, c));
        MetadataStorage_1.MetadataStorage.addPrimaryKey(User, 'id');
        const meta = MetadataStorage_1.MetadataStorage.getEntity(User);
        expect(meta).toBeDefined();
        const cc = meta.columns.find((c) => c.propertyName === 'nameLength');
        expect(cc?.isComputed).toBe(true);
        expect(cc?.computedExpression).toBe('length(name)');
    });
});
//# sourceMappingURL=ComputedColumn.test.js.map