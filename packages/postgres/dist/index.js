"use strict";
/**
 * PostgreSQL database provider for ts-linq ORM
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDialect = exports.PostgresProvider = void 0;
// PostgreSQL-specific exports
/**
 * @deprecated Use `PostgresProvider` from `@ts-linq/provider-pg` instead.
 */
var provider_pg_1 = require("@ts-linq/provider-pg");
Object.defineProperty(exports, "PostgresProvider", { enumerable: true, get: function () { return provider_pg_1.PostgresProvider; } });
/**
 * @deprecated Use `PostgresDialect` from `@ts-linq/dialect-postgres` instead.
 */
var dialect_postgres_1 = require("@ts-linq/dialect-postgres");
Object.defineProperty(exports, "PostgresDialect", { enumerable: true, get: function () { return dialect_postgres_1.PostgresDialect; } });
__exportStar(require("./PostgresDdlStrategy"), exports);
//# sourceMappingURL=index.js.map