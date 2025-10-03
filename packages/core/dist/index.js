"use strict";
/**
 * Core ORM exports - types, decorators, metadata, context, query building,
 * change tracking, loading utilities, and base provider abstractions.
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
// Core types
__exportStar(require("./types"), exports);
__exportStar(require("./types/Logger"), exports);
// Decorators
__exportStar(require("./decorators/Entity"), exports);
__exportStar(require("./decorators/Column"), exports);
__exportStar(require("./decorators/PrimaryKey"), exports);
__exportStar(require("./decorators/Relationships"), exports);
__exportStar(require("./decorators/ValidIf"), exports);
// Metadata
__exportStar(require("./metadata/MetadataStorage"), exports);
__exportStar(require("./metadata/EntityMetadata"), exports);
// Change tracking
__exportStar(require("./change-tracking/ChangeTracker"), exports);
// Context and DbSet
__exportStar(require("./context/DbContext"), exports);
__exportStar(require("./context/DbSet"), exports);
// Query building
__exportStar(require("./query/Queryable"), exports);
__exportStar(require("./query/TypedQueryable"), exports);
__exportStar(require("./query/QueryBuilder"), exports);
__exportStar(require("./query/SqlCache"), exports);
__exportStar(require("./query/EnhancedSqlCache"), exports);
__exportStar(require("./query/SqlDialect"), exports);
__exportStar(require("./query/CountCache"), exports);
__exportStar(require("./query/GlobalFilterApplier"), exports);
__exportStar(require("./query/JoinPredicateParser"), exports);
__exportStar(require("./query/QueryModel"), exports);
__exportStar(require("@ts-linq/ast"), exports);
__exportStar(require("./query/ast/SqlVisitor"), exports);
__exportStar(require("./query/SqlFunctions"), exports);
// Base provider abstractions
__exportStar(require("./DatabaseProvider"), exports);
__exportStar(require("./DdlStrategy"), exports);
__exportStar(require("./DdlBuilder"), exports);
// Loading
__exportStar(require("./loading/LoadingStrategy"), exports);
__exportStar(require("./loading/EntityLoader"), exports);
__exportStar(require("./loading/LazyLoadingProxy"), exports);
// Migrations
__exportStar(require("./migrations/Migration"), exports);
__exportStar(require("./migrations/MigrationRunner"), exports);
__exportStar(require("./migrations/DiffTypes"), exports);
__exportStar(require("./migrations/DialectMigrationSql"), exports);
__exportStar(require("./migrations/MigrationBuilder"), exports);
__exportStar(require("./migrations/DiffBasedMigration"), exports);
__exportStar(require("./migrations/MigrationFileBuilder"), exports);
__exportStar(require("./migrations/DiffMigrationGenerator"), exports);
__exportStar(require("./migrations/SchemaSnapshot"), exports);
// Utils
__exportStar(require("./utils/SqlHelper"), exports);
__exportStar(require("./utils/RetryPolicies"), exports);
__exportStar(require("./utils/EntityCache"), exports);
//# sourceMappingURL=index.js.map