"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexOptionsBuilder = void 0;
exports.normalizeIndexOptions = normalizeIndexOptions;
exports.Index = Index;
require("reflect-metadata");
const IndexOptionsBuilder_1 = require("../utils/IndexOptionsBuilder");
var IndexOptionsBuilder_2 = require("../utils/IndexOptionsBuilder");
Object.defineProperty(exports, "IndexOptionsBuilder", { enumerable: true, get: function () { return IndexOptionsBuilder_2.IndexOptionsBuilder; } });
function isStage3ClassContext(x) {
    return !!x && typeof x === 'object';
}
function normalizeIndexOptions(input) {
    const built = input instanceof IndexOptionsBuilder_1.IndexOptionsBuilder ? input.build() : {
        name: input.name,
        columns: input.columns,
        unique: input.unique ?? false,
        where: input.where,
        orders: input.orders,
        expressions: input.expressions,
        collations: input.collations,
        nulls: input.nulls,
        using: input.using,
        concurrently: input.concurrently,
        withParams: input.withParams,
        mysqlVisibility: input.mysqlVisibility,
        include: input.include
    };
    return built;
}
function Index(options) {
    return function IndexDecorator(_target, context) {
        if (context.kind !== 'class') {
            throw new Error('@Index requires TS5 Stage-3 decorators');
        }
        context.addInitializer?.(function () {
            const ctor = this;
            if (!ctor)
                return;
            const meta = normalizeIndexOptions(options);
            const existing = Reflect.getOwnMetadata('orm:indexes', ctor) || [];
            existing.push(meta);
            Reflect.defineMetadata('orm:indexes', existing, ctor);
        });
    };
}
// no re-exports from here
//# sourceMappingURL=index.js.map