"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapPgError = mapPgError;
const core_1 = require("@ts-linq/core");
function mapPgError(err) {
    const anyErr = err;
    const code = anyErr?.code;
    const message = anyErr?.message || String(err);
    if (code === '23505')
        return new core_1.UniqueConstraintError(message, code);
    if (code === '23503')
        return new core_1.ForeignKeyConstraintError(message, code);
    return new core_1.DatabaseError(message, code);
}
//# sourceMappingURL=ErrorMapper.js.map