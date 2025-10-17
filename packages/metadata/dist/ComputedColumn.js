"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComputedColumn = ComputedColumn;
const MetadataStorage_1 = require("../metadata/MetadataStorage");
function isStage3FieldContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
function ComputedColumn(options) {
    return function ComputedColumnDecorator(_targetOrValue, propOrContext) {
        if (!isStage3FieldContext(propOrContext)) {
            throw new Error('@ComputedColumn requires TS5 Stage-3 decorators');
        }
        const ctx = propOrContext;
        const name = ctx.name.toString();
        ctx.addInitializer?.(function () {
            const ctor = this?.constructor;
            if (!ctor)
                return;
            const columnMetadata = {
                propertyName: name,
                columnName: options?.name || name,
                type: 'TEXT',
                nullable: true,
                isGenerated: false,
                isVersion: false,
                isComputed: true,
                computedExpression: options.expression
            };
            MetadataStorage_1.MetadataStorage.addColumn(ctor, columnMetadata);
        });
    };
}
//# sourceMappingURL=ComputedColumn.js.map