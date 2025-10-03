"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MySqlOrderEmitter = void 0;
class MySqlOrderEmitter {
    emit(options) {
        if (!options.orderBy || options.orderBy.length === 0)
            return '';
        const orderByClauses = options.orderBy.map((o) => `${o.column} ${o.direction}`);
        return ` ORDER BY ${orderByClauses.join(', ')}`;
    }
}
exports.MySqlOrderEmitter = MySqlOrderEmitter;
//# sourceMappingURL=MySqlOrderEmitter.js.map