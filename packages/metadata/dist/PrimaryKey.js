"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimaryKey = PrimaryKey;
const MetadataStorage_1 = require("./MetadataStorage");
function isStage3FieldContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
function PrimaryKey(options = {}) {
    return function PrimaryKeyDecorator(_targetOrValue, propOrContext) {
        if (!isStage3FieldContext(propOrContext)) {
            throw new Error('@PrimaryKey requires TS5 Stage-3 decorators');
        }
        const ctx = propOrContext;
        const name = ctx.name.toString();
        ctx.addInitializer?.(function () {
            const ctor = this?.constructor;
            if (!ctor)
                return;
            const columnMeta = {
                propertyName: name,
                columnName: options?.name || name,
                type: options?.type || 'INTEGER',
                nullable: false,
                isGenerated: !!options?.autoIncrement,
                isVersion: !!options?.version
            };
            MetadataStorage_1.MetadataStorage.addColumn(ctor, columnMeta);
            MetadataStorage_1.MetadataStorage.addPrimaryKey(ctor, name);
            if (options.branded) {
                const meta = MetadataStorage_1.MetadataStorage.getEntity(ctor);
                const col = meta?.columns.find((c) => c.propertyName === name);
                if (col) {
                    col.isBranded = true;
                    col.brand = ctor.name;
                }
            }
        });
    };
}
//# sourceMappingURL=PrimaryKey.js.map