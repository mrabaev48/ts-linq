"use strict";
/**
 * @ts-linq/plugin-audit
 *
 * Plugin for audit trail functionality in TypeScript ORM
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeSinceUpdate = exports.hasBeenModified = exports.getAuditInfo = exports.withAudit = exports.AuditMiddleware = void 0;
var AuditMiddleware_1 = require("./AuditMiddleware");
Object.defineProperty(exports, "AuditMiddleware", { enumerable: true, get: function () { return AuditMiddleware_1.AuditMiddleware; } });
var utils_1 = require("./utils");
Object.defineProperty(exports, "withAudit", { enumerable: true, get: function () { return utils_1.withAudit; } });
Object.defineProperty(exports, "getAuditInfo", { enumerable: true, get: function () { return utils_1.getAuditInfo; } });
Object.defineProperty(exports, "hasBeenModified", { enumerable: true, get: function () { return utils_1.hasBeenModified; } });
Object.defineProperty(exports, "timeSinceUpdate", { enumerable: true, get: function () { return utils_1.timeSinceUpdate; } });
//# sourceMappingURL=index.js.map