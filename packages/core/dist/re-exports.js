"use strict";
// Re-exports for backwards compatibility
// Users can still import from @ts-linq/core
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
exports.RetryPolicy = exports.EntityCache = exports.DiffBasedMigration = exports.MigrationRunner = exports.Migration = exports.EntityMetadata = exports.MetadataStorage = exports.ChangeTracker = exports.DbSet = exports.DbContext = exports.PredicateParser = exports.QueryBuilder = exports.Queryable = void 0;
// Query layer
var query_1 = require("@ts-linq/query");
Object.defineProperty(exports, "Queryable", { enumerable: true, get: function () { return query_1.Queryable; } });
Object.defineProperty(exports, "QueryBuilder", { enumerable: true, get: function () { return query_1.QueryBuilder; } });
Object.defineProperty(exports, "PredicateParser", { enumerable: true, get: function () { return query_1.PredicateParser; } });
// ORM layer  
var orm_1 = require("@ts-linq/orm");
Object.defineProperty(exports, "DbContext", { enumerable: true, get: function () { return orm_1.DbContext; } });
Object.defineProperty(exports, "DbSet", { enumerable: true, get: function () { return orm_1.DbSet; } });
Object.defineProperty(exports, "ChangeTracker", { enumerable: true, get: function () { return orm_1.ChangeTracker; } });
// Metadata
var metadata_1 = require("@ts-linq/metadata");
Object.defineProperty(exports, "MetadataStorage", { enumerable: true, get: function () { return metadata_1.MetadataStorage; } });
Object.defineProperty(exports, "EntityMetadata", { enumerable: true, get: function () { return metadata_1.EntityMetadata; } });
// Migrations
var migrations_1 = require("@ts-linq/migrations");
Object.defineProperty(exports, "Migration", { enumerable: true, get: function () { return migrations_1.Migration; } });
Object.defineProperty(exports, "MigrationRunner", { enumerable: true, get: function () { return migrations_1.MigrationRunner; } });
Object.defineProperty(exports, "DiffBasedMigration", { enumerable: true, get: function () { return migrations_1.DiffBasedMigration; } });
// Cache
var cache_1 = require("@ts-linq/cache");
Object.defineProperty(exports, "EntityCache", { enumerable: true, get: function () { return cache_1.EntityCache; } });
// Types
__exportStar(require("@ts-linq/types"), exports);
// Concurrency
var concurrency_1 = require("@ts-linq/concurrency");
Object.defineProperty(exports, "RetryPolicy", { enumerable: true, get: function () { return concurrency_1.RetryPolicy; } });
// Pagination
__exportStar(require("@ts-linq/pagination"), exports);
//# sourceMappingURL=re-exports.js.map