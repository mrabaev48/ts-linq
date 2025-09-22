"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidIf = ValidIf;
require("reflect-metadata");
function isStage3FieldContext(x) {
    return !!x && typeof x === 'object' && x.kind === 'field' && 'name' in x;
}
function ValidIf(predicate, message) {
    return function ValidIfDecorator(_targetOrValue, propOrContext) {
        if (!isStage3FieldContext(propOrContext)) {
            throw new Error('@ValidIf requires TS5 Stage-3 decorators');
        }
        const ctx = propOrContext;
        const name = ctx.name.toString();
        ctx.addInitializer?.(function () {
            const ctor = this?.constructor;
            if (!ctor)
                return;
            const existing = Reflect.getOwnMetadata('orm:validations', ctor) || [];
            existing.push({ propertyName: name, predicate, message });
            Reflect.defineMetadata('orm:validations', existing, ctor);
        });
    };
}
//# sourceMappingURL=ValidIf.js.map