"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MssqlOrderEmitter = void 0;
class MssqlOrderEmitter {
    emit(options) {
        if (!options.orderBy || options.orderBy.length === 0)
            return '';
        const orderByClauses = options.orderBy.map((o) => `${o.column} ${o.direction}`);
        return ` ORDER BY ${orderByClauses.join(', ')}`;
    }
}
exports.MssqlOrderEmitter = MssqlOrderEmitter;
//# sourceMappingURL=MssqlOrderEmitter.js.map