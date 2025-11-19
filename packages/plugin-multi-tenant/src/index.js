"use strict";
/**
 * @ts-linq/plugin-multi-tenant
 *
 * Plugin for multi-tenant functionality in TypeScript ORM
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTenantId = exports.hasTenantColumn = exports.getTenantId = exports.createTenantScope = exports.withTenant = exports.MultiTenantMiddleware = void 0;
var MultiTenantMiddleware_1 = require("./MultiTenantMiddleware");
Object.defineProperty(exports, "MultiTenantMiddleware", { enumerable: true, get: function () { return MultiTenantMiddleware_1.MultiTenantMiddleware; } });
var utils_1 = require("./utils");
Object.defineProperty(exports, "withTenant", { enumerable: true, get: function () { return utils_1.withTenant; } });
Object.defineProperty(exports, "createTenantScope", { enumerable: true, get: function () { return utils_1.createTenantScope; } });
Object.defineProperty(exports, "getTenantId", { enumerable: true, get: function () { return utils_1.getTenantId; } });
Object.defineProperty(exports, "hasTenantColumn", { enumerable: true, get: function () { return utils_1.hasTenantColumn; } });
Object.defineProperty(exports, "setTenantId", { enumerable: true, get: function () { return utils_1.setTenantId; } });
//# sourceMappingURL=index.js.map