"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MetadataStorage_1 = require("../../src/metadata/MetadataStorage");
class Log {
}
test('DatabaseFunction metadata shape (without decorator)', () => {
    MetadataStorage_1.MetadataStorage.getInstance().clear();
    MetadataStorage_1.MetadataStorage.addEntity(Log, 'Logs');
    const cols = [
        { propertyName: 'id', columnName: 'id', type: 'INTEGER', nullable: false, isGenerated: true },
        {
            propertyName: 'createdAt',
            columnName: 'created_at',
            type: 'DATETIME',
            nullable: false,
            defaultExpression: 'CURRENT_TIMESTAMP'
        }
    ];
    cols.forEach((c) => MetadataStorage_1.MetadataStorage.addColumn(Log, c));
    MetadataStorage_1.MetadataStorage.addPrimaryKey(Log, 'id');
    const meta = MetadataStorage_1.MetadataStorage.getEntity(Log);
    const col = meta.columns.find((c) => c.columnName === 'created_at');
    expect(col?.defaultExpression).toBe('CURRENT_TIMESTAMP');
});
//# sourceMappingURL=DatabaseFunction.test.js.map